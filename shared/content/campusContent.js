// ═══════════════════════════════════════════════════════════════
// CAMPUS PAGE CONTENT — Phase B.3 fallback + first-save source
// ═════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
//
// The exact content extracted from the existing Campus.jsx at the
// time of the Phase B.3 audit. Mirrors the homeContent.js
// pattern: client fallback constants + server per-section merge;
// rows are created on the first admin save (no seed).
//
// GALLERY INTEGRATION (Phase B.2 — DO NOT BREAK): the campus
// gallery GRID is DB-backed from gallery_items (published rows)
// with the page's FALLBACK_GALLERY_IMAGES. This module stores
// ONLY the gallery band's heading copy ('galleryHighlight') —
// gallery IMAGE data is NEVER copied into page_sections. One
// source of truth per item.
//
// SOURCE-OF-TRUTH NOTES:
//   • Gallery images/captions → gallery_items table ONLY.
//   • School name references use {{identity.name}} /
//     {{identity.shortName}} tokens — never copied here.
//   • Hero imagery/branding remains code-structure (visual shell).
// ═══════════════════════════════════════════════════════════════

export const CAMPUS_SECTION_KEYS = Object.freeze([
  'overview',
  'facilities',
  'galleryHighlight',
]);

/** Campus overview: "Our Space" band (heading + copy + image). */
export const DEFAULT_CAMPUS_OVERVIEW = {
  eyebrow: 'Our Space',
  title: 'A Campus Built for Learning',
  paragraph1:
    '[Campus description placeholder — Replace with verified information about the campus size, location, and notable features.]',
  paragraph2:
    'Our campus provides a safe, stimulating environment where students can explore their interests and develop their potential.',
  image: '/Hero Section/hero 2.jpg',
  imageAlt: '{{identity.name}} campus overview',
  isActive: true,
};

/** Facilities: heading + the 8 facility cards. */
export const DEFAULT_CAMPUS_FACILITIES = {
  eyebrow: 'Facilities',
  title: 'Our Facilities',
  description: 'World-class infrastructure to support holistic development.',
  facilities: [
    { title: 'Classrooms', description: 'Spacious, well-lit classrooms equipped with modern teaching aids.', icon: '🏫' },
    { title: 'Science Labs', description: 'Fully equipped laboratories for Physics, Chemistry, and Biology.', icon: '🔬' },
    { title: 'Computer Lab', description: 'Modern computer laboratory with high-speed internet access.', icon: '💻' },
    { title: 'Library', description: 'A well-stocked library with thousands of books and digital resources.', icon: '📚' },
    { title: 'Sports Ground', description: 'Large playground for cricket, football, basketball, and athletics.', icon: '⚽' },
    { title: 'Auditorium', description: 'Multi-purpose auditorium for events, assemblies, and performances.', icon: '🎭' },
    { title: 'Art Studio', description: 'Creative space for painting, sculpting, and other artistic activities.', icon: '🎨' },
    { title: 'Cafeteria', description: 'Hygienic cafeteria providing nutritious meals and snacks.', icon: '🍽️' },
  ],
  isActive: true,
};

/**
 * Gallery band heading copy ONLY. The grid below it is fed by the
 * gallery_items table (published items) with the page's verified
 * fallback images — this section deliberately has no image list.
 */
export const DEFAULT_CAMPUS_GALLERY_HIGHLIGHT = {
  eyebrow: 'Gallery',
  title: 'Campus Gallery',
  description: 'A glimpse into life at {{identity.name}}.',
  isActive: true,
};

/**
 * The complete default content object for the campus page, keyed
 * by section_key — the shape served by GET /api/pages/campus when
 * a section is missing from the DB.
 */
export function defaultCampusContent() {
  return {
    overview: { ...DEFAULT_CAMPUS_OVERVIEW },
    facilities: {
      ...DEFAULT_CAMPUS_FACILITIES,
      facilities: DEFAULT_CAMPUS_FACILITIES.facilities.map((f) => ({ ...f })),
    },
    galleryHighlight: { ...DEFAULT_CAMPUS_GALLERY_HIGHLIGHT },
  };
}

export default defaultCampusContent;
