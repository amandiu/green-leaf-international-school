-- ============================================================
-- Green Leaf — Migration 009: news_items (Phase E)
--
-- CENTRAL NEWS / NOTICES — the ONE dynamic content source for:
--   Homepage news preview, Navbar ticker, News page (+ detail).
-- Consumers reference these rows via the News API — news content
-- is NEVER copied into page components or page_sections.
--
--   type    NEWS | NOTICE | EVENT | ANNOUNCEMENT
--           (exactly the categories the existing UI used)
--   status  DRAFT | PUBLISHED | ARCHIVED
--           (public API serves PUBLISHED only)
--   slug    unique, URL-safe — used by /news/:slug detail links
--   image   nullable public path/URL (no new media system —
--           matches the existing asset-field conventions)
--
-- Dates: DATETIME columns are written/read as UTC by the app
-- (pool timezone 'Z'); the API serves ISO 8601 and a stable
-- Asia/Dhaka date label. Idempotent CREATE TABLE IF NOT EXISTS;
-- additive — nothing is modified.
-- ============================================================

CREATE TABLE IF NOT EXISTS `news_items` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title`        VARCHAR(200) NOT NULL COMMENT 'Headline shown in every consumer',
  `slug`         VARCHAR(220) NOT NULL COMMENT 'URL-safe unique identity for /news/:slug',
  `type`         VARCHAR(20)  NOT NULL DEFAULT 'NEWS' COMMENT 'NEWS | NOTICE | EVENT | ANNOUNCEMENT',
  `status`       VARCHAR(20)  NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT | PUBLISHED | ARCHIVED (public sees PUBLISHED only)',
  `excerpt`      VARCHAR(500)     NULL COMMENT 'Short summary for cards/ticker (nullable)',
  `content`      TEXT             NULL COMMENT 'Full body for the detail page (nullable)',
  `image`        VARCHAR(500)     NULL COMMENT 'Public path/URL for the card image (nullable)',
  `published_at` DATETIME         NULL COMMENT 'UTC publish timestamp (set when published)',
  `created_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  -- One URL per news item — case-insensitive (utf8mb4_unicode_ci)
  UNIQUE KEY `uq_news_items_slug` (`slug`),

  -- Public list queries: published, newest first, filterable by type
  KEY `idx_news_items_pub` (`status`, `published_at`),
  KEY `idx_news_items_type` (`type`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Central news/notices consumed by Homepage, Navbar ticker and News page (Phase E)';
