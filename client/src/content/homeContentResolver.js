// ------------------------------------------------------------
// Home content resolver (Phase B)
//
// Substitutes the sanctioned template tokens in DB-backed home
// content with the EFFECTIVE site settings at render time:
//
//   {{identity.name}}       → settings.identity.name
//   {{identity.shortName}}  → settings.identity.shortName
//   {{social.youtube}}      → settings.social.youtube
//
// This keeps fields that follow Site Settings today (hero image
// alt text naming, video channel links, inline school-name
// references) following Site Settings after the DB migration —
// no duplicated school-name/channel data inside Homepage CMS.
// Any other string passes through untouched.
// ------------------------------------------------------------

/**
 * Resolve `{{...}}` tokens in one string. Unknown/missing tokens
 * resolve to '' (matches the current "hide when unset" behaviour
 * for social links).
 */
function resolveString(value, tokens) {
  if (typeof value !== 'string') return value;
  return value.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const resolved = tokens[key];
    if (resolved === undefined || resolved === null) return '';
    return String(resolved);
  });
}

/** Recursively resolve tokens in strings/arrays/plain objects. */
export function resolveHomeContent(value, tokens) {
  if (typeof value === 'string') return resolveString(value, tokens);
  if (Array.isArray(value)) {
    return value.map((item) => resolveHomeContent(item, tokens));
  }
  if (typeof value === 'object' && value !== null) {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = resolveHomeContent(item, tokens);
    }
    return out;
  }
  return value;
}

/** Token map from the effective site settings. */
export function settingsTokens(settings) {
  if (!settings) return {};
  return {
    'identity.name': settings.identity?.name ?? '',
    'identity.shortName': settings.identity?.shortName ?? '',
    'social.youtube': settings.social?.youtube ?? '',
    // Phase D: contact/location tokens for reusable blocks —
    // settings values are referenced, never copied into blocks.
    'contact.admissionsEmail': settings.contact?.admissionsEmail ?? '',
    'contact.phone': settings.contact?.phone ?? '',
    'location.address': settings.location?.address ?? '',
  };
}

/**
 * Resolve `{{...}}` tokens in ONE string against the settings
 * token map (Phase D helper for reusable block fields).
 */
export function resolveTokenizedText(text, tokens) {
  if (typeof text !== 'string') return text;
  return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const resolved = tokens?.[key];
    if (resolved === undefined || resolved === null) return '';
    return String(resolved);
  });
}

export default resolveHomeContent;
