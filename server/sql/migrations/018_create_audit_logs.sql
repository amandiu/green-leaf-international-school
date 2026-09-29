-- ============================================================
-- Green Leaf — Migration 018: audit_logs (Phase D.3)
--
-- PRIVILEGED-WRITE AUDIT TRAIL (SYSTEM_DESIGN §AN.19 + §L) —
-- one row per SUCCESSFUL privileged admin write. This is NOT a
-- generic request log: failed auth/authz/validation/business
-- operations produce NO row (§AN.19 event class), authentication
-- flows are excluded (separate concern), and reads are excluded
-- (no private-data read class exists yet — Phase F expansion).
--
--   actor       canonical users.id resolved SERVER-SIDE from the
--               authenticated session. NULLABLE on purpose:
--                 - ON DELETE SET NULL keeps the audit history
--                   when an account is later removed (the trail
--                   outlives identities);
--                 - the deprecated ADMIN_TOKEN bearer path (§AN.14.4)
--                   performs privileged writes with NO canonical
--                   identity — actor_email preserves attribution.
--               The client can NEVER supply this field.
--   actor_email actor email snapshot (attribution survives user
--               deletion; never a credential — email is public-
--               facing in this system's design).
--   action      controlled APPLICATION-DEFINED event name
--               (e.g. NEWS_ITEM_CREATE) — never client text.
--   entity      controlled resource category (e.g. news_item).
--   entity_id   STRING-typed target snapshot. Deliberately NO live
--               FK: audited targets (news, gallery, users…) are
--               mutable/deletable CMS rows, and the trail must
--               survive their deletion (§AN.19 immutability).
--               Composite keys use a "page:key" string form.
--   meta        JSON — MINIMAL explicitly whitelisted, non-secret,
--               action-specific metadata ONLY (status transitions,
--               changed field names, safe labels/counts). NEVER
--               req.body, headers, cookies, tokens, passwords,
--               hashes, file contents or whole rows (§AN.19
--               forbidden-data list). NULL when an action has no
--               useful safe metadata.
--   ip          server-derived request IP (req.ip under the
--               established trust-proxy setting). VARCHAR(45)
--               fits IPv4 + IPv6.
--   created_at  server-generated UTC instant — THE §L `at` field
--               (pool runs timezone 'Z'; TIMESTAMP convention is
--               established across every table).
--
-- APPEND-ONLY by application contract (§AN.19): no UPDATE/DELETE
-- API exists or may be added. Retention is Phase Q (§Y.12) —
-- no purge jobs, no archival columns.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS. Additive — nothing
-- existing is modified (§AN.18).
-- ============================================================

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`     INT UNSIGNED NULL COMMENT 'Actor: canonical users.id resolved server-side (NULL = bearer-path write or deleted account)',
  `actor_email` VARCHAR(255) NULL COMMENT 'Actor email snapshot — attribution survives account deletion',
  `action`      VARCHAR(64)  NOT NULL COMMENT 'Controlled application-defined event name (never client text)',
  `entity`      VARCHAR(64)  NOT NULL COMMENT 'Controlled resource category',
  `entity_id`   VARCHAR(64)  NULL COMMENT 'String-typed target snapshot — NO live FK (targets are mutable/deletable)',
  `meta`        JSON         NULL COMMENT 'Minimal whitelisted non-secret action metadata ONLY — never request bodies/headers/secrets (§AN.19)',
  `ip`          VARCHAR(45)  NULL COMMENT 'Server-derived request IP (req.ip, trust-proxy convention)',
  `created_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'UTC server-generated instant (the §L `at`)',

  PRIMARY KEY (`id`),

  -- Trail by actor (per-account review; §AN.16 admin-abuse mitigation)
  KEY `idx_audit_logs_user_id` (`user_id`),
  -- Trail by target resource
  KEY `idx_audit_logs_entity` (`entity`, `entity_id`),
  -- Chronological review (Phase Q retention windows)
  KEY `idx_audit_logs_created_at` (`created_at`),

  CONSTRAINT `fk_audit_logs_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Privileged-write audit trail (Phase D.3) — successful admin writes only, append-only by application contract';
