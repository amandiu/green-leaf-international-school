// ------------------------------------------------------------
// usePageContent (Phase B.3)
//
// Loads one page's DB-backed sections ONCE per mount — the same
// one-fetch convention as useHomeContent, useGallery and
// useNews. The page's shared fallback content renders
// immediately and is replaced by the API response; if the API
// fails the fallback stays, so the page never blanks and the
// ErrorBoundary is never triggered by data errors.
//
//   DB published content   → rendered
//   unavailable/empty      → shared fallback constants
//                            (safe baseline only)
//
// The caller passes the page's `defaultXxxContent()` factory
// output (shared/content/<page>Content.js) — the same module the
// server merges server-side. Sections the DB hides (is_active=0)
// arrive as null and stay null after the merge, so the page can
// hide them (never crash).
//
// Tokens ({{identity.*}}, {{social.youtube}}) are resolved
// against the EFFECTIVE site settings at render time — the same
// mechanism the Homepage uses, so fields that follow Site
// Settings keep doing so.
// ------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react';
import { getPublicPageContent } from '../services/pageContentService';
import { resolveHomeContent, settingsTokens } from '../content/homeContentResolver';
import { useSettings } from '../context/SettingsContext';

const STATUS = {
  LOADING: 'loading',
  READY: 'ready',
  FALLBACK: 'fallback',
};

export function usePageContent(page, fallbackContent) {
  const [sections, setSections] = useState(null);
  const [status, setStatus] = useState(STATUS.LOADING);
  const { settings } = useSettings();

  useEffect(() => {
    let cancelled = false;

    getPublicPageContent(page)
      .then((data) => {
        if (cancelled) return;
        // Accept any object response; per-section fallback has
        // already been applied server-side, so a partial payload
        // still merges safely over the client fallback.
        if (data && typeof data === 'object') {
          setSections(data);
          setStatus(STATUS.READY);
        } else {
          setStatus(STATUS.FALLBACK);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.name !== 'AbortError') {
          console.warn(`[PageContent:${page}] API unavailable, using fallback:`, err?.message);
        }
        setStatus(STATUS.FALLBACK);
      });

    return () => {
      cancelled = true;
    };
  }, [page]);

  /**
   * Render-ready content: fallback overlaid with DB sections,
   * with {{...}} tokens resolved from effective site settings
   * (cheap, memoized). A null DB section stays null.
   */
  const content = useMemo(() => {
    const merged = { ...(fallbackContent ?? {}), ...(sections ?? {}) };
    return resolveHomeContent(merged, settingsTokens(settings));
  }, [fallbackContent, sections, settings]);

  return { sections, content, status };
}

export default usePageContent;
