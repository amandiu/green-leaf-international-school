// ------------------------------------------------------------
// Raw-body upload middleware (shared image-upload phase)
//
// Shared by EVERY admin image upload (leadership portraits AND
// the generic /api/admin/uploads/image endpoint):
//   - Accepts a single multipart/form-data part named "image"
//     OR a raw application/octet-stream body
//   - Enforces the 10 MB cap while streaming (rejects early,
//     before expensive image processing starts)
//   - Hands a Buffer to the service; the filename from the
//     browser is never used for storage (server-generated only)
// ------------------------------------------------------------

import { badRequest } from '../utils/errors.js';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // must match utils/imageUpload.js + imageSanitizer.js

/** Collect the request body as a Buffer with a hard size cap. */
export function readImageUpload(req, res, next) {
  const contentType = req.headers['content-type'] || '';

  const isMultipart = contentType.startsWith('multipart/form-data');
  const isRaw = contentType.startsWith('application/octet-stream');
  if (!isMultipart && !isRaw) {
    return res.status(400).json({
      success: false,
      message: 'Send the image as multipart/form-data (field "image") or raw bytes.',
    });
  }

  const declaredLength = Number(req.headers['content-length'] || 0);
  if (declaredLength > MAX_FILE_BYTES) {
    return res.status(413).json({
      success: false,
      message: 'Image is too large. Maximum allowed size is 10 MB.',
    });
  }

  const chunks = [];
  let received = 0;
  let aborted = false;

  req.on('data', (chunk) => {
    if (aborted) return;
    received += chunk.length;
    if (received > MAX_FILE_BYTES) {
      aborted = true;
      res.status(413).json({
        success: false,
        message: 'Image is too large. Maximum allowed size is 10 MB.',
      });
      req.destroy(); // stop reading the rest of the upload
      return;
    }
    chunks.push(chunk);
  });

  req.on('error', () => {
    if (!aborted) {
      aborted = true;
      next(badRequest('Upload failed while reading the request body'));
    }
  });

  req.on('end', () => {
    if (aborted) return;
    if (received === 0) {
      return res.status(400).json({
        success: false,
        message: 'No image file was received.',
      });
    }

    // Extract the single "image" part from the multipart body so
    // only file bytes reach the service (no MIME wrappers).
    if (isMultipart) {
      const buffer = Buffer.concat(chunks);
      const file = extractMultipartFile(buffer, contentType);
      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'Expected one multipart part named "image".',
        });
      }
      req.uploadedFile = file; // { data: Buffer, filename, contentType }
      return next();
    }

    req.uploadedFile = {
      data: Buffer.concat(chunks),
      filename: 'upload',
      contentType,
    };
    return next();
  });
}

/**
 * Pull the first form part out of a multipart body. This is a
 * minimal, best-effort parser for the single-file case only —
 * adequate for this endpoint and never used for other content.
 * The filename is carried for diagnostics only; it is NEVER used
 * for storage (server-generated filenames only).
 */
function extractMultipartFile(buffer, contentType) {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!boundaryMatch) return null;
  const boundary = `--${(boundaryMatch[1] || boundaryMatch[2]).trim()}`;
  const body = buffer.toString('latin1'); // byte-preserving
  const parts = body.split(boundary);
  for (const part of parts) {
    if (!part || part === '--' || part === '--\r\n') continue;
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const headers = part.slice(0, headerEnd);
    const nameMatch = /name="([^"]*)"/i.exec(headers);
    if (!nameMatch || nameMatch[1] !== 'image') continue;

    const fileMatch = /filename="([^"]*)"/i.exec(headers);
    const typeMatch = /content-type:\s*([^\r\n]+)/i.exec(headers);
    let data = part.slice(headerEnd + 4);
    // Strip the trailing CRLF that belongs to the part delimiter.
    if (data.endsWith('\r\n')) data = data.slice(0, -2);
    return {
      data: Buffer.from(data, 'latin1'),
      filename: fileMatch ? fileMatch[1] : 'upload',
      contentType: typeMatch ? typeMatch[1].trim() : '',
    };
  }
  return null;
}
