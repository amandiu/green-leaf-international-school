// ═══════════════════════════════════════════════════════════════
// ABOUT PAGE CONTENT — Phase B.3 fallback + first-save source
// ═══════════════════════════════════════════════════════════════
//
// The exact content extracted from the existing About.jsx at the
// time of the Phase B.3 audit. Mirrors the homeContent.js pattern:
//
//   1. client About page      → fallback constants (no seed —
//      rows are created on the first admin save, exactly how the
//      service treats any missing home section)
//   2. server pageSectionService → per-section fallback merge
//
// DB values override these; any missing section/field/failed API
// request falls back to these values so the About page always
// renders exactly as it does today. NO new content is invented —
// every string below is the current live value (placeholder
// copy included verbatim).
//
// SOURCE-OF-TRUTH NOTES (do not duplicate other CMS data here):
//   • Head/teacher messages stay in leadership_messages (Phase 5
//     module) — this page does not embed them.
//   • School name references use {{identity.name}} /
//     {{identity.shortName}} tokens resolved from Site Settings
//     at render time — never copied here.
//   • Hero imagery/branding remains code-structure (visual shell).
// ═══════════════════════════════════════════════════════════════

export const ABOUT_SECTION_KEYS = Object.freeze([
  'intro',
  'coreValues',
  'visionMission',
]);

/** Introduction: "Our Story" band (heading + copy + image). */
export const DEFAULT_ABOUT_INTRO = {
  eyebrow: 'Our Story',
  title: 'A Tradition of Excellence',
  paragraph1:
    '[School introduction placeholder — Replace with verified school history and background information.]',
  paragraph2:
    '{{identity.name}} is dedicated to providing a nurturing environment where students can thrive academically, socially, and personally.',
  image: '/Activity/799142983_1523030073172836_1172060919875647706_n.jpg',
  imageAlt: '{{identity.name}} students and campus',
  isActive: true,
};

/** Core Values: heading + the 4 value cards. */
export const DEFAULT_ABOUT_CORE_VALUES = {
  eyebrow: 'Our Values',
  title: 'Core Values',
  description: 'The principles that guide everything we do at {{identity.shortName}}.',
  values: [
    { title: 'Excellence', description: 'We strive for the highest standards in everything we do.', icon: '⭐' },
    { title: 'Integrity', description: 'Honesty, transparency, and ethical conduct guide our actions.', icon: '🛡️' },
    { title: 'Innovation', description: 'Embracing new ideas and creative approaches to education.', icon: '💡' },
    { title: 'Respect', description: 'Fostering a culture of mutual respect and understanding.', icon: '🤝' },
  ],
  isActive: true,
};

/** Vision & Mission: the two statement cards. */
export const DEFAULT_ABOUT_VISION_MISSION = {
  vision:
    "[Vision statement placeholder — Replace with the school's verified vision statement.]",
  mission:
    "[Mission statement placeholder — Replace with the school's verified mission statement.]",
  isActive: true,
};

/**
 * The complete default content object for the about page, keyed by
 * section_key — the shape served by GET /api/pages/about when a
 * section is missing from the DB.
 */
export function defaultAboutContent() {
  return {
    intro: { ...DEFAULT_ABOUT_INTRO },
    coreValues: {
      ...DEFAULT_ABOUT_CORE_VALUES,
      values: DEFAULT_ABOUT_CORE_VALUES.values.map((v) => ({ ...v })),
    },
    visionMission: { ...DEFAULT_ABOUT_VISION_MISSION },
  };
}

export default defaultAboutContent;
