// ------------------------------------------------------------
// ImageUploader — ONE reusable admin image upload component
// (secure image-upload phase)
//
// Replaces the old "paste an image URL" workflow on every admin
// image field. Flow: pick → client-side UX validation (never a
// security boundary; the backend re-validates everything) →
// upload to POST /api/admin/uploads/image → store the returned
// safe path in the form value.
//
// Security notes:
//   - Local preview uses URL.createObjectURL (never file content
//     injected into HTML) and the object URL is revoked on
//     replacement/unmount.
//   - Existing stored paths (uploads or legacy site assets) keep
//     rendering; only NEW images go through the uploader.
//   - The uploaded path is accepted from the server only when it
//     matches the strict managed-path shape.
// ------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { uploadImage } from '../services/uploadService';

const IMAGE_RE = /^\/api\/uploads\/images\/[A-Za-z0-9._-]+$/;
const MAX_MB = 10;
const OK_MIME = /^image\/(jpe?g|png|webp)$/i;
const ACCEPT = 'image/jpeg,image/png,image/webp';

/**
 * Controlled reusable image uploader.
 *
 * @param {string|null} value    current image path/URL (form value)
 * @param {(v: string) => void} onChange  receive the stored path ('' clears)
 * @param {string} label         field label
 * @param {boolean} required     visual required marker only
 * @param {string} hint          extra hint line under the controls
 */
export default function ImageUploader({
  value,
  onChange,
  label = 'Image',
  required = false,
  hint,
}) {
  const [preview, setPreview] = useState(null); // object URL for the picked file
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  // Revoke the temporary object URL whenever it changes/unmounts.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const clearPicked = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
  };

  const handlePick = async (event) => {
    const file = event.target?.files?.[0];
    event.target.value = ''; // allow re-picking the same file
    setError('');
    if (!file) return;

    // ---- Client-side checks are UX only. The backend re-validates
    // ---- content (magic bytes + decode + re-encode) for security.
    if (!OK_MIME.test(file.type || '')) {
      setError('Only JPG, PNG and WebP images are allowed.');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Image is too large. Maximum allowed size is ${MAX_MB} MB.`);
      return;
    }

    clearPicked();
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const data = await uploadImage(file);
      const path = data?.image_path || '';
      if (!IMAGE_RE.test(path)) {
        throw { message: 'Server returned an unexpected image path.' };
      }
      onChange(path);
    } catch (err) {
      setError(err?.message || 'Image upload failed.');
      clearPicked();
    } finally {
      setUploading(false);
    }
  };

  const handleReplace = () => inputRef.current?.click();

  const handleRemove = () => {
    clearPicked();
    onChange('');
  };

  const showPreview = preview || value || null;

  return (
    <div>
      <span className="block text-sm font-medium text-charcoal-700">
        {label}
        {required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
      </span>

      <div className="mt-1 flex flex-wrap items-center gap-3">
        {showPreview ? (
          <div className="flex items-center gap-3">
            {/* Preview is either a local object URL or the stored
                site-relative path — never raw file content in HTML. */}
            <img
              src={showPreview}
              alt="Selected image preview"
              className="h-14 w-24 rounded-lg border border-charcoal-200 bg-charcoal-50 object-cover"
            />
            {!preview && value && (
              <span className="max-w-[16rem] truncate font-mono text-xs text-charcoal-400" title={value}>
                {value}
              </span>
            )}
          </div>
        ) : (
          <span className="inline-flex h-14 w-24 items-center justify-center rounded-lg border border-dashed border-charcoal-300 bg-charcoal-50 text-xs text-charcoal-400">
            No image
          </span>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleReplace}
            disabled={uploading}
            className="rounded-lg border border-forest-300 px-3 py-1.5 text-xs font-medium text-forest-700 transition-colors hover:bg-forest-50 disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : value || preview ? 'Replace image' : 'Choose Image'}
          </button>
          {(value || preview) && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={handlePick}
        />
      </div>

      <p className="mt-1 text-xs text-charcoal-400">
        Accepted: JPG, PNG, WebP · Maximum: {MAX_MB} MB. The image uploads immediately and the
        stored copy is optimized by the server.
        {hint ? ` ${hint}` : ''}
      </p>

      {error && (
        <p className="mt-1 text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
