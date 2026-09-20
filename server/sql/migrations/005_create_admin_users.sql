-- ============================================================
-- Green Leaf — Migration 005: Admin users (email + password)
--
-- Real credential-based authentication for the Admin Panel.
-- Only bcrypt password hashes are stored — never plaintext.
-- Login is additionally restricted to active rows only.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS (matches 002/003).
-- ============================================================

CREATE TABLE IF NOT EXISTS `admin_users` (
  `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `email`         VARCHAR(255)  NOT NULL COMMENT 'Login identifier (lowercase)',
  `password_hash` VARCHAR(255)  NOT NULL COMMENT 'bcrypt hash (never plaintext)',
  `name`          VARCHAR(120)  NULL DEFAULT NULL COMMENT 'Display name',
  `is_active`     TINYINT(1)    NOT NULL DEFAULT 1 COMMENT 'Deactivate without deleting (blocks login)',
  `created_at`    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  -- One account per email — case-insensitive (utf8mb4_unicode_ci)
  UNIQUE KEY `uq_admin_users_email` (`email`),

  -- Constant-time-ish lookup pattern for the login query
  KEY `idx_admin_users_email_active` (`email`, `is_active`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Admin Panel login accounts (bcrypt password hashes only)';
