import type { RiskLevel } from "../../types/habit";
import type { Prediction } from "../../types/recommendation";
import type { HabitStats } from "../../types/statistics";
import { formatRiskDisplay, getRiskLevel, hasEnoughRiskData, riskLabels } from "../../utils/risk";
import { Badge } from "../ui/Badge";

const riskTone: Record<RiskLevel, "risk-low" | "risk-medium" | "risk-high"> = {
  low: "risk-low",
  medium: "risk-medium",
  high: "risk-high"
};

interface RiskBadgeProps {
  level?: RiskLevel;
  prediction?: Prediction;
  stats?: Pick<HabitStats, "total_entries">;
}

export function RiskBadge({ level, prediction, stats }: RiskBadgeProps) {
  if (prediction) {
    if (!hasEnoughRiskData(prediction, stats)) {
      return <Badge tone="neutral">Недостаточно данных</Badge>;
    }

    const displayLevel = getRiskLevel(prediction);
    return <Badge tone={riskTone[displayLevel]}>{formatRiskDisplay(prediction, stats)}</Badge>;
  }

  const fallbackLevel = level ?? "low";
  return <Badge tone={riskTone[fallbackLevel]}>{riskLabels[fallbackLevel]} риск</Badge>;
}
