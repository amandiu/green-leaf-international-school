// ------------------------------------------------------------
// Contact Inbox page (Phase B.1)
//
// Admin → Contact Inbox: messages submitted through the public
// Contact form (POST /api/contact → contact_messages).
//
// Conventions mirror LeadershipManagement/NewsManagement: same
// header/main shell, Alert banners (kind= props + children — the
// Feedback.jsx contract), Loader, two-click delete confirm,
// busy-id gating, 401/503 → onUnauthorized. Filter by status is
// client-side over the full list (inboxes are small; pagination
// can be added when the existing admin list pattern grows one).
// ------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchContactMessages,
  setContactMessageStatus,
  deleteContactMessage,
} from '../services/contactService';
import { Alert } from '../components/Feedback';
import ConfirmDialog from '../components/ConfirmDialog';

const STATUS_LABEL = {
  NEW: 'New',
  READ: 'Read',
  REPLIED: 'Replied',
  ARCHIVED: 'Archived',
};
const STATUS_CLASS = {
  NEW: 'bg-green-100 text-green-700',
  READ: 'bg-charcoal-100 text-charcoal-600',
  REPLIED: 'bg-blue-50 text-blue-700',
  ARCHIVED: 'bg-gold-100 text-gold-700',
};
const FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'NEW', label: 'New' },
  { key: 'READ', label: 'Read' },
  { key: 'REPLIED', label: 'Replied' },
  { key: 'ARCHIVED', label: 'Archived' },
];

function MessageDetail({ item, onStatus, onDelete, busy, onBack }) {
  return (
    <div className="rounded-xl border border-charcoal-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-charcoal-900">{item.subject}</h2>
          <p className="mt-0.5 text-xs text-charcoal-400">
            Received {item.receivedLabel ?? '—'} (Bangladesh time)
          </p>
        </div>
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[item.status] ?? 'bg-charcoal-100 text-charcoal-600'}`}
        >
          {STATUS_LABEL[item.status] ?? item.status}
        </span>
      </div>

      <dl className="mt-4 grid gap-2 rounded-lg bg-charcoal-50/70 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-charcoal-400">From</dt>
          <dd className="text-charcoal-800">{item.name}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-charcoal-400">Email</dt>
          <dd className="break-all text-charcoal-800">{item.email}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-charcoal-400">Phone</dt>
          <dd className="text-charcoal-800">{item.phone ?? '—'}</dd>
        </div>
      </dl>

      <div className="mt-4 whitespace-pre-wrap rounded-lg border border-charcoal-100 p-4 text-sm leading-relaxed text-charcoal-700">
        {item.message}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {item.status === 'NEW' && (
          <button
            type="button"
            onClick={() => onStatus(item, 'READ')}
            disabled={busy}
            className="rounded-lg bg-forest-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-forest-800 disabled:opacity-50"
          >
            Mark as Read
          </button>
        )}
        {item.status !== 'REPLIED' && (
          <button
            type="button"
            onClick={() => onStatus(item, 'REPLIED')}
            disabled={busy}
            className="rounded-lg border border-forest-300 px-3 py-1.5 text-xs font-semibold text-forest-700 hover:bg-forest-50 disabled:opacity-50"
          >
            Mark as Replied
          </button>
        )}
        {item.status !== 'ARCHIVED' && (
          <button
            type="button"
            onClick={() => onStatus(item, 'ARCHIVED')}
            disabled={busy}
            className="rounded-lg border border-gold-300 px-3 py-1.5 text-xs font-medium text-gold-700 hover:bg-gold-50 disabled:opacity-50"
          >
            Archive
          </button>
        )}
        {item.status === 'ARCHIVED' && (
          <button
            type="button"
            onClick={() => onStatus(item, 'READ')}
            disabled={busy}
            className="rounded-lg border border-charcoal-200 px-3 py-1.5 text-xs font-medium text-charcoal-700 hover:bg-charcoal-50 disabled:opacity-50"
          >
            Unarchive
          </button>
        )}
        <button
          type="button"
          onClick={onBack}
          className="ml-auto rounded-lg border border-charcoal-200 px-3 py-1.5 text-xs font-medium text-charcoal-600 hover:bg-charcoal-50"
        >
          Back to inbox
        </button>
      </div>

      <div className="mt-3 border-t border-charcoal-100 pt-3">
        <button
          type="button"
          onClick={() => onDelete(item)}
          disabled={busy}
          className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Delete message
        </button>
        <p className="mt-1 text-xs text-charcoal-400">
          Reply from your own email client — the sender's address is shown above.
        </p>
      </div>
    </div>
  );
}

function MessageRow({ item, onOpen, busy }) {
  return (
    <tr className="border-b border-charcoal-100 last:border-0">
      <td className="py-3 pr-4">
        <span className={`block font-medium ${item.status === 'NEW' ? 'text-charcoal-900' : 'text-charcoal-600'}`}>
          {item.subject}
        </span>
        <span className="text-xs text-charcoal-400">{item.name}</span>
      </td>
      <td className="py-3 pr-4 text-sm text-charcoal-600">{item.email}</td>
      <td className="py-3 pr-4 text-sm text-charcoal-600">{item.phone ?? '—'}</td>
      <td className="py-3 pr-4">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[item.status] ?? 'bg-charcoal-100 text-charcoal-600'}`}
        >
          {STATUS_LABEL[item.status] ?? item.status}
        </span>
      </td>
      <td className="py-3 pr-4 text-xs text-charcoal-400">{item.receivedLabel ?? '—'}</td>
      <td className="py-3">
        <button
          type="button"
          onClick={() => onOpen(item)}
          disabled={busy}
          className="rounded-lg border border-charcoal-200 px-2.5 py-1 text-xs font-medium text-charcoal-700 hover:bg-charcoal-50 disabled:opacity-50"
        >
          Open
        </button>
      </td>
    </tr>
  );
}

export default function ContactInbox({ onUnauthorized }) {
  const [items, setItems] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [openId, setOpenId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [flash, setFlash] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchContactMessages();
      setItems(Array.isArray(data?.data) ? data.data : []);
      setLoadError(null);
    } catch (err) {
      if (err?.status === 401 || err?.status === 503) onUnauthorized();
      setLoadError(err?.message || 'Could not load contact messages.');
    }
  }, [onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const list = items ?? [];
    return filter === 'ALL' ? list : list.filter((m) => m.status === filter);
  }, [items, filter]);

  const newCount = (items ?? []).filter((m) => m.status === 'NEW').length;

  const openMessage = (item) => {
    setOpenId(item.id);
    // Opening a NEW message marks it read (classic inbox behavior);
    // failures are non-fatal — the detail view still renders.
    if (item.status === 'NEW') {
      setContactMessageStatus(item.id, 'READ')
        .then(() => load())
        .catch((err) => {
          if (err?.status === 401 || err?.status === 503) onUnauthorized();
        });
    }
  };

  const handleStatus = async (item, status) => {
    setBusyId(item.id);
    try {
      await setContactMessageStatus(item.id, status);
      setFlash(`Message #${item.id} marked as ${STATUS_LABEL[status] ?? status}.`);
      await load();
    } catch (err) {
      if (err?.status === 401 || err?.status === 503) onUnauthorized();
      setFlash(err?.message || 'Could not update the status.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item) => {
    if (confirmDelete !== item.id) {
      setConfirmDelete(item.id);
      return;
    }
    setBusyId(item.id);
    try {
      await deleteContactMessage(item.id);
      setFlash(`Deleted message #${item.id}.`);
      setConfirmDelete(null);
      setOpenId(null);
      await load();
    } catch (err) {
      if (err?.status === 401 || err?.status === 503) onUnauthorized();
      setFlash(err?.message || 'Could not delete the message.');
    } finally {
      setBusyId(null);
    }
  };

  const openItem = (items ?? []).find((m) => m.id === openId);

  return (
    <div className="min-h-screen bg-charcoal-50">
      <header className="bg-white border-b border-charcoal-200 px-6 py-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-forest-700">Contact Inbox</h1>
            <p className="text-xs text-charcoal-500">
              Messages from the public Contact form. Private data — never shown
              on the public website.
            </p>
          </div>
          {newCount > 0 && (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
              {newCount} new
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl p-6">
        {flash && (
          <div className="mb-4">
            <Alert kind="info" onClose={() => setFlash(null)}>{flash}</Alert>
          </div>
        )}
        {loadError && (
          <div className="mb-4">
            <Alert kind="error">{loadError}</Alert>
          </div>
        )}

        {openItem ? (
          <MessageDetail
            item={openItem}
            onStatus={handleStatus}
            onDelete={handleDelete}
            busy={busyId === openItem.id}
            onBack={() => setOpenId(null)}
          />
        ) : (
          <>
            {/* Status filter tabs */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {FILTERS.map((f) => {
                const count = f.key === 'ALL'
                  ? (items ?? []).length
                  : (items ?? []).filter((m) => m.status === f.key).length;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className={[
                      'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                      filter === f.key
                        ? 'bg-forest-700 text-white'
                        : 'border border-charcoal-200 bg-white text-charcoal-600 hover:bg-charcoal-50',
                    ].join(' ')}
                  >
                    {f.label} ({count})
                  </button>
                );
              })}
            </div>

            <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead>
                    <tr className="border-b border-charcoal-100 bg-charcoal-50/60 text-xs uppercase tracking-wide text-charcoal-500">
                      <th className="px-4 py-3 font-semibold">Subject / From</th>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="px-4 py-3 font-semibold">Phone</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Received</th>
                      <th className="px-4 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items === null ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-charcoal-400">
                          Loading messages…
                        </td>
                      </tr>
                    ) : visible.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-charcoal-400">
                          {items.length === 0
                            ? 'No contact messages yet. Submissions from the public Contact form appear here.'
                            : `No ${STATUS_LABEL[filter]?.toLowerCase() ?? ''} messages.`}
                        </td>
                      </tr>
                    ) : (
                      visible.map((item) => (
                        <MessageRow
                          key={item.id}
                          item={item}
                          onOpen={openMessage}
                          busy={busyId === item.id}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="mt-4 text-xs text-charcoal-400">
              Lifecycle: New → Read → Replied (Archive any time). Received times
              are shown in Bangladesh time (Asia/Dhaka) for every admin.
            </p>
          </>
        )}
      </main>

      {confirmDelete !== null && (
        <ConfirmDialog
          title="Delete this message?"
          message="The message and its content will be permanently removed. This cannot be undone."
          confirmLabel="Delete"
          busy={busyId !== null}
          onConfirm={() => handleDelete(openItem ?? { id: confirmDelete })}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
