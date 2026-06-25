interface ProgressBarProps {
  value: number; // 0–1
}

export function ProgressBar({ value }: ProgressBarProps) {
  const pct = Math.min(Math.max(value, 0), 1) * 100;
  return (
    <div
      className="h-[3px] flex-shrink-0 bg-border"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}
