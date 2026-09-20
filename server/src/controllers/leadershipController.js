// ------------------------------------------------------------
// Leadership message controllers
//
// HTTP concerns only — validation and business rules live in
// the service; SQL lives in the model. HttpErrors map to their
// status; everything else becomes a safe generic 500 (no SQL,
// credentials, stack, or paths ever reach the client).
// ------------------------------------------------------------

import {
  getPublicLeadershipMessages,
  getPublicLeadership as getPublicLeadershipFromService,
  getAdminLeadershipMessages,
  getLeadershipMessage,
  createLeadershipMessage,
  updateLeadershipMessage,
  deleteLeadershipMessage,
  setLeadershipMessageStatus,
  reorderLeadershipMessages,
  getLeadershipSection,
  updateLeadershipSection,
} from '../services/leadershipService.js';
import { saveLeadershipImage } from '../utils/imageUpload.js';
import { HttpError } from '../utils/errors.js';

/** Map service errors to responses; log everything else safely. */
function sendServiceError(res, err, fallback) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  console.error(fallback.log, err.message);
  return res.status(500).json({ success: false, message: fallback.message });
}

/** Guard for :id route params. */
function parseId(raw) {
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// ============ PUBLIC ============

/**
 * GET /api/leadership-messages
 * Active records only, ordered by sort_order ASC.
 */
export async function getLeadershipMessages(_req, res) {
  try {
    const data = await getPublicLeadershipMessages();
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Failed to load leadership messages:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to load leadership messages',
    });
  }
}

/**
 * GET /api/leadership
 * Combined public payload: section copy + active messages.
 * An inactive section returns { section: null, messages: [] }
 * so the homepage hides the whole block gracefully.
 */
export async function getPublicLeadership(_req, res) {
  try {
    const data = await getPublicLeadershipFromService();
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Failed to load leadership content:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to load leadership content',
    });
  }
}

// ============ ADMIN ============

/** GET /api/admin/leadership-messages — all records (incl. inactive). */
export async function listLeadershipMessages(_req, res) {
  try {
    const data = await getAdminLeadershipMessages();
    res.status(200).json({ success: true, data });
  } catch (err) {
    return sendServiceError(res, err, {
      log: 'Admin: failed to list leadership messages:',
      message: 'Failed to load leadership messages',
    });
  }
}

/** GET /api/admin/leadership-messages/:id — single record fetch. */
export async function getOneLeadership(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid leadership message id' });
    }
    const item = await getLeadershipMessage(id);
    res.status(200).json({ success: true, data: item });
  } catch (err) {
    return sendServiceError(res, err, {
      log: 'Admin: failed to load leadership message:',
      message: 'Failed to load leadership message',
    });
  }
}

/** POST /api/admin/leadership-messages — create a record. */
export async function createLeadership(req, res) {
  try {
    const item = await createLeadershipMessage(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    return sendServiceError(res, err, {
      log: 'Admin: failed to create leadership message:',
      message: 'Failed to create leadership message',
    });
  }
}

/** PUT /api/admin/leadership-messages/:id — update a record. */
export async function updateLeadership(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid leadership message id' });
    }
    const item = await updateLeadershipMessage(id, req.body);
    res.status(200).json({ success: true, data: item });
  } catch (err) {
    return sendServiceError(res, err, {
      log: 'Admin: failed to update leadership message:',
      message: 'Failed to update leadership message',
    });
  }
}

/** DELETE /api/admin/leadership-messages/:id — delete a record. */
export async function deleteLeadership(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid leadership message id' });
    }
    await deleteLeadershipMessage(id);
    res.status(200).json({ success: true, message: 'Leadership message deleted' });
  } catch (err) {
    return sendServiceError(res, err, {
      log: 'Admin: failed to delete leadership message:',
      message: 'Failed to delete leadership message',
    });
  }
}

/**
 * PATCH /api/admin/leadership-messages/:id/status
 * Activate/deactivate a record without touching other fields.
 */
export async function setLeadershipStatus(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid leadership message id' });
    }
    const item = await setLeadershipMessageStatus(id, req.body);
    res.status(200).json({ success: true, data: item });
  } catch (err) {
    return sendServiceError(res, err, {
      log: 'Admin: failed to set leadership status:',
      message: 'Failed to update leadership status',
    });
  }
}

/**
 * PATCH /api/admin/leadership-messages/reorder
 * Body: { order: [ { id, sort_order }, ... ] } — applied atomically.
 */
export async function reorderLeadership(req, res) {
  try {
    const data = await reorderLeadershipMessages(req.body);
    res.status(200).json({ success: true, data });
  } catch (err) {
    return sendServiceError(res, err, {
      log: 'Admin: failed to reorder leadership messages:',
      message: 'Failed to reorder leadership messages',
    });
  }
}

/** GET /api/admin/leadership-section — section settings (admin view). */
export async function getLeadershipSectionSettings(_req, res) {
  try {
    const data = await getLeadershipSection();
    res.status(200).json({ success: true, data });
  } catch (err) {
    return sendServiceError(res, err, {
      log: 'Admin: failed to load leadership section:',
      message: 'Failed to load leadership section',
    });
  }
}

/** PUT /api/admin/leadership-section — update section settings. */
export async function updateLeadershipSectionSettings(req, res) {
  try {
    const data = await updateLeadershipSection(req.body);
    res.status(200).json({ success: true, data });
  } catch (err) {
    return sendServiceError(res, err, {
      log: 'Admin: failed to update leadership section:',
      message: 'Failed to update leadership section',
    });
  }
}

/**
 * POST /api/admin/leadership-messages/image
 * Upload a leadership portrait. Returns the public-safe image_url
 * to store on the record via POST/PUT.
 */
export async function uploadLeadershipImage(req, res) {
  try {
    const file = req.uploadedFile;
    if (!file || !file.data) {
      return res.status(400).json({ success: false, message: 'No image file was received.' });
    }
    const image_url = await saveLeadershipImage(file.data);
    res.status(201).json({ success: true, data: { image_url } });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    // Validation messages from the upload utility are safe to show.
    const safe =
      typeof err?.message === 'string'
      && /image|file|5 MB|jpeg|png|webp/i.test(err.message);
    if (safe) {
      return res.status(400).json({ success: false, message: err.message });
    }
    console.error('Admin: leadership image upload failed:', err.message);
    return res.status(500).json({ success: false, message: 'Image upload failed' });
  }
}
