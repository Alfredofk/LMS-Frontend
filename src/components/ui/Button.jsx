import React from 'react';

/**
 * Reusable and accessible Button component.
 * Supports primary (purple), secondary, outline, ghost, and social circle styles.
 */
export const Button = React.forwardRef(({
  children,
  type = 'button',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  isDisabled = false,
  className = '',
  onClick,
  ariaLabel,
  ...props
}, ref) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 disabled:opacity-50 disabled:cursor-not-allowed';

  const sizes = {
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-5 py-2.5 text-base rounded-xl',
    lg: 'px-7 py-3 text-lg rounded-2xl',
    circle: 'p-3 rounded-full justify-center items-center',
  };

  const variants = {
    primary: 'bg-violet-600 hover:bg-violet-700 text-white shadow-sm active:scale-[0.98]',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-[0.98]',
    outline: 'border border-slate-300 hover:bg-slate-50 text-slate-700 active:scale-[0.98]',
    ghost: 'hover:bg-slate-100 text-slate-700',
    social: 'border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 shadow-sm active:scale-95 transition-transform',
  };

  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={isDisabled || isLoading}
      aria-label={ariaLabel || (typeof children === 'string' ? children : undefined)}
      aria-busy={isLoading}
      className={`${baseStyles} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg
            className="animate-spin h-5 w-5 text-current"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            role="presentation"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Loading...
        </span>
      ) : (
        children
      )}
    </button>
  );
});

Button.displayName = 'Button';
export default Button;
