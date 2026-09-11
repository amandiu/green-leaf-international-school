-- ============================================================
-- Green Leaf — Migration 002: Navigation items (Phase 3.1)
-- Hierarchical navigation foundation for the future dynamic
-- Navbar + submenu system.
--
-- Level 0 (parent_id IS NULL) = Main menu
-- Level 1 (parent_id = parent.id) = Submenu
--
-- Idempotent: CREATE TABLE IF NOT EXISTS.
-- ============================================================

CREATE TABLE IF NOT EXISTS `navigation_items` (
  `id`           INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `parent_id`    INT UNSIGNED    NULL DEFAULT NULL COMMENT 'NULL = main menu; otherwise id of the parent navigation item',
  `title`        VARCHAR(100)    NOT NULL COMMENT 'Visible menu label',
  `slug`         VARCHAR(100)    NULL DEFAULT NULL COMMENT 'Unique stable identifier (nullable for dropdown-only parents)',
  `url`          VARCHAR(255)    NULL DEFAULT NULL COMMENT 'Internal route (/about) or external URL; NULL for pure dropdowns',
  `type`         ENUM('INTERNAL','EXTERNAL','DROPDOWN') NOT NULL DEFAULT 'INTERNAL' COMMENT 'Only supported navigation types',
  `sort_order`   INT             NOT NULL DEFAULT 0 COMMENT 'Deterministic ordering within the same menu level',
  `is_active`    TINYINT(1)      NOT NULL DEFAULT 1 COMMENT 'Admin can disable without deleting',
  `open_new_tab` TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'Mainly for external links',
  `icon`         VARCHAR(64)     NULL DEFAULT NULL COMMENT 'Optional icon key, configured in a later phase',
  `created_at`   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  -- Stable identifier; multiple NULLs are allowed for slug-less items
  UNIQUE KEY `uq_navigation_items_slug` (`slug`),

  -- Serves the main menu query pattern (fetch children of a parent,
  -- ordered) AND the parent_id foreign key
  KEY `idx_navigation_items_parent_sort` (`parent_id`, `sort_order`),

  -- Deleting a parent that still has children is RESTRICTED:
  -- the database refuses the delete instead of silently destroying
  -- the whole submenu tree. Explicit reassignment/deletion of the
  -- children is always required first.
  CONSTRAINT `fk_navigation_items_parent`
    FOREIGN KEY (`parent_id`) REFERENCES `navigation_items` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  -- "title cannot be empty": blocks NULL (NOT NULL) and also
  -- empty / whitespace-only strings
  CONSTRAINT `chk_navigation_items_title` CHECK (CHAR_LENGTH(TRIM(`title`)) > 0),

  -- "type must contain only supported values". ENUM alone is NOT
  -- enough on non-strict servers (e.g. default XAMPP MariaDB
  -- silently coerces bad ENUM values to ''), so a CHECK constraint
  -- enforces it regardless of server sql_mode.
  CONSTRAINT `chk_navigation_items_type`
    CHECK (`type` IN ('INTERNAL','EXTERNAL','DROPDOWN'))
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci
  COMMENT = 'Hierarchical navigation menu items (Phase 3.1 database foundation)';
