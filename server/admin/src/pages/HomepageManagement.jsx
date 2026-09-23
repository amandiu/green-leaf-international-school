// ------------------------------------------------------------
// Homepage Management page (Phase B)
//
// Admin → Homepage: edits the DB-backed Homepage sections (hero,
// news preview heading, life at school, video showcase, admissions
// CTA) via GET/PUT /api/admin/pages/home. Architecture mirrors
// SiteSettings: section cards + Alert/Loader primitives + the
// 401/503 session-drop convention. Repeatable entries (hero slides,
// life images, video slides) are edited as validated arrays with
// move up/down ordering; add/remove edits the array (server schema
// allows 1..N). Image fields use the shared secure ImageUploader
// (server-sanitized uploads under /api/uploads/images/); existing
// stored paths/URLs keep rendering untouched.
// ------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import {
  fetchAdminHome,
  updateHomeSection,
} from '../services/homeContentService';
import { Alert, Loader } from '../components/Feedback';
import ImageUploader from '../components/ImageUploader';

/* ---------- field primitives (shared styling) ---------- */

const inputClass = 'mt-1 w-full rounded-lg border border-charcoal-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent';
const labelClass = 'block text-sm font-medium text-charcoal-700';

function TextField({ id, label, value, onChange, maxLength, type = 'text', placeholder, required }) {
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

function TextAreaField({ id, label, value, onChange, maxLength, rows = 2, required }) {
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

/** Reusable ordered-array editor (hero slides / life images / video slides). */
function ArrayEditor({
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

function SectionCard({ sectionKey, title, description, load, onUnauthorized }) {
  const [values, setValues] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchAdminHome();
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
  }, [sectionKey, onUnauthorized]);

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
      const res = await updateHomeSection(sectionKey, values);
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
          {load({ values, set, ArrayEditor, TextField, TextAreaField })}
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

/* ---------- per-section field layouts ---------- */

const ASSET_PLACEHOLDER = '/logo.jpg or https://…';

export default function HomepageManagement({ onUnauthorized }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-forest-700">Homepage</h1>
        <p className="mt-1 text-sm text-charcoal-500">
          Edit the public Homepage content. Changes appear on the next public page load. Image fields use
          the secure uploader (existing stored paths keep working).
        </p>
      </div>

      <div className="space-y-4">
        <SectionCard
          sectionKey="hero"
          title="Hero"
          description="Headline, subtext, buttons and the rotating slide images. Use | in the headline for the desktop line break."
          onUnauthorized={onUnauthorized}
          load={({ values, set, ArrayEditor: Arr, TextField: TF, TextAreaField: TA }) => (
            <>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <TF id="hero-headline" label="Headline" required maxLength={200}
                  value={values.headline} onChange={(v) => set('headline', v)}
                  placeholder="Excellence in |Knowledge & Character" />
                <TF id="hero-eyebrow" label="Eyebrow (optional)" maxLength={100}
                  value={values.eyebrow} onChange={(v) => set('eyebrow', v)} />
                <TA id="hero-subtext" label="Subtext" maxLength={1000}
                  value={values.subtext} onChange={(v) => set('subtext', v)} />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <TF id="hero-pri-text" label="Primary Button Text" required maxLength={100}
                  value={values.primaryButton?.text}
                  onChange={(v) => set('primaryButton', { ...values.primaryButton, text: v })} />
                <TF id="hero-pri-link" label="Primary Button Link" maxLength={500}
                  value={values.primaryButton?.link}
                  onChange={(v) => set('primaryButton', { ...values.primaryButton, link: v })} />
                <TF id="hero-sec-text" label="Secondary Button Text" required maxLength={100}
                  value={values.secondaryButton?.text}
                  onChange={(v) => set('secondaryButton', { ...values.secondaryButton, text: v })} />
                <TF id="hero-sec-link" label="Secondary Button Link" maxLength={500}
                  value={values.secondaryButton?.link}
                  onChange={(v) => set('secondaryButton', { ...values.secondaryButton, link: v })} />
              </div>
              <Arr
                title="Slides"
                itemNoun="slide"
                items={values.slides || []}
                onChange={(next) => set('slides', next)}
                maxItems={10}
                newItem={{ src: '', alt: '' }}
                preview={(item) => (
                  <p className="truncate font-mono text-xs text-charcoal-500">{item.src}</p>
                )}
                fields={[
                  { name: 'src', label: 'Slide Image', type: 'image', required: true },
                  { name: 'alt', label: 'Alt Text', maxLength: 500, required: true },
                ]}
              />
            </>
          )}
        />

        <SectionCard
          sectionKey="newsPreview"
          title="News Preview"
          description="Section heading/description only. The preview cards come from Content Center → News & Notices (publish once, they appear here automatically)."
          onUnauthorized={onUnauthorized}
          load={({ values, set, TextField: TF, TextAreaField: TA }) => (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <TF id="news-eyebrow" label="Eyebrow (optional)" maxLength={100}
                value={values.eyebrow} onChange={(v) => set('eyebrow', v)} />
              <TF id="news-title" label="Title" required maxLength={200}
                value={values.title} onChange={(v) => set('title', v)} />
              <TA id="news-description" label="Description" maxLength={1000}
                value={values.description} onChange={(v) => set('description', v)} />
            </div>
          )}
        />

        <SectionCard
          sectionKey="lifeAtSchool"
          title="Life at School"
          description="Section heading and the image grid. The first image renders as the large 2×2 tile; the rest as squares."
          onUnauthorized={onUnauthorized}
          load={({ values, set, ArrayEditor: Arr }) => (
            <>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField id="life-eyebrow" label="Eyebrow (badge)" maxLength={100}
                      value={values.eyebrow} onChange={(v) => set('eyebrow', v)} />
                    <TextField id="life-title" label="Title" required maxLength={200}
                      value={values.title} onChange={(v) => set('title', v)} />
                  </div>
                </div>
                <TextAreaField id="life-description" label="Description" maxLength={1000}
                  value={values.description} onChange={(v) => set('description', v)} />
              </div>
              <Arr
                title="Images"
                itemNoun="image"
                items={values.images || []}
                onChange={(next) => set('images', next)}
                maxItems={12}
                newItem={{ src: '', alt: '' }}
                preview={(item) => (
                  <p className="truncate font-mono text-xs text-charcoal-500">{item.src}</p>
                )}
                fields={[
                  { name: 'src', label: 'Grid Image', type: 'image', required: true },
                  { name: 'alt', label: 'Alt Text', maxLength: 500, required: true },
                ]}
              />
            </>
          )}
        />

        <SectionCard
          sectionKey="videoShowcase"
          title="Video Showcase"
          description="The rotating video slides. Leave a slide's Video URL as {{social.youtube}} to keep following the Site Settings channel; or paste a specific video URL."
          onUnauthorized={onUnauthorized}
          load={({ values, set, ArrayEditor: Arr, TextField: TF, TextAreaField: TA }) => (
            <>
              <Arr
                title="Slides"
                itemNoun="slide"
                items={values.slides || []}
                onChange={(next) => set('slides', next)}
                maxItems={12}
                newItem={{
                  eyebrow: '', title: '', description: '',
                  videoUrl: '{{social.youtube}}', thumbnail: '',
                  metadata: [], buttonText: 'Watch Video',
                }}
                preview={(item) => (
                  <div className="flex items-center gap-3">
                    {item.thumbnail && (
                      <img src={item.thumbnail} alt="" className="h-9 w-16 rounded object-cover" />
                    )}
                    <p className="truncate text-sm font-medium text-charcoal-700">{item.title}</p>
                  </div>
                )}
                fields={[
                  { name: 'eyebrow', label: 'Eyebrow', maxLength: 100, placeholder: 'Campus Life' },
                  { name: 'title', label: 'Title', maxLength: 200, required: true },
                  { name: 'description', label: 'Description', type: 'textarea', maxLength: 1000 },
                  { name: 'videoUrl', label: 'Video URL', maxLength: 500, placeholder: '{{social.youtube}} or https://…' },
                  { name: 'thumbnail', label: 'Video Thumbnail', type: 'image', required: true },
                  { name: 'buttonText', label: 'CTA Text', maxLength: 100, required: true },
                  { name: 'metadata', label: 'Metadata (comma-separated)', type: 'metadata', placeholder: 'Campus, Student Life' },
                ]}
              />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <TF id="vs-eyebrow" label="Section Eyebrow (optional)" maxLength={100}
                  value={values.eyebrow} onChange={(v) => set('eyebrow', v)} />
                <TF id="vs-title" label="Section Title (optional)" maxLength={200}
                  value={values.title} onChange={(v) => set('title', v)} />
                <TA id="vs-description" label="Section Description (optional)" maxLength={1000}
                  value={values.description} onChange={(v) => set('description', v)} />
              </div>
            </>
          )}
        />

        {/* Phase D: this section REFERENCES the reusable block
            'admissions-primary-cta'. Its content is edited in
            Content Center → Reusable Content so Homepage and the
            Admissions page always share ONE copy. */}
        <SectionCard
          sectionKey="admissionsCta"
          title="Admissions CTA (shared content)"
          description="This band uses the reusable block 'admissions-primary-cta' — also shown on the Admissions page. Edit the content ONCE in Content Center → Reusable Content."
          onUnauthorized={onUnauthorized}
          load={({ values, set }) => (
            <div className="mt-4 rounded-lg bg-charcoal-50 px-3 py-2 text-xs text-charcoal-600">
              <span className="font-semibold text-charcoal-700">Managed in:</span>{' '}
              Content Center → Reusable Content → Admissions Primary CTA.
              Use the “Section visible” checkbox to hide/show this band on the Homepage.
            </div>
          )}
        />
      </div>
    </div>
  );
}
