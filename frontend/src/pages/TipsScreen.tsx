import { RecommendationCard } from "../components/recommendations/RecommendationCard";
import { Button } from "../components/ui/Button";
import { useAppData } from "../app/providers";
import { useRecommendations } from "../hooks/useRecommendations";
import type { EntryStatus, Habit } from "../types/habit";
import type { Prediction, Recommendation } from "../types/recommendation";
import type { HabitStats } from "../types/statistics";
import { percent } from "../utils/formatDate";
import { shouldActivateRecoveryMode } from "../utils/gamification";
import {
  formatNextScheduledOccurrence,
  getHabitScheduleAvailability,
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
  ctaLabel: "Перейти к привычке" | "Отметить" | "Отметить минимум";
  markStatus?: EntryStatus;
  recommendationId?: number;
}

const MAX_ADVICE_WORDS = 48;
const URGENT_RECOMMENDATION_TYPES = new Set([
  "risk_ignored_recovery",
  "reset_plan",
  "miss_streak_recovery",
  "risk_recovery",
  "recovery_mode"
]);
const RECOVERY_RECOMMENDATION_TYPES = new Set([
  "risk_ignored_recovery",
  "reset_plan",
  "miss_streak_recovery",
  "early_recovery",
  "risk_recovery",
  "soft_recovery",
  "recovery_mode",
  "reduce_difficulty",
  "restore_regular_activity"
]);
const POSITIVE_RECOMMENDATION_TYPES = new Set([
  "after_completion",
  "on_track_support",
  "streak_maintenance",
  "streak_support",
  "motivation",
  "keep_regular"
]);

function normalizeAdviceText(value: string) {
  const withoutListTail = value.split(/\s(?:Шаги|Действия)\s*:/i)[0] || value;
  const text = stripOuterQuotes(withoutListTail.replace(/\s+/g, " ").trim());
  const words = text.split(" ").filter(Boolean);
  if (words.length <= MAX_ADVICE_WORDS) {
    return text;
  }
  return `${words.slice(0, MAX_ADVICE_WORDS).join(" ").replace(/[ ,;:.!?]+$/, "")}.`;
}

function stripOuterQuotes(value: string) {
  const quotePairs: Record<string, string> = {
    "\"": "\"",
    "'": "'",
    "«": "»",
    "“": "”",
    "„": "“"
  };
  let text = value.trim();

  while (text.length >= 2 && quotePairs[text[0]] === text[text.length - 1]) {
    text = text.slice(1, -1).trim();
  }

  return text;
}

function getRecommendationKey(recommendation: Recommendation) {
  return recommendation.habit_id
    ? `habit-${recommendation.habit_id}`
    : `general-${recommendation.type}`;
}

function getRecommendationTimestamp(recommendation: Recommendation) {
  return new Date(recommendation.created_at).getTime() || 0;
}

function dedupeRecommendations(recommendations: Recommendation[]) {
  const byKey = new Map<string, Recommendation>();

  recommendations.forEach((recommendation) => {
    const key = getRecommendationKey(recommendation);
    const current = byKey.get(key);
    if (
      !current ||
      getRecommendationTimestamp(recommendation) > getRecommendationTimestamp(current)
    ) {
      byKey.set(key, recommendation);
    }
  });

  return Array.from(byKey.values()).sort((left, right) => {
    if (left.is_read !== right.is_read) {
      return Number(left.is_read) - Number(right.is_read);
    }
    return getRecommendationTimestamp(right) - getRecommendationTimestamp(left);
  });
}

function getTodayFollowUpAdvice(habit?: Habit) {
  if (!habit) {
    return "Сегодня уже отмечено. Следующий совет появится после новых отметок";
  }

  return `Сегодня уже готово. ${formatNextScheduledOccurrence(
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
  return habit?.title ?? "Общий совет";
}

function getAdviceLabel(tone: AdviceItem["tone"]) {
  switch (tone) {
    case "urgent":
      return "Риск";
    case "data":
      return "История";
    default:
      return "Совет";
  }
}

function getRecommendationTone(recommendation: Recommendation): AdviceItem["tone"] {
  if (
    recommendation.priority === "high" ||
    URGENT_RECOMMENDATION_TYPES.has(recommendation.type)
  ) {
    return "urgent";
  }
  if (recommendation.type === "data_collection") {
    return "data";
  }
  return "normal";
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

function formatConsecutiveMisses(count: number) {
  if (count === 1) {
    return "1 пропуск подряд";
  }
  if (count > 1 && count < 5) {
    return `${count} пропуска подряд`;
  }
  return `${count} пропусков подряд`;
}

function getRiskReason(stats: HabitStats | undefined, risk: number | undefined) {
  const parts: string[] = [];
  if (typeof risk === "number") {
    parts.push(`риск пропуска ${percent(risk)}`);
  }
  if (stats?.consecutive_missed) {
    parts.push(formatConsecutiveMisses(stats.consecutive_missed));
  }
  if (typeof stats?.completion_rate_last_7 === "number") {
    parts.push(`за 7 дней выполнено ${percent(stats.completion_rate_last_7)}`);
  }
  return parts.length > 0
    ? parts.join(", ")
    : "Смотрим на последние отметки и регулярность привычки";
}

function getPredictionRiskReason(
  stats: HabitStats | undefined,
  prediction: Prediction | undefined
) {
  if (!hasEnoughRiskData(prediction, stats)) {
    return "Пока мало истории: отметьте привычку несколько раз, и прогноз станет полезнее";
  }
  const context = getRiskReason(stats, undefined);
  return `${formatRiskDisplay(prediction, stats)}; ${context}`;
}

function getPositiveReason(stats: HabitStats | undefined, isDone: boolean) {
  const parts: string[] = [];
  if (isDone) {
    parts.push("сегодня выполнено");
  }
  if (stats?.current_streak && stats.current_streak > 1) {
    parts.push(`серия ${stats.current_streak} подряд`);
  }
  if (stats && stats.total_entries >= 3) {
    parts.push(`за 7 дней выполнено ${percent(stats.completion_rate_last_7)}`);
  }
  return parts.length > 0 ? parts.join(", ") : "Привычка идёт по плану";
}

function getRecommendationReason(
  recommendation: Recommendation,
  stats: HabitStats | undefined,
  prediction: Prediction | undefined,
  isDone: boolean
) {
  if (recommendation.type === "first_step") {
    return "Стартовый совет после создания привычки и выбора питомца";
  }
  if (POSITIVE_RECOMMENDATION_TYPES.has(recommendation.type)) {
    return getPositiveReason(stats, isDone);
  }
  if (RECOVERY_RECOMMENDATION_TYPES.has(recommendation.type)) {
    return getRiskReason(stats, prediction?.miss_risk);
  }
  if (recommendation.type === "plan_ahead") {
    return prediction
      ? getRiskReason(stats, prediction.miss_risk)
      : "Готовим следующий повтор заранее";
  }
  if (prediction) {
    return `${isDone ? "Это риск на следующий раз. " : ""}${getPredictionRiskReason(stats, prediction)}`;
  }
  return "Совет собран по истории привычек и последним отметкам";
}

function getRecommendationAdvice(recommendation: Recommendation, habit?: Habit) {
  switch (recommendation.type) {
    case "risk_ignored_recovery":
      return "Пересоберите условия привычки и оставьте только минимальный шаг";
    case "reset_plan":
      return "Перезапустите привычку через самую короткую версию";
    case "miss_streak_recovery":
      return "Вернитесь через короткий шаг без попытки наверстать пропуски";
    case "early_recovery":
      return "Сделайте минимальный вариант, пока пропуск не стал серией";
    case "risk_recovery":
      return "Сузьте задачу до самого простого действия на сегодня";
    case "soft_recovery":
      return "Уменьшите объем и заранее решите, где закончится минимум";
    case "plan_ahead":
      return "Подготовьте первый шаг и время выполнения заранее";
    case "after_completion":
      return "Закрепите выполнение и подготовьте следующий повтор";
    case "on_track_support":
      return "Уберите один барьер, чтобы следующий повтор прошел так же спокойно";
    case "streak_maintenance":
    case "streak_support":
      return "Сохраните текущий темп без резкого усложнения";
    case "reduce_difficulty":
      return "Сделайте шаг проще на сегодня и отметьте результат";
    case "soft_reminder":
      return "Выберите удобное время заранее и отметьте шаг";
    case "restore_regular_activity":
      return "Вернитесь через короткий шаг, без компенсации пропусков";
    case "motivation":
      return "Сохраните текущий темп и выполните привычку в привычное время";
    case "keep_regular":
      return "Продолжайте отмечать привычку, чтобы советы оставались точными";
    default:
      return recommendation.message || `Продолжайте привычку «${getHabitTitle(habit)}»`;
  }
}

function isCompletedToday(status: EntryStatus | undefined) {
  return status === "completed" || status === "recovery_completed";
}

function getRecommendationAction(
  recommendation: Recommendation,
  canMarkToday: boolean
): Pick<AdviceItem, "ctaLabel" | "markStatus"> {
  if (!canMarkToday) {
    return { ctaLabel: "Перейти к привычке" };
  }

  if (RECOVERY_RECOMMENDATION_TYPES.has(recommendation.type) || recommendation.priority === "high") {
    return {
      ctaLabel: "Отметить минимум",
      markStatus: "recovery_completed"
    };
  }

  if (
    recommendation.type === "first_step" ||
    recommendation.type === "data_collection" ||
    recommendation.type === "plan_ahead"
  ) {
    return {
      ctaLabel: "Отметить",
      markStatus: "completed"
    };
  }

  return { ctaLabel: "Перейти к привычке" };
}

export function TipsScreen() {
  const {
    habitStats,
    habitEntries,
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
  const now = new Date();

  const urgentItems: AdviceItem[] = activeHabits
    .map((habit): AdviceItem | null => {
      const stats = habitStats[habit.id];
      const prediction = predictions[habit.id];
      const todayEntry = getTodayEntry(habit.id);
      const isDone = isCompletedToday(todayEntry?.status);
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
        advice: "Сделайте минимальную версию сегодня, чтобы не терять ритм",
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
      const isDone = isCompletedToday(todayEntry?.status);
      const canMarkToday =
        !todayEntry &&
        getHabitScheduleAvailability(
          habit,
          now,
          (habitEntries[habit.id]?.length ?? 0) > 0
        ).isAvailableToday;
      return {
        id: `data-${habit.id}`,
        tone: "data" as const,
        habit,
        habitTitle: habit.title,
        advice: isDone
          ? getTodayFollowUpAdvice(habit)
          : "Отметьте привычку несколько раз, чтобы риск считался точнее",
        reason: isDone
          ? `Сегодня уже учтено; сейчас есть ${formatMarks(totalEntries)}`
          : `Сейчас есть ${formatMarks(totalEntries)}, для прогноза нужно немного больше истории`,
        ctaLabel: canMarkToday ? "Отметить" as const : "Перейти к привычке" as const,
        markStatus: canMarkToday ? "completed" as const : undefined
      };
    });

  const recommendationItems: AdviceItem[] = dedupeRecommendations(recommendations)
    .map((recommendation): AdviceItem => {
      const habit = recommendation.habit_id
        ? activeHabitById.get(recommendation.habit_id)
        : undefined;
      const prediction = habit ? predictions[habit.id] : undefined;
      const stats = habit ? habitStats[habit.id] : undefined;
      const todayEntry = habit ? getTodayEntry(habit.id) : undefined;
      const isDone = isCompletedToday(todayEntry?.status);
      const tone = getRecommendationTone(recommendation);
      const canMarkToday = habit && !todayEntry
        ? getHabitScheduleAvailability(
            habit,
            now,
            (habitEntries[habit.id]?.length ?? 0) > 0
          ).isAvailableToday
        : false;
      const action = getRecommendationAction(recommendation, canMarkToday);
      return {
        id: `recommendation-${recommendation.id}`,
        tone,
        habit,
        habitTitle: getHabitTitle(habit),
        advice: normalizeAdviceText(
          recommendation.message || (isDone
            ? getTodayFollowUpAdvice(habit)
            : getRecommendationAdvice(recommendation, habit))
        ),
        reason: getRecommendationReason(recommendation, stats, prediction, isDone),
        ctaLabel: action.ctaLabel,
        markStatus: action.markStatus,
        recommendationId: recommendation.id
      };
    });

  const fallbackAdviceItems = [...urgentItems, ...dataItems];
  const adviceItems = recommendationItems.length > 0 ? recommendationItems : fallbackAdviceItems;
  const primaryAdvice = adviceItems[0];
  const secondaryAdviceItems = adviceItems.filter(
    (item) =>
      item.id !== primaryAdvice?.id &&
      (!primaryAdvice?.habit || item.habit?.id !== primaryAdvice.habit.id)
  );
  const riskyAdviceCount = adviceItems.filter((item) => item.tone === "urgent").length;
  const dataAdviceCount = adviceItems.filter((item) => item.tone === "data").length;
  const insightSource = recommendationItems.length > 0
    ? adviceItems.filter((item) => item.tone !== "normal")
    : fallbackAdviceItems;
  const insightItems = insightSource
    .filter(
      (item) =>
        item.id !== primaryAdvice?.id &&
        (!primaryAdvice?.habit || item.habit?.id !== primaryAdvice.habit.id)
    )
    .slice(0, 3);

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
          Сначала конкретный следующий шаг, затем контекст по рискам и истории
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

      {activeHabits.length === 0 ? (
        <section className="tips-section-panel">
          <TipsEmptyState>
            Создайте первую привычку, и здесь появятся советы по риску и возвращению.
          </TipsEmptyState>
        </section>
      ) : (
        <>
          <div className="tips-dashboard-grid">
            <section className="tips-focus-panel">
              <div className="tips-section-heading">
                <h2>Совет на сейчас</h2>
                <p>Самое полезное действие по текущим привычкам</p>
              </div>
              {primaryAdvice ? (
                <RecommendationCard
                  ctaLabel={primaryAdvice.ctaLabel}
                  habitTitle={primaryAdvice.habitTitle}
                  reason={primaryAdvice.reason}
                  advice={primaryAdvice.advice}
                  tone={primaryAdvice.tone}
                  metaLabel="Следующий шаг"
                  featured
                  onAction={() => handleAdviceAction(primaryAdvice)}
                />
              ) : (
                <TipsEmptyState>
                  Обновите советы после нескольких отметок, и здесь появится следующий шаг
                </TipsEmptyState>
              )}
            </section>

            <aside className="tips-insight-panel" aria-label="Контекст по привычкам">
              <div className="tips-section-heading">
                <h2>Контекст</h2>
                <p>Риски и точность советов без перегруза</p>
              </div>
              <div className="tips-stat-grid">
                <div>
                  <strong>{adviceItems.length}</strong>
                  <span>советов</span>
                </div>
                <div>
                  <strong>{riskyAdviceCount}</strong>
                  <span>в риске</span>
                </div>
                <div>
                  <strong>{dataAdviceCount}</strong>
                  <span>мало истории</span>
                </div>
              </div>
              <div className="tips-insight-list">
                {insightItems.length > 0 ? (
                  insightItems.map((item) => (
                    <button
                      className={`tips-insight-row tips-insight-row-${item.tone}`}
                      key={item.id}
                      type="button"
                      onClick={() => handleAdviceAction(item)}
                    >
                      <span>{getAdviceLabel(item.tone)}</span>
                      <strong>{item.habitTitle}</strong>
                      <small>{item.reason}</small>
                    </button>
                  ))
                ) : (
                  <TipsEmptyState>
                    Критичных рисков нет, истории достаточно для обычных советов
                  </TipsEmptyState>
                )}
              </div>
            </aside>
          </div>

          <section className="tips-section-panel tips-advice-panel">
            <div className="tips-section-heading">
              <h2>Следующие советы</h2>
              <p>Практичные подсказки по привычкам, регулярности и возвращению</p>
            </div>
            <div className="tips-card-list tips-card-list-wide">
              {secondaryAdviceItems.length > 0 ? (
                secondaryAdviceItems.map((item) => (
                  <RecommendationCard
                    ctaLabel={item.ctaLabel}
                    habitTitle={item.habitTitle}
                    key={item.id}
                    reason={item.reason}
                    advice={item.advice}
                    tone={item.tone}
                    metaLabel={getAdviceLabel(item.tone)}
                    onAction={() => handleAdviceAction(item)}
                  />
                ))
              ) : (
                <TipsEmptyState>
                  Пока достаточно одного главного совета. Новые появятся после отметок
                </TipsEmptyState>
              )}
            </div>
          </section>
        </>
      )}
    </section>
  );
}
