import type { PetState, PetType } from "../../types/auth";
import { petEmoji, petStateShortLabels, petTypeLabels } from "../../utils/gamification";

interface PetAnimationProps {
  petType: PetType;
  state: PetState;
  size?: "mini" | "large";
}

export function PetAnimation({ petType, state, size = "large" }: PetAnimationProps) {
  return (
    <div
      className={`pet-animation pet-animation-${state} pet-animation-${size}`}
      aria-label={`${petTypeLabels[petType]}: ${petStateShortLabels[state]}`}
    >
      <span className="pet-animation-emoji">{petEmoji[petType]}</span>
      <span className="pet-animation-caption">{petStateShortLabels[state]}</span>
    </div>
  );
}
