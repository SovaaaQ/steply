import { Button } from "../ui/Button";
import { cn } from "../../utils/cn";

interface ActionPlanSegment {
  label: "Сегодня" | "Минимум" | "Готово";
  text: string;
}

const actionPlanUiLabels: Record<ActionPlanSegment["label"], string> = {
  Сегодня: "Что сделать сейчас",
  Минимум: "Если тяжело",
  Готово: "Когда засчитать"
};

interface RecommendationCardProps {
  habitTitle: string;
  advice: string;
  reason: string;
  tone: "urgent" | "normal" | "data";
  ctaLabel: "Перейти к привычке" | "Отметить" | "Отметить минимум";
  metaLabel?: string;
  featured?: boolean;
  onAction: () => void;
}

function cleanDisplayText(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[—–−]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[ ,;:.!?]+$/g, "");
}

function normalizeActionPlanLabel(value: string): ActionPlanSegment["label"] | null {
  const normalized = value.toLowerCase();
  if (normalized === "сегодня") {
    return "Сегодня";
  }
  if (normalized === "минимум") {
    return "Минимум";
  }
  if (normalized === "готово") {
    return "Готово";
  }
  return null;
}

function parseActionPlan(value: string): ActionPlanSegment[] | null {
  const matches = Array.from(value.matchAll(/(?:^|\s)(сегодня|минимум|готово)\s*:\s*/gi));
  const expectedLabels: ActionPlanSegment["label"][] = ["Сегодня", "Минимум", "Готово"];

  if (matches.length !== expectedLabels.length) {
    return null;
  }

  const segments = matches.map((match, index): ActionPlanSegment => {
    const label = normalizeActionPlanLabel(match[1]) ?? "Сегодня";
    const textStart = (match.index ?? 0) + match[0].length;
    const textEnd = matches[index + 1]?.index ?? value.length;
    return {
      label,
      text: cleanDisplayText(value.slice(textStart, textEnd))
    };
  });

  if (
    segments.some((segment, index) => segment.label !== expectedLabels[index] || !segment.text)
  ) {
    return null;
  }

  return segments;
}

export function RecommendationCard({
  habitTitle,
  advice,
  reason,
  tone,
  ctaLabel,
  metaLabel,
  featured = false,
  onAction
}: RecommendationCardProps) {
  const isDirectAction = ctaLabel === "Отметить" || ctaLabel === "Отметить минимум";
  const actionPlan = parseActionPlan(advice);
  const displayAdvice = cleanDisplayText(advice);
  const displayReason = cleanDisplayText(reason);
  const primaryStep = actionPlan?.[0];
  const supportSteps = actionPlan?.slice(1) ?? [];

  return (
    <article
      className={cn(
        "recommendation-card",
        `recommendation-card-${tone}`,
        featured && "recommendation-card-featured"
      )}
    >
      <div className="recommendation-card-main">
        <div className="recommendation-card-heading">
          <span className="recommendation-habit">{habitTitle}</span>
          {metaLabel && <span className="recommendation-meta">{metaLabel}</span>}
        </div>
        {primaryStep ? (
          <div className="recommendation-action-plan" aria-label="План действия">
            <div className="recommendation-primary-step">
              <span>{actionPlanUiLabels[primaryStep.label]}</span>
              <p>{primaryStep.text}</p>
            </div>
            {supportSteps.length > 0 && (
              <div className="recommendation-support-steps">
                {supportSteps.map((segment) => (
                  <p key={segment.label}>
                    <strong>{actionPlanUiLabels[segment.label]}</strong>
                    <span>{segment.text}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="recommendation-advice">{displayAdvice}</p>
        )}
        <p className="recommendation-reason">
          <strong>Почему сейчас</strong>
          {" "}
          {displayReason}
        </p>
      </div>
      <Button
        className="recommendation-cta"
        type="button"
        variant={isDirectAction ? "cta" : "secondary"}
        onClick={onAction}
      >
        {ctaLabel}
      </Button>
    </article>
  );
}
