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
        'h-10 flex-1 cursor-pointer rounded-full text-[14px] font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
        active ? 'bg-accent text-bg' : 'bg-surface text-text-muted',
        className,
      ].join(' ')}
      {...props}
    >
      {label}
    </button>
  );
}
