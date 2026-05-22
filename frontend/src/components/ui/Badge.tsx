import type { ReactNode } from "react";

import { cn } from "../../utils/cn";

export function Badge({
  children,
  className,
  tone = "neutral"
}: {
  children: ReactNode;
  className?: string;
  tone?:
    | "neutral"
    | "risk-low"
    | "risk-medium"
    | "risk-high"
    | "completed"
    | "missed"
    | "recovery";
}) {
  return <span className={cn("badge", `badge-${tone}`, className)}>{children}</span>;
}
