// ------------------------------------------------------------
// Navigation mapping (Phase 3.4)
//
// Pure mapping layer between the public navigation API and the
// Navbar. Defensive by design: a malformed record is skipped —
// never rendered as a broken link and never crashes the Navbar.
// ------------------------------------------------------------

/** Verified existing routes only — safe fallback when the API fails. */
export const FALLBACK_NAV_ITEMS = Object.freeze([
  { id: 'fb-home', label: 'Home', url: '/', kind: 'internal', openNewTab: false, children: [] },
  { id: 'fb-about', label: 'About', url: '/about', kind: 'internal', openNewTab: false, children: [] },
  { id: 'fb-academics', label: 'Academics', url: '/academics', kind: 'internal', openNewTab: false, children: [] },
  { id: 'fb-admissions', label: 'Admissions', url: '/admissions', kind: 'internal', openNewTab: false, children: [] },
  { id: 'fb-campus', label: 'Campus', url: '/campus', kind: 'internal', openNewTab: false, children: [] },
  { id: 'fb-news', label: 'News', url: '/news', kind: 'internal', openNewTab: false, children: [] },
  { id: 'fb-contact', label: 'Contact', url: '/contact', kind: 'internal', openNewTab: false, children: [] },
]);

/**
 * Map one API record to a Navbar-safe item.
 * Returns null for anything unusable (skipped by the caller).
 */
function mapItem(raw, depth = 0) {
  if (typeof raw !== 'object' || raw === null) return null;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title) return null;

  const url = typeof raw.url === 'string' ? raw.url.trim() : '';
  const type = typeof raw.type === 'string' ? raw.type : '';
  const openNewTab = raw.open_new_tab === true;

  let kind;
  if (type === 'EXTERNAL' && url) {
    kind = 'external'; // rendered as <a> with target per open_new_tab
  } else if (url) {
    kind = 'internal'; // INTERNAL routes, or DROPDOWN with a fallback URL
  } else if (type === 'DROPDOWN') {
    kind = 'label'; // parent without URL: non-interactive label, never "#"
  } else {
    return null; // INTERNAL/EXTERNAL without a URL would be a dead link
  }

  const children = depth === 0 && Array.isArray(raw.children)
    ? raw.children.map((c) => mapItem(c, depth + 1)).filter(Boolean)
    : [];

  return {
    id: typeof raw.id === 'number' || typeof raw.id === 'string' ? raw.id : title,
    label: title,
    url,
    kind,
    openNewTab,
    children,
  };
}

/** Map the API tree to Navbar items; falls back to an empty array. */
export function mapNavigationForNavbar(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map((item) => mapItem(item, 0))
    .filter(Boolean);
}
