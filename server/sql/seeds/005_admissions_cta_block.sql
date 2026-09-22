-- ============================================================
-- Green Leaf — Seed 005: admissions CTA reusable block (Phase D)
--
-- THE canonical Admissions CTA block — ONE copy for every
-- consumer (Homepage band + Admissions page band). Content is
-- the neutral merge of the two former hardcoded versions:
--
--   Homepage band (old copy):   "Give Your Child a Place to Grow"
--                               buttons → /admissions, /contact
--   Admissions band (old copy): "Ready to Apply?" (+ office contact)
--                               buttons → mailto:admissionsEmail,
--                                         tel:phone (Site Settings)
--
-- Merge decisions:
--   • title/description carry the meaning of BOTH versions
--     (open invitation + open admissions + contact-the-office)
--   • ALL FOUR action meanings preserved as actions with stable
--     ids; each page renders its own pair by id
--   • mailto/tel use {{tokens}} — contact values are NEVER
--     copied into this block (single source: site_settings)
--
-- Idempotent: inserts only if the key does not already exist.
-- ============================================================

INSERT INTO `content_blocks` (`block_key`, `name`, `block_type`, `content`, `is_active`)
SELECT 'admissions-primary-cta',
       'Admissions Primary CTA',
       'CTA',
       JSON_OBJECT(
         'eyebrow', '',
         'title', 'Ready to Give Your Child a Place to Grow?',
         'description', 'Join the {{identity.shortName}} community — admissions are open for the upcoming academic year. Contact our admissions office for the application form and more information.',
         'actions', JSON_ARRAY(
           JSON_OBJECT('id', 'info', 'label', 'Admission Information', 'href', '/admissions'),
           JSON_OBJECT('id', 'contact-page', 'label', 'Contact School', 'href', '/contact'),
           JSON_OBJECT('id', 'email', 'label', 'Email Admissions', 'href', 'mailto:{{contact.admissionsEmail}}'),
           JSON_OBJECT('id', 'call', 'label', 'Call Us', 'href', 'tel:{{contact.phone}}')
         )
       ),
       1
FROM DUAL WHERE NOT EXISTS (
  SELECT 1 FROM `content_blocks` WHERE `block_key` = 'admissions-primary-cta');
