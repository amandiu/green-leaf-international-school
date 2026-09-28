-- ============================================================
-- Green Leaf — Seed 006: identity role catalog (Phase C.2)
--
-- Seeds EXACTLY the four catalog roles approved by SYSTEM_DESIGN
-- §AN.4 — nothing else. No permissions are seeded here (the
-- permission-key whitelist lives in code; role_permissions is
-- written by later Phase C items when enforcement arrives).
--
-- Idempotent: INSERT IGNORE — re-running never duplicates rows
-- (code is UNIQUE) and never overwrites future admin edits.
-- ============================================================

INSERT IGNORE INTO `roles` (`code`, `name`, `is_active`)
VALUES
  ('admin',    'Administrator',        1),
  ('student',  'Student',              1),
  ('teacher',  'Teacher',              1),
  ('guardian', 'Guardian / Parent',    1);
