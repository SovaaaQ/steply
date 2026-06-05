import { useMemo } from "react";

import { NextHabitCard } from "../components/dashboard/NextHabitCard";
import { TodaySummary } from "../components/dashboard/TodaySummary";
import { AuthQrCard } from "../components/auth/AuthQrCard";
import { DailyRecommendationCard } from "../components/dashboard/DailyRecommendationCard";
import { PetMiniWidget } from "../components/gamification/PetMiniWidget";
import { Button } from "../components/ui/Button";
import { useAppData } from "../app/providers";
import { useAuth } from "../hooks/useAuth";
import { useHabits } from "../hooks/useHabits";
import { useRecommendations } from "../hooks/useRecommendations";
import { useStatistics } from "../hooks/useStatistics";

export function DashboardPage() {
  const { setActiveSection, gamification } = useAppData();
  const { user } = useAuth();
  const {
    habitsForToday,
    predictions,
    habitStats,
    getTodayEntry,
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
            onOpenHabits={() => setActiveSection("habits")}
            onMark={(habitId, status) => void markHabit(habitId, status)}
          />
          <PetMiniWidget pet={gamification.pet} onOpen={() => setActiveSection("pet")} />
          <AuthQrCard variant="demo" />
        </div>
      </section>

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

                return (
                  <div className={`today-row ${isDone ? "done" : ""}`} key={habit.id}>
                    <div>
                      <strong>{habit.title}</strong>
                      <span>
                        {entry?.status === "missed"
                          ? "Этот день пропущен, можно вернуться мягко"
                          : isDone
                            ? "Отмечено сегодня"
                            : "Ждёт отметки"}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant={isAlreadyCounted ? "secondary" : "cta"}
                      disabled={isAlreadyCounted}
                      onClick={() => void markHabit(habit.id, "completed")}
                    >
                      {isDone ? "Готово" : isMissed ? "Пропущено" : "Отметить"}
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="muted-panel">На сегодня ничего не запланировано</p>
          )}
        </section>

        <DailyRecommendationCard
          recommendation={recommendationOfDay}
          onOpen={() => setActiveSection("recommendations")}
        />
      </section>
    </div>
  );
}
