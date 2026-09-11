// ------------------------------------------------------------
// NavigationForm (Phase 3.3)
//
// Reusable add/edit form for navigation items. Mirrors the
// server-side validation rules so users get early feedback, but
// the server remains the source of truth.
//
// Type behavior:
//   INTERNAL → URL required, must start with "/"
//   EXTERNAL → URL required, full http(s) URL
//   DROPDOWN → URL optional (used only as a fallback link)
// ------------------------------------------------------------

import { useState } from 'react';
import { Alert } from './Feedback';

const TYPE_OPTIONS = [
  { value: 'INTERNAL', label: 'Internal page', help: 'URL required — a site route starting with "/" (e.g. /about).' },
  { value: 'EXTERNAL', label: 'External link', help: 'URL required — a full link starting with http:// or https://.' },
  { value: 'DROPDOWN', label: 'Dropdown (parent only)', help: 'Groups submenus. URL optional — only main-menu dropdowns can hold children.' },
];

const EMPTY = {
  title: '',
  slug: '',
  parent_id: '',
  type: 'INTERNAL',
  url: '',
  sort_order: 0,
  is_active: true,
  open_new_tab: false,
  icon: '',
};

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Build the form's initial values from an item (edit) or blank (create). */
export function toFormValues(item) {
  if (!item) return { ...EMPTY };
  return {
    title: item.title ?? '',
    slug: item.slug ?? '',
    parent_id: item.parent_id === null || item.parent_id === undefined ? '' : String(item.parent_id),
    type: item.type ?? 'INTERNAL',
    url: item.url ?? '',
    sort_order: item.sort_order ?? 0,
    is_active: item.is_active !== false,
    open_new_tab: item.open_new_tab === true,
    icon: item.icon ?? '',
  };
}

/** Client-side check mirroring the server rules; returns error text or ''. */
export function clientValidate(values) {
  if (!values.title.trim()) return 'Title is required.';
  if (values.title.trim().length > 100) return 'Title must be at most 100 characters.';
  if (!values.slug.trim()) return 'Slug is required (e.g. about-us).';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug.trim())) {
    return 'Slug must be lowercase letters/numbers with single hyphens (e.g. about-us).';
  }
  const url = values.url.trim();
  if (values.type === 'INTERNAL' && !url.startsWith('/')) {
    return 'Internal items need a URL starting with "/" (e.g. /about).';
  }
  if (values.type === 'EXTERNAL' && !/^https?:\/\/\S+$/i.test(url)) {
    return 'External items need a full URL starting with http:// or https://.';
  }
  if (values.type === 'DROPDOWN' && url !== '' && !url.startsWith('/')) {
    return 'A dropdown URL (optional) must be a site route starting with "/".';
  }
  if (!Number.isInteger(Number(values.sort_order))) return 'Sort order must be a whole number.';
  return '';
}

/** Payload the admin API expects from the current form values. */
export function toPayload(values) {
  return {
    parent_id: values.parent_id === '' ? null : Number(values.parent_id),
    title: values.title.trim(),
    slug: values.slug.trim(),
    type: values.type,
    url: values.url.trim() === '' ? null : values.url.trim(),
    sort_order: Number(values.sort_order),
    is_active: values.is_active === true,
    open_new_tab: values.open_new_tab === true,
    icon: values.icon.trim() === '' ? null : values.icon.trim(),
  };
}

/**
 * Props:
 *   parents        — selectable parent options (top-level DROPDOWN items)
 *   initial        — item being edited, or null for create
 *   lockedParentId — when set, the parent selector is fixed (submenu create)
 *   onSubmit(payload) — async; should throw { message } on failure
 *   onCancel()
 */
export default function NavigationForm({
  parents, initial = null, lockedParentId = null, onSubmit, onCancel,
}) {
  const [values, setValues] = useState(() => toFormValues(initial));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(initial && initial.id);
  const typeHelp = TYPE_OPTIONS.find((t) => t.value === values.type)?.help;

  const set = (field, value) => {
    setValues((v) => ({ ...v, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const problem = clientValidate(values);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setBusy(true);
    try {
      await onSubmit(toPayload(values));
    } catch (err) {
      setError(err?.message || 'Save failed.');
    } finally {
      setBusy(false);
    }
  };

  const inputClass = 'mt-1 w-full rounded-lg border border-charcoal-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent';
  const labelClass = 'block text-sm font-medium text-charcoal-700';

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-charcoal-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-forest-700">
        {isEdit ? `Edit “${initial.title}”` : lockedParentId ? 'Add submenu item' : 'Add main menu item'}
      </h3>

      {error && (
        <div className="mt-3">
          <Alert kind="error" onClose={() => setError('')}>{error}</Alert>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="nav-title" className={labelClass}>Title *</label>
          <input
            id="nav-title"
            className={inputClass}
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="About"
            maxLength={100}
            required
          />
        </div>

        <div>
          <label htmlFor="nav-slug" className={labelClass}>Slug *</label>
          <div className="flex items-start gap-2">
            <input
              id="nav-slug"
              className={inputClass}
              value={values.slug}
              onChange={(e) => set('slug', e.target.value)}
              placeholder="about-us"
              maxLength={100}
              required
            />
            <button
              type="button"
              onClick={() => set('slug', slugify(values.title))}
              className="mt-1 shrink-0 rounded-lg border border-charcoal-200 px-2.5 py-2 text-xs font-medium text-charcoal-600 hover:bg-charcoal-100"
              title="Generate slug from the title (replaces the current slug)"
            >
              Suggest
            </button>
          </div>
          <p className="mt-1 text-xs text-charcoal-400">
            Unique identifier. “Suggest” builds it from the title and replaces what you typed.
          </p>
        </div>

        <div>
          <label htmlFor="nav-parent" className={labelClass}>Parent menu</label>
          <select
            id="nav-parent"
            className={inputClass}
            value={lockedParentId ?? values.parent_id}
            disabled={lockedParentId !== null}
            onChange={(e) => set('parent_id', e.target.value)}
          >
            <option value="">None — main menu</option>
            {parents.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.title} (submenu parent)
              </option>
            ))}
          </select>
          {lockedParentId !== null && (
            <p className="mt-1 text-xs text-charcoal-400">
              Parent is fixed to this submenu level (max depth: 2).
            </p>
          )}
        </div>

        <div>
          <label htmlFor="nav-type" className={labelClass}>Type *</label>
          <select
            id="nav-type"
            className={inputClass}
            value={values.type}
            onChange={(e) => set('type', e.target.value)}
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {typeHelp && <p className="mt-1 text-xs text-charcoal-400">{typeHelp}</p>}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="nav-url" className={labelClass}>
            URL {values.type === 'DROPDOWN' ? '(optional for dropdowns)' : '*'}
          </label>
          <input
            id="nav-url"
            className={inputClass}
            value={values.url}
            onChange={(e) => set('url', e.target.value)}
            placeholder={values.type === 'EXTERNAL' ? 'https://example.com' : '/about'}
          />
        </div>

        <div>
          <label htmlFor="nav-sort" className={labelClass}>Sort order *</label>
          <input
            id="nav-sort"
            type="number"
            className={inputClass}
            value={values.sort_order}
            onChange={(e) => set('sort_order', e.target.value === '' ? '' : Number(e.target.value))}
          />
          <p className="mt-1 text-xs text-charcoal-400">Lower numbers appear first (10, 20, 30…).</p>
        </div>

        <div>
          <label htmlFor="nav-icon" className={labelClass}>Icon (optional)</label>
          <input
            id="nav-icon"
            className={inputClass}
            value={values.icon}
            onChange={(e) => set('icon', e.target.value)}
            placeholder="menu-icon-name"
            maxLength={64}
          />
        </div>

        <div className="flex flex-wrap items-center gap-6 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm text-charcoal-700">
            <input
              type="checkbox"
              checked={values.is_active}
              onChange={(e) => set('is_active', e.target.checked)}
              className="h-4 w-4 rounded border-charcoal-300 text-forest-600 focus:ring-forest-500"
            />
            Active (visible in public navigation)
          </label>
          <label className="flex items-center gap-2 text-sm text-charcoal-700">
            <input
              type="checkbox"
              checked={values.open_new_tab}
              onChange={(e) => set('open_new_tab', e.target.checked)}
              className="h-4 w-4 rounded border-charcoal-300 text-forest-600 focus:ring-forest-500"
            />
            Open in new tab
          </label>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-forest-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-forest-700 disabled:opacity-60"
        >
          {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create item'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-charcoal-200 px-5 py-2 text-sm font-medium text-charcoal-600 hover:bg-charcoal-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
