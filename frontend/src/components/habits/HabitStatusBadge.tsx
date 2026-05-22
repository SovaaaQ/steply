import type { EntryStatus } from "../../types/habit";
import { statusLabels } from "../../utils/risk";
import { Badge } from "../ui/Badge";

export function HabitStatusBadge({ status }: { status: EntryStatus }) {
  const tone = status === "completed" ? "completed" : status === "recovery_completed" ? "recovery" : "missed";
  return <Badge tone={tone}>{statusLabels[status]}</Badge>;
}
