// ------------------------------------------------------------
// Generic page section editor (Phase B + B.3)
//
// Shared editor primitives extracted from HomepageManagement so
// ANY page backed by page_sections can reuse the SAME CMS
// pattern (Phase B.3: About / Academics / Campus pages — no
// per-page management architecture was invented).
//
//   Admin UI → PUT /api/admin/pages/:page/sections/:key
//            → validator → service → page_sections (JSON)
//            → effective content echoed back (server truth)
//
// Architecture mirrors SiteSettings/HomepageManagement: section
// cards + Alert/Loader primitives + the 401/503 session-drop
// convention. Repeatable entries (slides, cards, images) are
// edited as validated arrays with move up/down ordering;
// image fields use the shared secure ImageUploader
// (server-sanitized uploads under /api/uploads/images/).
// ------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import {
  fetchAdminPage,
  updatePageSection,
} from '../services/homeContentService';
import { Alert, Loader } from '../components/Feedback';
import ImageUploader from '../components/ImageUploader';

/* ---------- shared field styling ---------- */

export const inputClass = 'mt-1 w-full rounded-lg border border-charcoal-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent';
export const labelClass = 'block text-sm font-medium text-charcoal-700';

export function TextField({ id, label, value, onChange, maxLength, type = 'text', placeholder, required }) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
      </label>
      <input
        id={id}
        type={type}
        className={inputClass}
        maxLength={maxLength}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

export function TextAreaField({ id, label, value, onChange, maxLength, rows = 2, required }) {
  return (
    <div className="sm:col-span-2">
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
      </label>
      <textarea
        id={id}
        className={inputClass}
        rows={rows}
        maxLength={maxLength}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/** Reusable ordered-array editor (slides / cards / images / items). */
export function ArrayEditor({
  title,
  itemNoun,
  items,
  onChange,
  fields,
  newItem,
  preview,
  maxItems,
  addLocked = false,
}) {
  const move = (index, dir) => {
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const update = (index, field, value) => {
    const next = items.map((item, i) => (i === index ? { ...item, [field]: value } : item));
    onChange(next);
  };

  const remove = (index) => onChange(items.filter((_, i) => i !== index));

  const add = () => onChange([...items, { ...newItem }]);

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-charcoal-700">
          {title} <span className="font-normal text-charcoal-400">({items.length}{maxItems ? ` / ${maxItems}` : ''})</span>
        </h3>
        {!addLocked && (
          <button
            type="button"
            onClick={add}
            className="rounded-lg border border-forest-300 px-3 py-1 text-xs font-medium text-forest-700 transition-colors hover:bg-forest-50"
          >
            + Add {itemNoun}
          </button>
        )}
      </div>

      <ul className="mt-2 space-y-3">
        {items.map((item, index) => (
          <li key={index} className="rounded-lg border border-charcoal-200 bg-charcoal-50/60 p-3">
            <div className="flex items-start justify-between gap-2">
              {preview && <div className="min-w-0 flex-1">{preview(item, index)}</div>}
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="rounded-md border border-charcoal-200 bg-white px-2 py-1 text-xs text-charcoal-600 disabled:opacity-40 hover:bg-charcoal-100"
                  aria-label={`Move ${itemNoun} ${index + 1} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                  className="rounded-md border border-charcoal-200 bg-white px-2 py-1 text-xs text-charcoal-600 disabled:opacity-40 hover:bg-charcoal-100"
                  aria-label={`Move ${itemNoun} ${index + 1} down`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="rounded-md border border-red-200 bg-white px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  aria-label={`Remove ${itemNoun} ${index + 1}`}
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {fields.map((field) =>
                field.type === 'textarea' ? (
                  <TextAreaField
                    key={field.name}
                    id={`${title}-${index}-${field.name}`}
                    label={field.label}
                    value={item[field.name]}
                    onChange={(v) => update(index, field.name, v)}
                    maxLength={field.maxLength}
                    required={field.required}
                  />
                ) : field.type === 'metadata' ? (
                  <div key={field.name} className="sm:col-span-2">
                    <label htmlFor={`${title}-${index}-${field.name}`} className={labelClass}>
                      {field.label}
                    </label>
                    <input
                      id={`${title}-${index}-${field.name}`}
                      type="text"
                      className={inputClass}
                      value={(item[field.name] || []).join(', ')}
                      onChange={(e) => update(
                        index,
                        field.name,
                        e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      )}
                      placeholder={field.placeholder}
                    />
                  </div>
                ) : field.type === 'image' ? (
                  <div key={field.name} className="sm:col-span-2">
                    <ImageUploader
                      label={field.label}
                      required={field.required}
                      value={item[field.name] || ''}
                      onChange={(v) => update(index, field.name, v)}
                    />
                  </div>
                ) : (
                  <TextField
                    key={field.name}
                    id={`${title}-${index}-${field.name}`}
                    label={field.label}
                    value={item[field.name]}
                    onChange={(v) => update(index, field.name, v)}
                    maxLength={field.maxLength}
                    required={field.required}
                    placeholder={field.placeholder}
                  />
                ),
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- section editor (loads/saves ONE section) ---------- */

/**
 * Edit one section of one page. `children` is a render function
 * receiving { values, set } plus the field primitives, exactly
 * like the original HomepageManagement SectionCard contract.
 */
export default function SectionEditor({ page, sectionKey, title, description, onUnauthorized, children }) {
  const [values, setValues] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchAdminPage(page);
      const section = (res.data || {})[sectionKey];
      if (!section) {
        setError('Section not found.');
      }
      setValues(section || null);
    } catch (err) {
      if (err.status === 401 || err.status === 503) {
        onUnauthorized?.();
        return;
      }
      setError(err.message || 'Failed to load section.');
    } finally {
      setLoading(false);
    }
  }, [page, sectionKey, onUnauthorized]);

  useEffect(() => {
    reload();
  }, [reload]);

  const set = (field, value) => {
    setValues((v) => ({ ...v, [field]: value }));
    setNotice('');
  };

  const handleSave = async () => {
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const res = await updatePageSection(page, sectionKey, values);
      const section = (res.data || {})[sectionKey];
      if (section) setValues(section);
      setNotice('Saved.');
    } catch (err) {
      if (err.status === 401 || err.status === 503) {
        onUnauthorized?.();
      } else {
        setError(err.message || 'Save failed.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
      className="rounded-xl border border-charcoal-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-charcoal-900">{title}</h2>
          <p className="mt-1 text-xs text-charcoal-500">{description}</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-charcoal-600">
          <input
            type="checkbox"
            checked={!!values?.isActive}
            onChange={(e) => set('isActive', e.target.checked)}
            className="h-4 w-4 rounded border-charcoal-300"
          />
          Section visible
        </label>
      </div>

      {error && <div className="mt-3"><Alert kind="error" onClose={() => setError('')}>{error}</Alert></div>}
      {notice && <div className="mt-3"><Alert kind="success" onClose={() => setNotice('')}>{notice}</Alert></div>}
      {loading && <Loader label="Loading section…" />}

      {!loading && values && (
        <>
          {children({ values, set, ArrayEditor, TextField, TextAreaField })}
          <div className="mt-4 flex items-center justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-forest-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-forest-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : `Save ${title}`}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
