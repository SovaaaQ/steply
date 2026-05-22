import { ReactNode, useEffect, useState } from "react";

import { Button } from "../ui/Button";
import { SketchArrow } from "../ui/SketchArrow";

interface OnboardingStep {
  title: ReactNode;
  description: string;
}

const onboardingSteps: OnboardingStep[] = [
  {
    title: <span className="sketch-circle">Выберите питомца</span>,
    description: "Он помогает сохранять интерес."
  },
  {
    title: <span className="marker-highlight">Создайте первую привычку</span>,
    description: "Задайте расписание и сложность."
  },
  {
    title: <span className="hand-underline">Отмечайте выполнение</span>,
    description: "Steply считает прогресс, риск и советы."
  }
];

export function FirstLoginOnboarding({ onComplete }: { onComplete: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = onboardingSteps[stepIndex];
  const isLastStep = stepIndex === onboardingSteps.length - 1;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="onboarding-overlay" role="presentation">
      <section
        className="onboarding-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-login-onboarding-title"
      >
        <div className="onboarding-head">
          <div>
            <span className="page-kicker">Первый вход</span>
            <h2 id="first-login-onboarding-title">Коротко о маршруте</h2>
          </div>
          <button type="button" className="onboarding-skip" onClick={onComplete}>
            Пропустить
          </button>
        </div>

        <article className="onboarding-step">
          <span className="onboarding-step-count">
            Шаг {stepIndex + 1} из {onboardingSteps.length}
          </span>
          <SketchArrow className="onboarding-sketch-arrow" />
          <h3>{step.title}</h3>
          <p>{step.description}</p>
        </article>

        <div className="onboarding-dots" aria-hidden="true">
          {onboardingSteps.map((item, index) => (
            <span
              className={index === stepIndex ? "active" : ""}
              key={typeof item.description === "string" ? item.description : index}
            />
          ))}
        </div>

        <div className="onboarding-actions">
          {stepIndex > 0 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStepIndex((current) => current - 1)}
            >
              Назад
            </Button>
          ) : (
            <span />
          )}
          <Button
            autoFocus
            type="button"
            variant="cta"
            onClick={() => {
              if (isLastStep) {
                onComplete();
                return;
              }
              setStepIndex((current) => current + 1);
            }}
          >
            {isLastStep ? "Начать" : "Далее"}
          </Button>
        </div>
      </section>
    </div>
  );
}
