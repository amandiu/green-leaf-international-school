// ------------------------------------------------------------
// Contact message service (Phase B.1)
//
// Business rules for the public contact flow and the admin inbox.
// HTTP concerns live in the controllers; SQL lives in the model.
//
// Public path (POST /api/contact): validate → insert → acknowledge.
// The public caller NEVER receives stored-row detail beyond the
// acknowledgment — contact data is private (see SYSTEM_DESIGN
// "Public vs Private Data").
//
// Admin path (/api/admin/contact-messages): full list/detail/
// status/delete, all reached only through the adminAuth gate
// mounted on the router (never through a public read API).
//
// Dates: rows are stored UTC (pool timezone 'Z'); every served
// item also carries a preformatted `receivedLabel` fixed to
// Asia/Dhaka so the inbox shows identical, predictable dates
// (same convention as the news dateLabel).
// ------------------------------------------------------------

import {
  findAll, findById, insert, updateStatus, remove,
} from '../models/ContactMessage.js';
import {
  validateContactSubmission,
  validateContactStatusPayload,
  CONTACT_STATUSES,
} from '../validators/contactValidation.js';
import { notFound, badRequest } from '../utils/errors.js';

/**
 * Asia/Dhaka-stable label, e.g. "12 Mar 2026, 14:05".
 * Pinned timezone — every admin sees the same received time.
 */
function dhakaReceivedLabel(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/** Attach the Dhaka-stable label to a raw row. */
function withReceivedLabel(row) {
  return { ...row, receivedLabel: dhakaReceivedLabel(row.created_at) };
}

/**
 * Public submit: validate + normalize, insert as NEW.
 * Returns a minimal acknowledgment payload (id + receivedLabel) —
 * never the stored row content.
 */
export async function submitContactMessage(input) {
  const clean = validateContactSubmission(input);
  const id = await insert(clean);
  return {
    id,
    receivedLabel: dhakaReceivedLabel(new Date().toISOString()),
  };
}

/** Admin list (all statuses or one filtered status), newest first. */
export async function getAdminContactMessages({ status } = {}) {
  if (status) {
    if (!CONTACT_STATUSES.includes(status)) {
      throw badRequest(`status must be one of: ${CONTACT_STATUSES.join(', ')}`);
    }
  }
  const rows = await findAll({ status });
  return rows.map(withReceivedLabel);
}

/** Admin detail by id. */
export async function getAdminContactMessage(id) {
  const row = await findById(id);
  if (!row) throw notFound(`Contact message ${id} not found`);
  return withReceivedLabel(row);
}

/**
 * Status transition (NEW → READ → REPLIED, ARCHIVED any time).
 * Simple set — no timestamp semantics beyond updated_at (the
 * lifecycle is a plain triage state, unlike news publish dates).
 */
export async function setContactMessageStatus(id, input) {
  const existing = await findById(id);
  if (!existing) throw notFound(`Contact message ${id} not found`);

  const { status } = validateContactStatusPayload(input);
  await updateStatus(id, status);
  return getAdminContactMessage(id);
}

/**
 * Delete a message (hard delete — nothing references contact rows;
  * the same no-references rule that makes news deletion safe).
 */
export async function deleteContactMessage(id) {
  const existing = await findById(id);
  if (!existing) throw notFound(`Contact message ${id} not found`);
  await remove(id);
  return { deleted: existing.id };
}
