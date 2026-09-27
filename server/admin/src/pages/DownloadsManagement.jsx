// ------------------------------------------------------------
// Downloads management page (Phase B.6)
//
// Admin → Downloads: the ONE management flow for the public
// Downloads Center. Architecture mirrors GalleryManagement
// (Phase B.2): list + form + status lifecycle + delete
// confirmation + 401/503 session-drop convention, with
// <Alert kind="...">{children}</Alert> feedback primitives.
//
// Document upload goes through the shared secure pipeline
// (POST /api/admin/uploads/document — PDF allowlist + magic-byte
// validation, server-generated filename). The UI shows file
// METADATA only (filename, size, type) — never internal
// filesystem paths.
// ------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import {
  fetchDownloads,
  createDownload,
  updateDownload,
  setDownloadStatus,
  deleteDownload,
  uploadDocument,
} from '../services/downloadService';
import { Alert, Loader } from '../components/Feedback';
import ConfirmDialog from '../components/ConfirmDialog';

const CATEGORIES = [
  'Prospectus', 'Syllabus', 'Routine', 'Question Papers',
  'Forms', 'Notices', 'Circulars', 'Academic Documents',
  'Rules & Regulations', 'Other',
];
const STATUS_LABEL = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};
const STATUS_CLASS = {
  DRAFT: 'bg-charcoal-100 text-charcoal-600',
  PUBLISHED: 'bg-green-100 text-green-700',
  ARCHIVED: 'bg-gold-100 text-gold-700',
};

const inputClass =
  'mt-1 w-full rounded-lg border border-charcoal-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent';
const labelClass = 'block text-sm font-medium text-charcoal-700';

const EMPTY_FORM = {
  title: '',
  description: '',
  category: 'Forms',
  file: '',
  original_filename: '',
  file_bytes: null,
  sort_order: 0,
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function toForm(item) {
  return {
    title: item.title ?? '',
    description: item.description ?? '',
    category: item.category ?? 'Forms',
    file: item.file ?? '',
    original_filename: item.original_filename ?? '',
    file_bytes: item.file_bytes ?? null,
    sort_order: item.sort_order ?? 0,
  };
}

/** PDF file picker → shared secure upload pipeline. */
function DocumentUploader({ values, set }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const data = await uploadDocument(file);
      set((prev) => ({
        ...prev,
        file: data.file_path ?? '',
        original_filename: data.original_filename ?? file.name,
        file_bytes: data.bytes ?? null,
      }));
    } catch (err) {
      if (err?.status === 401 || err?.status === 503) {
        setUploadError(err?.message || 'Session expired. Log in again.');
      } else {
        setUploadError(err?.message || 'Upload failed.');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="sm:col-span-2">
      <label className={labelClass} htmlFor="download-file">
        Document (PDF, max 10 MB) *
      </label>
      <input
        id="download-file"
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleFile}
        disabled={uploading}
        className="mt-1 block w-full text-sm text-charcoal-600 file:mr-3 file:rounded-lg file:border-0 file:bg-forest-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-forest-700 hover:file:bg-forest-100"
      />
      {uploading && <p className="mt-1 text-xs text-charcoal-500">Uploading…</p>}
      {uploadError && <p className="mt-1 text-xs text-red-600">{uploadError}</p>}
      {values.file && (
        <p className="mt-2 text-xs text-charcoal-500">
          <span className="font-medium text-charcoal-700">{values.original_filename || 'Document'}</span>
          {' · '}PDF{' · '}{formatBytes(values.file_bytes)}
          {' · '}uploaded
        </p>
      )}
    </div>
  );
}

function DownloadForm({ initial, onSaved, onCancel, onUnauthorized }) {
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const isEdit = Boolean(initial.id);

  const setField = (name, value) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!values.file) {
      setError('Upload the PDF document first.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: values.title.trim(),
        description: values.description.trim(),
        category: values.category,
        file: values.file,
        sort_order: Number(values.sort_order) || 0,
        // Upload facts from the shared pipeline (display metadata).
        original_filename: values.original_filename,
        file_ext: 'pdf',
        file_bytes: values.file_bytes,
      };
      if (isEdit) {
        await updateDownload(initial.id, payload);
      } else {
        await createDownload(payload);
      }
      onSaved();
    } catch (err) {
      if (err?.status === 401 || err?.status === 503) onUnauthorized();
      setError(err?.message || 'Could not save the download.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-charcoal-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-charcoal-900">
          {isEdit ? `Edit: ${initial.title}` : 'New Download'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-medium text-charcoal-500 hover:text-charcoal-700"
        >
          Cancel
        </button>
      </div>

      {error && (
        <div className="mt-3">
          <Alert kind="error" onClose={() => setError(null)}>{error}</Alert>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="download-title">
            Title *
          </label>
          <input
            id="download-title"
            className={inputClass}
            value={values.title}
            onChange={(e) => setField('title', e.target.value)}
            maxLength={200}
            required
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="download-category">
            Category
          </label>
          <select
            id="download-category"
            className={inputClass}
            value={values.category}
            onChange={(e) => setField('category', e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="download-sort">
            Sort order
          </label>
          <input
            id="download-sort"
            type="number"
            min={0}
            className={inputClass}
            value={values.sort_order}
            onChange={(e) => setField('sort_order', e.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="download-description">
            Description (short public summary)
          </label>
          <textarea
            id="download-description"
            className={inputClass}
            rows={2}
            value={values.description}
            onChange={(e) => setField('description', e.target.value)}
            maxLength={500}
          />
        </div>

        <DocumentUploader values={values} set={setValues} />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || !values.title.trim() || !values.file}
          className="rounded-lg bg-forest-700 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Download'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-charcoal-200 px-4 py-2 text-sm font-medium text-charcoal-600 hover:bg-charcoal-50"
        >
          Close
        </button>
      </div>
    </form>
  );
}

function DownloadRow({ item, onEdit, onStatus, onDelete, busy }) {
  return (
    <tr className="border-b border-charcoal-100 last:border-0">
      <td className="py-3 pr-4">
        <span className="block font-medium text-charcoal-900">{item.title}</span>
        <span className="text-xs text-charcoal-400">
          {item.original_filename ?? 'document'} · {formatBytes(item.file_bytes)}
        </span>
      </td>
      <td className="py-3 pr-4 text-sm text-charcoal-600">{item.category}</td>
      <td className="py-3 pr-4">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[item.status] ?? 'bg-charcoal-100 text-charcoal-600'}`}
        >
          {STATUS_LABEL[item.status] ?? item.status}
        </span>
      </td>
      <td className="py-3 pr-4 text-sm text-charcoal-600">{item.sort_order}</td>
      <td className="py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(item)}
            disabled={busy}
            className="rounded-lg border border-charcoal-200 px-2.5 py-1 text-xs font-medium text-charcoal-700 hover:bg-charcoal-50 disabled:opacity-50"
          >
            Edit
          </button>
          {item.status === 'PUBLISHED' ? (
            <button
              type="button"
              onClick={() => onStatus(item, 'DRAFT')}
              disabled={busy}
              className="rounded-lg border border-gold-300 px-2.5 py-1 text-xs font-medium text-gold-700 hover:bg-gold-50 disabled:opacity-50"
            >
              Unpublish
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onStatus(item, 'PUBLISHED')}
              disabled={busy}
              className="rounded-lg bg-forest-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-forest-800 disabled:opacity-50"
            >
              Publish
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(item)}
            disabled={busy}
            className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function DownloadsManagement({ onUnauthorized }) {
  const [items, setItems] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | item
  const [busyId, setBusyId] = useState(null);
  const [flash, setFlash] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchDownloads();
      setItems(Array.isArray(data?.data?.items) ? data.data.items : []);
      setLoadError(null);
    } catch (err) {
      if (err?.status === 401 || err?.status === 503) onUnauthorized();
      setLoadError(err?.message || 'Could not load downloads.');
    }
  }, [onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatus = async (item, status) => {
    setBusyId(item.id);
    try {
      await setDownloadStatus(item.id, status);
      setFlash(
        status === 'PUBLISHED'
          ? `“${item.title}” is now live in the public Downloads Center.`
          : `“${item.title}” is hidden from the public Downloads Center.`,
      );
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
      await deleteDownload(item.id);
      setFlash(`Deleted “${item.title}”. Its file was removed if no other entry used it.`);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      if (err?.status === 401 || err?.status === 503) onUnauthorized();
      setFlash(err?.message || 'Could not delete the item.');
    } finally {
      setBusyId(null);
    }
  };

  const publishedCount = (items ?? []).filter(
    (i) => i.status === 'PUBLISHED',
  ).length;

  return (
    <div className="min-h-screen bg-charcoal-50">
      <header className="bg-white border-b border-charcoal-200 px-6 py-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-forest-700">
              Downloads
            </h1>
            <p className="text-xs text-charcoal-500">
              Public Downloads Center — documents publish instantly at /downloads.
              Only PDF files up to 10 MB are accepted (validated server-side).
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl p-6">
        {flash && (
          <div className="mb-4">
            <Alert kind="success" onClose={() => setFlash(null)}>{flash}</Alert>
          </div>
        )}
        {loadError && (
          <div className="mb-4">
            <Alert kind="error">{loadError}</Alert>
          </div>
        )}

        {editing ? (
          <DownloadForm
            initial={editing === 'new' ? { ...EMPTY_FORM } : { ...toForm(editing), id: editing.id }}
            onSaved={async () => {
              setEditing(null);
              setFlash('Saved. The public Downloads Center shows the change immediately.');
              await load();
            }}
            onCancel={() => setEditing(null)}
            onUnauthorized={onUnauthorized}
          />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-charcoal-500">
                {items === null
                  ? 'Loading…'
                  : `${items.length} item${items.length === 1 ? '' : 's'} · ${publishedCount} published`}
              </p>
              <button
                type="button"
                onClick={() => setEditing('new')}
                className="rounded-lg bg-forest-700 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-800"
              >
                + New Download
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left">
                  <thead>
                    <tr className="border-b border-charcoal-100 bg-charcoal-50/60 text-xs uppercase tracking-wide text-charcoal-500">
                      <th className="px-4 py-3 font-semibold">Title</th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Order</th>
                      <th className="px-4 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="px-4">
                    {items === null ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-charcoal-400">
                          <Loader label="Loading downloads…" />
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-sm text-charcoal-400">
                          No downloads yet. Create the first entry — it appears in the
                          public Downloads Center once published.
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <DownloadRow
                          key={item.id}
                          item={item}
                          onEdit={(i) => setEditing(i)}
                          onStatus={handleStatus}
                          onDelete={handleDelete}
                          busy={busyId === item.id}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="mt-4 text-xs text-charcoal-400">
              Files are stored under server-generated names and served only for
              published entries. Replacing a document keeps the old file until it
              is no longer referenced.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
