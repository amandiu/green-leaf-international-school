-- ============================================================
-- Green Leaf — Seed 001: Initial navigation items (Phase 3.1)
--
-- Sources verified against the existing project:
--   - client/src/App.jsx  (React Router routes)
--   - client/src/Components/layout/Navbar.jsx (navLinks)
--
-- Only REAL, existing routes are seeded. No submenu items are
-- invented because no child routes/pages exist yet.
--
-- Idempotent: INSERT IGNORE — re-running never duplicates rows
-- (slug is UNIQUE) and never overwrites future admin edits.
-- ============================================================

INSERT IGNORE INTO `navigation_items` (`title`, `slug`, `url`, `type`, `sort_order`)
VALUES
  ('Home',      'home',      '/',          'INTERNAL', 10),
  ('About',     'about',     '/about',     'INTERNAL', 20),
  ('Academics', 'academics', '/academics', 'INTERNAL', 30),
  ('Admissions','admissions','/admissions','INTERNAL', 40),
  ('Campus',    'campus',    '/campus',    'INTERNAL', 50),
  ('News',      'news',      '/news',      'INTERNAL', 60),
  ('Contact',   'contact',   '/contact',   'INTERNAL', 70);
