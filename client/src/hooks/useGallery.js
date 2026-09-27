// ------------------------------------------------------------
// useGallery (Phase B.2)
//
// Loads the published gallery ONCE per mount (no polling, no
// refetch loops) — the same one-fetch convention as useNavigation
// and useNews. On API failure it serves an EMPTY list so pages
// render their intentional empty/fallback states; the site never
// blanks and the ErrorBoundary is never triggered by data errors.
//
// Campus integration contract: the Campus page keeps its existing
// hardcoded images as a visible fallback while the DB gallery has
// no published items — hardcoded verified-content placeholders
// are never silently removed by an API outage.
// ------------------------------------------------------------

import { useEffect, useState } from 'react';
import {
  getPublishedGallery,
  getPublishedGalleryCategories,
} from '../services/galleryService';

export default function useGallery({ category, limit } = {}) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | fallback

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getPublishedGallery({ category, limit }),
      // Categories are a nicety — a failure here must not break the grid.
      getPublishedGalleryCategories().catch(() => []),
    ])
      .then(([galleryItems, galleryCategories]) => {
        if (cancelled) return;
        setItems(Array.isArray(galleryItems) ? galleryItems : []);
        setCategories(Array.isArray(galleryCategories) ? galleryCategories : []);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.name !== 'AbortError') {
          console.warn('[Gallery] API unavailable, showing empty state:', err?.message);
        }
        setStatus('fallback');
      });

    return () => {
      cancelled = true;
    };
  }, [category, limit]);

  return { items, categories, status };
}
