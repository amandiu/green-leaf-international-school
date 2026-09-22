-- ============================================================
-- Green Leaf — Seed 004: Home page sections (Phase B)
--
-- Seeds the CURRENT Homepage content extracted verbatim from
-- client/src/Pages/Home.jsx at the Phase B audit (shared/
-- content/homeContent.js is the JS mirror of these values).
--
-- One row per section (page='home'), structured JSON per section
-- — NOT a giant page blob. The news preview ITEMS are stored so
-- the public Homepage renders identically, but Phase B exposes
-- only the section heading/description to the admin; the items
-- are replaced wholesale by the Phase D News API.
--
-- {{identity.name}} / {{identity.shortName}} / {{social.youtube}}
-- tokens are substituted at render time from the effective Site
-- Settings — the same fields that follow Site Settings today.
--
-- Idempotent: INSERT ... SELECT ... WHERE NOT EXISTS per row —
-- re-running never duplicates or overwrites. Admin edits always
-- win over this seed.
-- ============================================================

-- ---- home.hero (sort_order 10) ----
INSERT INTO `page_sections` (`page`, `section_key`, `sort_order`, `content`, `is_active`)
SELECT 'home', 'hero', 10,
  JSON_OBJECT(
    'eyebrow', '',
    'headline', 'Excellence in |Knowledge & Character',
    'subtext', 'A place where knowledge grows, character develops, and students prepare for a successful future.',
    'primaryButton', JSON_OBJECT('text', 'Explore Our School', 'link', '/about'),
    'secondaryButton', JSON_OBJECT('text', 'Admissions', 'link', '/admissions'),
    'slides', JSON_ARRAY(
      JSON_OBJECT('src', '/Hero Section/hero 1.jpg', 'alt', '{{identity.name}} Campus'),
      JSON_OBJECT('src', '/Hero Section/hero 2.jpg', 'alt', '{{identity.shortName}} Students'),
      JSON_OBJECT('src', '/Hero Section/hero 3.jpg', 'alt', '{{identity.shortName}} Activities')
    )
  ),
  1
FROM DUAL WHERE NOT EXISTS (
  SELECT 1 FROM `page_sections` WHERE `page` = 'home' AND `section_key` = 'hero');

-- ---- home.newsPreview (sort_order 20) ----
-- Phase E: heading/settings only — ITEMS come exclusively from
-- the central news_items table (news API). Legacy copied item
-- arrays are retired; fresh installs never receive them.
INSERT INTO `page_sections` (`page`, `section_key`, `sort_order`, `content`, `is_active`)
SELECT 'home', 'newsPreview', 20,
  JSON_OBJECT(
    'eyebrow', 'Recent Updates',
    'title', 'Recent News & Notices',
    'description', 'Stay updated with the latest news, notices, events, and announcements from {{identity.shortName}}.'
  ),
  1
FROM DUAL WHERE NOT EXISTS (
  SELECT 1 FROM `page_sections` WHERE `page` = 'home' AND `section_key` = 'newsPreview');

-- ---- home.lifeAtSchool (sort_order 30) ----
-- Image 0 renders as the large 2x2 tile; images 1-4 as squares.
INSERT INTO `page_sections` (`page`, `section_key`, `sort_order`, `content`, `is_active`)
SELECT 'home', 'lifeAtSchool', 30,
  JSON_OBJECT(
    'eyebrow', 'School Life',
    'title', 'Life at {{identity.shortName}}',
    'description', 'A vibrant community where students learn, grow, and create lasting memories.',
    'images', JSON_ARRAY(
      JSON_OBJECT('src', '/Activity/791074857_1519300476879129_5256173980750495448_n.jpg', 'alt', 'Students participating in school activities'),
      JSON_OBJECT('src', '/Activity/733146204_1461550822654095_1531413830165513343_n.jpg', 'alt', 'School event on campus'),
      JSON_OBJECT('src', '/Activity/745503622_1472778644864646_857229043481260756_n.jpg', 'alt', 'Students in classroom'),
      JSON_OBJECT('src', '/Activity/798261940_1522758883199955_4596081823843794397_n.jpg', 'alt', 'Student life on campus'),
      JSON_OBJECT('src', '/Activity/799202494_1523030196506157_181619563109164848_n.jpg', 'alt', 'School activities and celebrations')
    )
  ),
  1
FROM DUAL WHERE NOT EXISTS (
  SELECT 1 FROM `page_sections` WHERE `page` = 'home' AND `section_key` = 'lifeAtSchool');

-- ---- home.videoShowcase (sort_order 40) ----
-- 5 slides — the exact current data. videoUrl uses the
-- {{social.youtube}} token so slides keep following the Site
-- Settings channel URL until an admin sets a per-slide URL.
INSERT INTO `page_sections` (`page`, `section_key`, `sort_order`, `content`, `is_active`)
SELECT 'home', 'videoShowcase', 40,
  JSON_OBJECT(
    'eyebrow', '',
    'title', '',
    'description', '',
    'slides', JSON_ARRAY(
      JSON_OBJECT('eyebrow', 'Campus Life', 'title', 'Life at {{identity.shortName}}', 'description', 'Experience the vibrant campus life and activities at {{identity.name}}.', 'videoUrl', '{{social.youtube}}', 'thumbnail', '/Activity/796941384_1521802823295561_1039006011241713451_n.jpg', 'metadata', JSON_ARRAY('Campus', 'Student Life'), 'buttonText', 'Watch Video'),
      JSON_OBJECT('eyebrow', 'Student Activities', 'title', 'Learning Beyond the Classroom', 'description', 'Discover learning experiences, activities, and memorable moments from {{identity.name}}.', 'videoUrl', '{{social.youtube}}', 'thumbnail', '/Activity/791074857_1519300476879129_5256173980750495448_n.jpg', 'metadata', JSON_ARRAY('Activities', 'Learning'), 'buttonText', 'Watch Video'),
      JSON_OBJECT('eyebrow', 'School Events', 'title', 'Moments That Matter', 'description', 'Explore events and special moments from our school community at {{identity.name}}.', 'videoUrl', '{{social.youtube}}', 'thumbnail', '/Activity/733146204_1461550822654095_1531413830165513343_n.jpg', 'metadata', JSON_ARRAY('Events', 'Community'), 'buttonText', 'Watch Video'),
      JSON_OBJECT('eyebrow', 'Student Life', 'title', 'Growing Together', 'description', 'See how our students grow, learn, and thrive in a nurturing educational environment at {{identity.shortName}}.', 'videoUrl', '{{social.youtube}}', 'thumbnail', '/Activity/745503622_1472778644864646_857229043481260756_n.jpg', 'metadata', JSON_ARRAY('Growth', 'Education'), 'buttonText', 'Watch Video'),
      JSON_OBJECT('eyebrow', 'Our Community', 'title', 'School Spirit in Action', 'description', 'Witness the spirit, dedication, and joy that define the {{identity.name}} experience.', 'videoUrl', '{{social.youtube}}', 'thumbnail', '/Activity/798261940_1522758883199955_4596081823843794397_n.jpg', 'metadata', JSON_ARRAY('Spirit', 'Dedication'), 'buttonText', 'Watch Video')
    )
  ),
  1
FROM DUAL WHERE NOT EXISTS (
  SELECT 1 FROM `page_sections` WHERE `page` = 'home' AND `section_key` = 'videoShowcase');

-- ---- home.admissionsCta (sort_order 50) ----
-- Phase D: this section is now a REFERENCE to the reusable block
-- `admissions-primary-cta` (seeded in 005). No content is copied
-- here — editing the block updates every consumer. Fresh installs
-- get the reference shape; existing DBs are migrated by the
-- backend service on first read (the copied JSON row is replaced
-- by the reference — the copied content was identical to the
-- legacy default).
INSERT INTO `page_sections` (`page`, `section_key`, `sort_order`, `content`, `is_active`)
SELECT 'home', 'admissionsCta', 50,
  JSON_OBJECT('__block', 'admissions-primary-cta'),
  1
FROM DUAL WHERE NOT EXISTS (
  SELECT 1 FROM `page_sections` WHERE `page` = 'home' AND `section_key` = 'admissionsCta');
