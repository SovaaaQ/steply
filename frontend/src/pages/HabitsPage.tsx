import { useEffect, useRef, useState } from "react";

import { HabitForm } from "../components/habits/HabitForm";
import { HabitList } from "../components/habits/HabitList";
import { PetSetup } from "../components/gamification/PetSetup";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { ErrorState } from "../components/ui/ErrorState";
import { useAppData } from "../app/providers";
import { useHabits } from "../hooks/useHabits";
import type { Habit } from "../types/habit";

export function HabitsPage() {
  const {
    closeHabitForm,
    error,
    gamification,
    isHabitFormOpen,
    openHabitCreator,
    updatePet
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
  const [habitToDelete, setHabitToDelete] = useState<Habit | null>(null);
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
      <div className="page-intro">
        <div>
          <span className="page-kicker">Привычки</span>
          <h2>Ваши привычки</h2>
          <p>Отметьте привычку, чтобы поддержать питомца и сохранить темп дня</p>
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
        onDelete={(habitId) => {
          const habit = activeHabits.find((item) => item.id === habitId);
          if (habit) {
            setHabitToDelete(habit);
          }
        }}
        onMark={(habitId, status) => void markHabit(habitId, status)}
      />

      {habitToDelete && (
        <ConfirmDialog
          title="Удалить привычку?"
          description={`«${habitToDelete.title}» будет удалена вместе с историей выполнения.`}
          confirmLabel="Удалить"
          tone="danger"
          onCancel={() => setHabitToDelete(null)}
          onConfirm={() => {
            const habitId = habitToDelete.id;
            setHabitToDelete(null);
            void deleteHabit(habitId);
          }}
        />
      )}

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
                <PetSetup
                  description="Сохраним питомца и сразу продолжим создание привычки в этой же форме"
                  onSubmit={updatePet}
                  pet={gamification.pet}
                  submitLabel="Продолжить к привычке"
                  title="Сначала выберите спутника"
                />
              </div>
            )}
          </article>
        </div>
      )}
    </section>
  );
}
