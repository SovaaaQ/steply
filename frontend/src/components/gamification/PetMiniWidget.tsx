import type { Pet } from "../../types/gamification";
import { petMiniPhrases, petStateShortLabels, petTypeLabels } from "../../utils/gamification";
import { PetAnimation } from "./PetAnimation";

interface PetMiniWidgetProps {
  pet: Pet;
  onOpen: () => void;
}

export function PetMiniWidget({ pet, onOpen }: PetMiniWidgetProps) {
  const petType = pet.pet_type;
  const petName = pet.pet_name || "Питомец";

  return (
    <button
      type="button"
      className={`pet-mini-widget pet-state-${pet.pet_state}`}
      onClick={onOpen}
    >
      <PetAnimation
        isConfigured={pet.is_configured}
        petType={petType}
        state={pet.pet_state}
        size="mini"
      />
      <span>
        <strong>{petName}</strong>
        <small>
          {pet.is_configured && petType
            ? `${petTypeLabels[petType]} · ${petStateShortLabels[pet.pet_state]}`
            : "Питомец не выбран"}
        </small>
      </span>
      <em>{pet.is_configured ? petMiniPhrases[pet.pet_state] : "Выберите питомца для маршрута"}</em>
    </button>
  );
}
