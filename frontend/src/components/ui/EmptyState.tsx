import type { ReactNode } from "react";

import { SketchArrow } from "./SketchArrow";

export function EmptyState({
  title,
  children,
  action
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <SketchArrow className="empty-state-arrow" />
      <span className="empty-state-mark" aria-hidden="true" />
      <strong className="hand-underline empty-state-title">{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
