// ------------------------------------------------------------
// Site settings service (Phase A)
//
// THE single runtime merge point for effective site settings:
//
//   MySQL site_settings  (DB values win)
//   + siteConfig.js      (fallback for missing keys / DB down)
//   → effective settings object
//
// siteConfig.js is never deleted — it is the fallback + seed
// source. Only the groups/keys defined in settingsValidation are
// exposed; siteConfig extras (api.*, seo.adminTitle) are NOT
// admin-editable settings and are never returned.
//
// The public site keeps rendering from siteConfig when the
// database is unreachable (graceful degradation).
// ------------------------------------------------------------

import { findAll, upsertMany } from '../models/SiteSetting.js';
import {
  validateSettingsPayload,
  flattenSettings,
  SETTING_GROUPS,
} from '../validators/settingsValidation.js';
import { siteConfig } from '../../../shared/config/siteConfig.js';

export { SETTING_GROUPS };

/** Effective settings shape: grouped objects per setting group. */
function configFallback() {
  return {
    identity: { ...siteConfig.identity },
    branding: { ...siteConfig.branding },
    contact: { ...siteConfig.contact },
    social: { ...siteConfig.social },
    location: { ...siteConfig.location },
    seo: {
      title: siteConfig.seo.title,
      description: siteConfig.seo.description,
    },
  };
}

/** Parse a stored string back to its JS type (mapsZoom → number). */
function parseStoredValue(group, field, raw) {
  if (raw === null || raw === undefined) return null;
  if (group === 'location' && field === 'mapsZoom') {
    const zoom = Number(raw);
    return Number.isFinite(zoom) ? zoom : siteConfig.location.mapsZoom;
  }
  return raw;
}

/**
 * Effective settings: config fallback overlaid with DB values.
 * Throws only on unexpected errors — DB unavailability is handled
 * by the caller (getEffectiveSettings).
 *
 * Phase C: a legacy `contact.address` row (retired duplicate of
 * location.address) is never merged — the central location value
 * is the single source of truth for the school address.
 */
async function getEffectiveSettingsStrict() {
  const effective = configFallback();

  const rows = await findAll();
  for (const row of rows) {
    const dot = row.setting_key.indexOf('.');
    if (dot === -1) continue; // defensive: malformed key never crashes
    const group = row.setting_key.slice(0, dot);
    const field = row.setting_key.slice(dot + 1);
    if (group === 'contact' && field === 'address') continue; // retired duplicate
    if (!(group in effective)) continue; // unknown group in DB → ignore
    if (!(field in effective[group])) continue; // unknown field → ignore
    effective[group][field] = parseStoredValue(group, field, row.setting_value);
  }

  return effective;
}

/**
 * Public/admin read. Never throws for DB downtime: on database
 * failure the pure siteConfig fallback is served so the public
 * website keeps working.
 */
export async function getEffectiveSettings() {
  try {
    return await getEffectiveSettingsStrict();
  } catch (err) {
    console.error('Site settings: database unavailable, using siteConfig fallback:', err.message);
    return configFallback();
  }
}

/** Update settings from an already-validated payload. */
export async function updateSettings(input) {
  const grouped = validateSettingsPayload(input);
  const rows = flattenSettings(grouped);
  await upsertMany(rows);
  // Return the effective view so the admin UI shows merged truth.
  return getEffectiveSettingsStrict();
}
