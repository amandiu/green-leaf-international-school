// ═══════════════════════════════════════════════════════════════
// HOME PAGE CONTENT — Phase B fallback + seed source
// ═══════════════════════════════════════════════════════════════
//
// The exact content extracted from the existing Home.jsx at the
// time of the Phase B audit. This file is the SINGLE source for:
//
//   1. server/sql/seeds/004_home_sections.sql  (initial DB values)
//   2. client HomeContentProvider               (fallback constants)
//
// DB values override these; any missing section/field/failed API
// request falls back to these values so the Homepage always
// renders exactly as it does today. NO new content is invented —
// every string below is the current live value.
//
// Note: `{{identity.name}}` / `{{identity.shortName}}` /
// `{{social.youtube}}` placeholders stand for values that Home.jsx
// currently derives from Site Settings (identity.name /
// identity.shortName / social.youtube) at render time. The API
// seeds store these same template strings, and the frontend
// resolver substitutes them with the EFFECTIVE site settings at
// render time (see client/src/content/homeContentResolver.jsx),
// so fields that follow Site Settings today keep doing so.
// ═══════════════════════════════════════════════════════════════

export const HOME_SECTION_KEYS = Object.freeze([
  'hero',
  'newsPreview',
  'lifeAtSchool',
  'videoShowcase',
  'admissionsCta',
]);

/**
 * Phase D: the admissions CTA is a REUSABLE content block
 * (content_blocks key `admissions-primary-cta`). The home
 * 'admissionsCta' section stores a REFERENCE (not a copy):
 *   { __block: 'admissions-primary-cta', isActive: true }
 * The section renderer resolves the block + renders the home
 * pair of actions (ids: info, contact-page).
 */
export const HOME_ADMISSIONS_CTA_BLOCK_KEY = 'admissions-primary-cta';

/** The reference shape stored in page_sections for admissionsCta. */
export const DEFAULT_HOME_ADMISSIONS_CTA = {
  __block: 'admissions-primary-cta',
  isActive: true,
};

/** The homepage's action ids from the shared CTA block. */
export const HOME_ADMISSIONS_CTA_ACTION_IDS = ['info', 'contact-page'];

/** Hero slides — current images/alts; headline/subtext/CTAs are
 *  one set shared by the whole hero (current design). */
export const DEFAULT_HOME_HERO = {
  eyebrow: '',
  headline: 'Excellence in |Knowledge & Character',
  subtext:
    'A place where knowledge grows, character develops, and students prepare for a successful future.',
  primaryButton: { text: 'Explore Our School', link: '/about' },
  secondaryButton: { text: 'Admissions', link: '/admissions' },
  slides: [
    {
      src: '/Hero Section/hero 1.jpg',
      alt: '{{identity.name}} Campus',
    },
    {
      src: '/Hero Section/hero 2.jpg',
      alt: '{{identity.shortName}} Students',
    },
    {
      src: '/Hero Section/hero 3.jpg',
      alt: '{{identity.shortName}} Activities',
    },
  ],
  isActive: true,
};

/** News preview — heading/settings only. Phase E: the preview
 *  items come exclusively from the central news table via the
 *  news API (NewsProvider); this fallback intentionally has no
 *  item list, so nothing can be duplicated here. */
export const DEFAULT_HOME_NEWS_PREVIEW = {
  eyebrow: 'Recent Updates',
  title: 'Recent News & Notices',
  description:
    'Stay updated with the latest news, notices, events, and announcements from {{identity.shortName}}.',
  isActive: true,
};

/** Life at School — section copy + the 5 current grid images
 *  (image 0 renders as the large 2x2 tile, 1-4 as square tiles). */
export const DEFAULT_HOME_LIFE_AT_SCHOOL = {
  eyebrow: 'School Life',
  title: 'Life at {{identity.shortName}}',
  description:
    'A vibrant community where students learn, grow, and create lasting memories.',
  images: [
    {
      src: '/Activity/791074857_1519300476879129_5256173980750495448_n.jpg',
      alt: 'Students participating in school activities',
    },
    {
      src: '/Activity/733146204_1461550822654095_1531413830165513343_n.jpg',
      alt: 'School event on campus',
    },
    {
      src: '/Activity/745503622_1472778644864646_857229043481260756_n.jpg',
      alt: 'Students in classroom',
    },
    {
      src: '/Activity/798261940_1522758883199955_4596081823843794397_n.jpg',
      alt: 'Student life on campus',
    },
    {
      src: '/Activity/799202494_1523030196506157_181619563109164848_n.jpg',
      alt: 'School activities and celebrations',
    },
  ],
  isActive: true,
};

/** Video Showcase — the 5 current slides. videoUrl currently
 *  points at the Site Settings YouTube channel for every slide;
 *  the {{social.youtube}} token preserves that behaviour and the
 *  admin can replace it with a literal per-slide URL any time. */
export const DEFAULT_HOME_VIDEO_SHOWCASE = {
  eyebrow: '',
  title: '',
  description: '',
  slides: [
    {
      eyebrow: 'Campus Life',
      title: 'Life at {{identity.shortName}}',
      description:
        'Experience the vibrant campus life and activities at {{identity.name}}.',
      videoUrl: '{{social.youtube}}',
      thumbnail:
        '/Activity/796941384_1521802823295561_1039006011241713451_n.jpg',
      metadata: ['Campus', 'Student Life'],
      buttonText: 'Watch Video',
    },
    {
      eyebrow: 'Student Activities',
      title: 'Learning Beyond the Classroom',
      description:
        'Discover learning experiences, activities, and memorable moments from {{identity.name}}.',
      videoUrl: '{{social.youtube}}',
      thumbnail:
        '/Activity/791074857_1519300476879129_5256173980750495448_n.jpg',
      metadata: ['Activities', 'Learning'],
      buttonText: 'Watch Video',
    },
    {
      eyebrow: 'School Events',
      title: 'Moments That Matter',
      description:
        'Explore events and special moments from our school community at {{identity.name}}.',
      videoUrl: '{{social.youtube}}',
      thumbnail:
        '/Activity/733146204_1461550822654095_1531413830165513343_n.jpg',
      metadata: ['Events', 'Community'],
      buttonText: 'Watch Video',
    },
    {
      eyebrow: 'Student Life',
      title: 'Growing Together',
      description:
        'See how our students grow, learn, and thrive in a nurturing educational environment at {{identity.shortName}}.',
      videoUrl: '{{social.youtube}}',
      thumbnail:
        '/Activity/745503622_1472778644864646_857229043481260756_n.jpg',
      metadata: ['Growth', 'Education'],
      buttonText: 'Watch Video',
    },
    {
      eyebrow: 'Our Community',
      title: 'School Spirit in Action',
      description:
        'Witness the spirit, dedication, and joy that define the {{identity.name}} experience.',
      videoUrl: '{{social.youtube}}',
      thumbnail:
        '/Activity/798261940_1522758883199955_4596081823843794397_n.jpg',
      metadata: ['Spirit', 'Dedication'],
      buttonText: 'Watch Video',
    },
  ],
  isActive: true,
};

// Phase D: the admissions CTA content moved to the reusable block
// `admissions-primary-cta` (see shared/content/contentBlocks.js).
// The section stores only a reference — see the top of this file.

/**
 * The complete default content object for the home page, keyed by
 * section_key — the shape served by GET /api/pages/home when a
 * section is missing from the DB.
 */
export function defaultHomeContent() {
  return {
    hero: { ...DEFAULT_HOME_HERO },
    newsPreview: { ...DEFAULT_HOME_NEWS_PREVIEW },
    lifeAtSchool: { ...DEFAULT_HOME_LIFE_AT_SCHOOL },
    videoShowcase: { ...DEFAULT_HOME_VIDEO_SHOWCASE },
    admissionsCta: { ...DEFAULT_HOME_ADMISSIONS_CTA },
  };
}

export default defaultHomeContent;
