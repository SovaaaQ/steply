import { RecommendationCard } from "../components/recommendations/RecommendationCard";
import { Button } from "../components/ui/Button";
import { SketchArrow } from "../components/ui/SketchArrow";
import { useAppData } from "../app/providers";
import { useRecommendations } from "../hooks/useRecommendations";
import type { EntryStatus, Habit } from "../types/habit";
import type { Prediction, Recommendation } from "../types/recommendation";
import type { HabitStats } from "../types/statistics";
import { percent } from "../utils/formatDate";
import { shouldActivateRecoveryMode } from "../utils/gamification";
import {
  formatNextScheduledOccurrence,
  getNextScheduledOccurrence
} from "../utils/habitSchedule";
import { formatRiskDisplay, hasEnoughRiskData } from "../utils/risk";

interface AdviceItem {
  id: string;
  tone: "urgent" | "normal" | "data";
  habit?: Habit;
  habitTitle: string;
  advice: string;
  reason: string;
  ctaLabel: "Перейти к привычке" | "Отметить";
  markStatus?: EntryStatus;
  recommendationId?: number;
}

function getTodayFollowUpAdvice(habit?: Habit) {
  if (!habit) {
    return "Сегодня шаг уже отмечен. Следующий совет появится после новой истории.";
  }

  return `Сегодня привычка уже выполнена. ${formatNextScheduledOccurrence(
    getNextScheduledOccurrence(habit, new Date(), 1)
  )}.`;
}

function TipsEmptyState({ children }: { children: string }) {
  return <p className="tips-empty-state">{children}</p>;
}

function isAdviceItem(item: AdviceItem | null): item is AdviceItem {
  return item !== null;
}

function getHabitTitle(habit?: Habit) {
  return habit?.title ?? "Общая рекомендация";
}

function formatMarks(count: number) {
  if (count === 1) {
    return "1 отметка";
  }
  if (count > 1 && count < 5) {
    return `${count} отметки`;
  }
  return `${count} отметок`;
}

function getRiskReason(stats: HabitStats | undefined, risk: number | undefined) {
  const parts: string[] = [];
  if (typeof risk === "number") {
    parts.push(`риск пропуска ${percent(risk)}`);
  }
  if (stats?.consecutive_missed) {
    parts.push(`${stats.consecutive_missed} пропуска подряд`);
  }
  if (typeof stats?.completion_rate_last_7 === "number") {
    parts.push(`за 7 дней выполнено ${percent(stats.completion_rate_last_7)}`);
  }
  return parts.length > 0
    ? parts.join(", ")
    : "Steply учитывает последние отметки и регулярность привычки";
}

function getPredictionRiskReason(
  stats: HabitStats | undefined,
  prediction: Prediction | undefined
) {
  if (!hasEnoughRiskData(prediction, stats)) {
    return "Недостаточно истории: отметьте привычку несколько раз, чтобы прогноз стал полезным.";
  }
  const context = getRiskReason(stats, undefined);
  return `${formatRiskDisplay(prediction, stats)}; ${context}`;
}

function getRecommendationAdvice(recommendation: Recommendation, habit?: Habit) {
  switch (recommendation.type) {
    case "reduce_difficulty":
      return "Сделайте шаг проще на сегодня и отметьте реальное выполнение.";
    case "soft_reminder":
      return "Запланируйте выполнение заранее и закройте шаг в удобное время.";
    case "restore_regular_activity":
      return "Вернитесь через короткое действие без попытки компенсировать пропуски.";
    case "motivation":
      return "Сохраните текущий темп и выполните привычку в привычное время.";
    case "keep_regular":
      return "Продолжайте отмечать выполнение, чтобы прогноз оставался точным.";
    default:
      return recommendation.message || `Продолжайте работать с привычкой «${getHabitTitle(habit)}».`;
  }
}

export function TipsScreen() {
  const {
    habitStats,
    predictions,
    getTodayEntry,
    markHabit,
    setActiveSection
  } = useAppData();
  const {
    recommendations,
    activeHabits,
    isLoading,
    markRecommendationRead,
    refreshRecommendations
  } = useRecommendations();

  const activeHabitById = new Map(activeHabits.map((habit) => [habit.id, habit]));

  const urgentItems: AdviceItem[] = activeHabits
    .map((habit): AdviceItem | null => {
      const stats = habitStats[habit.id];
      const prediction = predictions[habit.id];
      const todayEntry = getTodayEntry(habit.id);
      const isDone =
        todayEntry?.status === "completed" || todayEntry?.status === "recovery_completed";
      const hasRiskData = hasEnoughRiskData(prediction, stats);
      const isUrgent =
        (hasRiskData && prediction.risk_level === "high") ||
        shouldActivateRecoveryMode(stats, hasRiskData ? prediction.miss_risk : 0);
      if (!isUrgent || isDone) {
        return null;
      }

      return {
        id: `urgent-${habit.id}`,
        tone: "urgent" as const,
        habit,
        habitTitle: habit.title,
        advice: "Выполните минимальную версию привычки сегодня, чтобы сохранить регулярность.",
        reason: getPredictionRiskReason(stats, prediction),
        ctaLabel: "Отметить" as const,
        markStatus: "recovery_completed" as const
      };
    })
    .filter(isAdviceItem)
    .sort((left, right) => {
      const leftRisk = left.habit ? predictions[left.habit.id]?.miss_risk ?? 0 : 0;
      const rightRisk = right.habit ? predictions[right.habit.id]?.miss_risk ?? 0 : 0;
      return rightRisk - leftRisk;
    });

  const urgentHabitIds = new Set(urgentItems.map((item) => item.habit?.id).filter(Boolean));

  const dataItems: AdviceItem[] = activeHabits
    .filter((habit) => !urgentHabitIds.has(habit.id))
    .filter((habit) => (habitStats[habit.id]?.total_entries ?? 0) < 3)
    .map((habit) => {
      const totalEntries = habitStats[habit.id]?.total_entries ?? 0;
      const todayEntry = getTodayEntry(habit.id);
      const isDone =
        todayEntry?.status === "completed" || todayEntry?.status === "recovery_completed";
      return {
        id: `data-${habit.id}`,
        tone: "data" as const,
        habit,
        habitTitle: habit.title,
        advice: isDone
          ? getTodayFollowUpAdvice(habit)
          : "Отметьте привычку несколько раз, чтобы Steply точнее оценивал риск пропуска.",
        reason: isDone
          ? `Сегодняшняя отметка уже учтена; сейчас есть ${formatMarks(totalEntries)}.`
          : `Сейчас есть ${formatMarks(totalEntries)}, для уверенного прогноза нужно больше истории.`,
        ctaLabel: isDone ? "Перейти к привычке" as const : "Отметить" as const,
        markStatus: isDone ? undefined : "completed" as const
      };
    });

  const dataHabitIds = new Set(dataItems.map((item) => item.habit?.id).filter(Boolean));

  const recommendationItems: AdviceItem[] = recommendations
    .filter((recommendation) => recommendation.type !== "data_collection")
    .map((recommendation): AdviceItem | null => {
      const habit = recommendation.habit_id
        ? activeHabitById.get(recommendation.habit_id)
        : undefined;
      if (habit && (urgentHabitIds.has(habit.id) || dataHabitIds.has(habit.id))) {
        return null;
      }
      const prediction = habit ? predictions[habit.id] : undefined;
      const stats = habit ? habitStats[habit.id] : undefined;
      const todayEntry = habit ? getTodayEntry(habit.id) : undefined;
      const isDone =
        todayEntry?.status === "completed" || todayEntry?.status === "recovery_completed";
      return {
        id: `recommendation-${recommendation.id}`,
        tone: "normal" as const,
        habit,
        habitTitle: getHabitTitle(habit),
        advice: isDone ? getTodayFollowUpAdvice(habit) : getRecommendationAdvice(recommendation, habit),
        reason: prediction
          ? `${isDone ? "Риск относится к следующему выполнению. " : ""}${getPredictionRiskReason(stats, prediction)}`
          : "Совет сформирован по истории привычек и последним отметкам.",
        ctaLabel: "Перейти к привычке" as const,
        recommendationId: recommendation.id
      };
    })
    .filter(isAdviceItem);

  function handleAdviceAction(item: AdviceItem) {
    if (item.habit && item.markStatus) {
      void markHabit(item.habit.id, item.markStatus);
      return;
    }
    if (item.recommendationId) {
      void markRecommendationRead(item.recommendationId);
    }
    setActiveSection("habits");
  }

  return (
    <section className="recommendations-page page-stack">
      <div className="tips-topbar">
        <p className="tips-subtitle">
          Рекомендации по привычкам, риску пропуска и восстановлению.
        </p>
        <Button
          className="tips-refresh-button"
          type="button"
          variant="secondary"
          disabled={isLoading || activeHabits.length === 0}
          onClick={() => void refreshRecommendations()}
        >
          {isLoading ? "Обновляем" : "Обновить советы"}
        </Button>
      </div>

      <div className="tips-hint-grid">
        <article className="tips-hint-card tips-hint-primary">
          <SketchArrow className="tips-hint-arrow" />
          <strong><span className="marker-highlight">Как работают советы</span></strong>
          <p>
            Steply анализирует отметки привычек, регулярность и риск пропуска.
            Чем больше выполнений, тем точнее рекомендации.
          </p>
        </article>
        <article className="tips-hint-card tips-hint-secondary">
          <strong>После отметки</strong>
          <p>Советы обновляются по новой истории и помогают выбрать следующий реальный шаг.</p>
        </article>
      </div>

      {activeHabits.length === 0 ? (
        <section className="tips-section-panel">
          <TipsEmptyState>
            Создайте первую привычку, и здесь появятся советы по риску, данным и восстановлению.
          </TipsEmptyState>
        </section>
      ) : (
        <div className="tips-section-grid">
          <section className="tips-section-panel tips-section-urgent">
            <div className="tips-section-heading">
              <h2>Срочно</h2>
              <p>Высокий риск пропуска или нужен режим восстановления.</p>
            </div>
            <div className="tips-card-list">
              {urgentItems.length > 0 ? (
                urgentItems.map((item) => (
                  <RecommendationCard
                    ctaLabel={item.ctaLabel}
                    habitTitle={item.habitTitle}
                    key={item.id}
                    reason={item.reason}
                    advice={item.advice}
                    tone={item.tone}
                    onAction={() => handleAdviceAction(item)}
                  />
                ))
              ) : (
                <TipsEmptyState>
                  Сейчас нет привычек с высоким риском. Поддерживайте регулярные отметки.
                </TipsEmptyState>
              )}
            </div>
          </section>

          <section className="tips-section-panel">
            <div className="tips-section-heading">
              <h2>Нужно больше данных</h2>
              <p>Привычки, по которым пока мало отметок для точного прогноза.</p>
            </div>
            <div className="tips-card-list">
              {dataItems.length > 0 ? (
                dataItems.map((item) => (
                  <RecommendationCard
                    ctaLabel={item.ctaLabel}
                    habitTitle={item.habitTitle}
                    key={item.id}
                    reason={item.reason}
                    advice={item.advice}
                    tone={item.tone}
                    onAction={() => handleAdviceAction(item)}
                  />
                ))
              ) : (
                <TipsEmptyState>
                  Данных достаточно для базовых рекомендаций. Продолжайте отмечать привычки.
                </TipsEmptyState>
              )}
            </div>
          </section>

          <section className="tips-section-panel tips-section-wide">
            <div className="tips-section-heading">
              <h2>Рекомендации</h2>
              <p>Обычные советы по регулярности, сложности и следующему шагу.</p>
            </div>
            <div className="tips-card-list tips-card-list-wide">
              {recommendationItems.length > 0 ? (
                recommendationItems.map((item) => (
                  <RecommendationCard
                    ctaLabel={item.ctaLabel}
                    habitTitle={item.habitTitle}
                    key={item.id}
                    reason={item.reason}
                    advice={item.advice}
                    tone={item.tone}
                    onAction={() => handleAdviceAction(item)}
                  />
                ))
              ) : (
                <TipsEmptyState>
                  Обычных советов пока нет. Обновите советы после нескольких отметок.
                </TipsEmptyState>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
