// ------------------------------------------------------------
// Page section controllers (Phase B + B.3)
//
// HTTP concerns only — validation and merge rules live in the
// service; SQL lives in the model. HttpErrors map to their
// status; everything else becomes a safe generic 500.
//
// GET /api/pages/:page                            public (never fails on DB downtime)
// GET /api/admin/pages/:page                      adminAuth
// PUT /api/admin/pages/:page/sections/:key        adminAuth
//
// Phase B.3: the fixed '/home' handlers were generalized to any
// page with a validated section schema ('home' | 'about' |
// 'academics' | 'campus'). Unknown pages/sections → 404; unknown
// or invalid fields → 400 (existing validation architecture — no
// second validation layer).
// ------------------------------------------------------------

import {
  getPageContent,
  updatePageSection,
  PAGE_SECTION_KEYS,
} from '../services/pageSectionService.js';
import { HttpError } from '../utils/errors.js';

/** True only for page identifiers with a validated section schema. */
function isKnownPage(page) {
  return typeof page === 'string' && Object.prototype.hasOwnProperty.call(PAGE_SECTION_KEYS, page);
}

/**
 * GET /api/pages/:page
 * Public effective page content (DB values + per-section fallback).
 * A database outage must NOT 500 the public site — the service
 * falls back to the default content and we still answer 200.
 */
export async function getPublicPage(req, res) {
  const { page } = req.params;
  try {
    if (!isKnownPage(page)) {
      return res.status(404).json({ success: false, message: `Unknown page "${page}"` });
    }
    const data = await getPageContent(page);
    res.set('Cache-Control', 'no-store');
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error(`Failed to load ${page} content:`, err.message);
    res.status(500).json({ success: false, message: 'Failed to load page content' });
  }
}

/** GET /api/admin/pages/:page — effective content for the admin editor. */
export async function getAdminPage(req, res) {
  const { page } = req.params;
  try {
    if (!isKnownPage(page)) {
      return res.status(404).json({ success: false, message: `Unknown page "${page}"` });
    }
    const data = await getPageContent(page);
    res.status(200).json({ success: true, data });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error(`Admin: failed to load ${page} content:`, err.message);
    res.status(500).json({ success: false, message: 'Failed to load page content' });
  }
}

/**
 * PUT /api/admin/pages/:page/sections/:key
 * Body: the section's content object (validated per-section
 * server-side). Unknown pages/sections → 404; unknown/invalid
 * fields → 400. Responds with the merged effective page content.
 */
export async function putPageSection(req, res) {
  const { page, key } = req.params;
  try {
    if (!isKnownPage(page) || !PAGE_SECTION_KEYS[page].includes(key)) {
      return res.status(404).json({ success: false, message: `Unknown ${page} section "${key}"` });
    }
    const data = await updatePageSection(page, key, req.body);
    res.status(200).json({ success: true, data });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error(`Admin: failed to save ${page} section:`, err.message);
    res.status(500).json({ success: false, message: 'Failed to save page section' });
  }
}
