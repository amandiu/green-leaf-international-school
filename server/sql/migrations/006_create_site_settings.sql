-- ============================================================
-- Green Leaf — Migration 006: Site settings (Phase A)
--
-- Admin-editable global site settings, ONE ROW PER SETTING
-- (no JSON blob):
--
--   setting_key    'identity.name', 'social.facebook', ...
--   setting_value  TEXT — string form; numbers stored as strings
--   setting_group  identity | branding | contact | social |
--                  location | seo
--
-- siteConfig.js remains the FALLBACK/seed source: when a key is
-- missing from this table (or the DB is unreachable) the API and
-- the public site fall back to the config values.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS (matches 002–005).
-- Additive: no existing table is modified.
-- ============================================================

CREATE TABLE IF NOT EXISTS `site_settings` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `setting_key`   VARCHAR(100) NOT NULL COMMENT 'Dotted key, e.g. identity.name (UNIQUE)',
  `setting_value` TEXT         NULL COMMENT 'String form of the value; NULL = unset (social links)',
  `setting_group` VARCHAR(50)  NOT NULL COMMENT 'identity | branding | contact | social | location | seo',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  -- One row per setting — case-insensitive uniqueness (utf8mb4_unicode_ci)
  UNIQUE KEY `uq_site_settings_key` (`setting_key`),

  -- Group listing (admin UI tabs, future bulk reads)
  KEY `idx_site_settings_group` (`setting_group`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Admin-editable global site settings (siteConfig.js is the fallback/seed source)';
