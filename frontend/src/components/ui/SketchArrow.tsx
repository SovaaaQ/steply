import { cn } from "../../utils/cn";

export function SketchArrow({ className }: { className?: string }) {
  return (
    <svg className={cn("sketch-arrow", className)} viewBox="0 0 84 34" aria-hidden="true">
      <path d="M4 25c19-15 39-19 67-14" />
      <path d="m60 4 13 7-10 10" />
    </svg>
  );
}
