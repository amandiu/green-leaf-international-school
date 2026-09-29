// ------------------------------------------------------------
// Site settings controllers (Phase A)
//
// HTTP concerns only — validation and merge rules live in the
// service; SQL lives in the model. HttpErrors map to their
// status; everything else becomes a safe generic 500.
//
// GET /api/settings            public (never fails on DB downtime)
// GET /api/admin/settings      adminAuth
// PUT /api/admin/settings      adminAuth
// ------------------------------------------------------------

import { getEffectiveSettings, updateSettings } from '../services/siteSettingsService.js';
import { recordAdminMutation } from '../services/auditLogService.js';
import { HttpError } from '../utils/errors.js';

/**
 * GET /api/settings
 * Public effective settings (DB values + siteConfig fallback).
 * A database outage must NOT 500 the public site — the service
 * falls back to siteConfig and we still answer 200.
 */
export async function getPublicSettings(_req, res) {
  try {
    const data = await getEffectiveSettings();
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Failed to load site settings:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load site settings' });
  }
}

/** GET /api/admin/settings — effective settings for the admin form. */
export async function getAdminSettings(_req, res) {
  try {
    const data = await getEffectiveSettings();
    res.status(200).json({ success: true, data });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('Admin: failed to load site settings:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load site settings' });
  }
}

/**
 * PUT /api/admin/settings
 * Body: { identity: {...}, branding: {...}, ... } — partial groups
 * allowed. Unknown keys/groups are rejected with 400 by the
 * validator; values are validated server-side before writing.
 */
export async function putAdminSettings(req, res) {
  try {
    const data = await updateSettings(req.body);
    // D3 (§AN.19): one write touches MULTIPLE setting rows — meta
    // records only the COUNT of top-level groups, never the values.
    await recordAdminMutation(req, {
      action: 'SITE_SETTINGS_UPDATE',
      entity: 'site_setting',
      meta: { count: typeof req.body === 'object' && req.body !== null ? Object.keys(req.body).length : 0 },
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('Admin: failed to save site settings:', err.message);
    res.status(500).json({ success: false, message: 'Failed to save site settings' });
  }
}
