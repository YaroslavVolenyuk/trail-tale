import type { ReactNode } from 'react';

interface ScreenProps {
  children: ReactNode;
  className?: string;
}

/**
 * Base wrapper for all mobile screens.
 * min-h-dvh flex-col so BottomDock sticks naturally without position:fixed.
 */
export function Screen({ children, className = '' }: ScreenProps) {
  return (
    <div className={`flex min-h-dvh flex-col overflow-hidden bg-bg font-sans ${className}`}>
      {/* iOS status-bar spacer */}
      <div className="h-[59px] flex-shrink-0" aria-hidden="true" />
      {children}
    </div>
  );
}
