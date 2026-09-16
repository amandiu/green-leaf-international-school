-- ============================================================
-- Green Leaf — Migration 003: Leadership messages
--
-- Content for the public Homepage "Leadership Message" 2×2
-- section. Future roles can be added without schema changes:
-- `role` is a plain VARCHAR(80), not a two-row enum lock-in.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS (matches migration 002).
-- ============================================================

CREATE TABLE IF NOT EXISTS `leadership_messages` (
  `id`         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `role`       VARCHAR(80)   NOT NULL COMMENT 'Principal / Chairman / any future leadership role',
  `name`       VARCHAR(120)  NULL DEFAULT NULL COMMENT 'Display name; NULL = not yet verified/published',
  `title`      VARCHAR(160)  NULL DEFAULT NULL COMMENT 'Optional message heading, e.g. "Message from the Principal"',
  `message`    TEXT          NULL COMMENT 'Official message content; NULL = pending verified content',
  `image_url`  VARCHAR(255)  NULL DEFAULT NULL COMMENT 'Public-safe relative path under /api/uploads (never a server filesystem path)',
  `sort_order` INT           NOT NULL DEFAULT 0 COMMENT 'Public display order (ORDER BY sort_order ASC)',
  `is_active`  TINYINT(1)    NOT NULL DEFAULT 1 COMMENT 'Admin can disable without deleting',
  `created_at` TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  -- Serves the public query pattern: active rows in display order
  KEY `idx_leadership_messages_active_sort` (`is_active`, `sort_order`),

  -- "role cannot be empty": blocks NULL (NOT NULL) and also
  -- empty / whitespace-only strings (same pattern as 002 title)
  CONSTRAINT `chk_leadership_messages_role` CHECK (CHAR_LENGTH(TRIM(`role`)) > 0),

  -- Sort order sanity: no negative display positions
  CONSTRAINT `chk_leadership_messages_sort` CHECK (`sort_order` >= 0)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Homepage Leadership Message section content (server+admin phase)';

-- ------------------------------------------------------------
-- NO SEED DATA
--
-- Per project data-safety rules, no official Principal/Chairman
-- names, messages, or portraits exist yet (the current frontend
-- data file also carries only verified-content placeholders).
-- Fabricating identities is forbidden; the admin panel is the
-- intended way to add real records. An empty table is safe: the
-- public homepage section already renders "pending" placeholders.
-- ------------------------------------------------------------
