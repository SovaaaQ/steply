import { useCallback, useMemo } from "react";

import { NextHabitCard } from "../components/dashboard/NextHabitCard";
import { TodaySummary } from "../components/dashboard/TodaySummary";
import { DailyRecommendationCard } from "../components/dashboard/DailyRecommendationCard";
import { PetMiniWidget } from "../components/gamification/PetMiniWidget";
import { OnboardingChecklist } from "../components/onboarding/OnboardingChecklist";
import { Button } from "../components/ui/Button";
import { useDashboardData, useHabitForm, useNavigation } from "../app/providers";
import { useAuth } from "../hooks/useAuth";
import { useHabits } from "../hooks/useHabits";
import { useRecommendations } from "../hooks/useRecommendations";
import { useStatistics } from "../hooks/useStatistics";

export function DashboardPage() {
  const { setActiveSection } = useNavigation();
  const { openHabitCreator } = useHabitForm();
  const { gamification } = useDashboardData();
  const { user } = useAuth();
  const {
    habitsForToday,
    activeHabits,
    predictions,
    habitStats,
    getTodayEntry,
    pendingHabitActionIds,
    markHabit
  } = useHabits();
  const { completedToday, todayProgress } = useStatistics();
  const { recommendationOfDay } = useRecommendations();

  const nextHabit = useMemo(
    () =>
      [...habitsForToday]
        .filter((habit) => {
          const entry = getTodayEntry(habit.id);
          return entry?.status !== "completed" && entry?.status !== "recovery_completed";
        })
        .sort((left, right) =>
          (left.preferred_time || "23:59").localeCompare(right.preferred_time || "23:59")
        )[0] ?? habitsForToday[0],
    [getTodayEntry, habitsForToday]
  );
  const pendingHabitIds = useMemo(
    () => new Set(pendingHabitActionIds),
    [pendingHabitActionIds]
  );
  const firstCompletableHabit = useMemo(
    () =>
      [...habitsForToday]
        .filter((habit) => {
          const entry = getTodayEntry(habit.id);
          return (
            entry?.status !== "completed" &&
            entry?.status !== "recovery_completed" &&
            entry?.status !== "missed"
          );
        })
        .sort((left, right) =>
          (left.preferred_time || "23:59").localeCompare(right.preferred_time || "23:59")
        )[0],
    [getTodayEntry, habitsForToday]
  );
  const handleMarkFirstStep = useCallback(() => {
    if (!firstCompletableHabit) {
      setActiveSection("habits");
      return;
    }

    void markHabit(firstCompletableHabit.id, "completed");
  }, [firstCompletableHabit, markHabit, setActiveSection]);

  return (
    <div className="page-stack dashboard-simple">
      <section className="dashboard-hero dashboard-hero-calm">
        <TodaySummary
          userName={user?.full_name}
          completedToday={completedToday}
          totalToday={habitsForToday.length}
          progress={todayProgress}
        />

        <div className="dashboard-side-stack">
          <NextHabitCard
            habit={nextHabit}
            prediction={nextHabit ? predictions[nextHabit.id] : undefined}
            stats={nextHabit ? habitStats[nextHabit.id] : undefined}
            todayEntry={nextHabit ? getTodayEntry(nextHabit.id) : undefined}
            isMarking={nextHabit ? pendingHabitIds.has(nextHabit.id) : false}
            onOpenHabits={() => setActiveSection("habits")}
            onMark={(habitId, status) => void markHabit(habitId, status)}
          />
          <PetMiniWidget pet={gamification.pet} onOpen={() => setActiveSection("pet")} />
        </div>
      </section>

      <OnboardingChecklist
        activeHabitCount={activeHabits.length}
        canMarkFirstStep={Boolean(firstCompletableHabit)}
        goals={gamification.goals}
        isFirstStepMarking={
          firstCompletableHabit ? pendingHabitIds.has(firstCompletableHabit.id) : false
        }
        pet={gamification.pet}
        onCreateHabit={openHabitCreator}
        onMarkFirstStep={handleMarkFirstStep}
        onOpenHabits={() => setActiveSection("habits")}
        onOpenPet={() => setActiveSection("pet")}
      />

      <section className="dashboard-main-grid">
        <section className="today-route-list">
          <div className="section-heading compact">
            <div>
              <span className="page-kicker">Сегодня</span>
              <h2>План на день</h2>
            </div>
            <Button type="button" variant="secondary" onClick={() => setActiveSection("habits")}>
              Все привычки
            </Button>
          </div>

          {habitsForToday.length > 0 ? (
            <div className="today-rows">
              {habitsForToday.slice(0, 5).map((habit) => {
                const entry = getTodayEntry(habit.id);
                const isDone =
                  entry?.status === "completed" || entry?.status === "recovery_completed";
                const isMissed = entry?.status === "missed";
                const isAlreadyCounted = isDone || isMissed;
                const isMarking = pendingHabitIds.has(habit.id);

                return (
                  <div className={`today-row ${isDone ? "done" : ""}`} key={habit.id}>
                    <div>
                      <strong>{habit.title}</strong>
                      <span>
                        {entry?.status === "missed"
                          ? "Этот день пропущен, вернитесь коротким шагом"
                          : isDone
                            ? "Отмечено сегодня"
                            : "Ждёт отметки"}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant={isAlreadyCounted ? "secondary" : "cta"}
                      disabled={isAlreadyCounted || isMarking}
                      aria-busy={isMarking || undefined}
                      onClick={() => void markHabit(habit.id, "completed")}
                    >
                      {isMarking
                        ? "Отмечаем"
                        : isDone
                          ? "Готово"
                          : isMissed
                            ? "Пропущено"
                            : "Отметить"}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="muted-panel">На сегодня ничего не запланировано</p>
          )}
        </section>

        <div className="dashboard-secondary-stack">
          <DailyRecommendationCard
            recommendation={recommendationOfDay}
            onOpen={() => setActiveSection("recommendations")}
          />
        </div>
      </section>
    </div>
  );
}
