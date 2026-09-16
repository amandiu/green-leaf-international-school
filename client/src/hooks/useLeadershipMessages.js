// ------------------------------------------------------------
// useLeadershipMessages (Leadership phase)
//
// Loads the public leadership records ONCE per mount (no
// polling, no refetch loops) — same pattern as useNavigation.
//
// States:
//   loading  → serve the verified local placeholder data (the
//              current "pending" cells — never fake official info)
//   ready    → API records mapped to the component's shape
//   empty    → API OK, no active records → keep the placeholder
//              cells (existing project convention for this section)
//   fallback → API unavailable → keep the placeholder cells;
//              the site stays usable (detail only in console)
// ------------------------------------------------------------

import { useEffect, useState } from 'react';
import { getPublicLeadershipMessages } from '../services/leadershipService';
import { leadershipMessages as FALLBACK_LEADERSHIP } from '../data/leadershipMessages';

const SCHOOL = 'Green Leaf International School & College';

/** Map one API record to the rendering shape the cells expect. */
function mapRecord(record) {
  const role = String(record.role || '').trim() || 'Leadership';
  return {
    id: record.id,
    role,
    roleBadge: role,
    heading: record.title || `Message from the ${role}`,
    message: record.message ?? null,
    name: record.name ?? null,
    designation: `${role}, ${SCHOOL}`,
    image: record.image_url ?? null,
    /* Alt text stays generic (role-based) unless a verified name exists. */
    imageAlt: record.name ? `Portrait of ${record.name}, ${role} of ${SCHOOL}` : null,
    placeholderMessage:
      `The official ${role}'s message will be published here once verified content is provided by the school.`,
  };
}

export default function useLeadershipMessages() {
  const [records, setRecords] = useState(FALLBACK_LEADERSHIP);
  const [status, setStatus] = useState('loading'); // loading | ready | empty | fallback

  useEffect(() => {
    let cancelled = false;

    getPublicLeadershipMessages()
      .then((data) => {
        if (cancelled) return;
        if (!Array.isArray(data) || data.length === 0) {
          // API OK but nothing published — keep the pending placeholders
          setStatus('empty');
          return;
        }
        setRecords(data.map(mapRecord));
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.name !== 'AbortError') {
          // Development-only detail; never rendered to users
          console.warn('[Leadership] API unavailable, using placeholders:', err?.message);
        }
        setStatus('fallback');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { records, status };
}
