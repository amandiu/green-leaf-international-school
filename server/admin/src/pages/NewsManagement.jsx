// ------------------------------------------------------------
// News & Notices management page (Phase E)
//
// Admin → Content Center → News & Notices: the ONE editable
// source for everything the public site shows as news/notices
// (Homepage preview, Navbar ticker, News page + detail).
//
// Structured fields only (no JSON editor). List shows
// Title/Type/Status/Published/Updated/Actions; actions are
// Edit, Publish/Unpublish, Delete. Auth/session conventions
// mirror the other admin pages (401/503 → onUnauthorized).
// ------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import {
  fetchAdminNews,
  createNewsItem,
  updateNewsItem,
  setNewsStatus,
  deleteNewsItem,
} from '../services/newsService';
import { Alert, Loader } from '../components/Feedback';

const TYPES = ['NEWS', 'NOTICE', 'EVENT', 'ANNOUNCEMENT'];
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
  type: 'NEWS',
  status: 'DRAFT',
  excerpt: '',
  content: '',
  image: '',
  slug: '',
};

/** Turn a list row into form values (dates stay server-formatted). */
function toForm(item) {
  return {
    title: item.title ?? '',
    type: item.type ?? 'NEWS',
    status: item.status ?? 'DRAFT',
    excerpt: item.excerpt ?? '',
    content: item.content ?? '',
    image: item.image ?? '',
    slug: item.slug ?? '',
  };
}

function NewsForm({ initial, onSaved, onCancel, onUnauthorized }) {
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
        type: values.type,
        status: values.status,
        excerpt: values.excerpt.trim(),
        content: values.content,
        image: values.image.trim(),
      };
      if (isEdit) {
        // Slug only changes when the admin edits the field (never
        // silently regenerated — existing URLs keep working).
        if (values.slug.trim() && values.slug.trim() !== initial.slug) {
          payload.slug = values.slug.trim();
        }
        await updateNewsItem(initial.id, payload);
      } else {
        await createNewsItem(payload);
      }
      onSaved();
    } catch (err) {
      if (err?.status === 401 || err?.status === 503) onUnauthorized();
      setError(err?.message || 'Could not save the news item.');
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
          {isEdit ? `Edit: ${initial.title}` : 'New News / Notice'}
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
          <Alert type="error" message={error} />
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="news-title">
            Title *
          </label>
          <input
            id="news-title"
            className={inputClass}
            value={values.title}
            onChange={(e) => setField('title', e.target.value)}
            maxLength={200}
            required
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="news-type">
            Type
          </label>
          <select
            id="news-type"
            className={inputClass}
            value={values.type}
            onChange={(e) => setField('type', e.target.value)}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="news-status">
            Status
          </label>
          <select
            id="news-status"
            className={inputClass}
            value={values.status}
            onChange={(e) => setField('status', e.target.value)}
          >
            <option value="DRAFT">Draft (not visible publicly)</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived (hidden, kept)</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="news-excerpt">
            Excerpt (short summary shown on cards)
          </label>
          <textarea
            id="news-excerpt"
            className={inputClass}
            rows={2}
            value={values.excerpt}
            onChange={(e) => setField('excerpt', e.target.value)}
            maxLength={500}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="news-content">
            Content (optional — blank line between paragraphs)
          </label>
          <textarea
            id="news-content"
            className={inputClass}
            rows={7}
            value={values.content}
            onChange={(e) => setField('content', e.target.value)}
            maxLength={20000}
            placeholder={`Write the full announcement here.\n\nLeave empty lines between paragraphs.`}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="news-image">
            Image (optional)
          </label>
          <input
            id="news-image"
            className={inputClass}
            value={values.image}
            onChange={(e) => setField('image', e.target.value)}
            maxLength={500}
            placeholder="/Activity/photo.jpg or https://…"
          />
          <p className="mt-1 text-xs text-charcoal-400">
            Site-relative path (existing /Activity/… files) or an https image
            URL. Leave empty for a branded placeholder.
          </p>
        </div>

        {isEdit && (
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="news-slug">
              URL slug
            </label>
            <input
              id="news-slug"
              className={inputClass}
              value={values.slug}
              onChange={(e) => setField('slug', e.target.value)}
              maxLength={200}
            />
            <p className="mt-1 text-xs text-charcoal-400">
              Public URL: /news/&lt;slug&gt;. Changing it moves the page —
              old links stop working. Leave as-is unless intended.
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || !values.title.trim()}
          className="rounded-lg bg-forest-700 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Item'}
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

function NewsRow({ item, onEdit, onStatus, onDelete, busy }) {
  return (
    <tr className="border-b border-charcoal-100 last:border-0">
      <td className="py-3 pr-4">
        <span className="block font-medium text-charcoal-900">{item.title}</span>
        <span className="text-xs text-charcoal-400">/news/{item.slug}</span>
      </td>
      <td className="py-3 pr-4 text-sm text-charcoal-600">{item.type}</td>
      <td className="py-3 pr-4">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[item.status] ?? 'bg-charcoal-100 text-charcoal-600'}`}
        >
          {STATUS_LABEL[item.status] ?? item.status}
        </span>
      </td>
      <td className="py-3 pr-4 text-sm text-charcoal-600">
        {item.dateLabel ?? '—'}
      </td>
      <td className="py-3 pr-4 text-xs text-charcoal-400">
        {item.updatedLabel ?? '—'}
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

export default function NewsManagement({ onUnauthorized }) {
  const [items, setItems] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | item
  const [busyId, setBusyId] = useState(null);
  const [flash, setFlash] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchAdminNews();
      setItems(Array.isArray(data?.items) ? data.items : []);
      setLoadError(null);
    } catch (err) {
      if (err?.status === 401 || err?.status === 503) onUnauthorized();
      setLoadError(err?.message || 'Could not load news items.');
    }
  }, [onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatus = async (item, status) => {
    setBusyId(item.id);
    try {
      await setNewsStatus(item.id, status);
      setFlash(
        status === 'PUBLISHED'
          ? `“${item.title}” is now live on Homepage, Navbar and the News page.`
          : `“${item.title}” is hidden from all public pages.`,
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
      await deleteNewsItem(item.id);
      setFlash(`Deleted “${item.title}”.`);
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
              News &amp; Notices
            </h1>
            <p className="text-xs text-charcoal-500">
              Content Center → News &amp; Notices — one source shared by the
              Homepage preview, Navbar ticker and the News page.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl p-6">
        {flash && (
          <div className="mb-4">
            <Alert
              type="success"
              message={flash}
              onDismiss={() => setFlash(null)}
            />
          </div>
        )}
        {loadError && (
          <div className="mb-4">
            <Alert type="error" message={loadError} />
          </div>
        )}

        {editing ? (
          <NewsForm
            initial={editing === 'new' ? EMPTY_FORM : toForm(editing)}
            onSaved={async () => {
              setEditing(null);
              setFlash('Saved. Public pages show the change immediately.');
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
                + New News / Notice
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-charcoal-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left">
                  <thead>
                    <tr className="border-b border-charcoal-100 bg-charcoal-50/60 text-xs uppercase tracking-wide text-charcoal-500">
                      <th className="px-4 py-3 font-semibold">Title</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Published</th>
                      <th className="px-4 py-3 font-semibold">Updated</th>
                      <th className="px-4 py-3 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="px-4">
                    {items === null ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-charcoal-400">
                          Loading news items…
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-charcoal-400">
                          No news yet. Create the first item — it will appear on
                          the Homepage preview, Navbar ticker and News page once
                          published.
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <NewsRow
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
              Published items appear as: Navbar ticker (title) · Homepage
              preview (up to 3 cards) · News page (full list) · detail pages at
              /news/&lt;slug&gt;. Dates are shown in Bangladesh time (Asia/Dhaka)
              for every visitor.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
