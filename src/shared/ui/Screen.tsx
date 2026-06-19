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
    <div
      className={`min-h-dvh flex flex-col bg-bg font-sans overflow-hidden ${className}`}
    >
      {/* iOS status-bar spacer */}
      <div className="h-[59px] flex-shrink-0" aria-hidden="true" />
      {children}
    </div>
  );
}
