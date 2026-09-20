import React from 'react';

/**
 * Reusable and accessible Button component.
 * Supports primary (purple), secondary, outline, ghost, and social circle styles.
 *
 * A note that is easy to lose and expensive to rediscover: **a caller's
 * `className` cannot override what this file writes.** Tailwind emits every
 * utility into the same `@layer utilities` at the same specificity, so ties are
 * broken by the order they appear in the stylesheet, which is alphabetical —
 * not by who passed the class. The old `bg-violet-600` here sorted after the
 * `bg-[#7047EB]` every call site passed, so every call site lost, silently.
 *
 * That is not theory. Measured on /login before this was fixed, the Continue
 * button rendered `oklch(0.541 0.281 293.009)` — violet-600 — at weight 500 and
 * a 12px radius, while its call site asked for `bg-[#7047EB] font-bold
 * rounded-2xl`. All 23 `<Button>` in the app were the wrong purple.
 *
 * So the rule is: anything this component sets, it owns. If a variant needs to
 * change, change it here. `src/index.css` already documents the same mechanism
 * for the Google button's radius.
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
  /*
    `font-bold`, not `font-medium`. Every call site already asked for bold or
    heavier and was overruled; 500 on a filled CTA sat visibly lighter than the
    150 hand-rolled buttons beside it.
  */
  const baseStyles = 'inline-flex items-center justify-center font-bold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50 disabled:cursor-not-allowed';

  /*
    `md` keeps its `rounded-xl` on purpose, even though it beats a call site
    asking for `rounded-2xl`. `src/index.css` pins the Google sign-in button to
    12px *because* this wins — changing it here would leave the two buttons on
    the login card no longer matching. See the comment there before touching it.
  */
  const sizes = {
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-5 py-2.5 text-base rounded-xl',
    lg: 'px-7 py-3 text-lg rounded-2xl',
    circle: 'p-3 rounded-full justify-center items-center',
  };

  const variants = {
    primary: 'bg-brand hover:bg-brand-deep text-white shadow-md shadow-brand/30 active:scale-[0.98]',
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
      {/*
        The spinner joins the label; it does not replace it.

        This used to render a hardcoded `Loading...` instead of `children`, in an
        app whose default language is Indonesian — so all six call sites showed
        an English word the moment they became busy, and the localized busy label
        several of them already pass (`t('reg.submitting')`, "Mengirim…") was
        thrown away unseen. Keeping the children also stops the button changing
        width mid-press.
      */}
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg
            className="animate-spin h-5 w-5 text-current shrink-0"
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
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
});

Button.displayName = 'Button';
export default Button;
