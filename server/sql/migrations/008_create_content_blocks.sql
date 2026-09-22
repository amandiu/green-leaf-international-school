-- ============================================================
-- Green Leaf — Migration 008: content_blocks (Phase D)
--
-- REUSABLE CONTENT BLOCKS: content managed ONCE and referenced
-- by many pages/sections. Consumers reference the stable
-- block_key — they NEVER copy block content.
--
--   block_key   'admissions-primary-cta' (UNIQUE, system identity)
--   name        Human label shown in the admin Content Center
--   block_type  'CTA' (each type has its own validated schema)
--   content     JSON — structured per-type content (CTA:
--               eyebrow, title, description, actions[] with
--               stable action ids; actions may use sanctioned
--               {{settings}} tokens)
--   is_active   Deactivating a referenced block makes consumers
--               fall back to their shared defaults (never crash).
--
-- siteConfig/homeContent-style defaults remain the FALLBACK/seed
-- source (shared/content/contentBlocks.js). Idempotent
-- CREATE TABLE IF NOT EXISTS; additive — nothing is modified.
-- ============================================================

CREATE TABLE IF NOT EXISTS `content_blocks` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `block_key`  VARCHAR(100) NOT NULL COMMENT 'Stable system identity, e.g. admissions-primary-cta (UNIQUE) — consumers reference this',
  `name`       VARCHAR(150) NOT NULL COMMENT 'Human label shown in the admin Content Center',
  `block_type` VARCHAR(50)  NOT NULL COMMENT 'Block type with its own validated schema, e.g. CTA',
  `content`    JSON         NOT NULL COMMENT 'Structured per-type content (validated shape per block_type)',
  `is_active`  TINYINT(1)   NOT NULL DEFAULT 1 COMMENT 'Inactive referenced blocks fall back to shared defaults on the public site',
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  -- One row per block — case-insensitive uniqueness (utf8mb4_unicode_ci)
  UNIQUE KEY `uq_content_blocks_key` (`block_key`),

  -- Type listing (Content Center grouping, future bulk reads)
  KEY `idx_content_blocks_type` (`block_type`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Reusable content blocks referenced by pages/sections (Phase D)';
