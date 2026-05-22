import type { ReactNode } from "react";

import { cn } from "../../utils/cn";

export function Badge({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?:
    | "neutral"
    | "risk-low"
    | "risk-medium"
    | "risk-high"
    | "completed"
    | "missed"
    | "recovery";
}) {
  return <span className={cn("badge", `badge-${tone}`)}>{children}</span>;
}
