import { forwardRef, type ReactNode } from 'react';

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  rightAdornment?: ReactNode;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ error = false, rightAdornment, className = '', ...props }, ref) => {
    const borderClass = error
      ? 'border-danger'
      : 'border-border-input focus:border-accent';

    return (
      <div className="relative">
        <input
          ref={ref}
          className={[
            'w-full h-input bg-surface rounded-input px-4 text-white text-[17px]',
            'border-[1.5px] transition-colors',
            'placeholder:text-text-muted',
            'focus:outline-none',
            'tracking-[0.05em]',
            borderClass,
            rightAdornment ? 'pr-14' : '',
            className,
          ].join(' ')}
          {...props}
        />
        {rightAdornment && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {rightAdornment}
          </div>
        )}
      </div>
    );
  },
);
TextInput.displayName = 'TextInput';
