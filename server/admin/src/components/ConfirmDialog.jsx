// ------------------------------------------------------------
// ConfirmDialog — destructive-action confirmation (Phase 3.3)
// ------------------------------------------------------------

export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', busy = false, onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-900/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-charcoal-900">
          {title}
        </h2>
        <p className="mt-2 whitespace-pre-line text-sm text-charcoal-600">{message}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-charcoal-200 px-4 py-2 text-sm font-medium text-charcoal-600 hover:bg-charcoal-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
          >
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
