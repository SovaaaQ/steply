import type { FormEvent } from "react";

import type { Difficulty, FrequencyType, HabitFormState, WeekdayKey } from "../../types/habit";
import { weekdayKeys } from "../../utils/habitForm";
import { Button } from "../ui/Button";
import { Input, Textarea } from "../ui/Input";

interface HabitFormProps {
  form: HabitFormState;
  setForm: React.Dispatch<React.SetStateAction<HabitFormState>>;
  editingHabitId: number | null;
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

  return (
    <form className="habit-form" onSubmit={onSubmit}>
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
              type="time"
              value={form.preferred_time}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  preferred_time: event.target.value
                }))
              }
            />
            <span className="field-hint">можно не выбирать</span>
          </label>
        </div>

        {form.frequency_type === "custom" && (
          <fieldset
            className={`weekday-selector ${selectedDayLabels.length === 0 ? "weekday-selector-empty" : ""}`}
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
        <Button variant="cta">{editingHabitId ? "Сохранить изменения" : "Создать привычку"}</Button>
        {editingHabitId && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Отменить
          </Button>
        )}
      </div>
    </form>
  );
}
