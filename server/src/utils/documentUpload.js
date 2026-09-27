// ------------------------------------------------------------
// Secure DOCUMENT upload utility (Phase B.6)
//
// Extends the shared upload pipeline to DOCUMENTS without
// touching the image pipeline (images keep their sharp/WebP
// branch — per the SYSTEM_DESIGN §L reuse rule "add a documents
// directory; PDF-only allowlist; same generated-filename rule").
//
// Security properties (mirroring utils/imageUpload.js):
//   - Magic-byte sniffing enforces the PDF allowlist BEFORE any
//     storage decision (never trusts filename/extension/MIME).
//   - Filenames are server-generated (Date.now(36) + 12 random
//     bytes). Browser-supplied names NEVER reach the filesystem,
//     so path traversal is impossible by construction.
//   - Resolution helpers are strictly confined to the documents
//     directory (defense in depth, checked twice).
//   - Deletion refuses anything outside the managed directory.
// ------------------------------------------------------------

import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';

/** Absolute directory root for ALL uploads (matches imageUpload.js). */
const ROOT = resolve(process.cwd(), 'src', 'uploads');

/** Public URL prefix served by GET /api/downloads/:id/file. */
export const DOCUMENTS_PUBLIC_PREFIX = '/api/uploads/documents/';

export const DOCUMENTS_UPLOAD_DIR = 'documents';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB — must match middleware/upload.js

/** The documented documents allowlist (SYSTEM_DESIGN §L): PDF-only. */
export const ALLOWED_DOCUMENT_EXTENSIONS = Object.freeze(['pdf']);

/** Reject files whose declared extension is not on the allowlist. */
export function assertAllowedDocumentExtension(filename) {
  const dot = filename.lastIndexOf('.');
  const ext = dot === -1 ? '' : filename.slice(dot + 1).toLowerCase();
  if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(ext)) {
    throw new Error('Only .pdf documents are allowed');
  }
  return ext;
}

/**
 * Verify a Buffer's magic bytes are a real PDF (%PDF-). An .exe
 * or .html renamed to .pdf is rejected here regardless of its
 * extension or declared MIME type.
 */
export function assertRealPdf(buffer) {
  if (buffer.length < 5 || buffer.toString('ascii', 0, 5) !== '%PDF-') {
    throw new Error('File content is not a valid PDF document');
  }
  return 'pdf';
}

/** Ensure the documents upload directory exists (before each write). */
export async function ensureDocumentUploadDir() {
  await mkdir(join(ROOT, DOCUMENTS_UPLOAD_DIR), { recursive: true });
}

/**
 * Server-generated safe filename — [0-9a-z-] plus a single dot.
 * The original filename never becomes the storage path.
 */
function generateFilename(extension) {
  return `${Date.now().toString(36)}-${randomBytes(12).toString('hex')}.${extension}`;
}

/** Trim the original filename to a safe display-only form. */
export function sanitizeOriginalFilename(filename) {
  const base = String(filename ?? '')
    // strip any directory components (Windows + POSIX forms)
    .split(/[\\/]/).pop()
    .replace(/[\r\n]/g, '') // header-injection safety
    .trim();
  return base.slice(0, 255) || null;
}

/**
 * Store one document upload. Returns
 * { publicUrl, bytes, original_filename, file_ext }.
 */
export async function saveDocument(file) {
  const data = file?.data;
  if (!Buffer.isBuffer(data)) {
    throw new Error('Document payload must be raw file bytes');
  }
  if (data.length === 0) {
    throw new Error('No document file was received.');
  }
  if (data.length > MAX_FILE_BYTES) {
    throw new Error('Document must be 10 MB or smaller.');
  }

  // Extension allowlist (diagnostic) + authoritative magic bytes.
  const fileExt = assertAllowedDocumentExtension(file.filename ?? '');
  assertRealPdf(data);

  await ensureDocumentUploadDir();
  const filename = generateFilename(fileExt);
  // Filename contains only [0-9a-z.-] — containment by construction.
  const target = join(ROOT, DOCUMENTS_UPLOAD_DIR, filename);
  await writeFile(target, data);

  return {
    publicUrl: `${DOCUMENTS_PUBLIC_PREFIX}${filename}`,
    bytes: data.length,
    original_filename: sanitizeOriginalFilename(file.filename),
    file_ext: fileExt,
  };
}

/** Strictly-confined resolver (documents dir only). */
export function resolveDocumentPath(publicUrl) {
  if (typeof publicUrl !== 'string' || !publicUrl.startsWith(DOCUMENTS_PUBLIC_PREFIX)) {
    return null;
  }
  const filename = publicUrl.slice(DOCUMENTS_PUBLIC_PREFIX.length);
  if (!/^[A-Za-z0-9._-]+$/.test(filename) || filename.includes('..')) {
    return null;
  }
  const dirRoot = join(ROOT, DOCUMENTS_UPLOAD_DIR);
  const target = join(dirRoot, filename);
  if (!resolve(target).startsWith(dirRoot + sep) && resolve(target) !== dirRoot) {
    return null;
  }
  return target;
}

/**
 * Delete a managed document; only files under the documents
 * directory can ever be removed. Missing files count as success.
 */
export async function deleteDocument(publicUrl) {
  const target = resolveDocumentPath(publicUrl);
  if (!target) return false; // not a managed path — never touch disk
  try {
    await unlink(target);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return true; // already gone
    throw err;
  }
}
