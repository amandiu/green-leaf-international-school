// ------------------------------------------------------------
// useDownloads (Phase B.6)
//
// Loads the published downloads ONCE per mount (no polling, no
// refetch loops) — the same one-fetch convention as useGallery,
// useNews and useNavigation. On API failure it serves an EMPTY
// list so the page renders its intentional empty state; the site
// never blanks and the ErrorBoundary is never triggered by data
// errors.
// ------------------------------------------------------------

import { useEffect, useState } from 'react';
import {
  getPublishedDownloads,
  getPublishedDownloadCategories,
} from '../services/downloadService';

export default function useDownloads({ category } = {}) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | fallback

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getPublishedDownloads({ category }),
      // Categories are a nicety — a failure here must not break the page.
      getPublishedDownloadCategories().catch(() => []),
    ])
      .then(([downloadItems, downloadCategories]) => {
        if (cancelled) return;
        setItems(Array.isArray(downloadItems) ? downloadItems : []);
        setCategories(Array.isArray(downloadCategories) ? downloadCategories : []);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.name !== 'AbortError') {
          console.warn('[Downloads] API unavailable, showing empty state:', err?.message);
        }
        setStatus('fallback');
      });

    return () => {
      cancelled = true;
    };
  }, [category]);

  return { items, categories, status };
}
