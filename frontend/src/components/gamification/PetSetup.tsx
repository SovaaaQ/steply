import { FormEvent, useEffect, useRef, useState } from "react";

import type { PetType } from "../../types/auth";
import type { Pet } from "../../types/gamification";
import {
  formatPetCaption,
  petEmoji,
  petTypeDescriptions,
  petTypeLabels
} from "../../utils/gamification";
import { petLimits } from "../../utils/formLimits";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

const petTypes: PetType[] = ["dog", "cat", "parrot", "hamster"];

interface PetSetupProps {
  pet?: Pet;
  title?: string;
  description?: string;
  submitLabel?: string;
  onSubmit: (payload: { pet_type: PetType; pet_name: string }) => Promise<void>;
}

export function PetSetup({
  pet,
  title = "Выберите питомца",
  description,
  submitLabel = "Сохранить питомца",
  onSubmit
}: PetSetupProps) {
  const [petType, setPetType] = useState<PetType>(pet?.pet_type ?? "dog");
  const [petName, setPetName] = useState(pet?.pet_name ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  useEffect(() => {
    setPetType(pet?.pet_type ?? "dog");
    setPetName(pet?.pet_name ?? "");
  }, [pet?.pet_name, pet?.pet_type]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSavingRef.current) return;
    const normalizedName = petName.trim();
    if (!normalizedName) {
      return;
    }
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      await onSubmit({ pet_type: petType, pet_name: normalizedName });
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <form className="pet-setup" onSubmit={handleSubmit}>
      <div className="pet-setup-head">
        <span className="page-kicker">Виртуальный питомец</span>
        <h3>{title}</h3>
        {description && <p>{formatPetCaption(description)}</p>}
      </div>

      <fieldset className="pet-type-field">
        <legend>Тип питомца</legend>
        <div className="pet-type-grid">
          {petTypes.map((type) => (
            <label
              className={`pet-option pet-option-${type} ${petType === type ? "active" : ""}`}
              key={type}
            >
              <input
                checked={petType === type}
                className="pet-option-input"
                disabled={isSaving}
                name="pet-type"
                onChange={() => setPetType(type)}
                type="radio"
                value={type}
              />
              <span className="pet-option-emoji">{petEmoji[type]}</span>
              <span className="pet-option-name">{petTypeLabels[type]}</span>
              <span className="pet-option-description">{petTypeDescriptions[type]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label>
        Имя питомца
        <Input
          value={petName}
          onChange={(event) => setPetName(event.target.value)}
          disabled={isSaving}
          placeholder="Например, Бади"
          minLength={petLimits.nameMinLength}
          maxLength={petLimits.nameMaxLength}
          required
        />
      </label>

      <Button
        variant="cta"
        disabled={isSaving || !petName.trim()}
        aria-busy={isSaving || undefined}
      >
        {isSaving ? "Сохраняем" : submitLabel}
      </Button>
    </form>
  );
}
