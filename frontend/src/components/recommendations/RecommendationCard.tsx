import { Button } from "../ui/Button";
import { cn } from "../../utils/cn";

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
        <p className="recommendation-advice">{advice}</p>
        <p className="recommendation-reason">
          <strong>Причина:</strong>
          {"\u00a0"}
          {reason}
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
