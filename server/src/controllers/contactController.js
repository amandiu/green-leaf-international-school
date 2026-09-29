// ------------------------------------------------------------
// Contact message controllers (Phase B.1)
//
// HTTP concerns only — validation and business rules live in the
// service; SQL lives in the model. HttpErrors map to their
// status; everything else becomes a safe generic 500 (no SQL,
// credentials, stack, or paths ever reach the client).
//
//   POST  /api/contact                             public submit
//   GET   /api/admin/contact-messages              adminAuth
//   GET   /api/admin/contact-messages/:id          adminAuth
//   PATCH /api/admin/contact-messages/:id/status   adminAuth
//   DELETE /api/admin/contact-messages/:id         adminAuth
// ------------------------------------------------------------

import {
  submitContactMessage,
  getAdminContactMessages,
  getAdminContactMessage,
  setContactMessageStatus,
  deleteContactMessage,
} from '../services/contactService.js';
import { recordAdminMutation } from '../services/auditLogService.js';
import { HttpError } from '../utils/errors.js';

/** Map service errors to responses; log everything else safely. */
function sendServiceError(res, err, fallback) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  console.error(fallback.log, err.message);
  return res.status(500).json({ success: false, message: fallback.message });
}

/** Guard for :id route params (same pattern as leadership parseId). */
function parseId(raw) {
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// ============ PUBLIC ============

/**
 * POST /api/contact
 * Body: { name, email, phone?, subject, message }
 * → 201 { success: true, message, data: { id, receivedLabel } }
 *
 * The response NEVER echoes stored content or DB internals. Any
 * validation failure is a safe 400 with a field-level message; any
 * unexpected failure is a generic 500 (logged server-side only).
 */
export async function postContact(req, res) {
  try {
    const data = await submitContactMessage(req.body);
    res.status(201).json({
      success: true,
      message: 'Your message has been sent. We will get back to you soon.',
      data,
    });
  } catch (err) {
    return sendServiceError(res, err, {
      log: 'Contact: submission failed:',
      message: 'Your message could not be sent right now. Please try again later.',
    });
  }
}

// ============ ADMIN ============

/** GET /api/admin/contact-messages?status=NEW|READ|REPLIED|ARCHIVED */
export async function listContactMessages(req, res) {
  try {
    const data = await getAdminContactMessages({ status: req.query.status });
    res.status(200).json({ success: true, data });
  } catch (err) {
    return sendServiceError(res, err, {
      log: 'Admin: failed to list contact messages:',
      message: 'Failed to load contact messages',
    });
  }
}

/** GET /api/admin/contact-messages/:id */
export async function getOneContactMessage(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid contact message id' });
    }
    const data = await getAdminContactMessage(id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    return sendServiceError(res, err, {
      log: 'Admin: failed to load contact message:',
      message: 'Failed to load contact message',
    });
  }
}

/**
 * PATCH /api/admin/contact-messages/:id/status
 * Body: { status } — NEW | READ | REPLIED | ARCHIVED.
 */
export async function patchContactMessageStatus(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid contact message id' });
    }
    const data = await setContactMessageStatus(id, req.body);
    // D3 (§AN.19): status transition only — the message content is
    // private data and never enters the audit trail.
    await recordAdminMutation(req, {
      action: 'CONTACT_MESSAGE_STATUS_SET',
      entity: 'contact_message',
      entityId: id,
      meta: { to: req.body?.status ?? null },
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    return sendServiceError(res, err, {
      log: 'Admin: failed to update contact status:',
      message: 'Failed to update contact message status',
    });
  }
}

/** DELETE /api/admin/contact-messages/:id — hard delete. */
export async function deleteContactMessageController(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ success: false, message: 'Invalid contact message id' });
    }
    const data = await deleteContactMessage(id);
    await recordAdminMutation(req, {
      action: 'CONTACT_MESSAGE_DELETE',
      entity: 'contact_message',
      entityId: id,
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    return sendServiceError(res, err, {
      log: 'Admin: failed to delete contact message:',
      message: 'Failed to delete contact message',
    });
  }
}
