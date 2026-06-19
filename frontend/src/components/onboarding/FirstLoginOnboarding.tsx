import { ReactNode, useEffect, useRef, useState } from "react";

import { Button } from "../ui/Button";
import { SketchArrow } from "../ui/SketchArrow";

interface OnboardingStep {
  label: string;
  title: ReactNode;
  description: string;
  detail: string;
}

const onboardingSteps: OnboardingStep[] = [
  {
    label: "Питомец",
    title: <span className="sketch-circle">Выберите питомца</span>,
    description: "Он реагирует на ваши отметки",
    detail: "Сначала выберите тип и имя, потом откроется первый маршрут"
  },
  {
    label: "Привычка",
    title: <span className="marker-highlight">Создайте первую привычку</span>,
    description: "Выберите дни, время и нагрузку",
    detail: "Начните с шаблона на 5-10 минут, расписание можно уточнить позже"
  },
  {
    label: "Отметка",
    title: <span className="hand-underline">Отмечайте выполнение</span>,
    description: "После отметок видны прогресс, риск и советы",
    detail: "Первая отметка откроет XP, серию и следующий шаг"
  }
];

export function FirstLoginOnboarding({
  onDeferSetup,
  onStartSetup
}: {
  onDeferSetup: () => void;
  onStartSetup: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLElement>(null);
  const step = onboardingSteps[stepIndex];
  const isLastStep = stepIndex === onboardingSteps.length - 1;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    overlayRef.current?.scrollTo({ top: 0 });
    modalRef.current?.scrollTo({ top: 0 });
  }, [stepIndex]);

  return (
    <div className="onboarding-overlay" role="presentation" ref={overlayRef}>
      <section
        className="onboarding-modal onboarding-modal-guided"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-login-onboarding-title"
      >
        <div className="onboarding-head">
          <div>
            <span className="page-kicker">Первый вход</span>
            <h2 id="first-login-onboarding-title">Соберём первый маршрут</h2>
          </div>
          <button type="button" className="onboarding-skip" onClick={onDeferSetup}>
            Настроить позже
          </button>
        </div>

        <div className="onboarding-guided-grid">
          <article className="onboarding-step" key={stepIndex}>
            <span className="onboarding-step-count">
              Шаг {stepIndex + 1} из {onboardingSteps.length}
            </span>
            <SketchArrow className="onboarding-sketch-arrow" />
            <h3>{step.title}</h3>
            <p>{step.description}</p>
            <small>{step.detail}</small>
          </article>

          <ol className="onboarding-route-list" aria-label="Маршрут первого запуска">
            {onboardingSteps.map((item, index) => {
              const isActive = index === stepIndex;
              const isDone = index < stepIndex;

              return (
                <li className={`${isActive ? "active" : ""} ${isDone ? "done" : ""}`} key={item.label}>
                  <button type="button" onClick={() => setStepIndex(index)}>
                    <span>{isDone ? "✓" : index + 1}</span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="onboarding-preview" aria-hidden="true">
          <div className="onboarding-preview-card onboarding-preview-pet">
            <span>Питомец</span>
            <strong>Мика</strong>
          </div>
          <div className="onboarding-preview-card onboarding-preview-habit">
            <span>Сегодня</span>
            <strong>10 минут</strong>
          </div>
          <div className="onboarding-preview-card onboarding-preview-xp">
            <span>После шага</span>
            <strong>+XP</strong>
          </div>
        </div>

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
                onStartSetup();
                return;
              }
              setStepIndex((current) => current + 1);
            }}
          >
            {isLastStep ? "Начать настройку" : "Далее"}
          </Button>
        </div>
      </section>
    </div>
  );
}
