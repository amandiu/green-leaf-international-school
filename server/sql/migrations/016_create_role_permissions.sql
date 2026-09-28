-- ============================================================
-- Green Leaf — Migration 016: role_permissions (Phase C.2 identity foundation)
--
-- ROLE → PERMISSION-KEY MAP — the RBAC foundation approved by
-- §AN.5 (RBAC with a seeded permission-key catalog; NO per-user
-- overrides in v1). Permission keys are a WHITELIST VALIDATED IN
-- CODE (mirrors the validator convention); this table only maps
-- them onto roles.
--
--   role_id          → roles.id, ON DELETE CASCADE (a catalog
--                      row cannot leave orphan permission rows).
--   permission_key   dotted key ('students.read', 'news.write',
--                      …) — validated against the code whitelist
--                      by the service layer before insert.
--
-- NO PERMISSION MANAGEMENT UI/ENDPOINT EXISTS IN C2 (§AN.5):
-- this table is written by migrations/seeds only. Admin → '*' is
-- a COARSE DEFAULT decided in middleware (requirePermission
-- short-circuits for holders of the admin role) — no wildcard row
-- is stored.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS. Additive.
-- ============================================================

CREATE TABLE IF NOT EXISTS `role_permissions` (
  `role_id`        INT UNSIGNED NOT NULL COMMENT 'Role the permission attaches to (roles.id)',
  `permission_key` VARCHAR(64)  NOT NULL COMMENT 'Dotted permission key, code-whitelisted (e.g. students.read)',
  `created_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`role_id`, `permission_key`),

  -- Role-wide lookup for requirePermission (cache-fill query)
  KEY `idx_role_permissions_role` (`role_id`),

  CONSTRAINT `fk_role_permissions_role` FOREIGN KEY (`role_id`)
    REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Role→permission-key map (Phase C.2) — foundation only; enforcement arrives in C7';
