-- ============================================================
-- Green Leaf — Migration 011: gallery_items (Phase B.2)
--
-- PUBLIC GALLERY — DB-backed replacement for the hardcoded
-- Campus photo grid. Rows store ONLY a safe public image
-- reference (/api/uploads/images/<file> produced by the existing
-- hardened upload pipeline, or a legacy site-relative path like
-- /Activity/...). The image BYTES are never duplicated in the
-- database and original filenames are never stored.
--
--   status    DRAFT | PUBLISHED | ARCHIVED
--             (the news_items vocabulary — public API serves
--             PUBLISHED only; reuse instead of inventing a new
--             lifecycle convention)
--   category  simple VARCHAR constrained by the validator to the
--             planned category list (Academic Events / Sports /
--             Cultural Programs / Science Fair / Educational Tour /
--             School Events / Campus / Other). NO relational album
--             system — documented decision (MASTER PLAN §12 rule:
--             prefer a simple field until a real need is proven).
--   caption   nullable — alt/caption text is admin-provided
--             (accessibility); NULL = admin has not written one.
--   sort_order deterministic public display order within the
--             gallery (same convention as leadership_messages).
--
-- Dates: TIMESTAMP columns are written/read as UTC by the app
-- (pool timezone 'Z'); the API serves ISO 8601 (+ Asia/Dhaka
-- label where displayed). Idempotent CREATE TABLE IF NOT EXISTS;
-- additive — nothing is modified. NO SEED DATA: fabricated
-- gallery entries are forbidden; the admin panel is the source
-- of truth (the public Campus page keeps its hardcoded images as
-- a visible-fallback until real rows exist — see Campus integration).
-- ============================================================

CREATE TABLE IF NOT EXISTS `gallery_items` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title`      VARCHAR(150) NOT NULL COMMENT 'Short title shown on hover/captions',
  `caption`    VARCHAR(500)     NULL COMMENT 'Optional longer caption / alt text (admin-provided)',
  `image`      VARCHAR(500) NOT NULL COMMENT 'Safe public image reference: /api/uploads/images/<file> or legacy site-relative path',
  `category`   VARCHAR(50)  NOT NULL DEFAULT 'Other' COMMENT 'Gallery category (validator-constrained list)',
  `status`     VARCHAR(20)  NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT | PUBLISHED | ARCHIVED (public sees PUBLISHED only)',
  `sort_order` INT          NOT NULL DEFAULT 0 COMMENT 'Display order (ORDER BY sort_order ASC, then newest)',
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  -- Public query pattern: published items of a category in order
  KEY `idx_gallery_items_status_sort` (`status`, `sort_order`),
  -- Category listing / filters (admin + public)
  KEY `idx_gallery_items_category` (`category`),

  -- "title cannot be empty": blocks NULL (NOT NULL) and also
  -- empty / whitespace-only strings (same pattern as 002/003/010).
  CONSTRAINT `chk_gallery_items_title` CHECK (CHAR_LENGTH(TRIM(`title`)) > 0),

  -- Status whitelist backstop for non-strict MariaDB servers
  -- (same rationale as chk_navigation_items_type / news CHECKs).
  CONSTRAINT `chk_gallery_items_status`
    CHECK (`status` IN ('DRAFT','PUBLISHED','ARCHIVED')),

  -- Display order sanity: no negative positions
  CONSTRAINT `chk_gallery_items_sort` CHECK (`sort_order` >= 0)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Public photo gallery items; admin-managed, uploaded via the shared image pipeline (Phase B.2)';
