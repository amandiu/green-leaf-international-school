// ------------------------------------------------------------
// Page section content validation (Phase B + B.3)
//
// Pure format/shape validation — no database access. Defines the
// ALLOWED pages/section keys and each section's exact content
// schema. Unknown pages, sections and fields are REJECTED (never
// silently accepted), matching the Phase A validation style.
//
//   PUT /api/admin/pages/:page/sections/:key
//
// Image fields accept site-relative paths or http(s) URLs only
// (same asset rule as Phase A branding). Template tokens
// ({{identity.*}}, {{social.*}}) are the sanctioned way to keep
// following Site Settings. Database writes are parameterized in
// the model — client input never reaches SQL text.
//
// Phase B.3: the same per-section schema registry now covers the
// 'about' | 'academics' | 'campus' page identifiers alongside
// 'home'. Home schemas are UNCHANGED (byte-for-byte behaviour).
// ------------------------------------------------------------

import { badRequest } from '../utils/errors.js';

/** Pages with a validated section schema (home + Phase B.3 pages). */
export const SECTION_PAGES = Object.freeze(['home', 'about', 'academics', 'campus']);

/** Allowed home section keys. */
export const HOME_SECTIONS = Object.freeze([
  'hero',
  'newsPreview',
  'lifeAtSchool',
  'videoShowcase',
  'admissionsCta',
]);

/** Allowed about page section keys (Phase B.3). */
export const ABOUT_SECTIONS = Object.freeze([
  'intro',
  'coreValues',
  'visionMission',
]);

/** Allowed academics page section keys (Phase B.3). */
export const ACADEMICS_SECTIONS = Object.freeze([
  'overview',
  'programs',
  'environment',
  'academicsCta',
]);

/** Allowed campus page section keys (Phase B.3). */
export const CAMPUS_SECTIONS = Object.freeze([
  'overview',
  'facilities',
  'galleryHighlight',
]);

/** Sensible array limits. */
const LIMITS = Object.freeze({
  heroSlides: 10,
  lifeImages: 12,
  videoSlides: 12,
  newsItems: 12,
  metadata: 6,
  // Phase B.3: informational card lists + rich text blocks.
  values: 8,
  programs: 8,
  environmentItems: 8,
  facilities: 12,
  paragraphs: 2,
});

const STRING_MAX = 500;
const DESCRIPTION_MAX = 1000;
const HEADLINE_MAX = 200;
const METADATA_MAX = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTTP_URL_RE = /^https?:\/\/[^\s]+$/i;
const ASSET_RE = /^(\/[A-Za-z0-9\-._~!$&'()*+,;=:@%\/ ]+|https?:\/\/[^\s]+)$/i;
/** Sanctioned template tokens resolved from Site Settings at render time. */
const TOKEN_RE = /^\{\{(identity\.(name|shortName)|social\.youtube)\}\}$/;
const INTERNAL_LINK_RE = /^\/[A-Za-z0-9\-._~\/]*$/;

function requireString(value, label, max = STRING_MAX) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw badRequest(`${label} must be a non-empty string`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw badRequest(`${label} must be at most ${max} characters`);
  }
  return trimmed;
}

/** Optional string: '' → null is NOT used here — sections keep
 *  the current shape, so optional fields default to ''. */
function optionalString(value, label, max = STRING_MAX) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw badRequest(`${label} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw badRequest(`${label} must be at most ${max} characters`);
  }
  return trimmed;
}

/** Asset path/URL, or a sanctioned template token. Empty → ''. */
function optionalAsset(value, label) {
  const str = optionalString(value, label, STRING_MAX);
  if (str === '') return '';
  if (TOKEN_RE.test(str) || ASSET_RE.test(str)) return str;
  throw badRequest(
    `${label} must be a site-relative path starting with "/", an http(s) URL, or a {{settings}} token`,
  );
}

/** http(s) URL or a sanctioned template token. Empty → ''. */
function optionalUrl(value, label) {
  const str = optionalString(value, label, STRING_MAX);
  if (str === '') return '';
  if (TOKEN_RE.test(str) || HTTP_URL_RE.test(str)) return str;
  throw badRequest(`${label} must be a valid http(s) URL or a {{settings}} token`);
}

/** Internal route (/about) or absolute http(s) URL. Empty → ''. */
function optionalLink(value, label) {
  const str = optionalString(value, label, STRING_MAX);
  if (str === '') return '';
  if (INTERNAL_LINK_RE.test(str) || HTTP_URL_RE.test(str) || str === '#') return str;
  throw badRequest(`${label} must be an internal path starting with "/" or an http(s) URL`);
}

function requireButton(value, label) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw badRequest(`${label} must be an object`);
  }
  const unknown = Object.keys(value).filter((k) => !['text', 'link'].includes(k));
  if (unknown.length > 0) {
    throw badRequest(`Unknown field "${label}.${unknown[0]}"`);
  }
  return {
    text: requireString(value.text ?? '', `${label}.text`, 100),
    link: optionalLink(value.link ?? '', `${label}.link`),
  };
}

function requireStringArray(value, label, maxItems, maxLen) {
  if (!Array.isArray(value)) {
    throw badRequest(`${label} must be an array`);
  }
  if (value.length > maxItems) {
    throw badRequest(`${label} must contain at most ${maxItems} items`);
  }
  return value.map((item, i) => requireString(item, `${label}[${i}]`, maxLen));
}

function requireBoolean(value, label) {
  if (typeof value !== 'boolean') throw badRequest(`${label} must be a boolean`);
  return value;
}

/** hero slides: [{ src, alt }] — src required (asset/token), alt required. */
function validateHeroSlides(value) {
  if (!Array.isArray(value)) throw badRequest('hero.slides must be an array');
  if (value.length === 0) throw badRequest('hero.slides must contain at least 1 slide');
  if (value.length > LIMITS.heroSlides) {
    throw badRequest(`hero.slides must contain at most ${LIMITS.heroSlides} slides`);
  }
  return value.map((slide, i) => {
    if (typeof slide !== 'object' || slide === null || Array.isArray(slide)) {
      throw badRequest(`hero.slides[${i}] must be an object`);
    }
    const unknown = Object.keys(slide).filter((k) => !['src', 'alt'].includes(k));
    if (unknown.length > 0) {
      throw badRequest(`Unknown field "hero.slides[${i}].${unknown[0]}"`);
    }
    return {
      src: optionalAsset(slide.src ?? '', `hero.slides[${i}].src`),
      alt: requireString(slide.alt ?? '', `hero.slides[${i}].alt`, STRING_MAX),
    };
  });
}

/** life images: [{ src, alt }] (current grid uses 5 images). */
function validateLifeImages(value) {
  if (!Array.isArray(value)) throw badRequest('lifeAtSchool.images must be an array');
  if (value.length === 0) throw badRequest('lifeAtSchool.images must contain at least 1 image');
  if (value.length > LIMITS.lifeImages) {
    throw badRequest(`lifeAtSchool.images must contain at most ${LIMITS.lifeImages} images`);
  }
  return value.map((img, i) => {
    if (typeof img !== 'object' || img === null || Array.isArray(img)) {
      throw badRequest(`lifeAtSchool.images[${i}] must be an object`);
    }
    const unknown = Object.keys(img).filter((k) => !['src', 'alt'].includes(k));
    if (unknown.length > 0) {
      throw badRequest(`Unknown field "lifeAtSchool.images[${i}].${unknown[0]}"`);
    }
    return {
      src: optionalAsset(img.src ?? '', `lifeAtSchool.images[${i}].src`),
      alt: requireString(img.alt ?? '', `lifeAtSchool.images[${i}].alt`, STRING_MAX),
    };
  });
}

/** video slides: [{ eyebrow, title, description, videoUrl, thumbnail, metadata, buttonText }] */
function validateVideoSlides(value) {
  if (!Array.isArray(value)) throw badRequest('videoShowcase.slides must be an array');
  if (value.length === 0) throw badRequest('videoShowcase.slides must contain at least 1 slide');
  if (value.length > LIMITS.videoSlides) {
    throw badRequest(`videoShowcase.slides must contain at most ${LIMITS.videoSlides} slides`);
  }
  const FIELDS = ['eyebrow', 'title', 'description', 'videoUrl', 'thumbnail', 'metadata', 'buttonText'];
  return value.map((slide, i) => {
    if (typeof slide !== 'object' || slide === null || Array.isArray(slide)) {
      throw badRequest(`videoShowcase.slides[${i}] must be an object`);
    }
    const unknown = Object.keys(slide).filter((k) => !FIELDS.includes(k));
    if (unknown.length > 0) {
      throw badRequest(`Unknown field "videoShowcase.slides[${i}].${unknown[0]}"`);
    }
    return {
      eyebrow: optionalString(slide.eyebrow ?? '', `videoShowcase.slides[${i}].eyebrow`, 100),
      title: requireString(slide.title ?? '', `videoShowcase.slides[${i}].title`, HEADLINE_MAX),
      description: optionalString(slide.description ?? '', `videoShowcase.slides[${i}].description`, DESCRIPTION_MAX),
      videoUrl: optionalUrl(slide.videoUrl ?? '', `videoShowcase.slides[${i}].videoUrl`),
      thumbnail: optionalAsset(slide.thumbnail ?? '', `videoShowcase.slides[${i}].thumbnail`),
      metadata: slide.metadata === undefined
        ? []
        : requireStringArray(slide.metadata, `videoShowcase.slides[${i}].metadata`, LIMITS.metadata, METADATA_MAX),
      buttonText: requireString(slide.buttonText ?? '', `videoShowcase.slides[${i}].buttonText`, 100),
    };
  });
}

/**
 * newsPreview: heading/description only. Phase E RETIRED the
 * legacy copied `items` array (the central news_items table now
 * owns every item). Legacy `items`/`category`/`date`/`color`
 * fields are silently STRIPPED — never re-persisted (lazy clean
 * up on the section's next admin save), never merged into item
 * sources. The news API is the only item source.
 */
function validateNewsPreview(value) {
  return {
    eyebrow: optionalString(value.eyebrow ?? '', 'newsPreview.eyebrow', 100),
    title: requireString(value.title ?? '', 'newsPreview.title', HEADLINE_MAX),
    description: optionalString(value.description ?? '', 'newsPreview.description', DESCRIPTION_MAX),
  };
}

// ═══════════════════════════════════════════════════════════════
// Phase B.3 — about / academics / campus section schemas
// (reusable card validators shared by the informational pages)
// ═══════════════════════════════════════════════════════════════

/** About intro / Academics overview / Campus overview band. */
function validateOverviewBand(value, page) {
  const clean = {
    eyebrow: optionalString(value.eyebrow ?? '', `${page}.eyebrow`, 100),
    title: requireString(value.title ?? '', `${page}.title`, HEADLINE_MAX),
    paragraph1: requireString(value.paragraph1 ?? '', `${page}.paragraph1`, DESCRIPTION_MAX),
    paragraph2: optionalString(value.paragraph2 ?? '', `${page}.paragraph2`, DESCRIPTION_MAX),
    image: optionalAsset(value.image ?? '', `${page}.image`),
    imageAlt: optionalString(value.imageAlt ?? '', `${page}.imageAlt`, STRING_MAX),
  };
  clean.isActive = requireBoolean(value.isActive ?? true, `${page}.isActive`);
  return clean;
}

/** Icon-card arrays: [{ title, description, icon }] — values,
 *  environment items and facilities share it. `extraFields`
 *  adds optional per-page fields (e.g. 'subtitle' for academics
 *  program cards' grades line). */
function validateIconCards(value, label, maxItems, extraFields = []) {
  if (!Array.isArray(value)) throw badRequest(`${label} must be an array`);
  if (value.length === 0) throw badRequest(`${label} must contain at least 1 item`);
  if (value.length > maxItems) {
    throw badRequest(`${label} must contain at most ${maxItems} items`);
  }
  const FIELDS = ['title', 'description', 'icon', ...extraFields];
  return value.map((item, i) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw badRequest(`${label}[${i}] must be an object`);
    }
    const unknown = Object.keys(item).filter((k) => !FIELDS.includes(k));
    if (unknown.length > 0) {
      throw badRequest(`Unknown field "${label}[${i}].${unknown[0]}"`);
    }
    const clean = {
      title: requireString(item.title ?? '', `${label}[${i}].title`, HEADLINE_MAX),
      description: optionalString(item.description ?? '', `${label}[${i}].description`, DESCRIPTION_MAX),
      icon: optionalString(item.icon ?? '', `${label}[${i}].icon`, 8),
    };
    if (extraFields.includes('subtitle')) {
      clean.subtitle = optionalString(item.subtitle ?? '', `${label}[${i}].subtitle`, STRING_MAX);
    }
    return clean;
  });
}

/**
 * Validate + normalize one page section payload.
 * sectionKey must already be a known key for the given page; the
 * payload must be the section's content object. Unknown fields
 * are rejected.
 */
export function validatePageSection(page, sectionKey, input) {
  if (!SECTION_PAGES.includes(page)) {
    throw badRequest(`Unknown page "${page}"`);
  }
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw badRequest('Section content must be a JSON object');
  }

  // Home keeps its exact Phase B schema.
  if (page === 'home') return validateHomeSection(sectionKey, input);

  // Per-section top-level fields — unknown fields are rejected
  // outright (never silently ignored).
  const SECTION_FIELDS = {
    about: {
      intro: ['eyebrow', 'title', 'paragraph1', 'paragraph2', 'image', 'imageAlt', 'isActive'],
      coreValues: ['eyebrow', 'title', 'description', 'values', 'isActive'],
      visionMission: ['vision', 'mission', 'isActive'],
    },
    academics: {
      overview: ['eyebrow', 'title', 'paragraph1', 'paragraph2', 'image', 'imageAlt', 'isActive'],
      programs: ['eyebrow', 'title', 'description', 'programs', 'isActive'],
      environment: ['eyebrow', 'title', 'description', 'items', 'isActive'],
      academicsCta: ['title', 'description', 'buttonText', 'buttonLink', 'isActive'],
    },
    campus: {
      overview: ['eyebrow', 'title', 'paragraph1', 'paragraph2', 'image', 'imageAlt', 'isActive'],
      facilities: ['eyebrow', 'title', 'description', 'facilities', 'isActive'],
      galleryHighlight: ['eyebrow', 'title', 'description', 'isActive'],
    },
  };
  const allowed = SECTION_FIELDS[page][sectionKey];
  if (!allowed) {
    throw badRequest(`Unknown section "${sectionKey}"`);
  }
  const unknown = Object.keys(input).filter((k) => !allowed.includes(k));
  if (unknown.length > 0) {
    throw badRequest(`Unknown field "${unknown[0]}"`);
  }

  switch (page) {
    case 'about':
      switch (sectionKey) {
        case 'intro':
          return validateOverviewBand(input, 'intro');
        case 'coreValues': {
          const clean = {
            eyebrow: optionalString(input.eyebrow ?? '', 'coreValues.eyebrow', 100),
            title: requireString(input.title ?? '', 'coreValues.title', HEADLINE_MAX),
            description: optionalString(input.description ?? '', 'coreValues.description', DESCRIPTION_MAX),
            values: validateIconCards(input.values ?? [], 'coreValues.values', LIMITS.values),
          };
          clean.isActive = requireBoolean(input.isActive ?? true, 'coreValues.isActive');
          return clean;
        }
        case 'visionMission': {
          const clean = {
            vision: requireString(input.vision ?? '', 'visionMission.vision', DESCRIPTION_MAX),
            mission: requireString(input.mission ?? '', 'visionMission.mission', DESCRIPTION_MAX),
          };
          clean.isActive = requireBoolean(input.isActive ?? true, 'visionMission.isActive');
          return clean;
        }
        default:
          throw badRequest(`Unknown section "${sectionKey}"`);
      }

    case 'academics':
      switch (sectionKey) {
        case 'overview':
          return validateOverviewBand(input, 'overview');
        case 'programs': {
          const clean = {
            eyebrow: optionalString(input.eyebrow ?? '', 'programs.eyebrow', 100),
            title: requireString(input.title ?? '', 'programs.title', HEADLINE_MAX),
            description: optionalString(input.description ?? '', 'programs.description', DESCRIPTION_MAX),
            programs: validateIconCards(input.programs ?? [], 'programs.programs', LIMITS.programs, ['subtitle']),
          };
          clean.isActive = requireBoolean(input.isActive ?? true, 'programs.isActive');
          return clean;
        }
        case 'environment': {
          const clean = {
            eyebrow: optionalString(input.eyebrow ?? '', 'environment.eyebrow', 100),
            title: requireString(input.title ?? '', 'environment.title', HEADLINE_MAX),
            description: optionalString(input.description ?? '', 'environment.description', DESCRIPTION_MAX),
            items: validateIconCards(input.items ?? [], 'environment.items', LIMITS.environmentItems),
          };
          clean.isActive = requireBoolean(input.isActive ?? true, 'environment.isActive');
          return clean;
        }
        case 'academicsCta': {
          const clean = {
            title: requireString(input.title ?? '', 'academicsCta.title', HEADLINE_MAX),
            description: optionalString(input.description ?? '', 'academicsCta.description', DESCRIPTION_MAX),
            buttonText: requireString(input.buttonText ?? '', 'academicsCta.buttonText', 100),
            buttonLink: optionalLink(input.buttonLink ?? '', 'academicsCta.buttonLink'),
          };
          clean.isActive = requireBoolean(input.isActive ?? true, 'academicsCta.isActive');
          return clean;
        }
        default:
          throw badRequest(`Unknown section "${sectionKey}"`);
      }

    case 'campus':
      switch (sectionKey) {
        case 'overview':
          return validateOverviewBand(input, 'overview');
        case 'facilities': {
          const clean = {
            eyebrow: optionalString(input.eyebrow ?? '', 'facilities.eyebrow', 100),
            title: requireString(input.title ?? '', 'facilities.title', HEADLINE_MAX),
            description: optionalString(input.description ?? '', 'facilities.description', DESCRIPTION_MAX),
            facilities: validateIconCards(input.facilities ?? [], 'facilities.facilities', LIMITS.facilities),
          };
          clean.isActive = requireBoolean(input.isActive ?? true, 'facilities.isActive');
          return clean;
        }
        case 'galleryHighlight': {
          const clean = {
            eyebrow: optionalString(input.eyebrow ?? '', 'galleryHighlight.eyebrow', 100),
            title: requireString(input.title ?? '', 'galleryHighlight.title', HEADLINE_MAX),
            description: optionalString(input.description ?? '', 'galleryHighlight.description', DESCRIPTION_MAX),
          };
          clean.isActive = requireBoolean(input.isActive ?? true, 'galleryHighlight.isActive');
          return clean;
        }
        default:
          throw badRequest(`Unknown section "${sectionKey}"`);
      }

    default:
      // Unknown pages never reach here (SECTION_PAGES guard above
      // + route allow-list checks first) — defensive guard only.
      throw badRequest(`Unknown page "${page}"`);
  }
}

/**
 * Back-compat export: the original Phase B home-only validator
 * signature. All existing callers (service, tests) keep working.
 */
export function validateHomeSection(sectionKey, input) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw badRequest('Section content must be a JSON object');
  }
  // Per-section top-level fields — unknown fields are rejected
  // outright (never silently ignored).
  const SECTION_FIELDS = {
    hero: ['eyebrow', 'headline', 'subtext', 'primaryButton', 'secondaryButton', 'slides', 'isActive'],
    // Phase E: legacy 'items' is accepted on the wire but stripped
    // by validateNewsPreview — it is never re-persisted.
    newsPreview: ['eyebrow', 'title', 'description', 'items', 'category', 'date', 'color', 'isActive'],
    lifeAtSchool: ['eyebrow', 'title', 'description', 'images', 'isActive'],
    videoShowcase: ['eyebrow', 'title', 'description', 'slides', 'isActive'],
    admissionsCta: ['eyebrow', 'title', 'description', 'primaryButton', 'secondaryButton', 'isActive'],
  };
  const allowed = SECTION_FIELDS[sectionKey];
  if (!allowed) {
    throw badRequest(`Unknown section "${sectionKey}"`);
  }
  const unknown = Object.keys(input).filter((k) => !allowed.includes(k));
  if (unknown.length > 0) {
    throw badRequest(`Unknown field "${unknown[0]}"`);
  }

  switch (sectionKey) {
    case 'hero': {
      const clean = {
        eyebrow: optionalString(input.eyebrow ?? '', 'hero.eyebrow', 100),
        headline: requireString(input.headline ?? '', 'hero.headline', HEADLINE_MAX),
        subtext: optionalString(input.subtext ?? '', 'hero.subtext', DESCRIPTION_MAX),
        primaryButton: requireButton(input.primaryButton ?? {}, 'hero.primaryButton'),
        secondaryButton: requireButton(input.secondaryButton ?? {}, 'hero.secondaryButton'),
        slides: validateHeroSlides(input.slides ?? []),
      };
      clean.isActive = requireBoolean(input.isActive ?? true, 'hero.isActive');
      return clean;
    }
    case 'newsPreview': {
      const clean = validateNewsPreview(input);
      clean.isActive = requireBoolean(input.isActive ?? true, 'newsPreview.isActive');
      return clean;
    }
    case 'lifeAtSchool': {
      const clean = {
        eyebrow: optionalString(input.eyebrow ?? '', 'lifeAtSchool.eyebrow', 100),
        title: requireString(input.title ?? '', 'lifeAtSchool.title', HEADLINE_MAX),
        description: optionalString(input.description ?? '', 'lifeAtSchool.description', DESCRIPTION_MAX),
        images: validateLifeImages(input.images ?? []),
      };
      clean.isActive = requireBoolean(input.isActive ?? true, 'lifeAtSchool.isActive');
      return clean;
    }
    case 'videoShowcase': {
      const clean = {
        eyebrow: optionalString(input.eyebrow ?? '', 'videoShowcase.eyebrow', 100),
        title: optionalString(input.title ?? '', 'videoShowcase.title', HEADLINE_MAX),
        description: optionalString(input.description ?? '', 'videoShowcase.description', DESCRIPTION_MAX),
        slides: validateVideoSlides(input.slides ?? []),
      };
      clean.isActive = requireBoolean(input.isActive ?? true, 'videoShowcase.isActive');
      return clean;
    }
    case 'admissionsCta': {
      const clean = {
        eyebrow: optionalString(input.eyebrow ?? '', 'admissionsCta.eyebrow', 100),
        title: requireString(input.title ?? '', 'admissionsCta.title', HEADLINE_MAX),
        description: optionalString(input.description ?? '', 'admissionsCta.description', DESCRIPTION_MAX),
        primaryButton: requireButton(input.primaryButton ?? {}, 'admissionsCta.primaryButton'),
        secondaryButton: requireButton(input.secondaryButton ?? {}, 'admissionsCta.secondaryButton'),
      };
      clean.isActive = requireBoolean(input.isActive ?? true, 'admissionsCta.isActive');
      return clean;
    }
    default:
      // Unknown section keys never reach here (route allow-list
      // checks first) — defensive guard only.
      throw badRequest(`Unknown section "${sectionKey}"`);
  }
}
