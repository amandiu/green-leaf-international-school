// ------------------------------------------------------------
// Navigation controller (Phase 3.2 — read-only public API)
//
// HTTP concerns only: calls the service, shapes the response,
// and never leaks database errors, SQL, or credentials.
// ------------------------------------------------------------

import { getPublicNavigation } from '../services/navigationService.js';

/**
 * GET /api/navigation
 * Public, active-only navigation tree for the site Navbar.
 */
export async function getNavigation(_req, res) {
  try {
    const data = await getPublicNavigation();
    res.status(200).json({ success: true, data });
  } catch (err) {
    // Full detail goes to server logs only; the client gets a
    // generic message (no SQL, credentials, stack, or paths).
    console.error('Failed to load navigation:', err.message);
    res.status(500).json({
      success: false,
      message: 'Failed to load navigation',
    });
  }
}
