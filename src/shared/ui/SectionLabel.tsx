interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionLabel({ children, className = '' }: SectionLabelProps) {
  return (
    <p
      className={`text-[13px] font-medium text-text-muted tracking-[0.08em] uppercase mb-3 ${className}`}
    >
      {children}
    </p>
  );
}
