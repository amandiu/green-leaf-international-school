-- ============================================================
-- Green Leaf — Migration 010: contact_messages (Phase B.1)
--
-- PUBLIC CONTACT FORM BACKEND — persistent storage for messages
-- submitted through the public Contact page (POST /api/contact).
-- Read/manage EXCLUSIVELY through the admin AuthGate
-- (/api/admin/contact-messages) — never through a public read API.
--
--   status  NEW | READ | REPLIED | ARCHIVED
--           Inbox lifecycle (mirrors the news_items pattern of
--           VARCHAR + validator whitelist; the CHECK constraint
--           backstops non-strict MariaDB servers that would
--           silently coerce bad enum-ish values).
--   phone   nullable — the existing public form treats phone as
--           optional, so the column matches (no forced field).
--   email   lowercased by the service before insert; stored as
--           plain VARCHAR (utf8mb4_unicode_ci compares are
--           case-insensitive anyway).
--
-- Dates: DATETIME/TIMESTAMP columns are written/read as UTC by
-- the app (pool timezone 'Z'); the API serves ISO 8601. received
-- display label is derived (Asia/Dhaka) like news dateLabel.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS. Additive — nothing is
-- modified. NO SEED DATA (messages arrive from real visitors).
-- ============================================================

CREATE TABLE IF NOT EXISTS `contact_messages` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(120) NOT NULL COMMENT 'Sender full name (whitespace-trimmed)',
  `email`      VARCHAR(255) NOT NULL COMMENT 'Sender email (service lowercases before insert)',
  `phone`      VARCHAR(40)      NULL COMMENT 'Optional phone from the existing form',
  `subject`    VARCHAR(200) NOT NULL COMMENT 'Message subject',
  `message`    TEXT         NOT NULL COMMENT 'Message body (bounded by the validator, not the column)',
  `status`     VARCHAR(20)  NOT NULL DEFAULT 'NEW' COMMENT 'NEW | READ | REPLIED | ARCHIVED (admin inbox lifecycle)',
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Received time (UTC)',
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  -- Inbox list queries: filter by status, newest first
  KEY `idx_contact_messages_status_created` (`status`, `created_at`),

  -- "name/subject cannot be empty": blocks NULL (NOT NULL) and
  -- empty / whitespace-only strings (same pattern as 002/003).
  CONSTRAINT `chk_contact_messages_name` CHECK (CHAR_LENGTH(TRIM(`name`)) > 0),
  CONSTRAINT `chk_contact_messages_subject` CHECK (CHAR_LENGTH(TRIM(`subject`)) > 0),

  -- Status whitelist backstop for non-strict servers (same
  -- rationale as chk_navigation_items_type / news CHECKs).
  CONSTRAINT `chk_contact_messages_status`
    CHECK (`status` IN ('NEW','READ','REPLIED','ARCHIVED'))
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Public contact form submissions; admin-only inbox (Phase B.1)';
