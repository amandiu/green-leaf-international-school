-- ============================================================
-- Green Leaf — Migration 015: user_roles (Phase C.2 identity foundation)
--
-- USER ↔ ROLE ASSIGNMENTS — the multi-role junction approved by
-- §AN.4 (a teacher may also be a guardian; an admin may hold a
-- second organizational role). One row per (user, role).
--
--   user_id     → users.id, ON DELETE CASCADE (identity is the
--                 parent: deleting a user removes its assignments).
--   role_id     → roles.id, ON DELETE RESTRICT (the catalog is
--                 never silently emptied — mirrors the leadership
--                 RESTRICT convention).
--   is_primary  exactly ONE primary role per user, enforced by the
--                 service; the portal shell (Phase N) uses it as
--                 the deterministic default. Default 1 so seeded/
--                 migrated single-role users are primary by
--                 construction.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS. Additive.
-- ============================================================

CREATE TABLE IF NOT EXISTS `user_roles` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED NOT NULL COMMENT 'Identity owner (users.id)',
  `role_id`    INT UNSIGNED NOT NULL COMMENT 'Assigned catalog role (roles.id)',
  `is_primary` TINYINT(1)   NOT NULL DEFAULT 1 COMMENT 'Exactly ONE primary role per user (service-enforced; portal-shell default)',
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  -- A user holds a role at most once
  UNIQUE KEY `uq_user_roles_user_role` (`user_id`, `role_id`),

  -- Role lookup for a user (session building, requireRole)
  KEY `idx_user_roles_user` (`user_id`),
  -- Reverse lookup (user management UI: members of a role)
  KEY `idx_user_roles_role` (`role_id`),

  CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_roles_role` FOREIGN KEY (`role_id`)
    REFERENCES `roles` (`id`) ON DELETE RESTRICT
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'User↔role assignments (Phase C.2) — multi-role with one service-enforced primary';
