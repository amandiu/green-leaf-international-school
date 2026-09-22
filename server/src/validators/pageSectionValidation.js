// ------------------------------------------------------------
// Home page section content validation (Phase B)
//
// Pure format/shape validation — no database access. Defines the
// ALLOWED pages/section keys and each section's exact content
// schema. Unknown pages, sections and fields are REJECTED (never
// silently accepted), matching the Phase A validation style.
//
//   PUT /api/admin/pages/home/sections/:key
//
// Image fields accept site-relative paths or http(s) URLs only
// (same asset rule as Phase A branding). Social/news strings are
// bounded; template tokens ({{identity.*}}, {{social.*}}) are the
// sanctioned way to keep following Site Settings. Database
// writes are parameterized in the model — client input never
// reaches SQL text.
// ------------------------------------------------------------

import { badRequest } from '../utils/errors.js';

/** Pages with a validated section schema (Phase B: home only). */
export const SECTION_PAGES = Object.freeze(['home']);

/** Allowed home section keys. */
export const HOME_SECTIONS = Object.freeze([
  'hero',
  'newsPreview',
  'lifeAtSchool',
  'videoShowcase',
  'admissionsCta',
]);

/** Sensible array limits. */
const LIMITS = Object.freeze({
  heroSlides: 10,
  lifeImages: 12,
  videoSlides: 12,
  newsItems: 12,
  metadata: 6,
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
const INTERNAL_LINK_RE = /^\/[A-Za-z0-9\-._~/]*$/;

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

/**
 * Validate + normalize one home section payload.
 * sectionKey must already be a known key; the payload must be the
 * section's content object. Unknown fields are rejected.
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
