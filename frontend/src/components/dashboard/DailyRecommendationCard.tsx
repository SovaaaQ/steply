import type { Recommendation } from "../../types/recommendation";
import { Button } from "../ui/Button";

export function DailyRecommendationCard({
  recommendation,
  onOpen
}: {
  recommendation?: Recommendation;
  onOpen: () => void;
}) {
  return (
    <section className="side-card recommendation-preview">
      <span className="page-kicker">Совет дня</span>
      {recommendation ? (
        <>
          <h2>{recommendation.title}</h2>
          <p>{recommendation.message}</p>
          <Button variant="secondary" onClick={onOpen}>
            Посмотреть совет
          </Button>
        </>
      ) : (
        <p>Совет появится после первых отметок</p>
      )}
    </section>
  );
}
