interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 72, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={Math.round(size * 1.167)}
      viewBox="0 0 60 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M30 4C18 4 8 14 8 26C8 40 18 54 30 68C42 54 52 40 52 26C52 14 42 4 30 4Z"
        fill="#F5A623"
      />
      <circle cx="30" cy="23" r="8.5" fill="#0A0A0A" />
      <path d="M26 30L23 45H37L34 30H26Z" fill="#0A0A0A" />
    </svg>
  );
}
