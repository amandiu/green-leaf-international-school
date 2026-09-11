-- ============================================================
-- Green Leaf — Migration 001: Create database
-- Idempotent. The {{DATABASE_NAME}} placeholder is substituted
-- by src/scripts/dbMigrate.js using the DB_NAME env variable.
-- ============================================================

CREATE DATABASE IF NOT EXISTS `{{DATABASE_NAME}}`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
