// ------------------------------------------------------------
// useNavigation (Phase 3.4)
//
// Loads the public navigation tree ONCE per mount (no polling,
// no refetch loops). While loading it serves the verified
// fallback items so the Navbar keeps its shape; on API failure
// it keeps the same fallback — the site stays usable.
// ------------------------------------------------------------

import { useEffect, useState } from 'react';
import { getPublicNavigation } from '../services/navigationService';
import {
  mapNavigationForNavbar,
  FALLBACK_NAV_ITEMS,
} from '../utils/navigation';

export default function useNavigation() {
  const [items, setItems] = useState(FALLBACK_NAV_ITEMS);
  const [status, setStatus] = useState('loading'); // loading | ready | fallback

  useEffect(() => {
    let cancelled = false;

    getPublicNavigation()
      .then((data) => {
        if (cancelled) return;
        const mapped = mapNavigationForNavbar(data);
        if (mapped.length > 0) {
          setItems(mapped);
          setStatus('ready');
        } else {
          // API OK but empty/malformed — keep verified fallback
          setStatus('fallback');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.name !== 'AbortError') {
          // Development-only detail; never rendered to users
          console.warn('[Navbar] navigation API unavailable, using fallback:', err?.message);
        }
        setStatus('fallback');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { items, status };
}
