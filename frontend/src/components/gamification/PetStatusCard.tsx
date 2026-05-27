import type { Pet } from "../../types/gamification";
import { petStateLabels, petTypeLabels } from "../../utils/gamification";
import { Button } from "../ui/Button";
import { XPProgressBar } from "./XPProgressBar";
import { PetAnimation } from "./PetAnimation";

interface PetStatusCardProps {
  pet: Pet;
  onEdit: () => void;
}

const stateReason = {
  happy: "в хорошей форме: привычки идут регулярно",
  neutral: "ждет ближайшую отметку, чтобы не терять ритм",
  sad: "заметил несколько пропусков. Можно начать с мягкого шага"
};

export function PetStatusCard({ pet, onEdit }: PetStatusCardProps) {
  const petType = pet.pet_type ?? "dog";
  const petName = pet.pet_name || "Питомец";
  const isMaxLevel = pet.level >= 5 && pet.xp_to_next_level === 0;

  return (
    <section className={`pet-status-card pet-state-${pet.pet_state}`}>
      <div className="pet-hero-grid">
        <PetAnimation petType={petType} state={pet.pet_state} />
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
        <p>{petName} {stateReason[pet.pet_state]}</p>
      </div>

      <div className="pet-help-list">
        <span>Что поможет</span>
        <ul>
          <li>Отметить ближайшую привычку</li>
          <li>Сделать минимальную версию</li>
          <li>Вернуться к ритму без давления</li>
        </ul>
      </div>
    </section>
  );
}
