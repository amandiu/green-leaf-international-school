// ═══════════════════════════════════════════════════════════════
// MAPS URL BUILDER — the ONE place Google Maps URLs are built
// ═══════════════════════════════════════════════════════════════
//
// Phase C (central content): every map consumer — Homepage map,
// Contact map, any future map — renders from the EFFECTIVE site
// settings (site_settings.location.* with the siteConfig.js
// fallback) through this helper. No page keeps its own URL
// template, so a Maps Query change in the admin Content Center
// updates every consumer at once.
//
// Consumers:
//   shared/config/siteConfig.js  (config-level derived helpers)
//   client Home / Contact        (settings-driven map sections)
//   client Footer / future pages (directions / address display)
// ═══════════════════════════════════════════════════════════════

/** Default zoom used when settings.location.mapsZoom is unset/null. */
const DEFAULT_MAPS_ZOOM = 17;

/**
 * Build the Google Maps embed + directions URLs from a location
 * settings object ({ mapsQuery, mapsZoom }).
 *
 * Returns { embed, directions } — either value is `null` when
 * mapsQuery is unset, which is the sanctioned "hide the map /
 * disable the CTA" signal (branded placeholder instead).
 */
export function buildMapsUrls(location) {
  const query = typeof location?.mapsQuery === 'string' ? location.mapsQuery.trim() : '';
  if (!query) return { embed: null, directions: null };

  // The sanctioned query format uses '+' for spaces (see the admin
  // Content Center hint). Plain spaces are normalized to '+' so a
  // human-typed query works too; existing '+' values pass through
  // untouched (no encodeURIComponent — it would turn '+' into %2B
  // and break the search).
  const q = query.replace(/ /g, '+');
  const zoomNum = Number(location?.mapsZoom);
  const zoom = Number.isFinite(zoomNum) && zoomNum >= 1 && zoomNum <= 22 ? zoomNum : DEFAULT_MAPS_ZOOM;

  return {
    embed: `https://maps.google.com/maps?q=${q}&z=${zoom}&output=embed`,
    directions: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
  };
}

export default buildMapsUrls;
