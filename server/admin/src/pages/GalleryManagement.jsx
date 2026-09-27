// ------------------------------------------------------------
// Gallery management page (Phase B.2)
//
// Admin → Gallery: the ONE editable source for the public photo
// gallery (Campus page gallery section; future consumers reference
// the public /api/gallery API — content is never copied).
//
// Conventions mirror NewsManagement/ContactInbox: same shell,
// Alert banners (kind= props + children), two-click delete
// confirm, busy-id gating, 401/503 → onUnauthorized. Images are
// uploaded through the EXISTING ImageUploader (shared pipeline).
// ------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import {
  fetchGalleryItems,
  createGalleryItem,
  updateGalleryItem,
  setGalleryItemStatus,
  deleteGalleryItem,
} from '../services/galleryService';
import { Alert } from '../components/Feedback';
import ImageUploader from '../components/ImageUploader';
import ConfirmDialog from '../components/ConfirmDialog';

const CATEGORIES = [
  'Academic Events', 'Sports', 'Cultural Programs', 'Science Fair',
  'Educational Tour', 'School Events', 'Campus', 'Other',
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
  caption: '',
  image: '',
  category: 'Campus',
  sort_order: 0,
};

function toForm(item) {
  return {
    title: item.title ?? '',
    caption: item.caption ?? '',
    image: item.image ?? '',
    category: item.category ?? 'Campus',
    sort_order: item.sort_order ?? 0,
  };
}

function GalleryForm({ initial, onSaved, onCancel, onUnauthorized }) {
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const isEdit = Boolean(initial.id);

  const setField = (name, value) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: values.title.trim(),
        caption: values.caption.trim(),
        image: values.image.trim(),
        category: values.category,
        sort_order: Number(values.sort_order) || 0,
      };
      if (isEdit) {
        await updateGalleryItem(initial.id, payload);
      } else {
        await createGalleryItem(payload);
      }
      onSaved();
    } catch (err) {
      if (err?.status === 401 || err?.status === 503) onUnauthorized();
      setError(err?.message || 'Could not save the gallery item.');
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
          {isEdit ? `Edit: ${initial.title}` : 'New Gallery Item'}
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
          <Alert kind="error">{error}</Alert>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="gallery-title">
            Title *
          </label>
          <input
            id="gallery-title"
            className={inputClass}
            value={values.title}
            onChange={(e) => setField('title', e.target.value)}
            maxLength={150}
            required
          />
        </div>

        <div className="sm:col-span-2">
          <ImageUploader
            label={isEdit ? 'Image (replacing removes the old upload if unused)' : 'Image'}
            value={values.image}
            onChange={(v) => setField('image', v)}
            required={!isEdit}
            hint="Shown in the public Campus gallery."
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="gallery-category">
            Category *
          </label>
          <select
            id="gallery-category"
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
          <label className={labelClass} htmlFor="gallery-sort">
            Sort order (lower shows first)
          </label>
          <input
            id="gallery-sort"
            type="number"
            min={0}
            className={inputClass}
            value={values.sort_order}
            onChange={(e) => setField('sort_order', e.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="gallery-caption">
            Caption / alt text (optional — accessibility)
          </label>
          <textarea
            id="gallery-caption"
            className={inputClass}
            rows={2}
            value={values.caption}
            onChange={(e) => setField('caption', e.target.value)}
            maxLength={500}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || !values.title.trim() || !values.image.trim()}
          className="rounded-lg bg-forest-700 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Item (Draft)'}
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

function GalleryRow({ item, onEdit, onStatus, onDelete, busy }) {
  return (
    <tr className="border-b border-charcoal-100 last:border-0">
      <td className="py-3 pr-4">
        {item.image ? (
          <img
            src={item.image}
            alt={item.caption || item.title}
            className="h-12 w-20 rounded-lg border border-charcoal-200 object-cover"
            loading="lazy"
          />
        ) : (
          <span className="inline-flex h-12 w-20 items-center justify-center rounded-lg border border-dashed border-charcoal-300 text-[10px] text-charcoal-400">
            none
          </span>
        )}
      </td>
      <td className="py-3 pr-4">
        <span className="block font-medium text-charcoal-900">{item.title}</span>
        {item.caption && (
          <span className="block max-w-[16rem] truncate text-xs text-charcoal-400">{item.caption}</span>
        )}
      </td>
      <td className="py-3 pr-4 text-sm text-charcoal-600">{item.category}</td>
      <td className="py-3 pr-4 text-sm text-charcoal-600">{item.sort_order}</td>
      <td className="py-3 pr-4">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[item.status] ?? 'bg-charcoal-100 text-charcoal-600'}`}
        >
          {STATUS_LABEL[item.status] ?? item.status}
        </span>
      </td>
      <td className="py-3 pr-4 text-xs text-charcoal-400">
        {(item.updated_at ?? '').slice(0, 10)}
      </td>
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

export default function GalleryManagement({ onUnauthorized }) {
  const [items, setItems] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | item
  const [busyId, setBusyId] = useState(null);
  const [flash, setFlash] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchGalleryItems({
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
      });
      setItems(Array.isArray(data?.data) ? data.data : []);
      setLoadError(null);
    } catch (err) {
      if (err?.status === 401 || err?.status === 503) onUnauthorized();
      setLoadError(err?.message || 'Could not load gallery items.');
    }
  }, [onUnauthorized, statusFilter, categoryFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatus = async (item, status) => {
    setBusyId(item.id);
    try {
      await setGalleryItemStatus(item.id, status);
      setFlash(
        status === 'PUBLISHED'
          ? `“${item.title}” is now live in the public gallery.`
          : `“${item.title}” is hidden from the public gallery.`,
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
      await deleteGalleryItem(item.id);
      setFlash(`Deleted “${item.title}”. Unused uploads are removed automatically.`);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      if (err?.status === 401 || err?.status === 503) onUnauthorized();
      setFlash(err?.message || 'Could not delete the item.');
    } finally {
      setBusyId(null);
    }
  };

  const publishedCount = (items ?? []).filter((i) => i.status === 'PUBLISHED').length;

  return (
    <div className="min-h-screen bg-charcoal-50">
      <header className="bg-white border-b border-charcoal-200 px-6 py-4">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-forest-700">Gallery</h1>
            <p className="text-xs text-charcoal-500">
              Photo gallery shown on the Campus page — publish items to make
              them public; unpublish to hide without deleting.
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
          <GalleryForm
            initial={editing === 'new' ? EMPTY_FORM : toForm(editing)}
            onSaved={async () => {
              setEditing(null);
              setFlash('Saved. The public gallery reflects the change immediately.');
              await load();
            }}
            onCancel={() => setEditing(null)}
            onUnauthorized={onUnauthorized}
          />
        ) : (
          <>
            {/* Filters */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <select
                aria-label="Filter by status"
                className="rounded-lg border border-charcoal-200 bg-white px-3 py-2 text-sm text-charcoal-700"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                {Object.keys(STATUS_LABEL).map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
              <select
                aria-label="Filter by category"
                className="rounded-lg border border-charcoal-200 bg-white px-3 py-2 text-sm text-charcoal-700"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <span className="text-sm text-charcoal-500">
                {items === null
                  ? 'Loading…'
                  : `${items.length} item${items.length === 1 ? '' : 's'} · ${publishedCount} published`}
              </span>
              <button
                type="button"
                onClick={() => setEditing('new')}
                className="ml-auto rounded-lg bg-forest-700 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-800"
              >
                + New Gallery Item
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left">
                  <thead>
                    <tr className="border-b border-charcoal-100 bg-charcoal-50/60 text-xs uppercase tracking-wide text-charcoal-500">
                      <th className="px-4 py-3 font-semibold">Image</th>
                      <th className="px-4 py-3 font-semibold">Title</th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Order</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Updated</th>
                      <th className="px-4 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items === null ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-sm text-charcoal-400">
                          Loading gallery items…
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-sm text-charcoal-400">
                          No gallery items{statusFilter || categoryFilter ? ' matching the filters' : ' yet'}.
                          Create the first item and publish it to show it on the Campus page.
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <GalleryRow
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
              Published items appear in the Campus page gallery (public API:
              /api/gallery). Images are uploaded through the shared secure
              pipeline and re-encoded to WebP by the server.
            </p>
          </>
        )}
      </main>

      {confirmDelete !== null && (
        <ConfirmDialog
          title="Delete this gallery item?"
          message="The item will be permanently removed. If its uploaded image is not used by another item or a news post, the file is removed too. This cannot be undone."
          confirmLabel="Delete"
          busy={busyId !== null}
          onConfirm={() => {
            const item = (items ?? []).find((i) => i.id === confirmDelete);
            if (item) handleDelete(item);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
