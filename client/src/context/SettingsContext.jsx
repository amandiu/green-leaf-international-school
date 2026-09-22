// ------------------------------------------------------------
// SettingsProvider / useSettings (Phase A)
//
// THE single runtime settings source for the public site:
//
//   siteConfig.js (immediate fallback value)
//   → GET /api/settings (once, at the app root)
//   → DB values replace the fallback
//
// Every global-settings consumer reads useSettings() — no
// component fetches /api/settings itself, no API waterfall, no
// state library. If the API fails the context keeps the
// siteConfig values, so the site renders exactly as before.
// ------------------------------------------------------------

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { siteConfig } from '../../../shared/config/siteConfig';
import { getPublicSettings } from '../services/settingsService';

/** Deep-enough copy of siteConfig as the initial/failed state. */
function configFallback() {
  return {
    identity: { ...siteConfig.identity },
    branding: { ...siteConfig.branding },
    contact: { ...siteConfig.contact },
    social: { ...siteConfig.social },
    location: { ...siteConfig.location },
    seo: {
      title: siteConfig.seo.title,
      description: siteConfig.seo.description,
    },
  };
}

export const SettingsContext = createContext({
  settings: configFallback(),
  status: 'loading', // loading | ready | fallback
});

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(configFallback);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;

    getPublicSettings()
      .then((data) => {
        if (cancelled) return;
        if (data && data.identity && data.branding) {
          setSettings(data);
          setStatus('ready');
        } else {
          // Malformed payload — keep the siteConfig fallback
          setStatus('fallback');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.name !== 'AbortError') {
          console.warn('[Settings] settings API unavailable, using siteConfig fallback:', err?.message);
        }
        setStatus('fallback');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ settings, status }), [settings, status]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

/**
 * Read the effective site settings. Always returns a complete
 * grouped object (siteConfig values until the API response
 * arrives), so components never render against undefined.
 */
export function useSettings() {
  return useContext(SettingsContext);
}

export default SettingsProvider;
