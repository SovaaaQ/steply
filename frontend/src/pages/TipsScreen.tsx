import { RecommendationCard } from "../components/recommendations/RecommendationCard";
import { Button } from "../components/ui/Button";
import { useDashboardData, useNavigation } from "../app/providers";
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

const MAX_ADVICE_WORDS = 56;
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
  const text = stripOuterQuotes(
    withoutListTail
      .replace(/\u00a0/g, " ")
      .replace(/[—–−]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[ ,;:.!?]+$/g, "")
  );
  const words = text.split(" ").filter(Boolean);
  if (words.length <= MAX_ADVICE_WORDS) {
    return text;
  }
  return words.slice(0, MAX_ADVICE_WORDS).join(" ").replace(/[ ,;:.!?]+$/, "");
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
    return [
      "Сегодня: привычка уже отмечена, новых действий на сегодня не нужно",
      "Минимум: оставьте одну заметку или подсказку для следующего повтора",
      "Готово: сегодняшний результат сохранен, следующий старт понятен"
    ].join(" ");
  }

  const nextOccurrence = formatNextScheduledOccurrence(
    getNextScheduledOccurrence(habit, new Date(), 1)
  );

  return [
    `Сегодня: привычка уже отмечена, подготовьте следующий старт: ${getPersonalSetupAction(habit)}`,
    "Минимум: просто оставьте подсказку на видном месте без второго подхода сегодня",
    `Готово: сегодняшний результат сохранен, следующий повтор ${nextOccurrence}`
  ].join(" ");
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

type HabitTopic =
  | "language"
  | "study"
  | "code"
  | "reading"
  | "smoking"
  | "sport"
  | "health"
  | "leisure"
  | "general";

function getHabitContextText(habit?: Habit) {
  return `${habit?.title ?? ""} ${habit?.description ?? ""}`.toLowerCase();
}

function getHabitTopic(habit?: Habit): HabitTopic {
  const context = getHabitContextText(habit);
  if (/(англий|english|слова|язык)/.test(context)) {
    return "language";
  }
  if (/(диплом|курсов|учеб|проект|курс|урок|лекц|конспект|матем)/.test(context)) {
    return "study";
  }
  if (/(python|пайтон|код|программ)/.test(context)) {
    return "code";
  }
  if (/(чтен|книг)/.test(context)) {
    return "reading";
  }
  if (/(курен|сигар|никотин)/.test(context)) {
    return "smoking";
  }
  if (/(спорт|трен|заряд|скакал|прыж|пробеж|гантел|йог)/.test(context)) {
    return "sport";
  }
  if (/(здоров|сон|спать|засып|вод|лекар|таблет|витамин|питани|завтрак|давлен|самочув|медитац|дыхани)/.test(context)) {
    return "health";
  }
  if (/(отдых|игр|хобби|музык|гитар|рисова|рисун|творч|фильм|сериал|танц|прогул)/.test(context)) {
    return "leisure";
  }
  return "general";
}

function getPreferredTimeHint(habit?: Habit) {
  return habit?.preferred_time ? ` в ${habit.preferred_time.slice(0, 5)}` : "";
}

function getHealthFocus(habit?: Habit) {
  const context = getHabitContextText(habit);
  if (/(сон|спать|засып)/.test(context)) {
    return "sleep";
  }
  if (/вод/.test(context)) {
    return "water";
  }
  if (/(лекар|таблет|витамин)/.test(context)) {
    return "medicine";
  }
  if (/(питани|завтрак|обед|ужин)/.test(context)) {
    return "nutrition";
  }
  if (/(медитац|дыхани)/.test(context)) {
    return "calm";
  }
  return "general";
}

function getLeisureFocus(habit?: Habit) {
  const context = getHabitContextText(habit);
  if (/(рисова|рисун|творч)/.test(context)) {
    return "drawing";
  }
  if (/(музык|гитар)/.test(context)) {
    return "music";
  }
  if (/(фильм|сериал)/.test(context)) {
    return "watching";
  }
  if (/(прогул|танц)/.test(context)) {
    return "movement";
  }
  if (/игр/.test(context)) {
    return "game";
  }
  return "general";
}

function getPersonalPrimaryAction(habit?: Habit) {
  const title = getHabitTitle(habit);
  const timeHint = getPreferredTimeHint(habit);
  switch (getHabitTopic(habit)) {
    case "language":
      return "повторите вслух три знакомых слова и один короткий диалог";
    case "study":
      return `откройте файл «${title}»${timeHint} и поправьте один конкретный абзац`;
    case "code":
      return "откройте редактор и запустите один короткий пример кода";
    case "reading":
      return "откройте книгу на закладке и прочитайте один короткий фрагмент";
    case "sport":
      return "сделайте короткую разминку и завершите на первом легком повторе";
    case "smoking":
      return "отложите первую сигарету, выпейте воды и отметьте момент тяги";
    case "health": {
      const focus = getHealthFocus(habit);
      if (focus === "sleep") {
        return "подготовьте сон: уберите экран и сделайте комнату чуть спокойнее";
      }
      if (focus === "water") {
        return "налейте стакан воды, выпейте комфортный объем и отметьте привычку";
      }
      if (focus === "medicine") {
        return "сверьтесь со своим напоминанием или назначением и отметьте факт выполнения";
      }
      if (focus === "nutrition") {
        return "подготовьте простой прием пищи без усложнения и отметьте результат";
      }
      if (focus === "calm") {
        return "сделайте одну спокойную минуту дыхания и отметьте паузу";
      }
      return "выполните небольшой безопасный шаг для самочувствия и отметьте его";
    }
    case "leisure": {
      const focus = getLeisureFocus(habit);
      if (focus === "drawing") {
        return "откройте материалы и сделайте один быстрый набросок без оценки";
      }
      if (focus === "music") {
        return "возьмите инструмент или включите трек и уделите этому одну короткую минуту";
      }
      if (focus === "watching") {
        return "выберите короткий фрагмент для отдыха и остановитесь после него";
      }
      if (focus === "movement") {
        return "выйдите на короткую прогулку или подвигайтесь под один трек";
      }
      if (focus === "game") {
        return "сыграйте один короткий раунд и заранее выберите точку остановки";
      }
      return "начните приятное занятие с короткого слота без требования результата";
    }
    default:
      return `сделайте один короткий шаг для «${title}»`;
  }
}

function getPersonalMinimumAction(habit?: Habit) {
  const customTask = habit?.recovery_task?.trim();
  if (customTask) {
    return customTask.charAt(0).toLowerCase() + customTask.slice(1).replace(/[ ,;:.!?]+$/g, "");
  }

  switch (getHabitTopic(habit)) {
    case "language":
      return "только три слова вслух без новой темы";
    case "study":
      return "только откройте документ и выделите место следующей правки";
    case "code":
      return "только откройте редактор и добавьте одну строку";
    case "reading":
      return "одна страница с закладки без нормы по времени";
    case "sport":
      return "две минуты разминки без полной тренировки";
    case "smoking":
      return "пауза без спора с собой: вода, дыхание и запись триггера";
    case "health": {
      const focus = getHealthFocus(habit);
      if (focus === "sleep") {
        return "только уберите экран и приглушите свет";
      }
      if (focus === "water") {
        return "только поставьте стакан воды рядом";
      }
      if (focus === "medicine") {
        return "только откройте напоминание и проверьте назначение";
      }
      if (focus === "nutrition") {
        return "только подготовьте один простой продукт или тарелку";
      }
      if (focus === "calm") {
        return "только один спокойный вдох и выдох";
      }
      return "один безопасный микрошаг без попытки резко менять режим";
    }
    case "leisure": {
      const focus = getLeisureFocus(habit);
      if (focus === "drawing") {
        return "только откройте материалы и проведите одну линию";
      }
      if (focus === "music") {
        return "только возьмите инструмент или включите один фрагмент";
      }
      if (focus === "watching") {
        return "только выберите короткий фрагмент без автопродолжения";
      }
      if (focus === "movement") {
        return "только выйдите на несколько минут или включите один трек";
      }
      if (focus === "game") {
        return "только один короткий раунд без продления";
      }
      return "пять минут приятного занятия без цели закончить";
    }
    default:
      return "один видимый шаг без полной версии привычки";
  }
}

function getPersonalDoneCriteria(habit?: Habit) {
  switch (getHabitTopic(habit)) {
    case "language":
      return "слова произнесены или завершен один короткий диалог";
    case "study":
      return "файл сохранен с одной правкой или двумя пунктами плана";
    case "code":
      return "редактор открыт, пример запущен или одна строка изменена";
    case "reading":
      return "фрагмент дочитан и чтение отмечено";
    case "sport":
      return "разминка сделана и отмечена";
    case "smoking":
      return "пауза отмечена и триггер записан; при сильной тяге стоит обратиться к специалисту";
    case "health": {
      const focus = getHealthFocus(habit);
      if (focus === "medicine") {
        return "назначение проверено, факт выполнения отмечен; дозировки не менялись";
      }
      if (focus === "sleep") {
        return "условия для сна подготовлены и шаг отмечен";
      }
      if (focus === "water") {
        return "вода подготовлена или выпита в комфортном объеме, отметка добавлена";
      }
      return "безопасный шаг для самочувствия сделан и отмечен";
    }
    case "leisure":
      return "короткий отдых начат, точка остановки понятна и шаг отмечен";
    default:
      return `шаг для «${getHabitTitle(habit)}» отмечен в приложении`;
  }
}

function getPersonalSetupAction(habit?: Habit) {
  const context = getHabitContextText(habit);
  switch (getHabitTopic(habit)) {
    case "language":
      return "оставьте список слов открытым на первом экране или закладке";
    case "study":
      return "откройте документ на нужном месте и оставьте пометку для следующей правки";
    case "code":
      return "откройте проект и оставьте рядом одну понятную задачу для следующего запуска";
    case "reading":
      return "положите книгу с закладкой на видное место";
    case "sport":
      if (/скакал/.test(context)) {
        return "положите скакалку на видное место для следующей короткой разминки";
      }
      if (/кроссов/.test(context)) {
        return "поставьте кроссовки на видное место для следующего выхода";
      }
      if (/коврик/.test(context)) {
        return "положите коврик на видное место для следующей короткой разминки";
      }
      return "подготовьте одежду или инвентарь для следующей короткой разминки";
    case "smoking":
      return "запишите триггер и подготовьте воду для следующей паузы";
    case "health": {
      const focus = getHealthFocus(habit);
      if (focus === "sleep") {
        return "оставьте телефон вне кровати и подготовьте спокойный свет";
      }
      if (focus === "water") {
        return "поставьте стакан или бутылку воды на видное место";
      }
      if (focus === "medicine") {
        return "проверьте напоминание и оставьте его на привычном месте";
      }
      if (focus === "nutrition") {
        return "оставьте простую заготовку или список продуктов на видном месте";
      }
      return "оставьте безопасную подсказку для следующего шага самочувствия";
    }
    case "leisure": {
      const focus = getLeisureFocus(habit);
      if (focus === "drawing") {
        return "положите материалы на видное место для короткого наброска";
      }
      if (focus === "music") {
        return "оставьте инструмент или плейлист готовым к короткому старту";
      }
      if (focus === "watching") {
        return "выберите короткий фрагмент заранее и отключите автопродолжение";
      }
      if (focus === "game") {
        return "выберите один короткий режим и точку остановки заранее";
      }
      return "подготовьте приятное занятие так, чтобы начать без долгого выбора";
    }
    default:
      return "оставьте видимую подсказку для следующего короткого шага";
  }
}

function getPersonalActionPlan(habit?: Habit, recommendationType = "default") {
  const primary = getPersonalPrimaryAction(habit);
  const minimum = getPersonalMinimumAction(habit);
  const done = getPersonalDoneCriteria(habit);

  switch (recommendationType) {
    case "risk_ignored_recovery":
      return [
        `Сегодня: уберите полную версию и оставьте только точку входа: ${minimum}`,
        `Минимум: уменьшите условие еще вдвое, если даже этот шаг кажется тяжелым`,
        `Готово: условия облегчены и отмечен минимальный шаг`
      ].join(" ");
    case "reset_plan":
      return [
        `Сегодня: начните новый цикл без старой нормы: ${minimum}`,
        `Минимум: только первый видимый шаг без попытки закрыть всю паузу`,
        `Готово: план упрощен и отмечен первый шаг перезапуска`
      ].join(" ");
    case "miss_streak_recovery":
      return [
        `Сегодня: разорвите серию пропусков одним минимальным шагом: ${minimum}`,
        `Минимум: ${minimum} без компенсации прошлых дней`,
        `Готово: серия пропусков остановлена новой отметкой`
      ].join(" ");
    case "early_recovery":
      return [
        `Сегодня: закройте первый разрыв коротким вариантом: ${minimum}`,
        `Минимум: ${minimum} без компенсации первого пропуска`,
        `Готово: первый пропуск не стал серией`
      ].join(" ");
    case "risk_recovery":
      return [
        `Сегодня: снизьте риск до пропуска: ${minimum}`,
        `Минимум: сделайте это до обычного времени или ближайшего свободного окна`,
        `Готово: барьер снижен до пропуска, минимум отмечен`
      ].join(" ");
    case "soft_recovery":
    case "reduce_difficulty":
    case "restore_regular_activity":
      return [
        `Сегодня: снизьте объем до короткой версии: ${minimum}`,
        `Минимум: ${minimum}`,
        `Готово: минимальная версия завершена`
      ].join(" ");
    case "plan_ahead":
      return [
        `Сегодня: подготовьте первый шаг заранее: ${primary}`,
        `Минимум: ${minimum}`,
        `Готово: время и место старта понятны до выполнения`
      ].join(" ");
    default:
      return [
        `Сегодня: ${primary}`,
        `Минимум: ${minimum}`,
        `Готово: ${done}`
      ].join(" ");
  }
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
    parts.push("выполнено сегодня");
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
    return `${isDone ? "Это риск на следующий раз, " : ""}${getPredictionRiskReason(stats, prediction)}`;
  }
  return "Совет собран по истории привычек и последним отметкам";
}

function getRecommendationAdvice(recommendation: Recommendation, habit?: Habit) {
  if (habit) {
    return getPersonalActionPlan(habit, recommendation.type);
  }

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
    pendingHabitActionIds,
    getTodayEntry,
    markHabit
  } = useDashboardData();
  const { setActiveSection } = useNavigation();
  const {
    recommendations,
    activeHabits,
    isLoading,
    markRecommendationRead,
    refreshRecommendations
  } = useRecommendations();

  const activeHabitById = new Map(activeHabits.map((habit) => [habit.id, habit]));
  const pendingHabitIds = new Set(pendingHabitActionIds);
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
        advice: getPersonalActionPlan(habit, "risk_recovery"),
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
          : getPersonalActionPlan(habit),
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
          isDone
            ? getTodayFollowUpAdvice(habit)
            : recommendation.message || getRecommendationAdvice(recommendation, habit)
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

  async function handleAdviceAction(item: AdviceItem) {
    const hasDirectHabitAction = Boolean(item.habit && item.markStatus);
    if (item.habit && item.markStatus) {
      const isMarked = await markHabit(item.habit.id, item.markStatus);
      if (isMarked && item.recommendationId) {
        await markRecommendationRead(item.recommendationId, { silent: hasDirectHabitAction });
      }
      return;
    }
    if (item.recommendationId) {
      await markRecommendationRead(item.recommendationId, { silent: hasDirectHabitAction });
    }
    setActiveSection("habits");
  }

  return (
    <section className="recommendations-page page-stack">
      <div className="page-intro">
        <div>
          <span className="page-kicker">Советы</span>
          <h2>Рекомендации на сегодня</h2>
          <p>Сначала конкретный следующий шаг, затем контекст по рискам и истории</p>
        </div>
        <Button
          className="tips-refresh-button"
          type="button"
          variant="secondary"
          disabled={isLoading || activeHabits.length === 0}
          aria-busy={isLoading || undefined}
          onClick={() => void refreshRecommendations()}
        >
          {isLoading ? "Обновляем" : "Обновить советы"}
        </Button>
      </div>

      {activeHabits.length === 0 ? (
        <section className="tips-section-panel">
          <TipsEmptyState>
            Создайте первую привычку, и здесь появятся советы по риску и возвращению
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
                  isActionPending={
                    primaryAdvice.habit ? pendingHabitIds.has(primaryAdvice.habit.id) : false
                  }
                  onAction={() => void handleAdviceAction(primaryAdvice)}
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
                      disabled={item.habit ? pendingHabitIds.has(item.habit.id) : false}
                      aria-busy={
                        item.habit && pendingHabitIds.has(item.habit.id) ? true : undefined
                      }
                      onClick={() => void handleAdviceAction(item)}
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
              <h2>Что сделать дальше</h2>
              <p>Короткие действия по привычкам, регулярности и возвращению</p>
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
                    isActionPending={item.habit ? pendingHabitIds.has(item.habit.id) : false}
                    onAction={() => void handleAdviceAction(item)}
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
