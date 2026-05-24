import { useEffect, useRef, useState } from "react";
import type { Habit, HabitEntry, EntryStatus } from "../../types/habit";
import type { HabitStats } from "../../types/statistics";
import type { Prediction } from "../../types/recommendation";
import { formatPreferredTime, percent } from "../../utils/formatDate";
import { getXPForCompletion } from "../../utils/gamification";
import {
  formatFirstScheduledOccurrence,
  formatNextScheduledOccurrence,
  getHabitCurrentPeriodState,
  getNextScheduledOccurrence
} from "../../utils/habitSchedule";
import {
  formatRiskDisplay,
  getRiskLevel,
  hasEnoughRiskData,
  riskDescriptions
} from "../../utils/risk";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ProgressBar } from "../ui/ProgressBar";
import { HabitStatusBadge } from "./HabitStatusBadge";
import { RiskBadge } from "../recommendations/RiskBadge";
import { RecoverySuggestion } from "./RecoverySuggestion";

const weekdayLabels: Record<string, string> = {
  mon: "Пн",
  tue: "Вт",
  wed: "Ср",
  thu: "Чт",
  fri: "Пт",
  sat: "Сб",
  sun: "Вс"
};

function formatSchedule(habit: Habit) {
  if (habit.frequency_type === "daily" || habit.schedule_days.length === 7) {
    return "Ежедневно";
  }
  return habit.schedule_days.map((day) => weekdayLabels[day] ?? day).join(", ");
}

interface HabitCardProps {
  habit: Habit;
  prediction?: Prediction;
  stats?: HabitStats;
  todayEntry?: HabitEntry;
  compact?: boolean;
  onEdit?: (habit: Habit) => void;
  onDelete?: (habitId: number) => void;
  onMark: (habitId: number, status: EntryStatus) => void;
}

export function HabitCard({
  habit,
  prediction,
  stats,
  todayEntry,
  compact = false,
  onEdit,
  onDelete,
  onMark
}: HabitCardProps) {
  const [isRiskPopoverOpen, setIsRiskPopoverOpen] = useState(false);
  const riskInfoRef = useRef<HTMLSpanElement>(null);
  const hasRiskData = hasEnoughRiskData(prediction, stats);
  const riskLevel = hasRiskData ? getRiskLevel(prediction) : undefined;
  const riskDisplay = formatRiskDisplay(prediction, stats);
  const riskPopoverId = `risk-popover-${habit.id}`;
  const completionRate = stats?.completion_rate ?? 0;
  const completionPercent = Math.round(completionRate * 100);
  const isCompletedToday = todayEntry?.status === "completed";
  const isRecoveredToday = todayEntry?.status === "recovery_completed";
  const isMissedToday = todayEntry?.status === "missed";
  const completionXP = getXPForCompletion("completed", habit.difficulty);
  const now = new Date();
  const hasEntries = (stats?.total_entries ?? 0) > 0;
  const periodState = getHabitCurrentPeriodState(habit, now, hasEntries, todayEntry);
  const scheduleAvailability = periodState.availability;
  const nextOccurrence = getNextScheduledOccurrence(
    habit,
    now,
    isCompletedToday || isRecoveredToday ? 1 : 0
  );
  const firstOccurrence = !hasEntries
    ? getNextScheduledOccurrence(
        habit,
        now,
        scheduleAvailability.reason === "first-after-preferred-time" ? 1 : 0
      )
    : undefined;
  const isAvailableToday = periodState.state === "available_to_complete";
  const isLateCompletion = todayEntry?.meta?.late_completion === true;
  const unavailableMessage =
    scheduleAvailability.reason === "first-after-preferred-time"
      ? "Первое выполнение перенесено"
      : "Не запланировано на сегодня";
  const rewardLabel =
    isCompletedToday || isRecoveredToday ? "Питомец поддержан" : "Связь с питомцем";

  useEffect(() => {
    if (!isRiskPopoverOpen) {
      return;
    }

    const closeOnOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (riskInfoRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsRiskPopoverOpen(false);
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsRiskPopoverOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("touchstart", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("touchstart", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isRiskPopoverOpen]);

  return (
    <Card className={`habit-card ${isCompletedToday || isRecoveredToday ? "habit-completed" : ""} ${isMissedToday ? "habit-missed" : ""}`}>
      <div className="habit-card-intro">
        <div className="habit-card-main">
          <div>
            <div className="habit-title-row">
              <h3>{habit.title}</h3>
              <RiskBadge prediction={prediction} stats={stats} />
              {todayEntry && <HabitStatusBadge status={todayEntry.status} />}
            </div>
            <p>{habit.description || "Короткая привычка без описания"}</p>
          </div>

          {!compact && (
            <div className="habit-card-actions">
              {onEdit && (
                <Button variant="text" onClick={() => onEdit(habit)}>
                  Редактировать
                </Button>
              )}
              {onDelete && (
                <Button variant="text" className="danger-text" onClick={() => onDelete(habit.id)}>
                  Удалить
                </Button>
              )}
            </div>
          )}
        </div>

        <svg className="habit-card-accent" viewBox="0 0 760 34" preserveAspectRatio="none" aria-hidden="true">
          <path d="M4 19 C68 11 116 25 180 18 C246 10 294 25 358 18 C423 10 472 25 536 18 C584 13 627 21 660 18" />
          <g className="habit-card-accent-burst">
            <line x1="694" y1="14" x2="708" y2="3" />
            <line x1="707" y1="20" x2="732" y2="15" />
            <line x1="699" y1="27" x2="720" y2="31" />
          </g>
        </svg>
      </div>

      <div className="habit-progress">
        <div className="habit-progress-row">
          <span>Прогресс привычки</span>
          <strong>{percent(completionRate)}</strong>
        </div>
        <ProgressBar value={completionPercent} variant="habit" label={`Прогресс ${habit.title}`} />
      </div>

      <dl className="habit-facts">
        <div>
          <dt>Частота</dt>
          <dd>{formatSchedule(habit)}</dd>
        </div>
        <div>
          <dt>Время</dt>
          <dd>{formatPreferredTime(habit.preferred_time)}</dd>
        </div>
        <div>
          <dt>Серия</dt>
          <dd>{stats?.current_streak ?? 0}</dd>
        </div>
        <div>
          <dt>Выполнение</dt>
          <dd>{percent(completionRate)}</dd>
        </div>
        <div>
          <dt>
            <span>
              {isCompletedToday || isRecoveredToday ? "Риск следующего шага" : "Риск пропуска"}
            </span>
            <span className={`risk-info ${isRiskPopoverOpen ? "open" : ""}`} ref={riskInfoRef}>
              <button
                className="risk-help-button"
                type="button"
                aria-label="Как рассчитывается риск"
                aria-controls={riskPopoverId}
                aria-expanded={isRiskPopoverOpen}
                onClick={() => setIsRiskPopoverOpen((isOpen) => !isOpen)}
              >
                ?
              </button>
              <span className="risk-popover" id={riskPopoverId} role="note" aria-hidden={!isRiskPopoverOpen}>
                <strong>Как рассчитывается риск</strong>
                <span>Steply оценивает риск по:</span>
                <ul>
                  <li>регулярности выполнения</li>
                  <li>количеству пропусков</li>
                  <li>текущей серии</li>
                  <li>дням недели</li>
                  <li>истории активности</li>
                </ul>
                <span>Низкий: 0–39%</span>
                <span>Средний: 40–69%</span>
                <span>Высокий: 70–100%</span>
              </span>
            </span>
          </dt>
          <dd>{riskDisplay}</dd>
        </div>
      </dl>

      <p className="risk-explanation">
        {isCompletedToday || isRecoveredToday
          ? `Сегодня привычка уже выполнена. ${formatNextScheduledOccurrence(nextOccurrence)}.`
          : riskLevel
            ? riskDescriptions[riskLevel]
            : "Нужно еще несколько выполнений"}
      </p>

      <RecoverySuggestion
        habit={habit}
        predictedRisk={hasRiskData ? prediction.miss_risk : undefined}
        stats={stats}
        todayEntry={todayEntry}
        isAvailableToday={isAvailableToday}
        onRecover={() => onMark(habit.id, "recovery_completed")}
      />

      {scheduleAvailability.isPastPreferredTime && isAvailableToday && !todayEntry && (
        <div className="habit-schedule-hint habit-late-hint">
          <strong>Предпочтительное время прошло</strong>
          <span>Отметка доступна до конца запланированного дня</span>
        </div>
      )}

      {!isAvailableToday && !todayEntry ? (
        <div className="habit-schedule-hint">
          <strong>{unavailableMessage}</strong>
          <span>
            {firstOccurrence
              ? formatFirstScheduledOccurrence(firstOccurrence)
              : formatNextScheduledOccurrence(nextOccurrence)}
          </span>
        </div>
      ) : (
        <div className="habit-reward-row">
          <span>{rewardLabel}</span>
          <strong>
            {isLateCompletion
              ? "Отмечено после рекомендованного времени"
              : isCompletedToday || isRecoveredToday
                ? "Сегодня шаг уже учтен"
              : isMissedToday
                ? "Доступно восстановление"
                : `Выполнение даст +${completionXP} XP`}
          </strong>
        </div>
      )}

      <div className="habit-actions">
        <Button
          className="habit-action-button habit-action-complete"
          variant="cta"
          disabled={!periodState.canComplete}
          onClick={() => onMark(habit.id, "completed")}
        >
          <svg
            className="habit-button-accent habit-button-complete-accent"
            viewBox="0 0 34 34"
            aria-hidden="true"
          >
            <path d="M17 3 L15 14 L5 9 M15 14 L29 11 M15 14 L26 24 M15 14 L7 27" />
          </svg>
          <span className="habit-action-label">
            {isCompletedToday || isRecoveredToday ? "Выполнено сегодня" : "Закрыть шаг"}
          </span>
        </Button>
        {periodState.state === "missed" && (
          <Button
            className="habit-action-button habit-action-miss"
            variant="danger"
            disabled
            title="Пропуск уже учтен для этого периода"
          >
            <span className="habit-action-label">Пропуск учтен</span>
            <svg
              className="habit-button-accent habit-button-miss-accent"
              viewBox="0 0 56 24"
              aria-hidden="true"
            >
              <path d="M3 17 C12 11 18 7 23 12 C27 17 34 7 39 10 C43 13 48 12 53 8" />
            </svg>
          </Button>
        )}
      </div>
    </Card>
  );
}
