export function XPProgressBar({
  value,
  label = "Прогресс опыта",
  showValue = false
}: {
  value: number;
  label?: string;
  showValue?: boolean;
}) {
  const clamped = Math.max(0, Math.min(value, 100));

  return (
    <div className="xp-progress-wrap">
      <div
        className="xp-progress"
        aria-label={label}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(clamped)}
        role="progressbar"
      >
        <span style={{ width: `${clamped}%` }} />
      </div>
      {showValue && <small>{Math.round(clamped)}%</small>}
    </div>
  );
}
