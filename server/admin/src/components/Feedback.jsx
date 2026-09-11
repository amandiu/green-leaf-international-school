// ------------------------------------------------------------
// Shared admin UI primitives (Phase 3.3)
// Following the existing Tailwind palette (forest / charcoal).
// ------------------------------------------------------------

/** Inline feedback banner for API/validation outcomes. */
export function Alert({ kind = 'info', children, onClose }) {
  const styles = {
    success: 'bg-green-50 border-green-300 text-green-800',
    error: 'bg-red-50 border-red-300 text-red-800',
    info: 'bg-blue-50 border-blue-300 text-blue-800',
  }[kind] || 'bg-charcoal-50 border-charcoal-200 text-charcoal-700';

  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${styles}`}
    >
      <span className="min-w-0 break-words">{children}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded p-0.5 text-current opacity-60 hover:opacity-100 focus:outline-none"
          aria-label="Dismiss message"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/** Centered loading indicator. */
export function Loader({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-charcoal-500">
      <span
        className="h-5 w-5 animate-spin rounded-full border-2 border-forest-500 border-t-transparent"
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}
