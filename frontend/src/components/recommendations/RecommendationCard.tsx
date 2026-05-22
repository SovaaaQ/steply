import { Button } from "../ui/Button";

interface RecommendationCardProps {
  habitTitle: string;
  advice: string;
  reason: string;
  tone: "urgent" | "normal" | "data";
  ctaLabel: "Перейти к привычке" | "Отметить";
  onAction: () => void;
}

export function RecommendationCard({
  habitTitle,
  advice,
  reason,
  tone,
  ctaLabel,
  onAction
}: RecommendationCardProps) {
  return (
    <article className={`recommendation-card recommendation-card-${tone}`}>
      <div className="recommendation-card-main">
        <span className="recommendation-habit">{habitTitle}</span>
        <p className="recommendation-advice">{advice}</p>
        <p className="recommendation-reason">
          <strong>Почему:</strong> {reason}
        </p>
      </div>
      <Button
        className="recommendation-cta"
        type="button"
        variant={ctaLabel === "Отметить" ? "cta" : "secondary"}
        onClick={onAction}
      >
        {ctaLabel}
      </Button>
    </article>
  );
}
