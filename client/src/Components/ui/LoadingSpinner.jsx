function LoadingSpinner({ size = 'md', text = '' }) {
  const sizes = {
    sm: 'w-5 h-5 border-[1.5px]',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-[2.5px]',
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <div
        className={`${sizes[size]} border-charcoal-200 border-t-forest-600 rounded-full animate-spin`}
        role="status"
        aria-label="Loading"
      />
      {text && <p className="text-body-sm text-charcoal-400">{text}</p>}
    </div>
  );
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-50">
      <div className="text-center">
        <div className="w-10 h-10 bg-forest-600 rounded-lg flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-white animate-pulse" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z" />
          </svg>
        </div>
        <LoadingSpinner size="md" />
      </div>
    </div>
  );
}

function Skeleton({ className = '', variant = 'text', count = 1 }) {
  const variants = {
    text: 'h-4 rounded',
    heading: 'h-8 rounded w-3/4',
    avatar: 'w-12 h-12 rounded-full',
    image: 'aspect-[16/10] rounded-xl',
    button: 'h-10 rounded-lg w-32',
  };

  return (
    <div className={`animate-pulse ${className}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${variants[variant]} bg-charcoal-100 ${i < count - 1 ? 'mb-3' : ''}`}
        />
      ))}
    </div>
  );
}

export { LoadingSpinner, PageLoader, Skeleton };
