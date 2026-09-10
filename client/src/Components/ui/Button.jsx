import { forwardRef } from 'react';

const variants = {
  primary: [
    'bg-forest-700 text-white',
    'hover:bg-forest-800 hover:shadow-lg hover:shadow-forest-700/20',
    'focus:ring-forest-500',
    'active:bg-forest-900',
  ].join(' '),
  secondary: [
    'border border-forest-700/30 text-forest-700 bg-transparent',
    'hover:bg-forest-700 hover:text-white hover:border-forest-700 hover:shadow-lg hover:shadow-forest-700/15',
    'focus:ring-forest-500',
    'active:bg-forest-800 active:text-white',
  ].join(' '),
  gold: [
    'bg-gold-500 text-white',
    'hover:bg-gold-600 hover:shadow-lg hover:shadow-gold-500/25',
    'focus:ring-gold-400',
    'active:bg-gold-700',
  ].join(' '),
  ghost: [
    'text-charcoal-600 bg-transparent',
    'hover:bg-charcoal-100 hover:text-charcoal-800',
    'focus:ring-charcoal-300',
    'active:bg-charcoal-200',
  ].join(' '),
  danger: [
    'bg-red-600 text-white',
    'hover:bg-red-700 hover:shadow-lg hover:shadow-red-600/20',
    'focus:ring-red-500',
    'active:bg-red-800',
  ].join(' '),
};

const sizes = {
  sm: 'px-4 py-2 text-body-sm gap-1.5 rounded-lg',
  md: 'px-5 py-2.5 text-body-sm gap-2 rounded-lg',
  lg: 'px-7 py-3 text-body gap-2.5 rounded-xl',
};

const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    className = '',
    children,
    showArrow = false,
    disabled,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled}
      className={[
        'inline-flex items-center justify-center font-semibold',
        'transition-all duration-250 ease-premium',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
        'select-none',
        variants[variant],
        sizes[size],
        className,
      ].join(' ')}
      {...props}
    >
      <span className="inline-flex items-center gap-inherit">
        {children}
        {showArrow && (
          <svg
            className="w-4 h-4 transition-transform duration-250 ease-premium group-hover:translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        )}
      </span>
    </button>
  );
});

export default Button;
