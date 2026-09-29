// ------------------------------------------------------------
// News controller (Phase E)
//
// Thin HTTP layer over newsService. Public routes are read-only
// and expose PUBLISHED items only; admin routes are write-
// protected by adminAuth (mounted in server.js). Error handling
// follows the existing controller convention: HttpError → its
// status, anything else → 500 with a safe message.
// ------------------------------------------------------------

import {
  getPublicNews, getPublicNewsBySlug,
  getAdminNews, getAdminNewsById,
  createNewsItem, updateNewsItem, setNewsStatus, deleteNewsItem,
} from '../services/newsService.js';
import { validateType } from '../validators/newsValidation.js';
import { recordAdminMutation } from '../services/auditLogService.js';
import { HttpError } from '../utils/errors.js';

const clampLimit = (v, max = 50) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : undefined;
};
const clampOffset = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

// ---- Public (read-only) -------------------------------------

/** GET /api/news — published items, newest first. */
export async function listPublicNews(req, res) {
  try {
    // Phase B item 4: the public `?type=` filter is now VALIDATED
    // (same rules as the admin filter) — unknown types → 400,
    // never silently ignored. `?upcoming=true` additionally
    // filters/sorts event-type items by their derived event date.
    const type = req.query.type ? validateType(req.query.type) : undefined;
    const upcoming = req.query.upcoming === 'true';
    const items = await getPublicNews({
      limit: clampLimit(req.query.limit),
      offset: clampOffset(req.query.offset),
      type,
      upcoming,
    });
    res.set('Cache-Control', 'no-store');
    res.status(200).json({ items });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Failed to load public news:', err.message);
    res.status(500).json({ error: 'Failed to load news' });
  }
}

/** GET /api/news/:slug — one published item (detail page). */
export async function getPublicNewsItem(req, res) {
  try {
    const item = await getPublicNewsBySlug(req.params.slug);
    if (!item) {
      return res.status(404).json({ error: 'News item not found' });
    }
    res.set('Cache-Control', 'no-store');
    res.status(200).json(item);
  } catch (err) {
    console.error('Failed to load news item:', err.message);
    res.status(500).json({ error: 'Failed to load news item' });
  }
}

// ---- Admin (adminAuth-protected) ----------------------------

/** GET /api/admin/news — all statuses for the management table. */
export async function listAdminNews(req, res) {
  try {
    const items = await getAdminNews({ status: req.query.status, type: req.query.type });
    res.status(200).json({ items });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Admin: failed to load news:', err.message);
    res.status(500).json({ error: 'Failed to load news' });
  }
}

/** GET /api/admin/news/:id */
export async function getAdminNewsItem(req, res) {
  try {
    res.status(200).json(await getAdminNewsById(req.params.id));
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Admin: failed to load news item:', err.message);
    res.status(500).json({ error: 'Failed to load news item' });
  }
}

/** POST /api/admin/news — create (DRAFT unless status PUBLISHED). */
export async function createAdminNewsItem(req, res) {
  try {
    const item = await createNewsItem(req.body);
    // D3 (§AN.19): slug is the stable public identifier — safe meta.
    await recordAdminMutation(req, {
      action: 'NEWS_ITEM_CREATE',
      entity: 'news_item',
      entityId: item?.id,
      meta: { slug: item?.slug ?? null },
    });
    res.status(201).json(item);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Admin: failed to create news item:', err.message);
    res.status(500).json({ error: 'Failed to create news item' });
  }
}

/** PUT /api/admin/news/:id — update editable fields. */
export async function updateAdminNewsItem(req, res) {
  try {
    const item = await updateNewsItem(req.params.id, req.body);
    await recordAdminMutation(req, {
      action: 'NEWS_ITEM_UPDATE',
      entity: 'news_item',
      entityId: item?.id ?? req.params.id,
    });
    res.status(200).json(item);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Admin: failed to update news item:', err.message);
    res.status(500).json({ error: 'Failed to update news item' });
  }
}

/** PATCH /api/admin/news/:id/status — publish/unpublish/archive. */
export async function patchAdminNewsStatus(req, res) {
  try {
    const item = await setNewsStatus(req.params.id, req.body);
    await recordAdminMutation(req, {
      action: 'NEWS_ITEM_STATUS_SET',
      entity: 'news_item',
      entityId: item?.id ?? req.params.id,
      meta: { to: req.body?.status ?? null },
    });
    res.status(200).json(item);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Admin: failed to update news status:', err.message);
    res.status(500).json({ error: 'Failed to update news status' });
  }
}

/** DELETE /api/admin/news/:id — hard delete (no references exist).
 *  Phase C.4: carries the standard success envelope so every
 *  admin consumer (test suites, admin client) can confirm the
 *  deletion uniformly (the GET/list envelopes stay untouched —
 *  §20.11 continues to track the pre-existing deviation). */
export async function deleteAdminNewsItem(req, res) {
  try {
    const deleted = await deleteNewsItem(req.params.id);
    await recordAdminMutation(req, {
      action: 'NEWS_ITEM_DELETE',
      entity: 'news_item',
      entityId: req.params.id,
      meta: null,
    });
    res.status(200).json({ success: true, message: 'News item deleted', data: deleted });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Admin: failed to delete news item:', err.message);
    res.status(500).json({ error: 'Failed to delete news item' });
  }
}
