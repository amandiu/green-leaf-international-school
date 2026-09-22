// ------------------------------------------------------------
// Page section controllers (Phase B)
//
// HTTP concerns only — validation and merge rules live in the
// service; SQL lives in the model. HttpErrors map to their
// status; everything else becomes a safe generic 500.
//
// GET /api/pages/home                      public (never fails on DB downtime)
// GET /api/admin/pages/home                adminAuth
// PUT /api/admin/pages/home/sections/:key  adminAuth
// ------------------------------------------------------------

import { getHomePageContent, updateHomeSection, HOME_SECTION_KEYS } from '../services/pageSectionService.js';
import { HttpError } from '../utils/errors.js';

/**
 * GET /api/pages/home
 * Public effective home content (DB values + per-section fallback).
 * A database outage must NOT 500 the public site — the service
 * falls back to the default content and we still answer 200.
 */
export async function getPublicHome(req, res) {
  try {
    const data = await getHomePageContent();
    res.set('Cache-Control', 'no-store');
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Failed to load home content:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load home content' });
  }
}

/** GET /api/admin/pages/home — effective content for the admin editor. */
export async function getAdminHome(req, res) {
  try {
    const data = await getHomePageContent();
    res.status(200).json({ success: true, data });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('Admin: failed to load home content:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load home content' });
  }
}

/**
 * PUT /api/admin/pages/home/sections/:key
 * Body: the section's content object (validated per-section
 * server-side). Unknown section keys → 404; unknown/invalid
 * fields → 400. Responds with the merged effective page content.
 */
export async function putHomeSection(req, res) {
  const { key } = req.params;
  try {
    if (!HOME_SECTION_KEYS.includes(key)) {
      return res.status(404).json({ success: false, message: `Unknown home section "${key}"` });
    }
    const data = await updateHomeSection(key, req.body);
    res.status(200).json({ success: true, data });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('Admin: failed to save home section:', err.message);
    res.status(500).json({ success: false, message: 'Failed to save home section' });
  }
}
