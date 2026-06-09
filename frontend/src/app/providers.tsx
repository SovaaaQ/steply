import {
  createContext,
  FormEvent,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import { authApi } from "../services/authApi";
import { clearToken, getStoredToken, storeToken } from "../services/apiClient";
import { dashboardApi } from "../services/dashboardApi";
import { dayApi } from "../services/dayApi";
import { gamificationApi } from "../services/gamificationApi";
import { habitsApi } from "../services/habitsApi";
import { recommendationsApi } from "../services/recommendationsApi";
import { getOnboardingStatus, setOnboardingStatus } from "./onboardingStorage";
import { useSectionRouter } from "./useSectionRouter";
import type { AuthResponse, PetType, User } from "../types/auth";
import type { EntryStatus, Habit, HabitEntry, HabitFormState } from "../types/habit";
import type { Prediction, Recommendation } from "../types/recommendation";
import type { HabitStats, Summary } from "../types/statistics";
import type { GamificationSummary, RewardPreview } from "../types/gamification";
import type { AppSection } from "../types/navigation";
import { formatLocalDate } from "../utils/formatDate";
import { buildHabitPayload, defaultHabitForm, weekdayKeys } from "../utils/habitForm";
import { getHabitScheduleAvailability } from "../utils/habitSchedule";
import { emptyGamificationSummary } from "../utils/gamification";
import { emptySummary } from "../utils/risk";

interface AppDataContextValue {
  token: string | null;
  activeSection: AppSection;
  setActiveSection: (section: AppSection) => void;
  user: User | null;
  habits: Habit[];
  activeHabits: Habit[];
  habitsForToday: Habit[];
  summary: Summary;
  predictions: Record<number, Prediction>;
  habitStats: Record<number, HabitStats>;
  habitEntries: Record<number, HabitEntry[]>;
  recommendations: Recommendation[];
  gamification: GamificationSummary;
  todayISO: string;
  completedToday: number;
  todayProgress: number;
  recommendationOfDay?: Recommendation;
  error: string;
  notice: string;
  noticeDetail: string;
  noticeReward?: RewardPreview;
  isLoading: boolean;
  isOnboardingOpen: boolean;
  isHabitFormOpen: boolean;
  isSubmitting: boolean;
  habitForm: HabitFormState;
  setHabitForm: React.Dispatch<React.SetStateAction<HabitFormState>>;
  editingHabitId: number | null;
  handleAuth: (response: AuthResponse, options?: { isNewRegistration?: boolean }) => void;
  login: (payload: { email: string; password: string }) => Promise<AuthResponse>;
  register: (payload: { email: string; full_name: string; password: string }) => Promise<AuthResponse>;
  logout: () => void;
  loadDashboard: () => Promise<void>;
  openHabitCreator: () => void;
  closeHabitForm: () => void;
  resetHabitForm: () => void;
  submitHabit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  startEditHabit: (habit: Habit) => void;
  markHabit: (habitId: number, status: EntryStatus) => Promise<void>;
  updatePet: (payload: { pet_type: PetType; pet_name: string }) => Promise<void>;
  completeOnboarding: () => void;
  deleteHabit: (habitId: number) => Promise<void>;
  refreshRecommendations: () => Promise<void>;
  markRecommendationRead: (recommendationId: number) => Promise<void>;
  getTodayEntry: (habitId: number) => HabitEntry | undefined;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

interface AuthDataContextValue {
  token: string | null;
  user: User | null;
  handleAuth: (response: AuthResponse, options?: { isNewRegistration?: boolean }) => void;
  login: (payload: { email: string; password: string }) => Promise<AuthResponse>;
  register: (payload: { email: string; full_name: string; password: string }) => Promise<AuthResponse>;
  logout: () => void;
}

const AuthDataContext = createContext<AuthDataContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(getStoredToken());
  const { activeSection, setActiveSection } = useSectionRouter();
  const [user, setUser] = useState<User | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [summary, setSummary] = useState<Summary>(emptySummary);
  const [predictions, setPredictions] = useState<Record<number, Prediction>>({});
  const [habitStats, setHabitStats] = useState<Record<number, HabitStats>>({});
  const [habitEntries, setHabitEntries] = useState<Record<number, HabitEntry[]>>({});
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [gamification, setGamification] = useState<GamificationSummary>(emptyGamificationSummary);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeDetail, setNoticeDetail] = useState("");
  const [noticeReward, setNoticeReward] = useState<RewardPreview | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isHabitFormOpen, setIsHabitFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<number | null>(null);
  const [habitForm, setHabitForm] = useState<HabitFormState>(defaultHabitForm);
  const [now, setNow] = useState(() => new Date());

  const todayISO = formatLocalDate(now);

  const activeHabits = useMemo(() => habits.filter((habit) => habit.is_active), [habits]);

  const habitsForToday = useMemo(
    () =>
      activeHabits.filter((habit) => {
        const availability = getHabitScheduleAvailability(
          habit,
          now,
          (habitEntries[habit.id]?.length ?? 0) > 0
        );
        const isCompletedToday = habitEntries[habit.id]?.some(
          (entry) =>
            entry.entry_date === todayISO &&
            (entry.status === "completed" || entry.status === "recovery_completed")
        );

        return availability.isAvailableToday || (availability.isScheduledToday && isCompletedToday);
      }),
    [activeHabits, habitEntries, now, todayISO]
  );

  const completedToday = useMemo(
    () =>
      habitsForToday.filter((habit) =>
        habitEntries[habit.id]?.some(
          (entry) =>
            entry.entry_date === todayISO &&
            (entry.status === "completed" || entry.status === "recovery_completed")
        )
      ).length,
    [habitEntries, habitsForToday, todayISO]
  );

  const todayProgress = habitsForToday.length ? completedToday / habitsForToday.length : 0;

  const recommendationOfDay = useMemo(
    () =>
      [...recommendations]
        .filter((recommendation) => {
          if (!recommendation.habit_id) {
            return true;
          }

          return !habitEntries[recommendation.habit_id]?.some(
            (entry) =>
              entry.entry_date === todayISO &&
              (entry.status === "completed" || entry.status === "recovery_completed")
          );
        })
        .sort((left, right) => {
          const weights: Record<string, number> = { high: 3, normal: 2, low: 1 };
          return (weights[right.priority] ?? 0) - (weights[left.priority] ?? 0);
        })[0],
    [habitEntries, recommendations, todayISO]
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!getStoredToken()) {
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      await dayApi.sync();
      const dashboardData = await dashboardApi.get();

      setUser(dashboardData.user);
      setHabits(dashboardData.habits);
      setSummary(dashboardData.summary);
      setPredictions(dashboardData.predictions);
      setHabitStats(dashboardData.habit_stats);
      setHabitEntries(dashboardData.habit_entries);
      setRecommendations(dashboardData.recommendations);
      setGamification(dashboardData.gamification);
      setIsOnboardingOpen(
        (isOpen) => isOpen || getOnboardingStatus(dashboardData.user.id) === "pending"
      );
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Не удалось загрузить данные";
      setError(message);
      if (message.includes("Сессия истекла")) {
        clearToken();
        setToken(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      void loadDashboard();
    }
  }, [loadDashboard, token]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setNotice("");
      setNoticeDetail("");
      setNoticeReward(undefined);
    }, 4200);

    return () => window.clearTimeout(timer);
  }, [notice]);

  const clearNotice = useCallback(() => {
    setNotice("");
    setNoticeDetail("");
    setNoticeReward(undefined);
  }, []);

  const showNotice = useCallback((message: string, detail = "", reward?: RewardPreview) => {
    setNotice(message);
    setNoticeDetail(detail);
    setNoticeReward(reward);
  }, []);

  const handleAuth = useCallback((response: AuthResponse, options?: { isNewRegistration?: boolean }) => {
    if (options?.isNewRegistration) {
      setOnboardingStatus(response.user.id, "pending");
    }

    storeToken(response.access_token);
    setToken(response.access_token);
    setUser(response.user);
    setIsOnboardingOpen(
      Boolean(options?.isNewRegistration) || getOnboardingStatus(response.user.id) === "pending"
    );
    showNotice("Вы в Steply", "Сегодня можно начать с ближайшей привычки");
    setActiveSection("dashboard");
  }, [showNotice]);

  const logout = useCallback(() => {
    clearToken();
    setToken(null);
    setUser(null);
    setHabits([]);
    setPredictions({});
    setHabitStats({});
    setHabitEntries({});
    setRecommendations([]);
    setSummary(emptySummary);
    setGamification(emptyGamificationSummary);
    setIsOnboardingOpen(false);
    clearNotice();
    setActiveSection("dashboard");
  }, [clearNotice]);

  function resetHabitForm() {
    setHabitForm(defaultHabitForm);
    setEditingHabitId(null);
  }

  function openHabitCreator() {
    setActiveSection("habits");
    setError("");
    clearNotice();
    setEditingHabitId(null);
    setHabitForm(defaultHabitForm);
    setIsHabitFormOpen(true);
  }

  function closeHabitForm() {
    setIsHabitFormOpen(false);
    setError("");
    resetHabitForm();
  }

  async function submitHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setError("");
    clearNotice();
    const payload = buildHabitPayload(habitForm);
    if (!payload.title) {
      setError("Введите название привычки");
      return;
    }
    if (payload.frequency_type === "custom" && payload.schedule_days.length === 0) {
      setError("Выберите хотя бы один день недели");
      return;
    }
    if (!editingHabitId && !gamification.pet.is_configured) {
      setError("Сначала выберите питомца");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingHabitId) {
        await habitsApi.update(editingHabitId, payload);
        showNotice("Привычку обновили");
      } else {
        await habitsApi.create(payload);
        showNotice("Привычка добавлена");
      }
      setIsHabitFormOpen(false);
      resetHabitForm();
      await loadDashboard();
    } catch (habitError) {
      setError(habitError instanceof Error ? habitError.message : "Не удалось сохранить привычку");
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEditHabit(habit: Habit) {
    setActiveSection("habits");
    setIsHabitFormOpen(true);
    setEditingHabitId(habit.id);
    setHabitForm({
      title: habit.title,
      description: habit.description ?? "",
      frequency_type: habit.frequency_type === "daily" ? "daily" : "custom",
      target_per_week: habit.target_per_week,
      difficulty: habit.difficulty,
      preferred_time: habit.preferred_time?.slice(0, 5) ?? "",
      scheduledDays:
        habit.frequency_type === "daily"
          ? weekdayKeys
          : habit.schedule_days.length > 0
            ? habit.schedule_days
            : weekdayKeys
    });
  }

  async function markHabit(habitId: number, status: EntryStatus) {
    setError("");
    clearNotice();
    const habit = activeHabits.find((item) => item.id === habitId);
    const existingTodayEntry = getTodayEntry(habitId);
    if (status === "missed") {
      setError("Пропуск появится сам после конца дня");
      return;
    }
    if (
      existingTodayEntry?.status === "completed" ||
      existingTodayEntry?.status === "recovery_completed"
    ) {
      setError("Сегодня уже учтено");
      return;
    }
    if (existingTodayEntry?.status === "missed") {
      setError("Этот день уже отмечен как пропуск");
      return;
    }
    if (
      habit &&
      !getHabitScheduleAvailability(
        habit,
        new Date(),
        (habitEntries[habit.id]?.length ?? 0) > 0
      ).isAvailableToday
    ) {
      setError("Эта привычка сегодня не запланирована");
      return;
    }

    try {
      const entry = await habitsApi.mark(habitId, status, todayISO);
      const reward =
        entry.xp_awarded > 0
          ? {
              title: "XP за привычку",
              detail: `${entry.xp_awarded} XP добавлены к уровню`,
              xp: entry.xp_awarded
            }
          : undefined;
      showNotice(
        status === "completed"
          ? entry.xp_awarded > 0
            ? "Готово, засчитали"
            : "Готово, сегодня уже учтено"
          : entry.xp_awarded > 0
            ? "Мягкий шаг засчитан"
            : "Мягкий шаг уже засчитан",
        "",
        reward
      );
      await loadDashboard();
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : "Не удалось отметить привычку");
    }
  }

  async function deleteHabit(habitId: number) {
    setError("");
    clearNotice();
    try {
      await habitsApi.delete(habitId);
      showNotice("Привычка удалена");
      await loadDashboard();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Не удалось удалить привычку");
    }
  }

  async function updatePet(payload: { pet_type: PetType; pet_name: string }) {
    setError("");
    clearNotice();
    try {
      await gamificationApi.updatePet(payload);
      showNotice("Питомец сохранён");
      await loadDashboard();
    } catch (petError) {
      setError(petError instanceof Error ? petError.message : "Не удалось сохранить питомца");
    }
  }

  function completeOnboarding() {
    if (user) {
      setOnboardingStatus(user.id, "completed");
    }
    setIsOnboardingOpen(false);

    if (!gamification.pet.is_configured) {
      setActiveSection("pet");
      return;
    }
    if (activeHabits.length === 0) {
      openHabitCreator();
      return;
    }
    setActiveSection("dashboard");
  }

  async function refreshRecommendations() {
    setError("");
    clearNotice();
    setIsLoading(true);
    try {
      const generated = await recommendationsApi.generate();
      setRecommendations(generated);
      showNotice("Советы обновлены", "ИИ пересчитал подсказки по последним отметкам");
      await loadDashboard();
    } catch (recommendationError) {
      setError(
        recommendationError instanceof Error
          ? recommendationError.message
          : "Не удалось обновить советы"
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function markRecommendationRead(recommendationId: number) {
    setError("");
    clearNotice();
    try {
      await recommendationsApi.markRead(recommendationId);
      showNotice("Совет отмечен", "Задания обновились");
      await loadDashboard();
    } catch (recommendationError) {
      setError(
        recommendationError instanceof Error
          ? recommendationError.message
          : "Не удалось отметить совет"
      );
    }
  }

  function getTodayEntry(habitId: number) {
    return habitEntries[habitId]
      ?.filter((entry) => entry.entry_date === todayISO)
      .sort((left, right) => {
        const dateOrder = right.created_at.localeCompare(left.created_at);
        return dateOrder || right.id - left.id;
      })[0];
  }

  const authValue = useMemo<AuthDataContextValue>(
    () => ({
      token,
      user,
      handleAuth,
      login: authApi.login,
      register: authApi.register,
      logout
    }),
    [handleAuth, logout, token, user]
  );

  const value: AppDataContextValue = {
    token,
    activeSection,
    setActiveSection,
    user,
    habits,
    activeHabits,
    habitsForToday,
    summary,
    predictions,
    habitStats,
    habitEntries,
    recommendations,
    gamification,
    todayISO,
    completedToday,
    todayProgress,
    recommendationOfDay,
    error,
    notice,
    noticeDetail,
    noticeReward,
    isLoading,
    isOnboardingOpen,
    isHabitFormOpen,
    isSubmitting,
    habitForm,
    setHabitForm,
    editingHabitId,
    handleAuth,
    login: authApi.login,
    register: authApi.register,
    logout,
    loadDashboard,
    openHabitCreator,
    closeHabitForm,
    resetHabitForm,
    submitHabit,
    startEditHabit,
    markHabit,
    updatePet,
    completeOnboarding,
    deleteHabit,
    refreshRecommendations,
    markRecommendationRead,
    getTodayEntry
  };

  return (
    <AuthDataContext.Provider value={authValue}>
      <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
    </AuthDataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData must be used inside AppProvider");
  }
  return context;
}

export function useAuthData() {
  const context = useContext(AuthDataContext);
  if (!context) {
    throw new Error("useAuthData must be used inside AppProvider");
  }
  return context;
}
