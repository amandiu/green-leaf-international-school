-- ============================================================
-- Green Leaf — Migration 017: password_resets (Phase C.5)
--
-- ONE-TIME PASSWORD RESET TOKENS (SYSTEM_DESIGN §AN.8) — hashed,
-- expiring, single-use, 60-minute validity. Raw tokens are NEVER
-- stored: the only persisted value is the SHA-256 digest
-- (64-character lowercase hex) of a 32-byte crypto-random token.
--
--   user_id     → users.id, ON DELETE CASCADE (identity is the
--                 parent: deleting a user removes its reset rows).
--   token_hash  SHA-256 hex digest — the ONLY accepted lookup key.
--   expires_at  UTC timestamp; consumption rejects expired rows
--                 (issued with exactly 60 minutes of validity).
--   used_at     NULL while outstanding; stamped exactly once at
--                 consumption (transactional UPDATE ... WHERE
--                 used_at IS NULL — concurrent replay cannot
--                 consume a token twice).
--
-- ADMIN-ISSUED UNTIL EMAIL EXISTS (§AN.8): no email delivery
-- exists yet, so raw tokens reach the user through the admin
-- flow (the C6 reset-issue UI consumes the token service); the
-- public request endpoint is a generic, rate-limited sink until
-- the notification adapter lands. No email column, no plaintext
-- token column, no reset codes — deliberately minimal.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS. Additive — nothing
-- existing is modified (§AN.18).
-- ============================================================

CREATE TABLE IF NOT EXISTS `password_resets` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    INT UNSIGNED NOT NULL COMMENT 'Identity owner (users.id)',
  `token_hash` CHAR(64)     NOT NULL COMMENT 'SHA-256 hex of the raw token — the raw token is NEVER stored',
  `expires_at` DATETIME     NOT NULL COMMENT 'UTC — consumption rejects rows past this instant (60 min after issue)',
  `used_at`    DATETIME     NULL DEFAULT NULL COMMENT 'UTC — stamped exactly once at consumption (single-use)',
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  -- Token lookup by hash (the ONLY accepted lookup path — §AN.8)
  KEY `idx_password_resets_token_hash` (`token_hash`),
  -- Outstanding-token invalidation for one user
  KEY `idx_password_resets_user_id` (`user_id`),

  CONSTRAINT `fk_password_resets_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'One-time expiring password reset tokens (Phase C.5) — hash-only, 60-minute validity';
