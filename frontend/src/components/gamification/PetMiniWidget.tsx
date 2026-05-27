import type { Pet } from "../../types/gamification";
import { petMiniPhrases, petStateShortLabels, petTypeLabels } from "../../utils/gamification";
import { PetAnimation } from "./PetAnimation";

interface PetMiniWidgetProps {
  pet: Pet;
  onOpen: () => void;
}

export function PetMiniWidget({ pet, onOpen }: PetMiniWidgetProps) {
  const petType = pet.pet_type ?? "dog";
  const petName = pet.pet_name || "Питомец";

  return (
    <button
      type="button"
      className={`pet-mini-widget pet-state-${pet.pet_state}`}
      onClick={onOpen}
    >
      <PetAnimation petType={petType} state={pet.pet_state} size="mini" />
      <span>
        <strong>{petName}</strong>
        <small>{petTypeLabels[petType]} · {petStateShortLabels[pet.pet_state]}</small>
      </span>
      <em>{pet.is_configured ? petMiniPhrases[pet.pet_state] : "Выберите питомца для поддержки"}</em>
    </button>
  );
}
