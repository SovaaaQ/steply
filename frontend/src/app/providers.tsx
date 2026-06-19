import {
  createContext,
  FormEvent,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

interface AuthDataContextValue {
  token: string | null;
  user: User | null;
  handleAuth: (response: AuthResponse, options?: { isNewRegistration?: boolean }) => void;
  login: (payload: { email: string; password: string }) => Promise<AuthResponse>;
  register: (payload: { email: string; full_name: string; password: string }) => Promise<AuthResponse>;
  logout: () => void;
}

const AuthDataContext = createContext<AuthDataContextValue | null>(null);

interface NavigationContextValue {
  activeSection: AppSection;
  setActiveSection: (section: AppSection) => void;
  isOnboardingOpen: boolean;
  completeOnboarding: (options?: { startSetup?: boolean }) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

interface UIFeedbackContextValue {
  error: string;
  notice: string;
  noticeDetail: string;
  noticeReward?: RewardPreview;
  isLoading: boolean;
  clearError: () => void;
}

const UIFeedbackContext = createContext<UIFeedbackContextValue | null>(null);

interface HabitFormContextValue {
  habitForm: HabitFormState;
  setHabitForm: React.Dispatch<React.SetStateAction<HabitFormState>>;
  editingHabitId: number | null;
  isHabitFormOpen: boolean;
  isSubmitting: boolean;
  openHabitCreator: () => void;
  closeHabitForm: () => void;
  resetHabitForm: () => void;
  submitHabit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  startEditHabit: (habit: Habit) => void;
}

const HabitFormContext = createContext<HabitFormContextValue | null>(null);

interface DashboardDataContextValue {
  habits: Habit[];
  activeHabits: Habit[];
  habitsForToday: Habit[];
  summary: Summary;
  predictions: Record<number, Prediction>;
  habitStats: Record<number, HabitStats>;
  habitEntries: Record<number, HabitEntry[]>;
  recommendations: Recommendation[];
  gamification: GamificationSummary;
  pendingHabitActionIds: number[];
  todayISO: string;
  completedToday: number;
  todayProgress: number;
  recommendationOfDay?: Recommendation;
  loadDashboard: (options?: { silent?: boolean }) => Promise<void>;
  markHabit: (habitId: number, status: EntryStatus) => Promise<boolean>;
  deleteHabit: (habitId: number) => Promise<void>;
  updatePet: (payload: { pet_type: PetType; pet_name: string }) => Promise<void>;
  refreshRecommendations: () => Promise<void>;
  markRecommendationRead: (
    recommendationId: number,
    options?: { silent?: boolean }
  ) => Promise<void>;
  getTodayEntry: (habitId: number) => HabitEntry | undefined;
}

const DashboardDataContext = createContext<DashboardDataContextValue | null>(null);

function getRecommendationRefreshDetail(recommendations: Recommendation[]) {
  if (recommendations.some((recommendation) => recommendation.ai_source === "bothub")) {
    return "BotHub обновил советы по последним отметкам";
  }
  if (recommendations.some((recommendation) => recommendation.ai_source === "heuristic")) {
    return "BotHub недоступен, использованы базовые правила";
  }
  return "Подсказки пересчитаны по последним отметкам";
}

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
  const [pendingHabitActionIds, setPendingHabitActionIds] = useState<number[]>([]);
  const pendingHabitActionsRef = useRef(new Set<number>());
  const pendingHabitDeletesRef = useRef(new Set<number>());
  const pendingRecommendationReadsRef = useRef(new Set<number>());
  const isPetUpdatingRef = useRef(false);
  const isRefreshingRecommendationsRef = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeDetail, setNoticeDetail] = useState("");
  const [noticeReward, setNoticeReward] = useState<RewardPreview | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isHabitFormOpen, setIsHabitFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
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

  const loadDashboard = useCallback(async (options?: { silent?: boolean }) => {
    if (!getStoredToken()) {
      return;
    }
    const silent = options?.silent ?? false;
    if (!silent) {
      setIsLoading(true);
    }
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
      if (!silent) {
        setIsLoading(false);
      }
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

  useEffect(() => {
    if (!error) {
      return;
    }

    const timer = window.setTimeout(() => setError(""), 8000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const clearError = useCallback(() => {
    setError("");
  }, []);

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
    showNotice("Вы в Steply", "Начните с ближайшей привычки");
    setActiveSection("dashboard");
  }, [setActiveSection, showNotice]);

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
  }, [clearNotice, setActiveSection]);

  const getTodayEntry = useCallback(
    (habitId: number) =>
      habitEntries[habitId]
        ?.filter((entry) => entry.entry_date === todayISO)
        .sort((left, right) => {
          const dateOrder = right.created_at.localeCompare(left.created_at);
          return dateOrder || right.id - left.id;
        })[0],
    [habitEntries, todayISO]
  );

  const setHabitActionPending = useCallback((habitId: number, isPending: boolean) => {
    if (isPending) {
      pendingHabitActionsRef.current.add(habitId);
    } else {
      pendingHabitActionsRef.current.delete(habitId);
    }
    setPendingHabitActionIds(Array.from(pendingHabitActionsRef.current));
  }, []);

  const resetHabitForm = useCallback(() => {
    setHabitForm(defaultHabitForm);
    setEditingHabitId(null);
  }, []);

  const openHabitCreator = useCallback(() => {
    setActiveSection("habits");
    setError("");
    clearNotice();
    setEditingHabitId(null);
    setHabitForm(defaultHabitForm);
    setIsHabitFormOpen(true);
  }, [clearNotice, setActiveSection]);

  const closeHabitForm = useCallback(() => {
    setIsHabitFormOpen(false);
    setError("");
    resetHabitForm();
  }, [resetHabitForm]);

  const submitHabit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isSubmittingRef.current) return;
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

      isSubmittingRef.current = true;
      setIsSubmitting(true);
      try {
        const isFirstHabit = !editingHabitId && activeHabits.length === 0;

        if (editingHabitId) {
          await habitsApi.update(editingHabitId, payload);
          showNotice("Привычку обновили");
        } else {
          await habitsApi.create(payload);
          showNotice(
            isFirstHabit ? "Первый маршрут собран" : "Привычка добавлена",
            isFirstHabit ? "Откройте главный экран и отметьте короткий шаг" : "",
            isFirstHabit
              ? {
                  title: "Цель онбординга",
                  detail: "20 XP за первую привычку",
                  xp: 20
                }
              : undefined
          );
        }
        setIsHabitFormOpen(false);
        resetHabitForm();
        await loadDashboard({ silent: true });
        if (isFirstHabit) {
          setActiveSection("dashboard");
        }
      } catch (habitError) {
        setError(habitError instanceof Error ? habitError.message : "Не удалось сохранить привычку");
      } finally {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [
      activeHabits.length,
      clearNotice,
      editingHabitId,
      gamification.pet.is_configured,
      habitForm,
      loadDashboard,
      resetHabitForm,
      setActiveSection,
      showNotice
    ]
  );

  const startEditHabit = useCallback(
    (habit: Habit) => {
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
    },
    [setActiveSection]
  );

  const markHabit = useCallback(
    async (habitId: number, status: EntryStatus) => {
      if (pendingHabitActionsRef.current.has(habitId)) {
        return false;
      }
      setError("");
      clearNotice();
      const habit = activeHabits.find((item) => item.id === habitId);
      const existingTodayEntry = getTodayEntry(habitId);
      if (status === "missed") {
        setError("Пропуск появится сам после конца дня");
        return false;
      }
      if (
        existingTodayEntry?.status === "completed" ||
        existingTodayEntry?.status === "recovery_completed"
      ) {
        setError("Сегодня уже учтено");
        return false;
      }
      if (existingTodayEntry?.status === "missed") {
        setError("Этот день уже отмечен как пропуск");
        return false;
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
        return false;
      }

      const isFirstCompletion = gamification.goals.some(
        (goal) => goal.id === "onboarding_complete_first_step" && goal.status !== "completed"
      );

      setHabitActionPending(habitId, true);
      try {
        const entry = await habitsApi.mark(habitId, status, todayISO);
        const reward =
          entry.xp_awarded > 0
            ? {
                title: isFirstCompletion ? "Первый шаг" : "XP за привычку",
                detail: `${entry.xp_awarded} XP добавлены к уровню`,
                xp: entry.xp_awarded
              }
            : undefined;
        showNotice(
          status === "completed"
            ? isFirstCompletion
              ? "Первый шаг отмечен"
              : entry.xp_awarded > 0
                ? "Готово, засчитали"
                : "Готово, сегодня уже учтено"
            : entry.xp_awarded > 0
              ? "Мягкий шаг засчитан"
              : "Мягкий шаг уже засчитан",
          isFirstCompletion ? "Маршрут запущен, дальше Steply подскажет следующий шаг" : "",
          reward
        );
        await loadDashboard({ silent: true });
        return true;
      } catch (markError) {
        setError(markError instanceof Error ? markError.message : "Не удалось отметить привычку");
        return false;
      } finally {
        setHabitActionPending(habitId, false);
      }
    },
    [
      activeHabits,
      clearNotice,
      gamification.goals,
      getTodayEntry,
      habitEntries,
      loadDashboard,
      setHabitActionPending,
      showNotice,
      todayISO
    ]
  );

  const deleteHabit = useCallback(
    async (habitId: number) => {
      if (pendingHabitDeletesRef.current.has(habitId)) {
        return;
      }
      pendingHabitDeletesRef.current.add(habitId);
      setError("");
      clearNotice();
      try {
        await habitsApi.delete(habitId);
        showNotice("Привычка удалена");
        await loadDashboard({ silent: true });
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Не удалось удалить привычку");
      } finally {
        pendingHabitDeletesRef.current.delete(habitId);
      }
    },
    [clearNotice, loadDashboard, showNotice]
  );

  const updatePet = useCallback(
    async (payload: { pet_type: PetType; pet_name: string }) => {
      if (isPetUpdatingRef.current) {
        return;
      }
      isPetUpdatingRef.current = true;
      setError("");
      clearNotice();
      try {
        await gamificationApi.updatePet(payload);
        showNotice("Питомец сохранён");
        await loadDashboard({ silent: true });
      } catch (petError) {
        setError(petError instanceof Error ? petError.message : "Не удалось сохранить питомца");
      } finally {
        isPetUpdatingRef.current = false;
      }
    },
    [clearNotice, loadDashboard, showNotice]
  );

  const completeOnboarding = useCallback((options?: { startSetup?: boolean }) => {
    if (user) {
      setOnboardingStatus(user.id, "completed");
    }
    setIsOnboardingOpen(false);

    if (options?.startSetup === false) {
      setActiveSection("dashboard");
      return;
    }

    if (!gamification.pet.is_configured) {
      setActiveSection("pet");
      return;
    }
    if (activeHabits.length === 0) {
      openHabitCreator();
      return;
    }
    setActiveSection("dashboard");
  }, [activeHabits.length, gamification.pet.is_configured, openHabitCreator, setActiveSection, user]);

  const refreshRecommendations = useCallback(async () => {
    if (isRefreshingRecommendationsRef.current) {
      return;
    }
    isRefreshingRecommendationsRef.current = true;
    setError("");
    clearNotice();
    setIsLoading(true);
    try {
      const generated = await recommendationsApi.generate({ forceAi: true });
      setRecommendations(generated);
      showNotice("Советы обновлены", getRecommendationRefreshDetail(generated));
      await loadDashboard({ silent: true });
    } catch (recommendationError) {
      setError(
        recommendationError instanceof Error
          ? recommendationError.message
          : "Не удалось обновить советы"
      );
    } finally {
      isRefreshingRecommendationsRef.current = false;
      setIsLoading(false);
    }
  }, [clearNotice, loadDashboard, showNotice]);

  const markRecommendationRead = useCallback(
    async (recommendationId: number, options?: { silent?: boolean }) => {
      if (pendingRecommendationReadsRef.current.has(recommendationId)) {
        return;
      }
      pendingRecommendationReadsRef.current.add(recommendationId);
      const silent = options?.silent ?? false;
      setError("");
      if (!silent) {
        clearNotice();
      }
      try {
        await recommendationsApi.markRead(recommendationId);
        if (!silent) {
          showNotice("Совет отмечен", "Задания обновились");
          await loadDashboard({ silent: true });
        }
      } catch (recommendationError) {
        setError(
          recommendationError instanceof Error
            ? recommendationError.message
            : "Не удалось отметить совет"
        );
      } finally {
        pendingRecommendationReadsRef.current.delete(recommendationId);
      }
    },
    [clearNotice, loadDashboard, showNotice]
  );

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

  const navigationValue = useMemo<NavigationContextValue>(
    () => ({
      activeSection,
      setActiveSection,
      isOnboardingOpen,
      completeOnboarding
    }),
    [activeSection, completeOnboarding, isOnboardingOpen, setActiveSection]
  );

  const uiFeedbackValue = useMemo<UIFeedbackContextValue>(
    () => ({
      error,
      notice,
      noticeDetail,
      noticeReward,
      isLoading,
      clearError
    }),
    [clearError, error, isLoading, notice, noticeDetail, noticeReward]
  );

  const habitFormValue = useMemo<HabitFormContextValue>(
    () => ({
      habitForm,
      setHabitForm,
      editingHabitId,
      isHabitFormOpen,
      isSubmitting,
      openHabitCreator,
      closeHabitForm,
      resetHabitForm,
      submitHabit,
      startEditHabit
    }),
    [
      closeHabitForm,
      editingHabitId,
      habitForm,
      isHabitFormOpen,
      isSubmitting,
      openHabitCreator,
      resetHabitForm,
      startEditHabit,
      submitHabit
    ]
  );

  const dashboardDataValue = useMemo<DashboardDataContextValue>(
    () => ({
      habits,
      activeHabits,
      habitsForToday,
      summary,
      predictions,
      habitStats,
      habitEntries,
      recommendations,
      gamification,
      pendingHabitActionIds,
      todayISO,
      completedToday,
      todayProgress,
      recommendationOfDay,
      loadDashboard,
      markHabit,
      deleteHabit,
      updatePet,
      refreshRecommendations,
      markRecommendationRead,
      getTodayEntry
    }),
    [
      activeHabits,
      completedToday,
      deleteHabit,
      gamification,
      getTodayEntry,
      habitEntries,
      habitStats,
      habits,
      habitsForToday,
      loadDashboard,
      markHabit,
      markRecommendationRead,
      pendingHabitActionIds,
      predictions,
      recommendationOfDay,
      recommendations,
      refreshRecommendations,
      summary,
      todayISO,
      todayProgress,
      updatePet
    ]
  );

  return (
    <AuthDataContext.Provider value={authValue}>
      <NavigationContext.Provider value={navigationValue}>
        <UIFeedbackContext.Provider value={uiFeedbackValue}>
          <HabitFormContext.Provider value={habitFormValue}>
            <DashboardDataContext.Provider value={dashboardDataValue}>
              {children}
            </DashboardDataContext.Provider>
          </HabitFormContext.Provider>
        </UIFeedbackContext.Provider>
      </NavigationContext.Provider>
    </AuthDataContext.Provider>
  );
}

export function useAuthData() {
  const context = useContext(AuthDataContext);
  if (!context) {
    throw new Error("useAuthData must be used inside AppProvider");
  }
  return context;
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used inside AppProvider");
  }
  return context;
}

export function useUIFeedback() {
  const context = useContext(UIFeedbackContext);
  if (!context) {
    throw new Error("useUIFeedback must be used inside AppProvider");
  }
  return context;
}

export function useHabitForm() {
  const context = useContext(HabitFormContext);
  if (!context) {
    throw new Error("useHabitForm must be used inside AppProvider");
  }
  return context;
}

export function useDashboardData() {
  const context = useContext(DashboardDataContext);
  if (!context) {
    throw new Error("useDashboardData must be used inside AppProvider");
  }
  return context;
}
