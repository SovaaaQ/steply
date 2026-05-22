import { FormEvent, useEffect, useState } from "react";

import type { PetType } from "../../types/auth";
import type { Pet } from "../../types/gamification";
import { petEmoji, petTypeDescriptions, petTypeLabels } from "../../utils/gamification";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

const petTypes: PetType[] = ["dog", "cat", "parrot", "hamster"];

interface PetSetupProps {
  pet?: Pet;
  title?: string;
  onSubmit: (payload: { pet_type: PetType; pet_name: string }) => Promise<void>;
}

export function PetSetup({ pet, title = "Выберите питомца", onSubmit }: PetSetupProps) {
  const [petType, setPetType] = useState<PetType>(pet?.pet_type ?? "dog");
  const [petName, setPetName] = useState(pet?.pet_name ?? "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setPetType(pet?.pet_type ?? "dog");
    setPetName(pet?.pet_name ?? "");
  }, [pet?.pet_name, pet?.pet_type]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = petName.trim();
    if (!normalizedName) {
      return;
    }
    setIsSaving(true);
    try {
      await onSubmit({ pet_type: petType, pet_name: normalizedName });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="pet-setup" onSubmit={handleSubmit}>
      <div>
        <span className="page-kicker">Виртуальный питомец</span>
        <h3>{title}</h3>
      </div>

      <div className="pet-type-grid" role="radiogroup" aria-label="Тип питомца">
        {petTypes.map((type) => (
          <button
            aria-checked={petType === type}
            className={`pet-option pet-option-${type} ${petType === type ? "active" : ""}`}
            key={type}
            onClick={() => setPetType(type)}
            role="radio"
            type="button"
          >
            <span className="pet-option-emoji">{petEmoji[type]}</span>
            <span className="pet-option-name">{petTypeLabels[type]}</span>
            <span className="pet-option-description">{petTypeDescriptions[type]}</span>
          </button>
        ))}
      </div>

      <label>
        Имя питомца
        <Input
          value={petName}
          onChange={(event) => setPetName(event.target.value)}
          placeholder="Например, Бади"
          required
        />
      </label>

      <Button variant="cta" disabled={isSaving || !petName.trim()}>
        {isSaving ? "Сохранение..." : "Сохранить питомца"}
      </Button>
    </form>
  );
}
