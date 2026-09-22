// ------------------------------------------------------------
// Content block controllers (Phase D)
//
// HTTP concerns only — validation and merge rules live in the
// service; SQL lives in the model. HttpErrors map to their
// status; everything else becomes a safe generic 500.
//
// Public:  GET /api/content/blocks           (active blocks for the site)
// Admin:   GET    /api/admin/content/blocks           (adminAuth)
//          PUT    /api/admin/content/blocks/:key      (adminAuth)
//          PATCH  /api/admin/content/blocks/:key/active (adminAuth)
//          DELETE /api/admin/content/blocks/:key      (adminAuth)
// ------------------------------------------------------------

import {
  getEffectiveBlocks, getAdminBlocks, updateBlock,
  setBlockActive, deleteBlock,
} from '../services/contentBlockService.js';
import { HttpError } from '../utils/errors.js';

/**
 * GET /api/content/blocks
 * Public effective reusable blocks (DB values + shared defaults).
 * A database outage must NOT 500 the public site — the service
 * falls back to the shared defaults and we still answer 200.
 */
export async function getPublicBlocks(_req, res) {
  try {
    const data = await getEffectiveBlocks();
    res.set('Cache-Control', 'no-store');
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Failed to load content blocks:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load content blocks' });
  }
}

/**
 * GET /api/admin/content/blocks
 * Effective blocks + derived usage ("Used in") for the admin UI.
 */
export async function getAdminBlocksController(_req, res) {
  try {
    const data = await getAdminBlocks();
    res.status(200).json({ success: true, data });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('Admin: failed to load content blocks:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load content blocks' });
  }
}

/**
 * PUT /api/admin/content/blocks/:key
 * Body: { name, content } — validated per-type server-side.
 * Unknown keys → 404; unknown/invalid fields → 400. Responds with
 * the merged effective blocks after the write.
 */
export async function putBlock(req, res) {
  const { key } = req.params;
  try {
    const data = await updateBlock(key, req.body);
    res.status(200).json({ success: true, data });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('Admin: failed to save content block:', err.message);
    res.status(500).json({ success: false, message: 'Failed to save content block' });
  }
}

/**
 * PATCH /api/admin/content/blocks/:key/active
 * Body: { isActive: boolean } — toggle without touching content.
 */
export async function patchBlockActive(req, res) {
  const { key } = req.params;
  try {
    const data = await setBlockActive(key, req.body?.isActive);
    res.status(200).json({ success: true, data });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('Admin: failed to update content block state:', err.message);
    res.status(500).json({ success: false, message: 'Failed to update content block state' });
  }
}

/**
 * DELETE /api/admin/content/blocks/:key
 * Refuses (409) while the block is referenced by any page
 * section — the error names the consumers.
 */
export async function deleteBlockController(req, res) {
  const { key } = req.params;
  try {
    await deleteBlock(key);
    res.status(200).json({ success: true, data: { deleted: key } });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('Admin: failed to delete content block:', err.message);
    res.status(500).json({ success: false, message: 'Failed to delete content block' });
  }
}
