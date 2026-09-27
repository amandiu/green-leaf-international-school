// ------------------------------------------------------------
// Gallery controllers (Phase B.2)
//
// HTTP concerns only — validation and business rules live in the
// service; SQL lives in the model. HttpErrors map to their
// status; everything else becomes a safe generic 500.
//
//   GET    /api/gallery                     public (PUBLISHED only)
//   GET    /api/gallery/categories          public (non-empty cats)
//   POST   /api/admin/gallery               adminAuth
//   GET    /api/admin/gallery               adminAuth
//   GET    /api/admin/gallery/:id           adminAuth
//   PUT    /api/admin/gallery/:id           adminAuth
//   PATCH  /api/admin/gallery/:id/status    adminAuth
//   DELETE /api/admin/gallery/:id           adminAuth
// ------------------------------------------------------------

import {
  getPublicGallery,
  getPublicGalleryCategories,
  getAdminGallery,
  getAdminGalleryItem,
  createGalleryItem,
  updateGalleryItem,
  setGalleryItemStatus,
  deleteGalleryItem,
} from '../services/galleryService.js';
import { HttpError } from '../utils/errors.js';

/** Map service errors to responses; log everything else safely. */
function sendServiceError(res, err, fallback) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  console.error(fallback.log, err.message);
  return res.status(500).json({ success: false, message: fallback.message });
}

/** Guard for :id route params (same pattern as leadership/contact). */
function parseId(raw) {
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Clamp ?limit= / ?offset= (news controller convention). */
const clampLimit = (v, max = 100) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : undefined;
};
const clampOffset = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

// ============ PUBLIC ============

/**
 * GET /api/gallery?category=&limit=&offset=
 * PUBLISHED items in display order. Admin-only fields do not
 * exist on public rows (the schema has none — status is filtered,
 * created_at/updated_at are harmless timestamps).
 */
export async function listPublicGallery(req, res) {
  try {
    const items = await getPublicGallery({
      category: req.query.category || undefined,
      limit: clampLimit(req.query.limit),
      offset: clampOffset(req.query.offset),
    });
    res.status(200).json({ success: true, items });
  } catch (err) {
    return sendServiceError(res, err, {
      log: 'Failed to load public gallery:',
      message: 'Failed to load gallery',
    });
  }
}

/** GET /api/gallery/categories — categories with published items. */
export async function listPublicGalleryCategories(_req, res) {
  try {
    const categories = await getPublicGalleryCategories();
    res.status(200).json({ success: true, data: { categories } });
  } catch (err) {
    return sendServiceError(res, err, {
      log: 'Failed to load gallery categories:',
      message: 'Failed to load gallery categories',
    });
  }
}

// ============ ADMIN ============

/** GET /api/admin/gallery?status=&category= */
export async function listAdminGallery(req, res) {
  try {
    const data = await getAdminGallery({
      status: req.query.status || undefined,
      category: req.query.category || undefined,
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    return sendServiceError(res, err, {
      log: 'Admin: failed to list gallery items:',
      message: 'Failed to load gallery items',
    });
  }
}

/** GET /api/admin/gallery/:id */
export async function getOneGalleryItem(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid gallery item id' });
    }
    const data = await getAdminGalleryItem(id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    return sendServiceError(res, err, {
      log: 'Admin: failed to load gallery item:',
      message: 'Failed to load gallery item',
    });
  }
}

/** POST /api/admin/gallery — create (defaults to DRAFT). */
export async function createGallery(req, res) {
  try {
    const data = await createGalleryItem(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) {
    return sendServiceError(res, err, {
      log: 'Admin: failed to create gallery item:',
      message: 'Failed to create gallery item',
    });
  }
}

/** PUT /api/admin/gallery/:id — edit metadata/image. */
export async function updateGallery(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid gallery item id' });
    }
    const data = await updateGalleryItem(id, req.body);
    res.status(200).json({ success: true, data });
  } catch (err) {
    return sendServiceError(res, err, {
      log: 'Admin: failed to update gallery item:',
      message: 'Failed to update gallery item',
    });
  }
}

/** PATCH /api/admin/gallery/:id/status — publish/unpublish/archive. */
export async function patchGalleryStatus(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid gallery item id' });
    }
    const data = await setGalleryItemStatus(id, req.body);
    res.status(200).json({ success: true, data });
  } catch (err) {
    return sendServiceError(res, err, {
      log: 'Admin: failed to update gallery status:',
      message: 'Failed to update gallery item status',
    });
  }
}

/** DELETE /api/admin/gallery/:id — hard delete + orphan-safe cleanup. */
export async function deleteGallery(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid gallery item id' });
    }
    const data = await deleteGalleryItem(id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    return sendServiceError(res, err, {
      log: 'Admin: failed to delete gallery item:',
      message: 'Failed to delete gallery item',
    });
  }
}
