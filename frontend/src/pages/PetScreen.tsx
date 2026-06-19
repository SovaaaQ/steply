import { useEffect, useRef, useState } from "react";

import { PetSetup } from "../components/gamification/PetSetup";
import { PetStatusCard } from "../components/gamification/PetStatusCard";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useDashboardData, useHabitForm, useNavigation } from "../app/providers";
import { formatPetCaption } from "../utils/gamification";
import type { PetType } from "../types/auth";
import type { Goal, RewardEvent } from "../types/gamification";

const rewardDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short"
});

function getActiveGoals(goals: Goal[]) {
  return goals
    .filter((goal) => !goal.empty && goal.status !== "completed")
    .slice(0, 3);
}

function getRecentPositiveEvents(events: RewardEvent[]) {
  return events.filter((event) => event.xp_amount > 0).slice(0, 4);
}

function getProgressPercent(progress: number, target: number) {
  if (target <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(Math.round((progress / target) * 100), 100));
}

function formatRewardDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return rewardDateFormatter.format(date);
}

export function PetScreen() {
  const { activeHabits, gamification, updatePet } = useDashboardData();
  const { openHabitCreator } = useHabitForm();
  const { setActiveSection } = useNavigation();
  const [isEditing, setIsEditing] = useState(false);
  const editFormRef = useRef<HTMLDivElement | null>(null);
  const pet = gamification.pet;
  const activeGoals = getActiveGoals(gamification.goals);
  const recentEvents = getRecentPositiveEvents(gamification.recent_events);
  const nextAction = gamification.next_best_action;

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      editFormRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start"
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isEditing]);

  async function handlePetSubmit(payload: { pet_type: PetType; pet_name: string }) {
    await updatePet(payload);
    setIsEditing(false);
    if (activeHabits.length === 0) {
      openHabitCreator();
    }
  }

  function handleNextAction() {
    setActiveSection(nextAction.cta_section);
  }

  if (!pet.is_configured) {
    return (
      <section className="pet-screen page-stack">
        <div className="page-intro">
          <div>
            <span className="page-kicker">Питомец</span>
            <h2>
              Выберите <span className="marker-highlight">спутника</span>
            </h2>
            <p>
              Питомец меняет состояние по отметкам: регулярность растит уровень,
              а после пропусков появляется короткий шаг для возвращения
            </p>
          </div>
        </div>
        <Card className="pet-setup-card">
          <PetSetup
            description="После выбора можно сразу создать первую привычку: XP, цели и советы начнут считаться по отметкам"
            pet={pet}
            onSubmit={handlePetSubmit}
          />
        </Card>
      </section>
    );
  }

  return (
    <section className="pet-screen page-stack">
      <div className="page-intro">
        <div>
          <span className="page-kicker">Питомец</span>
          <h2>
            Связь привычек и <span className="hand-underline">прогресса</span>
          </h2>
          <p>
            Когда привычки идут регулярно, питомец набирает XP и растет в уровне,
            а после пропусков Steply предложит короткий шаг для возвращения
          </p>
        </div>
      </div>

      <PetStatusCard
        nextAction={nextAction}
        onAction={handleNextAction}
        onEdit={() => setIsEditing((current) => !current)}
        pet={pet}
        streak={gamification.streak}
      />

      {isEditing && (
        <div ref={editFormRef} className="pet-edit-anchor">
          <Card className="pet-setup-card">
            <PetSetup
              pet={pet}
              title="Изменить питомца"
              onSubmit={handlePetSubmit}
            />
          </Card>
        </div>
      )}

      <section className="pet-action-grid">
        <Card className="pet-goals-card" tone="soft">
          <div className="pet-panel-head">
            <span className="page-kicker">Цели</span>
            <h3>Что двигает уровень</h3>
          </div>

          {activeGoals.length > 0 ? (
            <div className="pet-goal-list">
              {activeGoals.map((goal) => {
                const progressPercent = getProgressPercent(goal.progress, goal.target);

                return (
                  <article className={`pet-goal-item pet-goal-${goal.tone}`} key={goal.id}>
                    <div>
                      <strong>{goal.title}</strong>
                      <span>{formatPetCaption(goal.next_step)}</span>
                    </div>
                    <div
                      aria-label={`Прогресс цели ${goal.title}`}
                      aria-valuemax={goal.target}
                      aria-valuemin={0}
                      aria-valuenow={goal.progress}
                      className="pet-goal-progress"
                      role="progressbar"
                    >
                      <span style={{ width: `${progressPercent}%` }} />
                    </div>
                    <small>
                      {goal.progress}/{goal.target} · +{goal.reward_xp} XP
                    </small>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setActiveSection(goal.cta_section)}
                    >
                      {goal.cta_label}
                    </Button>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="pet-panel-empty">
              Активные цели закрыты, следующий прогресс появится после новых отметок
            </p>
          )}
        </Card>

        <Card className="pet-events-card">
          <div className="pet-panel-head">
            <span className="page-kicker">XP</span>
            <h3>Последние события</h3>
          </div>

          {recentEvents.length > 0 ? (
            <div className="pet-event-list">
              {recentEvents.map((event) => (
                <article className="pet-event-item" key={event.id}>
                  <span>+{event.xp_amount} XP</span>
                  <div>
                    <strong>{formatPetCaption(event.description)}</strong>
                    <small>{formatRewardDate(event.created_at)}</small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="pet-panel-empty">
              Здесь появится история XP после первых привычек, целей и советов
            </p>
          )}
        </Card>
      </section>
    </section>
  );
}
