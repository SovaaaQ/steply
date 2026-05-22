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
import { gamificationApi } from "../services/gamificationApi";
import { habitsApi } from "../services/habitsApi";
import { recommendationsApi } from "../services/recommendationsApi";
import { statisticsApi } from "../services/statisticsApi";
import type { AuthResponse, PetType, User } from "../types/auth";
import type { EntryStatus, Habit, HabitEntry, HabitFormState } from "../types/habit";
import type { Prediction, Recommendation } from "../types/recommendation";
import type { HabitStats, Summary } from "../types/statistics";
import type { GamificationSummary, RewardPreview } from "../types/gamification";
import type { AppSection } from "../types/navigation";
import { formatLocalDate } from "../utils/formatDate";
import { buildHabitPayload, defaultHabitForm, weekdayKeys } from "../utils/habitForm";
import { getHabitScheduleAvailability } from "../utils/habitSchedule";
import { emptySummary } from "../utils/risk";

const emptyGamificationSummary: GamificationSummary = {
  profile: {
    level: 1,
    title: "Старт маршрута",
    milestone: "Создайте первую привычку и закройте первый шаг.",
    total_xp: 0,
    current_level_xp: 0,
    current_level_min_xp: 0,
    next_level: 2,
    next_level_xp: 100,
    xp_to_next_level: 100,
    progress_percent: 0,
    current_streak: 0,
    longest_streak: 0,
    last_active_date: null,
    streak_status: "empty"
  },
  pet: {
    pet_type: null,
    pet_name: null,
    pet_state: "neutral",
    level: 1,
    xp: 0,
    progress_percent: 0,
    next_level: 2,
    next_level_xp: 100,
    xp_to_next_level: 100,
    is_configured: false
  },
  streak: {
    current: 0,
    best: 0,
    status: "empty",
    label: "Серия еще не началась",
    next_step: "Создайте привычку и закройте первый короткий шаг.",
    is_at_risk: false,
    last_active_date: null,
    completed_today: 0,
    scheduled_today: 0
  },
  achievements: [],
  quests: [],
  recent_events: [],
  next_best_action: {
    title: "Соберите первый маршрут",
    description: "Создайте первую привычку, чтобы появились XP, серия и задания.",
    cta_label: "Создать привычку",
    cta_section: "habits"
  }
};

const ONBOARDING_STORAGE_PREFIX = "steply:onboarding:";

function getOnboardingKey(userId: number) {
  return `${ONBOARDING_STORAGE_PREFIX}${userId}`;
}

function getOnboardingStatus(userId: number) {
  try {
    return localStorage.getItem(getOnboardingKey(userId));
  } catch {
    return null;
  }
}

function setOnboardingStatus(userId: number, status: "pending" | "completed") {
  try {
    localStorage.setItem(getOnboardingKey(userId), status);
  } catch {
    // The onboarding can still finish for this session when storage is unavailable.
  }
}

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

export function AppProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [activeSection, setActiveSection] = useState<AppSection>("dashboard");
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
  const [editingHabitId, setEditingHabitId] = useState<number | null>(null);
  const [habitForm, setHabitForm] = useState<HabitFormState>(defaultHabitForm);
  const [now, setNow] = useState(() => new Date());

  const todayISO = formatLocalDate(now);

  const activeHabits = useMemo(() => habits.filter((habit) => habit.is_active), [habits]);

  const habitsForToday = useMemo(
    () =>
      activeHabits.filter((habit) => {
        const availability = getHabitScheduleAvailability(habit, now);
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
      const [currentUser, habitsData, summaryData] = await Promise.all([
        authApi.me(),
        habitsApi.list(),
        statisticsApi.summary()
      ]);

      const active = habitsData.filter((habit) => habit.is_active);
      const [predictionPairs, statsPairs, entryPairs, initialRecommendations] = await Promise.all([
        Promise.all(
          active.map(async (habit) => [habit.id, await statisticsApi.prediction(habit.id)] as const)
        ),
        Promise.all(
          active.map(async (habit) => [habit.id, await statisticsApi.habitStats(habit.id)] as const)
        ),
        Promise.all(active.map(async (habit) => [habit.id, await habitsApi.entries(habit.id)] as const)),
        recommendationsApi.list()
      ]);

      let recommendationsData = initialRecommendations;
      if (active.length > 0 && recommendationsData.length === 0) {
        recommendationsData = await recommendationsApi.generate();
      }
      const gamificationData = await gamificationApi.summary();

      setUser(currentUser);
      setHabits(habitsData);
      setSummary(summaryData);
      setPredictions(Object.fromEntries(predictionPairs) as Record<number, Prediction>);
      setHabitStats(Object.fromEntries(statsPairs) as Record<number, HabitStats>);
      setHabitEntries(Object.fromEntries(entryPairs) as Record<number, HabitEntry[]>);
      setRecommendations(recommendationsData);
      setGamification(gamificationData);
      setIsOnboardingOpen(
        (isOpen) => isOpen || getOnboardingStatus(currentUser.id) === "pending"
      );
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Ошибка загрузки данных";
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

  function clearNotice() {
    setNotice("");
    setNoticeDetail("");
    setNoticeReward(undefined);
  }

  function showNotice(message: string, detail = "", reward?: RewardPreview) {
    setNotice(message);
    setNoticeDetail(detail);
    setNoticeReward(reward);
  }

  function handleAuth(response: AuthResponse, options?: { isNewRegistration?: boolean }) {
    if (options?.isNewRegistration) {
      setOnboardingStatus(response.user.id, "pending");
    }

    storeToken(response.access_token);
    setToken(response.access_token);
    setUser(response.user);
    setIsOnboardingOpen(
      Boolean(options?.isNewRegistration) || getOnboardingStatus(response.user.id) === "pending"
    );
    showNotice("Вы вошли в Steply", "Сегодня можно начать с ближайшей привычки");
    setActiveSection("dashboard");
  }

  function logout() {
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
  }

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

    try {
      if (editingHabitId) {
        await habitsApi.update(editingHabitId, payload);
        showNotice("Привычка обновлена");
      } else {
        await habitsApi.create(payload);
        showNotice("Привычка создана");
      }
      setIsHabitFormOpen(false);
      resetHabitForm();
      await recommendationsApi.generate().catch(() => []);
      await loadDashboard();
    } catch (habitError) {
      setError(habitError instanceof Error ? habitError.message : "Не удалось сохранить привычку");
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
    if (habit && !getHabitScheduleAvailability(habit, new Date()).isAvailableToday) {
      setError("Эта привычка сегодня не запланирована");
      return;
    }

    try {
      const entry = await habitsApi.mark(habitId, status, todayISO);
      await recommendationsApi.generate().catch(() => []);
      const reward =
        entry.xp_awarded > 0
          ? {
              title: "XP начислены за выполнение привычки",
              detail: `${entry.xp_awarded} XP учтены в уровне`,
              xp: entry.xp_awarded
            }
          : undefined;
      showNotice(
        status === "completed"
          ? entry.xp_awarded > 0
            ? "Шаг закрыт"
            : "Шаг закрыт. Сегодня эта привычка уже учтена"
          : status === "recovery_completed"
            ? entry.xp_awarded > 0
              ? "Восстановление выполнено"
              : "Восстановление выполнено. Сегодня эта привычка уже учтена"
            : "Пропуск зафиксирован. Включаем мягкий маршрут восстановления",
        "",
        reward
      );
      await loadDashboard();
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : "Не удалось отметить привычку");
    }
  }

  async function deleteHabit(habitId: number) {
    if (!window.confirm("Удалить привычку и историю ее выполнения?")) {
      return;
    }
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
      showNotice("Питомец сохранен");
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
    try {
      const generated = await recommendationsApi.generate();
      setRecommendations(generated);
      showNotice("Рекомендации обновлены на основе текущей истории");
      await loadDashboard();
    } catch (recommendationError) {
      setError(
        recommendationError instanceof Error
          ? recommendationError.message
          : "Не удалось сформировать рекомендации"
      );
    }
  }

  async function markRecommendationRead(recommendationId: number) {
    setError("");
    clearNotice();
    try {
      await recommendationsApi.markRead(recommendationId);
      showNotice("Совет прочитан", "XP и задания обновлены по циклу обратной связи");
      await loadDashboard();
    } catch (recommendationError) {
      setError(
        recommendationError instanceof Error
          ? recommendationError.message
          : "Не удалось отметить совет прочитанным"
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

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData must be used inside AppProvider");
  }
  return context;
}
