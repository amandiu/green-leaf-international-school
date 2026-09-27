// ------------------------------------------------------------
// Download controller (Phase B.6)
//
// Thin HTTP layer over downloadService. Public routes are
// read-only and expose PUBLISHED rows only; admin routes are
// write-protected by adminAuth (mounted in server.js). Error
// handling follows the existing controller convention: HttpError
// → its status, anything else → 500 with a safe message.
//
// File serving (GET /api/downloads/:id/file) resolves the file
// through the DB row (published-only), streams it from the
// managed directory, and sets browser-safe headers:
//   Content-Type:        application/pdf (server-determined, not user MIME)
//   Content-Disposition: attachment; filename="<sanitized>" — the
//                        filename is stripped of CR/LF/quotes and
//                        control chars (no header injection, and
//                        PDFs download instead of rendering inline)
//   X-Content-Type-Options: nosniff
//   Cache-Control:       no-store
// ------------------------------------------------------------

import {
  getPublicDownloads, getPublicDownloadCategories,
  getAdminDownloads, getAdminDownloadById,
  createDownload, updateDownload, setDownloadStatus, deleteDownload,
  resolvePublishedDownloadFile,
} from '../services/downloadService.js';
import { HttpError, badRequest } from '../utils/errors.js';

const clampLimit = (v, max = 100) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : undefined;
};
const clampOffset = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};
const parseId = (v) => {
  // STRICT digits-only: '/downloads/1xyz/file' is NOT id 1. This
  // closes the lenient-parseInt hole where garbage suffixes would
  // silently resolve to a real row.
  if (typeof v !== 'string' || !/^\d{1,10}$/.test(v)) return null;
  const n = Number.parseInt(v, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** Strip header-dangerous characters from a display filename. */
function safeDownloadName(name) {
  return String(name)
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/"/g, '')
    .slice(0, 150) || 'document.pdf';
}

// ---- Public (read-only) -------------------------------------

/** GET /api/downloads?category=&limit=&offset= — PUBLISHED only. */
export async function listPublicDownloads(req, res) {
  try {
    const items = await getPublicDownloads({
      category: req.query.category || undefined,
      limit: clampLimit(req.query.limit),
      offset: clampOffset(req.query.offset),
    });
    res.set('Cache-Control', 'no-store');
    res.status(200).json({ success: true, data: { items } });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('Failed to load public downloads:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load downloads' });
  }
}

/** GET /api/downloads/categories — categories with published items. */
export async function listPublicDownloadCategories(req, res) {
  try {
    const categories = await getPublicDownloadCategories();
    res.set('Cache-Control', 'no-store');
    res.status(200).json({ success: true, data: { categories } });
  } catch (err) {
    console.error('Failed to load download categories:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load download categories' });
  }
}

/**
 * GET /api/downloads/:id/file — secure DB-mediated file serving.
 * The id must reference a PUBLISHED row; the path comes from the
 * managed DB reference (never URL input).
 */
export async function downloadFile(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(404).json({ success: false, message: 'Download not found' });
    }
    const { filePath, filename, contentType } = await resolvePublishedDownloadFile(id);
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${safeDownloadName(filename)}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    });
    res.sendFile(filePath, (err) => {
      if (err && !res.headersSent) {
        res.status(404).json({ success: false, message: 'Download not found' });
      }
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('Failed to serve download:', err.message);
    res.status(500).json({ success: false, message: 'Failed to serve download' });
  }
}

// ---- Admin (adminAuth-protected) ----------------------------

/** GET /api/admin/downloads — all statuses for the management table. */
export async function listAdminDownloads(req, res) {
  try {
    const items = await getAdminDownloads({
      status: req.query.status || undefined,
      category: req.query.category || undefined,
    });
    res.status(200).json({ success: true, data: { items } });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('Admin: failed to load downloads:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load downloads' });
  }
}

/** GET /api/admin/downloads/:id */
export async function getAdminDownload(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) throw badRequest('Invalid download id');
    res.status(200).json({ success: true, data: await getAdminDownloadById(id) });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('Admin: failed to load download:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load download' });
  }
}

/** POST /api/admin/downloads — create (DRAFT). */
export async function createAdminDownload(req, res) {
  try {
    const item = await createDownload(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('Admin: failed to create download:', err.message);
    res.status(500).json({ success: false, message: 'Failed to create download' });
  }
}

/** PUT /api/admin/downloads/:id — update editable fields. */
export async function updateAdminDownload(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) throw badRequest('Invalid download id');
    res.status(200).json({ success: true, data: await updateDownload(id, req.body) });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('Admin: failed to update download:', err.message);
    res.status(500).json({ success: false, message: 'Failed to update download' });
  }
}

/** PATCH /api/admin/downloads/:id/status — publish/unpublish/archive. */
export async function patchAdminDownloadStatus(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) throw badRequest('Invalid download id');
    res.status(200).json({ success: true, data: await setDownloadStatus(id, req.body) });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('Admin: failed to update download status:', err.message);
    res.status(500).json({ success: false, message: 'Failed to update download status' });
  }
}

/** DELETE /api/admin/downloads/:id — hard delete (+ safe file cleanup). */
export async function deleteAdminDownload(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) throw badRequest('Invalid download id');
    res.status(200).json({ success: true, data: await deleteDownload(id) });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('Admin: failed to delete download:', err.message);
    res.status(500).json({ success: false, message: 'Failed to delete download' });
  }
}
