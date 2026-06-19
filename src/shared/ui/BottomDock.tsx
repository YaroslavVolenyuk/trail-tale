import type { ReactNode } from 'react';

interface BottomDockProps {
  children: ReactNode;
  border?: boolean;
  className?: string;
}

/**
 * Sticky bottom panel.
 * Uses sticky (not fixed) so iOS keyboard pushes it up naturally.
 * pb accounts for iPhone home indicator.
 */
export function BottomDock({ children, border = true, className = '' }: BottomDockProps) {
  return (
    <div
      className={[
        'flex-shrink-0 sticky bottom-0 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),28px)]',
        'bg-bg',
        border ? 'border-t border-border' : '',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
