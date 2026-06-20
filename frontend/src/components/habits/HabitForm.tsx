import type { FormEvent } from "react";

import type { Difficulty, FrequencyType, HabitFormState, WeekdayKey } from "../../types/habit";
import {
  completePreferredTimeInput,
  formatPreferredTimeInput,
  habitStarterTemplates,
  preferredTimePattern,
  weekdayKeys
} from "../../utils/habitForm";
import { habitLimits } from "../../utils/formLimits";
import { Button } from "../ui/Button";
import { Input, Textarea } from "../ui/Input";

interface HabitFormProps {
  form: HabitFormState;
  setForm: React.Dispatch<React.SetStateAction<HabitFormState>>;
  editingHabitId: number | null;
  isSubmitting?: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}

const weekdayLabels: Record<WeekdayKey, string> = {
  mon: "Пн",
  tue: "Вт",
  wed: "Ср",
  thu: "Чт",
  fri: "Пт",
  sat: "Сб",
  sun: "Вс"
};

const weekdayFullLabels: Record<WeekdayKey, string> = {
  mon: "Понедельник",
  tue: "Вторник",
  wed: "Среда",
  thu: "Четверг",
  fri: "Пятница",
  sat: "Суббота",
  sun: "Воскресенье"
};

function formatSelectedDayCount(count: number) {
  if (count === weekdayKeys.length) {
    return "Каждый день";
  }
  if (count === 1) {
    return "1 день выбран";
  }
  if (count > 1 && count < 5) {
    return `${count} дня выбрано`;
  }
  return `${count} дней выбрано`;
}

export function HabitForm({
  form,
  setForm,
  editingHabitId,
  isSubmitting = false,
  onSubmit,
  onCancel
}: HabitFormProps) {
  const selectedDayLabels = weekdayKeys
    .filter((day) => form.scheduledDays.includes(day))
    .map((day) => weekdayLabels[day]);
  const weekdayHint =
    selectedDayLabels.length === 0
      ? "Выберите дни"
      : formatSelectedDayCount(selectedDayLabels.length);
  const isCustomScheduleEmpty =
    form.frequency_type === "custom" && selectedDayLabels.length === 0;
  const submitLabel = isSubmitting
    ? editingHabitId
      ? "Сохраняем"
      : "Создаём"
    : editingHabitId
      ? "Сохранить изменения"
      : "Создать привычку";

  function toggleScheduledDay(day: WeekdayKey) {
    setForm((current) => {
      const hasDay = current.scheduledDays.includes(day);
      return {
        ...current,
        scheduledDays: hasDay
          ? current.scheduledDays.filter((item) => item !== day)
          : weekdayKeys.filter((item) => [...current.scheduledDays, day].includes(item))
      };
    });
  }

  function applyTemplate(templateId: string) {
    const template = habitStarterTemplates.find((item) => item.id === templateId);
    if (!template) {
      return;
    }

    setForm({
      ...template.form,
      scheduledDays: [...template.form.scheduledDays]
    });
  }

  return (
    <form className="habit-form" onSubmit={onSubmit}>
      {!editingHabitId && (
        <section className="habit-template-section" aria-labelledby="habit-template-title">
          <div className="habit-form-section-head">
            <span className="habit-form-step">00</span>
            <h3 id="habit-template-title">Быстрый старт</h3>
            <span className="form-hint">можно изменить после выбора</span>
          </div>

          <div className="habit-template-grid">
            {habitStarterTemplates.map((template) => {
              const isActive = form.title === template.form.title;

              return (
                <button
                  aria-pressed={isActive}
                  className={isActive ? "habit-template-card active" : "habit-template-card"}
                  disabled={isSubmitting}
                  key={template.id}
                  onClick={() => applyTemplate(template.id)}
                  type="button"
                >
                  <span>{template.title}</span>
                  <small>{template.description}</small>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="habit-form-section">
        <div className="habit-form-section-head">
          <span className="habit-form-step">01</span>
          <h3>Что делаем?</h3>
        </div>

        <label>
          Название
          <Input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            minLength={habitLimits.titleMinLength}
            maxLength={habitLimits.titleMaxLength}
            placeholder="Читать 20 минут"
            required
          />
        </label>

        <label>
          Описание
          <Textarea
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                description: event.target.value
              }))
            }
            maxLength={habitLimits.descriptionMaxLength}
            placeholder="Коротко опишите действие"
            rows={3}
          />
        </label>
      </section>

      <section className="habit-form-section">
        <div className="habit-form-section-head">
          <span className="habit-form-step">02</span>
          <h3>Когда повторять?</h3>
          <span className="form-hint">выберите дни, когда хотите повторять привычку</span>
        </div>

        <div className="form-row habit-schedule-row">
          <label className="frequency-field">
            Частота
            <select
              className="field-control"
              value={form.frequency_type}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  frequency_type: event.target.value as FrequencyType,
                  scheduledDays:
                    event.target.value === "daily" ? weekdayKeys : current.scheduledDays
                }))
              }
            >
              <option value="daily">Ежедневно</option>
              <option value="custom">По дням</option>
            </select>
          </label>

          <label>
            Удобное время
            <Input
              aria-describedby="preferred-time-hint"
              className="time-text-field"
              inputMode="numeric"
              maxLength={5}
              pattern={preferredTimePattern}
              placeholder="10:00"
              title="Введите время в формате 10:00"
              type="text"
              value={form.preferred_time}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  preferred_time: formatPreferredTimeInput(event.target.value)
                }))
              }
              onBlur={(event) =>
                setForm((current) => ({
                  ...current,
                  preferred_time: completePreferredTimeInput(event.target.value)
                }))
              }
            />
            <span className="field-hint" id="preferred-time-hint">
              например 10:00, можно не выбирать
            </span>
          </label>
        </div>

        {form.frequency_type === "custom" && (
          <fieldset
            className={`weekday-selector ${isCustomScheduleEmpty ? "weekday-selector-empty" : ""}`}
          >
            <legend>
              <span>Дни недели</span>
              <span className="weekday-hint" aria-live="polite">
                {weekdayHint}
              </span>
            </legend>
            <div className="weekday-options" aria-label="Дни повторения привычки">
              {weekdayKeys.map((day) => {
                const isSelected = form.scheduledDays.includes(day);
                return (
                  <button
                    type="button"
                    className={isSelected ? "weekday-option active" : "weekday-option"}
                    aria-pressed={isSelected}
                    aria-label={`${weekdayFullLabels[day]}: ${isSelected ? "выбрано" : "не выбрано"}`}
                    key={day}
                    onClick={() => toggleScheduledDay(day)}
                  >
                    {weekdayLabels[day]}
                  </button>
                );
              })}
            </div>
            {isCustomScheduleEmpty && (
              <span className="field-hint field-hint-error">Выберите хотя бы один день</span>
            )}
          </fieldset>
        )}
      </section>

      <section className="habit-form-section">
        <div className="habit-form-section-head">
          <span className="habit-form-step">03</span>
          <h3>Нагрузка</h3>
          <span className="form-hint">от сложности зависит XP</span>
        </div>

        <label className="difficulty-field">
          Сложность
          <select
            className="field-control"
            value={form.difficulty}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                difficulty: event.target.value as Difficulty
              }))
            }
          >
            <option value="easy">Легкая</option>
            <option value="medium">Средняя</option>
            <option value="hard">Сложная</option>
          </select>
        </label>
      </section>

      <div className="form-actions">
        <Button variant="cta" disabled={isSubmitting || isCustomScheduleEmpty}>
          {submitLabel}
        </Button>
        {editingHabitId && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Отменить
          </Button>
        )}
      </div>
    </form>
  );
}
