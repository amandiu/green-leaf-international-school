// ------------------------------------------------------------
// Leadership image upload utility
//
// Small, dependency-free secure image upload mechanism (the
// project has no existing upload system). Security properties:
//   - Extension whitelist: .jpg/.jpeg/.png/.webp only
//   - Content sniffing via magic bytes (never trusts MIME header)
//   - 5 MB size cap
//   - Server-generated random filename — browser-supplied names
//     are never used; path traversal is impossible by construction
//   - Resolution strictly inside the leadership upload directory
// ------------------------------------------------------------

import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';

/** Absolute directory where leadership portraits are stored. */
const ROOT = resolve(process.cwd(), 'src', 'uploads', 'leadership');

/** Public URL prefix served by GET /api/uploads/leadership/:file. */
export const LEADERSHIP_PUBLIC_PREFIX = '/api/uploads/leadership/';

export const LEADERSHIP_UPLOAD_DIR = 'leadership';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

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

/** Ensure the upload directory exists (called before each write). */
export async function ensureUploadDirs() {
  await mkdir(ROOT, { recursive: true });
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
 * renamed to .jpg is rejected here regardless of extension).
 */
export function assertRealImage(buffer) {
  const type = detectImageType(buffer);
  if (!type) {
    throw new Error('File content is not a valid JPEG, PNG or WebP image');
  }
  return type;
}

/**
 * Store an uploaded image buffer.
 * Returns the public-safe relative URL (never a filesystem path).
 * The filename is generated server-side from random bytes.
 */
export async function saveLeadershipImage(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('Image payload must be raw file bytes');
  }
  if (buffer.length === 0) {
    throw new Error('Uploaded image is empty');
  }
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error('Image must be 5 MB or smaller');
  }

  const type = assertRealImage(buffer);
  await ensureUploadDirs();

  const filename = `${Date.now().toString(36)}-${randomBytes(12).toString('hex')}.${type}`;
  // Resolution stays inside ROOT by construction: filename contains
  // only [0-9a-z.-] generated above — no separators, no traversal.
  const target = join(ROOT, filename);

  await writeFile(target, buffer);
  return `${LEADERSHIP_PUBLIC_PREFIX}${filename}`;
}

/**
 * Map a public image URL back to its absolute file path, strictly
 * confined to the leadership upload directory. Returns null for
 * anything that is not a leadership upload path.
 */
export function resolveImagePath(imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith(LEADERSHIP_PUBLIC_PREFIX)) {
    return null;
  }
  const filename = imageUrl.slice(LEADERSHIP_PUBLIC_PREFIX.length);
  // Only plain filenames are accepted — no slashes, no "..", no null bytes.
  if (!/^[A-Za-z0-9._-]+$/.test(filename) || filename.includes('..')) {
    return null;
  }
  const target = join(ROOT, filename);
  // Defense in depth: the resolved path must stay inside ROOT.
  if (!resolve(target).startsWith(ROOT + sep) && resolve(target) !== ROOT) {
    return null;
  }
  return target;
}

/** Delete an uploaded image; missing files are treated as success. */
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
