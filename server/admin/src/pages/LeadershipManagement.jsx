// ------------------------------------------------------------
// Leadership Management page (Leadership phase)
//
// List of leadership records with create, edit, activate/
// deactivate and delete flows — following the same architecture
// and styling as NavigationManagement. All data changes go
// through the admin leadership API service.
// ------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import {
  fetchAdminLeadershipMessages,
  createLeadershipMessage,
  updateLeadershipMessage,
  deleteLeadershipMessage,
} from '../services/leadershipService';
import { Alert, Loader } from '../components/Feedback';
import LeadershipForm from '../components/LeadershipForm';
import ConfirmDialog from '../components/ConfirmDialog';

const NONE = { mode: 'none' };

function Badge({ tone, children }) {
  const tones = {
    green: 'bg-green-100 text-green-800',
    amber: 'bg-amber-100 text-amber-800',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

function RecordMeta({ item }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-charcoal-500">
      <Badge tone={item.is_active ? 'green' : 'amber'}>
        {item.is_active ? 'Active' : 'Inactive'}
      </Badge>
      <span>Order: {item.sort_order}</span>
      {item.name ? (
        <span>Name: {item.name}</span>
      ) : (
        <span className="italic">name pending</span>
      )}
      {item.message ? (
        <span>Message: {item.message.length} chars</span>
      ) : (
        <span className="italic">message pending</span>
      )}
    </div>
  );
}

/** Compact portrait preview that never breaks the layout. */
function PortraitPreview({ item }) {
  return (
    <div className="h-20 w-16 shrink-0 overflow-hidden rounded-lg border border-charcoal-200 bg-charcoal-50">
      {item.image_url ? (
        <img
          src={item.image_url}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-charcoal-400">
          No image
        </div>
      )}
    </div>
  );
}

function RowActions({ onEdit, onDelete }) {
  const btn = 'rounded-lg border border-charcoal-200 px-3 py-1.5 text-xs font-medium text-charcoal-600 transition-colors hover:bg-charcoal-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500';
  return (
    <div className="mt-2 flex flex-wrap gap-2 sm:mt-0 sm:shrink-0">
      <button type="button" className={btn} onClick={onEdit}>Edit</button>
      <button
        type="button"
        className={`${btn} border-red-200 text-red-600 hover:bg-red-50`}
        onClick={onDelete}
      >
        Delete
      </button>
    </div>
  );
}

export default function LeadershipManagement({ onUnauthorized }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(NONE);
  const [confirming, setConfirming] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetchAdminLeadershipMessages();
      setRecords(res.data || []);
    } catch (err) {
      if (err.status === 401 || err.status === 503) {
        onUnauthorized?.();
        return;
      }
      setLoadError(err.message || 'Failed to load leadership messages.');
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  const closeForm = () => setForm(NONE);

  const handleCreate = async (payload) => {
    await createLeadershipMessage(payload);
    setNotice(`Leadership record “${payload.role}” created.`);
    closeForm();
    await load();
  };

  const handleUpdate = async (payload) => {
    const record = form.item;
    await updateLeadershipMessage(record.id, payload);
    setNotice(`Leadership record “${payload.role}” updated.`);
    closeForm();
    await load();
  };

  const handleDelete = async () => {
    const record = confirming;
    if (!record) return;
    setDeleteBusy(true);
    try {
      await deleteLeadershipMessage(record.id);
      setNotice(`Leadership record “${record.role}” deleted.`);
      setConfirming(null);
      await load();
    } catch (err) {
      if (err.status === 401 || err.status === 503) {
        onUnauthorized?.();
      } else {
        setLoadError(err.message || 'Delete failed.');
      }
      setConfirming(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const card = 'rounded-xl border border-charcoal-200 bg-white p-4 shadow-sm';

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-forest-700">Leadership Management</h1>
          <p className="mt-1 text-sm text-charcoal-500">
            Manage the Principal and Chairman messages shown on the public homepage.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForm({ mode: 'create' })}
          className="rounded-lg bg-forest-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-forest-700"
        >
          + Add Leadership Message
        </button>
      </div>

      {(notice || loadError) && (
        <div className="mt-4">
          {notice && <Alert kind="success" onClose={() => setNotice('')}>{notice}</Alert>}
          {loadError && <Alert kind="error" onClose={() => setLoadError('')}>{loadError}</Alert>}
        </div>
      )}

      {form.mode === 'create' && (
        <div className="mt-4">
          <LeadershipForm onSubmit={handleCreate} onCancel={closeForm} />
        </div>
      )}

      {form.mode === 'edit' && (
        <div className="mt-4">
          <LeadershipForm
            key={form.item.id}
            initial={form.item}
            onSubmit={handleUpdate}
            onCancel={closeForm}
          />
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <Loader label="Loading leadership messages…" />
        ) : loadError && records.length === 0 ? (
          <div className={card}>
            <Alert kind="error">{loadError}</Alert>
            <button
              type="button"
              onClick={load}
              className="mt-3 rounded-lg border border-charcoal-200 px-4 py-2 text-sm font-medium text-charcoal-600 hover:bg-charcoal-100"
            >
              Retry
            </button>
          </div>
        ) : records.length === 0 ? (
          <div className={`${card} text-center`}>
            <p className="text-charcoal-600">No leadership records yet.</p>
            <p className="mt-1 text-sm text-charcoal-400">
              The public homepage section shows its “pending” placeholders until a record is added.
            </p>
            <button
              type="button"
              onClick={() => setForm({ mode: 'create' })}
              className="mt-3 rounded-lg bg-forest-600 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700"
            >
              Create the first record
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {records.map((item) => (
              <li key={item.id}>
                <div className={card}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <PortraitPreview item={item} />
                      <div className="min-w-0">
                        <span className="truncate font-semibold text-charcoal-900">{item.role}</span>
                        <RecordMeta item={item} />
                      </div>
                    </div>
                    <RowActions
                      onEdit={() => setForm({ mode: 'edit', item })}
                      onDelete={() => setConfirming(item)}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {confirming && (
        <ConfirmDialog
          title={`Delete “${confirming.role}” record?`}
          message="Are you sure you want to delete this leadership message? This action cannot be undone."
          busy={deleteBusy}
          onConfirm={handleDelete}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}
