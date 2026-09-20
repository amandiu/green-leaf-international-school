-- ============================================================
-- Green Leaf — Seed 002: Leadership section (single-section setup)
--
-- Inserts ONLY the section shell (eyebrow/title/description), and
-- only when the table is still empty. Idempotent: guarded by
-- NOT EXISTS, so re-running never duplicates.
--
-- NO MESSAGE DATA — per project data-safety rules, no Principal/
-- Chairman names, portraits, or messages are fabricated. The
-- admin panel (http://localhost:5174/leadership) is the source
-- of truth for records.
--
-- Note: the section copy here mirrors the homepage's existing
-- SectionHeader defaults so the admin panel starts with real,
-- editable values instead of blanks.
-- ============================================================

INSERT INTO `leadership_sections`
       (`eyebrow`, `title`, `description`, `is_active`)
SELECT 'Leadership Message',
       'Messages from Our Leadership',
       'Words of guidance and inspiration from the leaders of Green Leaf International School & College.',
       1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `leadership_sections`);
