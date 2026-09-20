// ------------------------------------------------------------
// useLeadership (Leadership database phase)
//
// Loads the combined public leadership payload ONCE per mount
// (no polling, no refetch loops) — same pattern as useNavigation.
//
// States:
//   loading  → serve the verified local placeholder data (the
//              current "pending" cells — never fake official info)
//   ready    → API section + messages mapped to the component's shape
//   empty    → API OK, no active messages → keep the placeholder
//              cells (existing project convention for this section)
//   fallback → API unavailable → keep the placeholder cells;
//              the site stays usable (detail only in console)
//   inactive → admin deactivated the section (hidden on homepage)
// ------------------------------------------------------------

import { useEffect, useState } from 'react';
import { getPublicLeadership } from '../services/leadershipService';
import { leadershipMessages as FALLBACK_LEADERSHIP } from '../data/leadershipMessages';

const SCHOOL = 'Green Leaf International School & College';

/** Verified local section copy, used while loading / on error. */
const FALLBACK_SECTION = {
  eyebrow: 'Leadership Message',
  title: 'Messages from Our Leadership',
  description:
    'Words of guidance and inspiration from the leaders of Green Leaf International School & College.',
};

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
    /* Admin-provided alt text wins; falls back to a role-based line
       only when a verified name exists; null otherwise (no false
       claims to assistive technology). */
    imageAlt:
      record.image_alt
      || (record.name ? `Portrait of ${record.name}, ${role} of ${SCHOOL}` : null),
    placeholderMessage:
      `The official ${role}'s message will be published here once verified content is provided by the school.`,
  };
}

export default function useLeadership() {
  const [section, setSection] = useState(FALLBACK_SECTION);
  const [records, setRecords] = useState(FALLBACK_LEADERSHIP);
  const [status, setStatus] = useState('loading'); // loading | ready | empty | fallback | inactive

  useEffect(() => {
    let cancelled = false;

    getPublicLeadership()
      .then((data) => {
        if (cancelled) return;
        if (data.section === null) {
          // Admin deactivated the whole section.
          setStatus('inactive');
          return;
        }
        setSection({
          eyebrow: data.section.eyebrow ?? FALLBACK_SECTION.eyebrow,
          title: data.section.title ?? FALLBACK_SECTION.title,
          description: data.section.description ?? FALLBACK_SECTION.description,
        });
        if (!Array.isArray(data.messages) || data.messages.length === 0) {
          // Section active but nothing published — keep placeholders
          setStatus('empty');
          return;
        }
        setRecords(data.messages.map(mapRecord));
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

  return { section, records, status };
}
