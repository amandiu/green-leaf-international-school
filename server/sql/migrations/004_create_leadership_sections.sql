-- ============================================================
-- Green Leaf — Migration 004: Leadership sections
--
-- Introduces `leadership_sections` (eyebrow/title/description for
-- the homepage Leadership Message block) and links every existing
-- `leadership_messages` row to exactly one section:
--
--   leadership_messages.section_id → leadership_sections.id
--   (ON DELETE RESTRICT — deleting a section that still has
--   messages is refused, mirroring navigation_items.parent_id.)
--
-- The single-section setup (id 1) keeps this phase's scope:
-- the homepage renders one Leadership Message block. The table
-- schema itself is multi-section ready (no role/section coupling).
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + guarded ALTER.
-- ============================================================

CREATE TABLE IF NOT EXISTS `leadership_sections` (
  `id`          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `eyebrow`     VARCHAR(255)  NULL DEFAULT NULL COMMENT 'Small badge line above the section title (admin-managed)',
  `title`       VARCHAR(255)  NULL DEFAULT NULL COMMENT 'Section heading (admin-managed)',
  `description` TEXT          NULL COMMENT 'Section intro paragraph (admin-managed)',
  `is_active`   TINYINT(1)    NOT NULL DEFAULT 1 COMMENT 'Admin can hide the whole section without deleting',
  `created_at`  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Homepage Leadership Message section settings (admin-managed)';

-- ------------------------------------------------------------
-- Add `section_id` to leadership_messages (idempotent: guarded
-- by information_schema, safe to re-run).
-- ------------------------------------------------------------
SET @has_section_id = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'leadership_messages'
    AND COLUMN_NAME  = 'section_id'
);

SET @ddl = IF(@has_section_id = 0,
  'ALTER TABLE `leadership_messages`
     ADD COLUMN `section_id` INT UNSIGNED NULL DEFAULT NULL
       COMMENT ''Section this message belongs to'' AFTER `id`',
  'SELECT ''leadership_messages.section_id already exists'' AS note');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill: all current messages attach to the first section
-- (created above with the lowest id) so the FK never blocks.
UPDATE `leadership_messages`
SET `section_id` = (SELECT MIN(`id`) FROM `leadership_sections`)
WHERE `section_id` IS NULL;

-- FK with RESTRICT: a section holding messages cannot be deleted.
SET @has_fk = (
  SELECT COUNT(*)
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME   = 'fk_leadership_messages_section'
);
SET @ddl = IF(@has_fk = 0,
  'ALTER TABLE `leadership_messages`
     ADD CONSTRAINT `fk_leadership_messages_section`
     FOREIGN KEY (`section_id`) REFERENCES `leadership_sections` (`id`)
     ON DELETE RESTRICT
     ON UPDATE CASCADE',
  'SELECT ''fk_leadership_messages_section already exists'' AS note');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index for the query pattern: messages of a section in display order.
SET @has_idx = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'leadership_messages'
    AND INDEX_NAME   = 'idx_leadership_messages_section_sort'
);
SET @ddl = IF(@has_idx = 0,
  'ALTER TABLE `leadership_messages`
     ADD INDEX `idx_leadership_messages_section_sort`
       (`section_id`, `sort_order`)',
  'SELECT ''idx_leadership_messages_section_sort already exists'' AS note');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
