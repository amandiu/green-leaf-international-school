-- ============================================================
-- Green Leaf — Migration 014: users (Phase C.2 identity foundation)
--
-- CANONICAL IDENTITY — one row per authenticated person
-- (SYSTEM_DESIGN §AN.3). A user's role(s) live in user_roles
-- (015); domain profiles (students/teachers/guardians) link by
-- user_id in LATER phases (F/G/H) — never stored here.
--
--   email                canonical login identifier (§AN.10);
--                        lowercase, UNIQUE case-insensitively.
--   password_hash        bcrypt hash ONLY — never plaintext
--                        (established convention). NOT yet read
--                        by any login path (Phase C.4 cutover).
--   name                 display name.
--   is_active            ACTIVE/INACTIVE lifecycle (§AN.10):
--                        the ONLY states approved — no pending/
--                        suspended/locked columns.
--   password_changed_at  UTC timestamp of the last credential
--                        change; powers password-change session
--                        invalidation at the C4 cutover (§AN.7).
--                        NULL = never changed (e.g. migrated rows
--                        keep their original hash; cutover stamps
--                        them with the copy time).
--
-- ADMIN COMPATIBILITY (§AN.14): this table does NOT replace
-- admin_users in Phase C.2 — the existing admin login keeps
-- reading admin_users until the C4 cutover. Nothing here is read
-- by any authentication path yet.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS. Additive.
-- ============================================================

CREATE TABLE IF NOT EXISTS `users` (
  `id`                  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email`               VARCHAR(255) NOT NULL COMMENT 'Canonical login identifier (lowercase; §AN.10)',
  `password_hash`       VARCHAR(255) NOT NULL COMMENT 'bcrypt hash only — never plaintext (established convention)',
  `name`                VARCHAR(120) NULL DEFAULT NULL COMMENT 'Display name',
  `is_active`           TINYINT(1)   NOT NULL DEFAULT 1 COMMENT 'Account lifecycle: ACTIVE/INACTIVE (§AN.10)',
  `password_changed_at` DATETIME     NULL DEFAULT NULL COMMENT 'UTC — last credential change (session invalidation, §AN.7); NULL = never',
  `created_at`          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  -- One account per email, case-insensitive (utf8mb4_unicode_ci)
  UNIQUE KEY `uq_users_email` (`email`),

  -- Login-pattern lookup (mirrors admin_users)
  KEY `idx_users_email_active` (`email`, `is_active`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Canonical authenticated identity (Phase C.2) — roles via user_roles; profiles link by user_id later';
