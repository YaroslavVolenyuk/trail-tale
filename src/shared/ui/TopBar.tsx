interface TopBarProps {
  title?: string;
  onBack?: () => void;
  /** Aria label for back button — pass translated string */
  backLabel?: string;
  rightSlot?: React.ReactNode;
  /** When true, title is centered (balanced left/right spacers) */
  centered?: boolean;
}

export function TopBar({
  title,
  onBack,
  backLabel = 'Go back',
  rightSlot,
  centered = true,
}: TopBarProps) {
  const hasLeft = !!onBack;
  const hasRight = !!rightSlot;

  return (
    <div className="flex-shrink-0 flex items-center px-3 h-[50px]">
      {/* Left: back button (44×44 hit target) or balance spacer */}
      {hasLeft ? (
        <button
          onClick={onBack}
          className="w-11 h-11 grid place-items-center text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg flex-shrink-0"
          aria-label={backLabel}
        >
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none" aria-hidden="true">
            <path
              d="M9 1L1 9L9 17"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : centered ? (
        <div className="w-11 flex-shrink-0" aria-hidden="true" />
      ) : null}

      {/* Title */}
      {title && (
        <h1
          className={[
            'flex-1 text-[17px] font-semibold text-white tracking-tight',
            centered ? 'text-center' : 'text-left',
            // Add right margin equal to right element width so title stays truly centred
            centered && (hasRight || hasLeft) ? 'mr-11' : '',
          ].join(' ')}
        >
          {title}
        </h1>
      )}
      {!title && <div className="flex-1" aria-hidden="true" />}

      {/* Right slot or balance spacer */}
      {hasRight ? rightSlot : centered ? <div className="w-11 flex-shrink-0" aria-hidden="true" /> : null}
    </div>
  );
}
