import { forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'sm' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-accent text-bg font-semibold hover:opacity-90 active:opacity-75',
  secondary: 'bg-border text-white font-semibold hover:bg-border/80 active:opacity-75',
  ghost: 'bg-transparent text-accent font-medium hover:bg-surface active:opacity-75',
};

const sizeClasses: Record<Size, string> = {
  md: 'w-full h-btn rounded-btn text-[17px] px-5',
  sm: 'h-8 rounded-lg text-[14px] px-4',
  icon: 'h-ctrl w-[60px] rounded-full',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, disabled, className = '', children, ...props }, ref) => {
    const isDisabled = disabled || loading;
    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={[
          'inline-flex items-center justify-center transition-opacity cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          variantClasses[variant],
          sizeClasses[size],
          className,
        ].join(' ')}
        {...props}
      >
        {loading ? <span className="animate-spin mr-2">⟳</span> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
