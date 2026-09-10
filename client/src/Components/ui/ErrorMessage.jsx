import Button from './Button';

function ErrorMessage({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-5">
        <svg
          className="w-8 h-8 text-red-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>
      <h3 className="font-heading text-h3 text-charcoal-900 mb-2">{title}</h3>
      {message && (
        <p className="text-charcoal-500 text-body-sm mb-6 max-w-md leading-relaxed">
          {message}
        </p>
      )}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try Again
        </Button>
      )}
    </div>
  );
}

function EmptyState({
  icon,
  title = 'Nothing here yet',
  message,
  action,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      {icon ? (
        <div className="w-16 h-16 bg-charcoal-50 rounded-2xl flex items-center justify-center mb-5 text-3xl">
          {icon}
        </div>
      ) : (
        <div className="w-16 h-16 bg-charcoal-50 rounded-2xl flex items-center justify-center mb-5">
          <svg className="w-8 h-8 text-charcoal-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
      )}
      <h3 className="font-heading text-h3 text-charcoal-900 mb-2">{title}</h3>
      {message && (
        <p className="text-charcoal-500 text-body-sm max-w-md leading-relaxed mb-4">
          {message}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}

export { ErrorMessage, EmptyState };
