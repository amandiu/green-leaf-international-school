// ------------------------------------------------------------
// DEPRECATED (Admin auth phase) — replaced by sessionAuth.js
//
// Kept as a thin re-export ONLY so that any forgotten import of
// the old path still resolves to the real session gate instead
// of silently bypassing authentication. Do not add new imports
// of this module; import middleware/sessionAuth.js directly.
// ------------------------------------------------------------

export { default } from './sessionAuth.js';
export { default as adminAuth } from './sessionAuth.js';
export { ADMIN_TOKEN_CONFIGURED } from '../utils/deprecatedAdminToken.js';
export { generateAdminToken } from '../utils/deprecatedAdminToken.js';
