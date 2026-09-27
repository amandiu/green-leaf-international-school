// ------------------------------------------------------------
// SettingsHeadSync (Phase A; page-SEO guard added Phase B.7)
//
// Renders nothing. Watches the settings context and re-applies
// the document <head> branding (title, favicon, OG metadata)
// whenever the effective settings change — i.e. once the
// /api/settings response arrives and DB values replace the
// siteConfig fallback. If the API fails, no update happens and
// the siteConfig values applied in main.jsx remain.
//
// Phase B.7: when a page has per-page SEO mounted
// (applyBranding's pageSeoActive flag set by usePageSeo), the
// global sync must NOT stomp the page's title/description/OG —
// React runs child effects before parent effects, so without
// the guard every page mount would be followed by a global
// overwrite. Favicon + og:image still sync (they are global).
// ------------------------------------------------------------

import { useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { applyBranding } from '../../utils/branding';

function SettingsHeadSync() {
  const { settings, status } = useSettings();

  useEffect(() => {
    if (status === 'ready') {
      applyBranding({ settings });
    }
  }, [settings, status]);

  // Note: restoring global metadata when LEAVING a page-SEO page
  // happens in usePageSeo's own cleanup (restoreGlobalSeo) — not
  // here, so there is exactly ONE owner for each head state.

  return null;
}

export default SettingsHeadSync;
