// ------------------------------------------------------------
// Centralized admin image upload controller
//
// Handles POST /api/admin/uploads/image (multipart field "image").
// The pipeline lives in utils/imageUpload.js + imageSanitizer.js;
// this controller only maps validation outcomes to safe responses:
//   201 → { data: { image_path, width, height, bytes } }
//   400 → invalid/fake/oversized/over-dimensioned image
//   500 → generic processing failure (no internal details)
// ------------------------------------------------------------

import { saveImage } from '../utils/imageUpload.js';
import { UPLOAD_ERROR_CODES } from '../utils/imageSanitizer.js';

/** Client-safe messages per validation error code. */
const SAFE_MESSAGES = Object.freeze({
  [UPLOAD_ERROR_CODES.NO_FILE]: 'No image file was received.',
  [UPLOAD_ERROR_CODES.INVALID]: 'Uploaded file is not a valid JPEG, PNG or WebP image.',
  [UPLOAD_ERROR_CODES.DIMENSIONS]: 'Image dimensions exceed the maximum allowed size.',
  [UPLOAD_ERROR_CODES.TIMEOUT]: 'Image processing took too long. Try a smaller image.',
  [UPLOAD_ERROR_CODES.PROCESSING]: 'Image processing failed.',
});

/**
 * POST /api/admin/uploads/image
 * req.uploadedFile is attached by middleware/readImageUpload
 * (streaming 10 MB cap + multipart extraction happen there).
 */
export async function uploadAdminImage(req, res) {
  try {
    const file = req.uploadedFile;
    if (!file || !file.data) {
      return res.status(400).json({
        success: false,
        message: SAFE_MESSAGES[UPLOAD_ERROR_CODES.NO_FILE],
      });
    }

    const stored = await saveImage(file.data);

    return res.status(201).json({
      success: true,
      data: {
        image_path: stored.publicUrl,
        width: stored.width,
        height: stored.height,
        bytes: stored.bytes,
      },
    });
  } catch (err) {
    // Known validation failures → safe 400 with the safe message.
    const code = err?.code;
    if (code && Object.values(UPLOAD_ERROR_CODES).includes(code)) {
      return res.status(400).json({
        success: false,
        message: SAFE_MESSAGES[code] || 'Image upload rejected.',
      });
    }
    // The legacy magic-byte/extension guards throw plain Errors with
    // safe, human-readable messages — surface those as 400 too.
    const msg = typeof err?.message === 'string' ? err.message : '';
    if (/image|file|10 MB|jpeg|png|webp/i.test(msg)) {
      return res.status(400).json({ success: false, message: msg });
    }
    // Anything else: log server-side, return a generic safe 500.
    console.error('Admin: image upload failed:', err?.message || err);
    return res.status(500).json({ success: false, message: 'Image upload failed.' });
  }
}
