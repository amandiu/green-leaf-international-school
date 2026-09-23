// ------------------------------------------------------------
// Secure image upload utility (shared image-upload phase)
//
// ONE storage engine for all admin image uploads:
//   - leadership portraits  → /api/uploads/leadership/<file>
//   - generic CMS images    → /api/uploads/images/<file>
//
// Security properties (all enforced server-side):
//   - Magic-byte sniffing enforces the JPEG/PNG/WebP allowlist
//     BEFORE any storage decision (never trusts filename,
//     extension or Content-Type).
//   - Full sanitization/re-encoding runs through
//     utils/imageSanitizer.js (sharp): decode → dimension limits
//     → metadata strip → fresh WebP output. The bytes written to
//     disk are always server-generated, never the raw upload.
//   - Filenames are generated from Date.now(36) + 12 random
//     bytes — browser-supplied names never reach the filesystem,
//     so path traversal is impossible by construction.
//   - Resolution helpers are strictly confined to their upload
//     directory (defense in depth, checked twice).
// ------------------------------------------------------------

import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { sanitizeImageToWebp, UPLOAD_ERROR_CODES } from './imageSanitizer.js';

/** Absolute directory root for ALL uploaded images. */
const ROOT = resolve(process.cwd(), 'src', 'uploads');

/** Public URL prefix served by GET /api/uploads/leadership/:file. */
export const LEADERSHIP_PUBLIC_PREFIX = '/api/uploads/leadership/';

export const LEADERSHIP_UPLOAD_DIR = 'leadership';

/** Public URL prefix served by GET /api/uploads/images/:file. */
export const IMAGES_PUBLIC_PREFIX = '/api/uploads/images/';

export const IMAGES_UPLOAD_DIR = 'images';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB — must match middleware/upload.js

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

/** Magic-byte signatures for the allowed image formats. */
function detectImageType(buffer) {
  if (buffer.length < 12) return null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e
    && buffer[3] === 0x47 && buffer[4] === 0x0d && buffer[5] === 0x0a
    && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) return 'png';
  // WebP: "RIFF" + 4 bytes + "WEBP"
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF'
    && buffer.toString('ascii', 8, 12) === 'WEBP'
  ) return 'webp';
  return null;
}

/** Ensure the upload directories exist (called before each write). */
export async function ensureUploadDirs() {
  await mkdir(join(ROOT, LEADERSHIP_UPLOAD_DIR), { recursive: true });
  await mkdir(join(ROOT, IMAGES_UPLOAD_DIR), { recursive: true });
}

/** Reject files whose declared extension is not an allowed web image. */
export function assertAllowedExtension(filename) {
  const dot = filename.lastIndexOf('.');
  const ext = dot === -1 ? '' : filename.slice(dot + 1).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error('Only .jpg, .jpeg, .png and .webp images are allowed');
  }
  return ext === 'jpeg' ? 'jpg' : ext;
}

/**
 * Verify a Buffer's magic bytes actually match a real image type.
 * Throws when the content is not a JPEG/PNG/WebP (e.g. an .exe
 * renamed to .jpg, or text/html renamed to .jpg, is rejected here
 * regardless of extension). This is the cheap pre-check; sharp
 * decoding in imageSanitizer.js is the authoritative validation.
 */
export function assertRealImage(buffer) {
  const type = detectImageType(buffer);
  if (!type) {
    throw new Error('File content is not a valid JPEG, PNG or WebP image');
  }
  return type;
}

/**
 * Server-generated safe filename. The original filename NEVER
 * becomes the storage path — no separators, no traversal, only
 * [0-9a-z] plus a single dot before the extension.
 */
function generateFilename(extension) {
  return `${Date.now().toString(36)}-${randomBytes(12).toString('hex')}.${extension}`;
}

/**
 * Shared storage step: sanitize + re-encode via sharp, then write
 * the server-generated WebP into the given upload subdirectory.
 * Returns { publicUrl, bytes, width, height }.
 */
async function storeSanitizedImage(buffer, uploadDir, publicPrefix) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('Image payload must be raw file bytes');
  }
  if (buffer.length === 0) {
    const err = new Error('No image file was received.');
    err.code = UPLOAD_ERROR_CODES.NO_FILE;
    throw err;
  }
  if (buffer.length > MAX_FILE_BYTES) {
    const err = new Error('Image must be 10 MB or smaller.');
    err.code = UPLOAD_ERROR_CODES.INVALID;
    throw err;
  }

  // 1. Cheap allowlist gate (magic bytes) — rejects SVG, GIF, ICO,
  //    HTML, executables, and every other non-allowed format.
  assertRealImage(buffer);

  // 2. Authoritative validation + sanitization (sharp): decode with
  //    pixel limits, enforce dimensions, strip metadata, re-encode.
  const sanitized = await sanitizeImageToWebp(buffer);

  // 3. Store ONLY the freshly generated bytes under a server-
  //    generated name inside the managed directory.
  await ensureUploadDirs();
  const filename = generateFilename(sanitized.format);
  // Resolution stays inside the directory by construction: the
  // filename contains only [0-9a-z.-] — no separators, no traversal.
  const target = join(ROOT, uploadDir, filename);
  await writeFile(target, sanitized.data);

  return {
    publicUrl: `${publicPrefix}${filename}`,
    bytes: sanitized.data.length,
    width: sanitized.width,
    height: sanitized.height,
  };
}

/**
 * Store a generic CMS image (news, homepage, branding, …).
 * Returns the public-safe relative URL (never a filesystem path).
 */
export async function saveImage(buffer) {
  const stored = await storeSanitizedImage(buffer, IMAGES_UPLOAD_DIR, IMAGES_PUBLIC_PREFIX);
  return stored;
}

/**
 * Store a leadership portrait (backward-compatible entry point —
 * same signature and return shape as the original implementation;
 * the stored image is now sanitized/re-encoded instead of raw).
 */
export async function saveLeadershipImage(buffer) {
  const stored = await storeSanitizedImage(
    buffer,
    LEADERSHIP_UPLOAD_DIR,
    LEADERSHIP_PUBLIC_PREFIX,
  );
  return stored.publicUrl;
}

/**
 * Map a public image URL back to its absolute file path, strictly
 * confined to the given managed upload directory. Returns null for
 * anything that is not a managed upload path.
 */
function resolveManagedPath(imageUrl, publicPrefix, dir) {
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith(publicPrefix)) {
    return null;
  }
  const filename = imageUrl.slice(publicPrefix.length);
  // Only plain filenames are accepted — no slashes, no "..", no null bytes.
  if (!/^[A-Za-z0-9._-]+$/.test(filename) || filename.includes('..')) {
    return null;
  }
  const dirRoot = join(ROOT, dir);
  const target = join(dirRoot, filename);
  // Defense in depth: the resolved path must stay inside the dir.
  if (!resolve(target).startsWith(dirRoot + sep) && resolve(target) !== dirRoot) {
    return null;
  }
  return target;
}

/** Leadership-specific resolver (existing consumers). */
export function resolveImagePath(imageUrl) {
  return resolveManagedPath(imageUrl, LEADERSHIP_PUBLIC_PREFIX, LEADERSHIP_UPLOAD_DIR);
}

/** Generic-images resolver (orphan handling). */
export function resolveGenericImagePath(imageUrl) {
  return resolveManagedPath(imageUrl, IMAGES_PUBLIC_PREFIX, IMAGES_UPLOAD_DIR);
}

/** Delete an uploaded leadership image; missing files count as success. */
export async function deleteUploadedImage(imageUrl) {
  const target = resolveImagePath(imageUrl);
  if (!target) return false; // not a managed path — never touch disk
  try {
    await unlink(target);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return true; // already gone
    throw err;
  }
}

/**
 * Delete a generic managed image. Only files under the images
 * directory can ever be removed — other paths (including legacy
 * /Activity/... site assets) are refused. Missing files count as
 * success (idempotent cleanup).
 */
export async function deleteGenericImage(imageUrl) {
  const target = resolveGenericImagePath(imageUrl);
  if (!target) return false; // not a managed path — never touch disk
  try {
    await unlink(target);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return true; // already gone
    throw err;
  }
}
