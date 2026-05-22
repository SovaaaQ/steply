import { useEffect, useRef } from "react";

import { HabitForm } from "../components/habits/HabitForm";
import { HabitList } from "../components/habits/HabitList";
import { Button } from "../components/ui/Button";
import { ErrorState } from "../components/ui/ErrorState";
import { useAppData } from "../app/providers";
import { useHabits } from "../hooks/useHabits";

export function HabitsPage() {
  const {
    closeHabitForm,
    error,
    gamification,
    isHabitFormOpen,
    openHabitCreator,
    setActiveSection
  } = useAppData();
  const drawerRef = useRef<HTMLElement>(null);
  const {
    activeHabits,
    predictions,
    habitStats,
    habitForm,
    setHabitForm,
    editingHabitId,
    submitHabit,
    startEditHabit,
    markHabit,
    deleteHabit,
    getTodayEntry
  } = useHabits();
  const hasPet = gamification.pet.is_configured;
  const drawerTitle = editingHabitId ? "Изменить привычку" : "Создать привычку";

  useEffect(() => {
    if (!isHabitFormOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeHabitForm();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);

    const focusTimer = window.setTimeout(() => {
      const firstField = drawerRef.current?.querySelector<HTMLInputElement>("input.field-control");
      const closeButton = drawerRef.current?.querySelector<HTMLButtonElement>(".drawer-close");
      (firstField ?? closeButton)?.focus();
    }, 80);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isHabitFormOpen]);

  return (
    <section className="page-stack">
      <div>
        <div className="section-heading">
          <div>
            <span className="page-kicker">Привычки</span>
            <h2>Управление привычками</h2>
          </div>
          <Button
            className="habit-page-create"
            type="button"
            variant="cta"
            onClick={openHabitCreator}
          >
            Новая привычка
          </Button>
        </div>
        <p className="habit-motivation">Выполни привычку, чтобы поддержать питомца</p>

        <Button
          className="mobile-habit-create"
          type="button"
          variant="cta"
          onClick={openHabitCreator}
        >
          Новая привычка
        </Button>

        <HabitList
          habits={activeHabits}
          predictions={predictions}
          stats={habitStats}
          getTodayEntry={getTodayEntry}
          onCreate={openHabitCreator}
          onEdit={startEditHabit}
          onDelete={(habitId) => void deleteHabit(habitId)}
          onMark={(habitId, status) => void markHabit(habitId, status)}
        />
      </div>

      {isHabitFormOpen && (
        <div
          className="habit-drawer-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeHabitForm();
            }
          }}
        >
          <article
            className="habit-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="habit-drawer-title"
            ref={drawerRef}
          >
            <div className="habit-drawer-head">
              <div>
                <span className="page-kicker">{editingHabitId ? "Редактирование" : "Новая привычка"}</span>
                <h2 id="habit-drawer-title">{drawerTitle}</h2>
              </div>
              <button
                type="button"
                className="drawer-close"
                aria-label="Закрыть форму привычки"
                onClick={closeHabitForm}
              >
                ×
              </button>
            </div>

            {error && <ErrorState message={error} />}

            {hasPet ? (
              <HabitForm
                form={habitForm}
                setForm={setHabitForm}
                editingHabitId={editingHabitId}
                onSubmit={(event) => void submitHabit(event)}
                onCancel={closeHabitForm}
              />
            ) : (
              <div className="pet-required-panel">
                <strong>Сначала выберите питомца</strong>
                <p>
                  После выбора питомца новые привычки будут поддерживать его состояние
                  и участвовать в прогрессе дня.
                </p>
                <Button
                  type="button"
                  variant="cta"
                  onClick={() => {
                    closeHabitForm();
                    setActiveSection("pet");
                  }}
                >
                  Выбрать питомца
                </Button>
              </div>
            )}
          </article>
        </div>
      )}
    </section>
  );
}
