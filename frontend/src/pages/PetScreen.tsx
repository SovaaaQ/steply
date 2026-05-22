import { useState } from "react";

import { PetSetup } from "../components/gamification/PetSetup";
import { PetStatusCard } from "../components/gamification/PetStatusCard";
import { Card } from "../components/ui/Card";
import { useAppData } from "../app/providers";
import type { PetType } from "../types/auth";

export function PetScreen() {
  const { gamification, updatePet, setActiveSection } = useAppData();
  const [isEditing, setIsEditing] = useState(false);
  const pet = gamification.pet;

  async function handlePetSubmit(payload: { pet_type: PetType; pet_name: string }) {
    await updatePet(payload);
    setIsEditing(false);
  }

  if (!pet.is_configured) {
    return (
      <section className="pet-screen page-stack">
        <div className="page-intro">
          <div>
            <span className="page-kicker">Питомец</span>
            <h2>
              Выберите спокойного <span className="marker-highlight">спутника</span>
            </h2>
            <p>
              Питомец будет показывать мягкую обратную связь: регулярность помогает
              ему развиваться, а пропуски включают подсказки восстановления.
            </p>
          </div>
        </div>
        <Card className="pet-setup-card">
          <PetSetup pet={pet} onSubmit={handlePetSubmit} />
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
            Связь привычек и <span className="hand-underline">поддержки</span>
          </h2>
          <p>
            Выполняешь привычки — питомцу хорошо, растут XP и уровень. Если были
            пропуски, Steply предлагает мягкий возврат через минимальный шаг.
          </p>
        </div>
      </div>

      <PetStatusCard pet={pet} onEdit={() => setIsEditing((current) => !current)} />

      {isEditing && (
        <Card className="pet-setup-card">
          <PetSetup
            pet={pet}
            title="Изменить питомца"
            onSubmit={handlePetSubmit}
          />
        </Card>
      )}

      <Card className="pet-account-link" tone="soft">
        <span className="page-kicker">Следующий шаг</span>
        <h3>Поддержать питомца через привычки</h3>
        <p>Открой список привычек и отметь ближайшее реальное действие.</p>
        <button type="button" className="button button-secondary" onClick={() => setActiveSection("habits")}>
          Перейти к привычкам
        </button>
      </Card>
    </section>
  );
}
