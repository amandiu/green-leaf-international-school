// ------------------------------------------------------------
// LeadershipForm (Leadership phase)
//
// Add/edit form for a leadership record. Mirrors the server-side
// validation rules so users get early feedback, but the server
// remains the source of truth.
//
// Image handling: pick → local preview → upload on save. The
// upload returns a public-safe image_url which is submitted with
// the record payload (no filesystem paths ever in the payload).
// ------------------------------------------------------------

import { useRef, useState } from 'react';
import { Alert } from './Feedback';
import { uploadLeadershipImage } from '../services/leadershipService';

const ROLE_OPTIONS = ['Principal', 'Chairman'];

const EMPTY = {
  role: 'Principal',
  name: '',
  title: '',
  message: '',
  image_url: null,
  sort_order: 10,
  is_active: true,
};

const NAME_MAX = 120;
const TITLE_MAX = 160;
const MESSAGE_MAX = 5000;
const MAX_IMAGE_MB = 10;
const IMAGE_RE = /^\/api\/uploads\/leadership\/[A-Za-z0-9._-]+$/;

/** Build the form's initial values from a record (edit) or blank (create). */
export function toFormValues(item) {
  if (!item) return { ...EMPTY };
  return {
    role: item.role ?? 'Principal',
    name: item.name ?? '',
    title: item.title ?? '',
    message: item.message ?? '',
    image_url: item.image_url ?? null,
    sort_order: item.sort_order ?? 10,
    is_active: item.is_active !== false,
  };
}

/** Client-side check mirroring the server rules; returns error text or ''. */
export function clientValidate(values) {
  if (!values.role.trim()) return 'Role is required.';
  if (values.role.trim().length > 80) return 'Role must be at most 80 characters.';
  if (values.name.trim().length > NAME_MAX) {
    return `Name must be at most ${NAME_MAX} characters.`;
  }
  if (values.title.trim().length > TITLE_MAX) {
    return `Title must be at most ${TITLE_MAX} characters.`;
  }
  if (values.message.length > MESSAGE_MAX) {
    return `Message must be at most ${MESSAGE_MAX} characters.`;
  }
  if (!Number.isInteger(Number(values.sort_order)) || Number(values.sort_order) < 0) {
    return 'Sort order must be a whole number (0 or greater).';
  }
  return '';
}

/** Payload the admin API expects from the current form values. */
export function toPayload(values) {
  return {
    role: values.role.trim(),
    name: values.name.trim() === '' ? null : values.name.trim(),
    title: values.title.trim() === '' ? null : values.title.trim(),
    message: values.message.trim() === '' ? null : values.message.trim(),
    image_url: values.image_url,
    sort_order: Number(values.sort_order),
    is_active: values.is_active === true,
  };
}

/**
 * Props:
 *   initial  — record being edited, or null for create
 *   onSubmit(payload) — async; should throw { message } on failure
 *   onCancel()
 */
export default function LeadershipForm({ initial = null, onSubmit, onCancel }) {
  const [values, setValues] = useState(() => toFormValues(initial));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // ---- image pick → preview → upload ----
  const fileInputRef = useRef(null);
  const [pickedFile, setPickedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploadState, setUploadState] = useState('idle'); // idle | uploading | done | error
  const [uploadError, setUploadError] = useState('');

  const isEdit = Boolean(initial && initial.id);
  const isCustomRole = values.role !== '' && !ROLE_OPTIONS.includes(values.role);

  const set = (field, value) => {
    setValues((v) => ({ ...v, [field]: value }));
  };

  const currentPreview = previewUrl || values.image_url;

  const handlePick = (e) => {
    const file = e.target.files?.[0];
    setError('');
    setUploadError('');
    if (!file) return;
    const okType = /^image\/(jpe?g|png|webp)$/i.test(file.type);
    if (!okType) {
      setError('Only JPG, PNG and WebP images are allowed.');
      e.target.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      setError(`Image must be ${MAX_IMAGE_MB} MB or smaller.`);
      e.target.value = '';
      return;
    }
    setPickedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setUploadState('idle');
  };

  const clearImage = () => {
    setPickedFile(null);
    setPreviewUrl('');
    setUploadState('idle');
    setUploadError('');
    set('image_url', null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /** Upload the picked file now; returns the stored image_url or null. */
  const ensureUploaded = async () => {
    if (!pickedFile) return values.image_url; // nothing new to upload
    setUploadState('uploading');
    setUploadError('');
    try {
      const res = await uploadLeadershipImage(pickedFile);
      const url = res?.data?.image_url || '';
      if (!IMAGE_RE.test(url)) throw new Error('Server returned an unexpected image path');
      setValues((v) => ({ ...v, image_url: url }));
      setUploadState('done');
      return url;
    } catch (err) {
      setUploadState('error');
      setUploadError(err?.message || 'Image upload failed.');
      throw err;
    }
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
      let imageUrl = values.image_url;
      if (pickedFile) {
        imageUrl = await ensureUploaded();
      }
      await onSubmit(toPayload({ ...values, image_url: imageUrl }));
    } catch (err) {
      // Upload errors already set their own message; show API errors here.
      if (!pickedFile || uploadState !== 'error') {
        setError(err?.message || 'Save failed.');
      }
    } finally {
      setBusy(false);
    }
  };

  const inputClass = 'mt-1 w-full rounded-lg border border-charcoal-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent';
  const labelClass = 'block text-sm font-medium text-charcoal-700';

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-charcoal-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-forest-700">
        {isEdit ? `Edit ${initial.role} message` : 'Add leadership message'}
      </h3>

      {error && (
        <div className="mt-3">
          <Alert kind="error" onClose={() => setError('')}>{error}</Alert>
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* ---- Portrait ---- */}
        <div className="sm:col-span-2">
          <span className={labelClass}>Portrait</span>
          <div className="mt-2 flex flex-wrap items-start gap-4">
            <div className="h-32 w-28 shrink-0 overflow-hidden rounded-lg border border-charcoal-200 bg-charcoal-50">
              {currentPreview ? (
                <img
                  src={currentPreview}
                  alt="Portrait preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-charcoal-400">
                  No image
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border border-charcoal-200 px-3 py-1.5 text-xs font-medium text-charcoal-600 hover:bg-charcoal-100"
                >
                  {currentPreview ? 'Change image' : 'Choose image'}
                </button>
                {currentPreview && (
                  <button
                    type="button"
                    onClick={clearImage}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePick}
              />
              <p className="mt-2 text-xs text-charcoal-400">
                JPG, PNG or WebP, up to {MAX_IMAGE_MB} MB. The image uploads when you save.
              </p>
              {uploadState === 'uploading' && (
                <p className="mt-1 text-xs text-forest-600">Uploading image…</p>
              )}
              {uploadState === 'error' && (
                <p className="mt-1 text-xs text-red-600" role="alert">{uploadError}</p>
              )}
            </div>
          </div>
        </div>

        {/* ---- Role ---- */}
        <div>
          <label htmlFor="lm-role" className={labelClass}>Role *</label>
          <select
            id="lm-role"
            className={inputClass}
            value={isCustomRole ? '__custom__' : values.role}
            onChange={(e) => {
              if (e.target.value === '__custom__') {
                set('role', '');
                setTimeout(() => document.getElementById('lm-role-custom')?.focus(), 0);
              } else {
                set('role', e.target.value);
              }
            }}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
            <option value="__custom__">Other (type below)…</option>
          </select>
          {isCustomRole && (
            <input
              id="lm-role-custom"
              className={inputClass}
              value={values.role}
              onChange={(e) => set('role', e.target.value)}
              placeholder="e.g. Vice Principal"
              maxLength={80}
              required
            />
          )}
          <p className="mt-1 text-xs text-charcoal-400">
            Future leadership roles can be added without any database change.
          </p>
        </div>

        {/* ---- Name ---- */}
        <div>
          <label htmlFor="lm-name" className={labelClass}>Name</label>
          <input
            id="lm-name"
            className={inputClass}
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Full name (leave blank until verified)"
            maxLength={NAME_MAX}
          />
        </div>

        {/* ---- Title ---- */}
        <div className="sm:col-span-2">
          <label htmlFor="lm-title" className={labelClass}>Message heading (optional)</label>
          <input
            id="lm-title"
            className={inputClass}
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Message from the Principal"
            maxLength={TITLE_MAX}
          />
        </div>

        {/* ---- Message ---- */}
        <div className="sm:col-span-2">
          <label htmlFor="lm-message" className={labelClass}>Message</label>
          <textarea
            id="lm-message"
            className={inputClass}
            rows={6}
            value={values.message}
            onChange={(e) => set('message', e.target.value)}
            placeholder="Official message text (leave blank until verified)"
            maxLength={MESSAGE_MAX}
          />
          <p className="mt-1 text-xs text-charcoal-400">
            {values.message.length}/{MESSAGE_MAX} characters. Blank shows the public “pending” placeholder.
          </p>
        </div>

        {/* ---- Sort order + Active ---- */}
        <div>
          <label htmlFor="lm-sort" className={labelClass}>Sort order *</label>
          <input
            id="lm-sort"
            type="number"
            min={0}
            className={inputClass}
            value={values.sort_order}
            onChange={(e) => set('sort_order', e.target.value === '' ? '' : Number(e.target.value))}
          />
          <p className="mt-1 text-xs text-charcoal-400">Lower numbers appear first (10, 20, 30…).</p>
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-charcoal-700">
            <input
              type="checkbox"
              checked={values.is_active}
              onChange={(e) => set('is_active', e.target.checked)}
              className="h-4 w-4 rounded border-charcoal-300 text-forest-600 focus:ring-forest-500"
            />
            Active (visible on the public homepage)
          </label>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={busy || uploadState === 'uploading'}
          className="rounded-lg bg-forest-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-forest-700 disabled:opacity-60"
        >
          {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create record'}
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
