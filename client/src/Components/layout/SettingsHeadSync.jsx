// ------------------------------------------------------------
// SettingsHeadSync (Phase A)
//
// Renders nothing. Watches the settings context and re-applies
// the document <head> branding (title, favicon, OG metadata)
// whenever the effective settings change — i.e. once the
// /api/settings response arrives and DB values replace the
// siteConfig fallback. If the API fails, no update happens and
// the siteConfig values applied in main.jsx remain.
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

  return null;
}

export default SettingsHeadSync;
