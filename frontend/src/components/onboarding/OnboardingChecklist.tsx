import type { Goal, Pet } from "../../types/gamification";
import { Button } from "../ui/Button";

interface OnboardingChecklistProps {
  activeHabitCount: number;
  goals: Goal[];
  pet: Pet;
  onCreateHabit: () => void;
  onOpenDashboard: () => void;
  onOpenPet: () => void;
}

function isGoalCompleted(goals: Goal[], goalId: string) {
  return goals.some((goal) => goal.id === goalId && goal.status === "completed");
}

export function OnboardingChecklist({
  activeHabitCount,
  goals,
  pet,
  onCreateHabit,
  onOpenDashboard,
  onOpenPet
}: OnboardingChecklistProps) {
  const items = [
    {
      id: "pet",
      title: "Выбрать питомца",
      description: "Первый спутник будет показывать реакцию на регулярность",
      isDone: pet.is_configured,
      actionLabel: "Выбрать",
      onAction: onOpenPet
    },
    {
      id: "habit",
      title: "Создать первую привычку",
      description: "Начните с действия на 5-10 минут, которое реально повторить завтра",
      isDone: activeHabitCount > 0,
      actionLabel: "Создать",
      onAction: onCreateHabit
    },
    {
      id: "completion",
      title: "Отметить первый шаг",
      description: "После отметки появятся XP, серия и следующий лучший шаг",
      isDone: isGoalCompleted(goals, "onboarding_complete_first_step"),
      actionLabel: "Отметить",
      onAction: onOpenDashboard
    }
  ];

  const completedCount = items.filter((item) => item.isDone).length;
  const nextItem = items.find((item) => !item.isDone);
  const progress = Math.round((completedCount / items.length) * 100);

  if (!nextItem) {
    return null;
  }

  return (
    <section className="onboarding-checklist" aria-labelledby="onboarding-checklist-title">
      <div className="onboarding-checklist-head">
        <div>
          <span className="page-kicker">Первый маршрут</span>
          <h2 id="onboarding-checklist-title">Дойдите до первой отметки</h2>
        </div>
        <div
          aria-label={`Готово ${completedCount} из ${items.length}`}
          aria-valuemax={items.length}
          aria-valuemin={0}
          aria-valuenow={completedCount}
          className="onboarding-checklist-progress"
          role="progressbar"
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      <ol className="onboarding-checklist-items">
        {items.map((item) => (
          <li className={`${item.isDone ? "done" : ""} ${item.id === nextItem.id ? "active" : ""}`} key={item.id}>
            <span className="onboarding-check-icon" aria-hidden="true">
              {item.isDone ? "✓" : ""}
            </span>
            <div>
              <strong>{item.title}</strong>
              <small>{item.description}</small>
            </div>
          </li>
        ))}
      </ol>

      <div className="onboarding-checklist-action">
        <div>
          <span>Следующий шаг</span>
          <strong>{nextItem.title}</strong>
        </div>
        <Button type="button" variant="cta" onClick={nextItem.onAction}>
          {nextItem.actionLabel}
        </Button>
      </div>
    </section>
  );
}
