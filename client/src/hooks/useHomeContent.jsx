// ------------------------------------------------------------
// HomeContentProvider / useHomeContent (Phase B)
//
// THE single runtime content source for the public Homepage:
//
//   shared/content/homeContent.js defaults (immediate)
//   → GET /api/pages/home (once, when the Homepage mounts)
//   → DB-backed sections replace the defaults
//
// Every Homepage section reads useHomeContent() — no per-section
// fetches, no API waterfall, no state library. If the API fails
// the context keeps the defaults, so the Homepage renders exactly
// as it does today. Tokens ({{identity.*}}, {{social.youtube}})
// are resolved against the EFFECTIVE site settings at render
// time, so Site Settings-driven values keep working.
// ------------------------------------------------------------

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { defaultHomeContent } from '../../../shared/content/homeContent';
import { getPublicHomeContent } from '../services/homeContentService';
import { resolveHomeContent, settingsTokens } from '../content/homeContentResolver';
import { useSettings } from '../context/SettingsContext';

export const HomeContentContext = createContext({
  /** Raw sections (defaults until the API response arrives). */
  sections: defaultHomeContent(),
  /** Defaults resolved with current site settings (render-ready). */
  content: defaultHomeContent(),
  status: 'loading', // loading | ready | fallback
});

export function HomeContentProvider({ children }) {
  const [sections, setSections] = useState(defaultHomeContent);
  const [status, setStatus] = useState('loading');
  const { settings } = useSettings();

  useEffect(() => {
    let cancelled = false;

    getPublicHomeContent()
      .then((data) => {
        if (cancelled) return;
        // Accept any object response; per-section fallback happens
        // in the resolver/merge below, not by rejecting the payload.
        if (data && typeof data === 'object') {
          setSections((prev) => ({ ...prev, ...data }));
          setStatus('ready');
        } else {
          setStatus('fallback');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.name !== 'AbortError') {
          console.warn('[HomeContent] home content API unavailable, using defaults:', err?.message);
        }
        setStatus('fallback');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Render-ready content: DB sections overlaid on defaults, with
   * {{...}} tokens resolved from effective site settings. Re-done
   * when settings change (cheap, memoized).
   */
  const content = useMemo(() => {
    const merged = { ...defaultHomeContent(), ...sections };
    return resolveHomeContent(merged, settingsTokens(settings));
  }, [sections, settings]);

  const value = useMemo(() => ({ sections, content, status }), [sections, content, status]);

  return (
    <HomeContentContext.Provider value={value}>
      {children}
    </HomeContentContext.Provider>
  );
}

/**
 * Read the effective home content. Always returns a complete
 * sectioned object (defaults until/unless the API responds), so
 * sections never render against undefined.
 */
export function useHomeContent() {
  return useContext(HomeContentContext);
}

export default HomeContentProvider;
