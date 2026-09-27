// ------------------------------------------------------------
// JSON-LD structured-data builders (Phase B.7)
//
// THE single structured-data implementation. Used by the client
// (runtime <script type="application/ld+json"> injection via
// usePageSeo) and by the SEO verification script (unit checks).
//
// CONSERVATIVE-BY-DESIGN (MASTER PLAN Step 9/10 rules):
//   - only properties backed by verified Site Settings / entity
//     data are emitted; placeholders ("[Phone Number]") and empty
//     values are treated as UNVERIFIED and omitted;
//   - no invented postal codes, geo coordinates, opening hours,
//     ratings, or social profiles;
//   - no internal database ids in the output.
//
// Event schema: deliberately NOT implemented (Phase B.7 decision)
// — the news "Event Date:" line provides a date, but no verified
// venue/location data exists, and Event without location is not
// reliably rich-result eligible. Revisit when venue data exists.
//
// BreadcrumbList: deliberately NOT implemented — no breadcrumb UI
// exists in the current routes (schema must mirror visible UI).
// ------------------------------------------------------------

/** A value is "verified" when it is a non-empty string and not a
 *  bracketed placeholder like "[Phone Number]". */
function isVerifiedText(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed === '') return false;
  if (/^\[.*\]$/.test(trimmed)) return false; // '[Email Address]' style placeholders
  return true;
}

/** Absolute-ize a site-relative image path (omit when impossible). */
function absoluteImage(image, siteUrl) {
  if (typeof image !== 'string' || image.trim() === '') return undefined;
  const trimmed = image.trim();
  if (/^https:\/\//i.test(trimmed) || /^http:\/\//i.test(trimmed)) return trimmed;
  if (siteUrl && trimmed.startsWith('/')) return `${siteUrl}${trimmed}`;
  return undefined; // relative path without a known origin → omit
}

/**
 * EducationalOrganization from verified identity/settings values.
 * Only caller-supplied verified values reach the output.
 */
export function buildOrganizationSchema({ identity, branding, contact, social, location, siteUrl }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: identity?.name,
  };
  if (siteUrl) data.url = siteUrl;
  const logo = absoluteImage(branding?.ogImage, siteUrl);
  if (logo) data.logo = logo;
  if (isVerifiedText(identity?.description)) data.description = identity.description.trim();
  if (isVerifiedText(location?.address)) {
    data.address = { '@type': 'PostalAddress', streetAddress: location.address.trim() };
  }
  if (isVerifiedText(contact?.phone)) data.telephone = contact.phone.trim();
  const sameAs = [social?.facebook, social?.youtube, social?.instagram, social?.linkedin]
    .filter((url) => isVerifiedText(url) && /^https:\/\//i.test(url.trim()));
  if (sameAs.length > 0) data.sameAs = sameAs;
  return data;
}

/** WebSite node (name + optional url). */
export function buildWebSiteSchema({ name, siteUrl }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name,
  };
  if (siteUrl) data.url = siteUrl;
  return data;
}

/**
 * NewsArticle for ONE published item (client already has it from
 * the published-only detail endpoint; the server can never hand
 * out DRAFT/ARCHIVED rows here). Uses only public entity fields.
 */
export function buildNewsArticleSchema({ item, organizationName, siteUrl }) {
  if (!item || !isVerifiedText(item.title)) return null;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: String(item.title).trim(),
  };
  if (isVerifiedText(item.excerpt)) data.description = item.excerpt.trim();
  const image = absoluteImage(item.image, siteUrl);
  if (image) data.image = [image];
  if (item.published_at) data.datePublished = item.published_at;
  if (item.updated_at) data.dateModified = item.updated_at;
  if (siteUrl && isVerifiedText(item.slug)) {
    data.mainEntityOfPage = `${siteUrl}/news/${encodeURIComponent(item.slug)}`;
  }
  if (isVerifiedText(organizationName)) {
    data.publisher = { '@type': 'Organization', name: organizationName.trim() };
  }
  return data;
}

/**
 * Serialize a JSON-LD object for inline <script> embedding.
 * Escapes "<" so admin-controlled strings (titles, excerpts)
 * cannot close the script tag from inside the payload.
 */
export function toJsonLdScriptContent(schemaObject) {
  if (!schemaObject) return null;
  return JSON.stringify(schemaObject).replace(/</g, '\\u003c');
}
