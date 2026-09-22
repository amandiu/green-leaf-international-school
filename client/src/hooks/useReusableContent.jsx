// ------------------------------------------------------------
// ReusableContentProvider / useReusableContent (Phase D)
//
// THE single runtime source for reusable content blocks on the
// public site:
//
//   shared/content/contentBlocks.js defaults (immediate)
//   → GET /api/content/blocks (once, at the app root)
//   → DB-backed blocks replace the defaults
//
// Every consumer reads useReusableContent().getBlock(key) — no
// per-component fetches, no API waterfall, no state library.
// If the API fails the context keeps the shared defaults, so
// pages render exactly as before (graceful degradation).
//
// getBlock(key) resolves {{settings}} tokens (identity.*,
// contact.*, social.*, location.*) against the EFFECTIVE site
// settings at read time — settings values are referenced, never
// copied into blocks.
// ------------------------------------------------------------

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { defaultContentBlocks } from '../../../shared/content/contentBlocks';
import { getPublicContentBlocks } from '../services/contentBlockService';
import { resolveHomeContent, settingsTokens } from '../content/homeContentResolver';
import { useSettings } from '../context/SettingsContext';

export const ReusableContentContext = createContext({
  /** Raw blocks (defaults until the API response arrives). */
  blocks: defaultContentBlocks(),
  status: 'loading', // loading | ready | fallback
});

export function ReusableContentProvider({ children }) {
  const [blocks, setBlocks] = useState(defaultContentBlocks);
  const [status, setStatus] = useState('loading');
  const { settings } = useSettings();

  useEffect(() => {
    let cancelled = false;

    getPublicContentBlocks()
      .then((data) => {
        if (cancelled) return;
        if (data && typeof data === 'object') {
          setBlocks((prev) => ({ ...prev, ...data }));
          setStatus('ready');
        } else {
          setStatus('fallback');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.name !== 'AbortError') {
          console.warn('[ContentBlocks] API unavailable, using defaults:', err?.message);
        }
        setStatus('fallback');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Resolve one block for rendering: token substitution against
   * the effective site settings, memoized per (blocks, settings).
   * Unknown key → undefined (callers must handle absence).
   */
  const getBlock = useCallback(
    (key) => {
      const block = blocks[key];
      if (!block) return undefined;
      return resolveHomeContent(block, settingsTokens(settings));
    },
    [blocks, settings],
  );

  const value = useMemo(
    () => ({ blocks, status, getBlock }),
    [blocks, status, getBlock],
  );

  return (
    <ReusableContentContext.Provider value={value}>
      {children}
    </ReusableContentContext.Provider>
  );
}

/**
 * Read the reusable content access object. Use
 * `getBlock('admissions-primary-cta')` etc. Always resolves
 * against the shared defaults until/unless the API responds, so
 * consumers never render against undefined during load.
 */
export function useReusableContent() {
  return useContext(ReusableContentContext);
}

export default ReusableContentProvider;
