-- ============================================================
-- Green Leaf — Migration 012: downloads (Phase B.6)
--
-- PUBLIC DOWNLOADABLE DOCUMENTS — the ONE entity for files the
-- school publishes for download (prospectus, syllabus, routines,
-- forms, notices, circulars, academic documents, rules).
--
--   status          DRAFT | PUBLISHED | ARCHIVED
--                   (public API + file serving serve PUBLISHED only)
--   file            SAFE managed upload reference ONLY:
--                   /api/uploads/documents/<server-generated>.pdf
--                   (never a client-supplied filesystem path)
--   original_filename  display-only copy of the uploaded name
--                   (sanitized on write; never used for storage)
--   file_ext        'pdf' — the pipeline's validated allowlist
--   file_bytes      size in bytes (shown to users, no path leak)
--
-- Per SYSTEM_DESIGN §L: standalone entity; file storage extends
-- the shared upload pipeline with a documents directory (PDF-only
-- allowlist, same server-generated-filename rule as images).
-- Idempotent CREATE TABLE IF NOT EXISTS; additive — nothing is
-- modified.
-- ============================================================

CREATE TABLE IF NOT EXISTS `downloads` (
  `id`                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title`             VARCHAR(200) NOT NULL COMMENT 'Document title shown in the Downloads Center',
  `description`       VARCHAR(500) NULL COMMENT 'Short public description (nullable)',
  `category`          VARCHAR(50)  NOT NULL DEFAULT 'Other' COMMENT 'Controlled vocabulary (MASTER PLAN §12: Prospectus, Syllabus, Routine, …)',
  `file`              VARCHAR(500) NOT NULL COMMENT 'SAFE managed upload reference /api/uploads/documents/<generated>.pdf (never client paths)',
  `original_filename` VARCHAR(255) NULL COMMENT 'Display-only uploaded filename (sanitized; never used for storage)',
  `file_ext`          VARCHAR(10)  NULL COMMENT 'Validated extension (pdf)',
  `file_bytes`        INT UNSIGNED NULL COMMENT 'File size in bytes (public metadata)',
  `status`            VARCHAR(20)  NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT | PUBLISHED | ARCHIVED (public sees PUBLISHED only)',
  `sort_order`        INT          NOT NULL DEFAULT 0 COMMENT 'Display order in the Downloads Center',
  `created_at`        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  -- Public listing: published, display order, category filter
  KEY `idx_downloads_pub` (`status`, `sort_order`),
  KEY `idx_downloads_category` (`category`),
  -- Orphan-safe file cleanup: find rows referencing a managed file
  KEY `idx_downloads_file` (`file`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Public downloadable documents (Phase B.6) — DB-mediated secure file serving';
