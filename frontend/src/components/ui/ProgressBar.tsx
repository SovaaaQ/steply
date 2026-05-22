export function ProgressBar({
  value,
  label,
  variant = "default"
}: {
  value: number;
  label?: string;
  variant?: "default" | "habit";
}) {
  const clamped = Math.max(0, Math.min(value, 100));

  return (
    <div className={`progress-wrap progress-${variant}`} aria-label={label}>
      <span style={{ width: `${clamped}%` }} />
    </div>
  );
}
