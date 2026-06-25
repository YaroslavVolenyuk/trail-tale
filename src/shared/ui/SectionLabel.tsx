interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionLabel({ children, className = '' }: SectionLabelProps) {
  return (
    <p
      className={`mb-3 text-[13px] font-medium uppercase tracking-[0.08em] text-text-muted ${className}`}
    >
      {children}
    </p>
  );
}
