interface PillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  label: string;
}

export function Pill({ active = false, label, className = '', ...props }: PillProps) {
  return (
    <button
      role="radio"
      aria-checked={active}
      className={[
        'flex-1 h-10 rounded-full text-[14px] font-medium transition-colors cursor-pointer',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
        active
          ? 'bg-accent text-bg'
          : 'bg-surface text-text-muted',
        className,
      ].join(' ')}
      {...props}
    >
      {label}
    </button>
  );
}
