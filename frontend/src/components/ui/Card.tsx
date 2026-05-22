import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../../utils/cn";

interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  tone?: "default" | "accent" | "soft";
}

export function Card({ children, className, tone = "default", ...props }: CardProps) {
  return (
    <article className={cn("card", `card-${tone}`, className)} {...props}>
      {children}
    </article>
  );
}
