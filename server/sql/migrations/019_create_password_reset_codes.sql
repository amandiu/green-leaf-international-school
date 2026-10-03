-- ============================================================
-- Green Leaf — Migration 019: password_reset_codes (Phase 2)
--
-- EMAIL-DELIVERED VERIFICATION CODES for the public forgot-
-- password flow (§AN.8 extension). SEPARATE from the C5
-- password_resets table: that table continues to serve the
-- ADMIN-ISSUED 32-byte token flow (C6 reset-issue UI) untouched;
-- this table holds the email channel's 6-digit codes.
--
--   user_id     → users.id, ON DELETE CASCADE (identity is the
--                 parent: deleting a user removes its code rows).
--   code_hash   SHA-256 hex digest — the ONLY persisted form of
--                 the code. The raw 6-digit code is NEVER stored,
--                 logged or projected (§AN.8/§AN.9).
--   expires_at  UTC; consumption rejects rows past this instant
--                 (issued with PASSWORD_RESET_CODE_EXPIRY_MINUTES
--                 minutes of validity — default 10).
--   used_at     NULL while outstanding; stamped exactly once at
--                 consumption (transactional UPDATE ... WHERE
--                 used_at IS NULL — Phase 3 verifies against it).
--   attempt_count  Failed verification attempts recorded per row
--                 (§AN.9 brute-force preparation for Phase 3).
--
-- One outstanding code per user at most: issuance marks every
-- other outstanding row used (§AN.8 — "only the latest valid
-- code should be usable") in the SAME transaction as the insert,
-- so two concurrent requests can never leave two live codes.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS. Additive — nothing
-- existing is modified (§AN.18).
-- ============================================================

CREATE TABLE IF NOT EXISTS `password_reset_codes` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`       INT UNSIGNED NOT NULL COMMENT 'Identity owner (users.id)',
  `code_hash`     CHAR(64)     NOT NULL COMMENT 'SHA-256 hex of the 6-digit code — the raw code is NEVER stored',
  `expires_at`    DATETIME     NOT NULL COMMENT 'UTC — verification rejects rows past this instant',
  `used_at`       DATETIME     NULL DEFAULT NULL COMMENT 'UTC — stamped exactly once at consumption (single-use)',
  `attempt_count` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Failed verification attempts (brute-force guard, consumed by Phase 3)',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  -- Verification lookup by hash (the ONLY accepted lookup path).
  -- Uniqueness across ALL rows — not a partial key — so a guessed
  -- code can never collide with a historical row either.
  UNIQUE KEY `uq_password_reset_codes_code_hash` (`code_hash`),
  -- Outstanding-code invalidation for one user
  KEY `idx_password_reset_codes_user_id` (`user_id`),

  CONSTRAINT `fk_password_reset_codes_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Email-delivered password reset verification codes (Phase 2) — hash-only, expiring, single-use';
