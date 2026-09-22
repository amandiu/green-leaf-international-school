-- ============================================================
-- Green Leaf — Migration 007: page_sections (Phase B)
--
-- Admin-editable page content, ONE ROW PER SECTION with
-- structured JSON per section (NOT one giant page blob):
--
--   page         'home' (only page in Phase B)
--   section_key  'hero' | 'newsPreview' | 'lifeAtSchool' |
--                'videoShowcase' | 'admissionsCta'
--   content      JSON — per-section validated shape
--   is_active    admin can hide a section without deleting it
--
-- Fallback rule: the site's default content constants remain the
-- seed/fallback source (Phase A pattern). A missing section row,
-- a missing field, or an unreachable database falls back to the
-- current homepage content — the public page never blanks.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS (matches 002–006).
-- Additive: no existing table is modified.
-- ============================================================

CREATE TABLE IF NOT EXISTS `page_sections` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `page`       VARCHAR(50)  NOT NULL COMMENT 'Page identifier, e.g. home',
  `section_key` VARCHAR(100) NOT NULL COMMENT 'Stable section identifier, e.g. hero (unique per page)',
  `sort_order` INT          NOT NULL DEFAULT 0 COMMENT 'Display order of page sections',
  `content`    JSON         NOT NULL COMMENT 'Structured per-section content (validated shape per section)',
  `is_active`  TINYINT(1)   NOT NULL DEFAULT 1 COMMENT 'Admin can hide a section without deleting it',
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  -- One content row per page section — case-insensitive (utf8mb4_unicode_ci)
  UNIQUE KEY `uq_page_sections_page_key` (`page`, `section_key`),

  -- Page listing ordered (page admin screens read page+order)
  KEY `idx_page_sections_page_sort` (`page`, `sort_order`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Admin-editable page sections with structured per-section JSON (Phase B: home)';
