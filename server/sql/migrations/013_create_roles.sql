-- ============================================================
-- Green Leaf — Migration 013: roles (Phase C.2 identity foundation)
--
-- ROLE CATALOG — the seeded vocabulary of roles
-- (SYSTEM_DESIGN §AN.4): admin / student / teacher / guardian.
-- Pure catalog: NO permissions column here — permission keys
-- attach to roles via role_permissions (migration 016).
--
--   code       stable machine key ('admin'…); UNIQUE
--              case-insensitively via utf8mb4_unicode_ci.
--   name       display label ("Administrator").
--   is_active  catalog rows are never hard-deleted; deactivate
--              instead (mirrors admin_users convention).
--
-- Idempotent: CREATE TABLE IF NOT EXISTS. Additive — nothing is
-- modified. NEVER modify an existing migration.
-- ============================================================

CREATE TABLE IF NOT EXISTS `roles` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code`       VARCHAR(50)  NOT NULL COMMENT 'Stable machine code: admin | student | teacher | guardian (§AN.4)',
  `name`       VARCHAR(120) NOT NULL COMMENT 'Display label (e.g. Administrator)',
  `is_active`  TINYINT(1)   NOT NULL DEFAULT 1 COMMENT 'Catalog lifecycle (deactivate, never delete)',
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  -- One role per code, case-insensitive (utf8mb4_unicode_ci)
  UNIQUE KEY `uq_roles_code` (`code`),

  KEY `idx_roles_active` (`is_active`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Role catalog for the unified identity foundation (Phase C.2)';
