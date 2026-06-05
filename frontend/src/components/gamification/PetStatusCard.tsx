import type { NextBestAction, Pet, StreakState } from "../../types/gamification";
import { formatPetCaption, petStateLabels, petTypeLabels } from "../../utils/gamification";
import { Button } from "../ui/Button";
import { XPProgressBar } from "./XPProgressBar";
import { PetAnimation } from "./PetAnimation";

interface PetStatusCardProps {
  pet: Pet;
  nextAction: NextBestAction;
  streak: StreakState;
  onAction: () => void;
  onEdit: () => void;
}

function getTodayProgressLabel(streak: StreakState) {
  if (streak.scheduled_today === 0) {
    return "на сегодня нет запланированных привычек";
  }
  return `сегодня выполнено ${streak.completed_today} из ${streak.scheduled_today}`;
}

function getStateReason(petName: string, petState: Pet["pet_state"], streak: StreakState) {
  const todayProgress = getTodayProgressLabel(streak);
  if (petState === "happy") {
    return `${petName} в форме: ${todayProgress}, регулярность держится`;
  }
  if (petState === "neutral") {
    return `${petName} ждёт ближайший шаг: ${todayProgress}`;
  }
  return `${petName} на паузе после пропусков, начните с короткого шага без компенсации объёма`;
}

export function PetStatusCard({
  pet,
  nextAction,
  streak,
  onAction,
  onEdit
}: PetStatusCardProps) {
  const petType = pet.pet_type ?? "dog";
  const petName = pet.pet_name || "Питомец";
  const isMaxLevel = pet.level >= 5 && pet.xp_to_next_level === 0;

  return (
    <section className={`pet-status-card pet-state-${pet.pet_state}`}>
      <div className="pet-hero-grid">
        <PetAnimation petType={petType} state={pet.pet_state} level={pet.level} />
        <div>
          <span className="page-kicker">Питомец</span>
          <h2>{petName}</h2>
          <p>{petTypeLabels[petType]} · {petStateLabels[pet.pet_state]}</p>
          <Button type="button" variant="secondary" onClick={onEdit}>
            Изменить питомца
          </Button>
        </div>
      </div>

      <div className="pet-level-grid">
        <div>
          <span>Уровень</span>
          <strong>{pet.level}</strong>
        </div>
        <div>
          <span>XP</span>
          <strong>{pet.xp}</strong>
        </div>
        <div>
          <span>{isMaxLevel ? "Статус" : `До уровня ${pet.next_level}`}</span>
          <strong>{isMaxLevel ? "Максимальный уровень" : `${pet.xp_to_next_level} XP`}</strong>
        </div>
      </div>

      <div className="pet-progress">
        <div>
          <span>{isMaxLevel ? "Максимальный уровень" : "До следующего уровня"}</span>
          <strong>{Math.round(pet.progress_percent)}%</strong>
        </div>
        <XPProgressBar value={pet.progress_percent} label="Прогресс до следующего уровня питомца" />
      </div>

      <div className="pet-explanation">
        <span>Почему так</span>
        <p>{getStateReason(petName, pet.pet_state, streak)}</p>
      </div>

      <div className="pet-next-action">
        <div>
          <span>Ближайшее действие</span>
          <strong>{nextAction.title}</strong>
          <p>{formatPetCaption(nextAction.description)}</p>
        </div>
        <Button type="button" variant="cta" onClick={onAction}>
          {nextAction.cta_label}
        </Button>
      </div>
    </section>
  );
}
