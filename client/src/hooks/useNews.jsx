// ------------------------------------------------------------
// NewsProvider / useNews (Phase E)
//
// THE single runtime source for News/Notices on the public site:
//
//   GET /api/news (once, at the app root)
//   → published items cached in context
//   → Navbar ticker / Homepage preview / News page + detail
//     all consume the SAME list — one entity, three
//     presentations, zero copies.
//
// No Redux, no per-component fetches, no API waterfall. If the
// API fails the provider degrades to an EMPTY list and pages
// render their intentional empty states — the site never shows
// fake placeholder news as if it were published, and never
// routes a data failure into the ErrorBoundary.
// ------------------------------------------------------------

import {
  createContext, useContext, useEffect, useMemo, useState,
} from 'react';
import { getPublishedNews } from '../services/newsService';

export const NewsContext = createContext({
  /** Published items, newest first ([] until the API responds). */
  items: [],
  /** loading | ready | fallback */
  status: 'loading',
});

export function NewsProvider({ children }) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;

    getPublishedNews()
      .then((data) => {
        if (cancelled) return;
        setItems(Array.isArray(data) ? data : []);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[News] API unavailable, showing empty state:', err?.message);
        setStatus('fallback');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ items, status }), [items, status]);

  return <NewsContext.Provider value={value}>{children}</NewsContext.Provider>;
}

/**
 * Read the central news data. While `status === 'loading'` items
 * is [] — consumers render their empty/loading state, never
 * placeholder content.
 */
export function useNews() {
  return useContext(NewsContext);
}

export default NewsProvider;
