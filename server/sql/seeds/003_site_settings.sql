-- ============================================================
-- Green Leaf — Seed 003: Site settings initial values (Phase A)
--
-- Seeds the CURRENT values from shared/config/siteConfig.js so the
-- website looks exactly the same after this phase if the admin
-- makes no changes. No new values are fabricated.
--
-- Idempotent: INSERT ... SELECT ... WHERE NOT EXISTS per row —
-- re-running never duplicates or overwrites. An admin's later
-- edits in the DB always win over this seed (the seed only fills
-- keys that are still missing).
-- ============================================================

-- ---- identity ----
INSERT INTO `site_settings` (`setting_key`, `setting_value`, `setting_group`)
SELECT 'identity.name', 'Green Leaf International School & College', 'identity'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `site_settings` WHERE `setting_key` = 'identity.name');

INSERT INTO `site_settings` (`setting_key`, `setting_value`, `setting_group`)
SELECT 'identity.shortName', 'Green Leaf', 'identity'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `site_settings` WHERE `setting_key` = 'identity.shortName');

INSERT INTO `site_settings` (`setting_key`, `setting_value`, `setting_group`)
SELECT 'identity.subName', 'International School & College', 'identity'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `site_settings` WHERE `setting_key` = 'identity.subName');

INSERT INTO `site_settings` (`setting_key`, `setting_value`, `setting_group`)
SELECT 'identity.tagline', 'Excellence in Knowledge & Character', 'identity'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `site_settings` WHERE `setting_key` = 'identity.tagline');

INSERT INTO `site_settings` (`setting_key`, `setting_value`, `setting_group`)
SELECT 'identity.description', 'Providing quality education with a focus on academic excellence, moral values, and character development.', 'identity'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `site_settings` WHERE `setting_key` = 'identity.description');

INSERT INTO `site_settings` (`setting_key`, `setting_value`, `setting_group`)
SELECT 'identity.monogram', 'G', 'identity'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `site_settings` WHERE `setting_key` = 'identity.monogram');

-- ---- branding ----
INSERT INTO `site_settings` (`setting_key`, `setting_value`, `setting_group`)
SELECT 'branding.logo', '/logo.jpg', 'branding'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `site_settings` WHERE `setting_key` = 'branding.logo');

INSERT INTO `site_settings` (`setting_key`, `setting_value`, `setting_group`)
SELECT 'branding.favicon', '/favicon.svg', 'branding'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `site_settings` WHERE `setting_key` = 'branding.favicon');

INSERT INTO `site_settings` (`setting_key`, `setting_value`, `setting_group`)
SELECT 'branding.ogImage', '/logo.jpg', 'branding'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `site_settings` WHERE `setting_key` = 'branding.ogImage');

-- ---- contact ----
INSERT INTO `site_settings` (`setting_key`, `setting_value`, `setting_group`)
SELECT 'contact.email', '[Email Address]', 'contact'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `site_settings` WHERE `setting_key` = 'contact.email');

INSERT INTO `site_settings` (`setting_key`, `setting_value`, `setting_group`)
SELECT 'contact.phone', '[Phone Number]', 'contact'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `site_settings` WHERE `setting_key` = 'contact.phone');

INSERT INTO `site_settings` (`setting_key`, `setting_value`, `setting_group`)
SELECT 'contact.address', '[School Address]', 'contact'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `site_settings` WHERE `setting_key` = 'contact.address');

INSERT INTO `site_settings` (`setting_key`, `setting_value`, `setting_group`)
SELECT 'contact.admissionsEmail', '[admissions@greenleaf.edu]', 'contact'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `site_settings` WHERE `setting_key` = 'contact.admissionsEmail');

INSERT INTO `site_settings` (`setting_key`, `setting_value`, `setting_group`)
SELECT 'contact.officeHours', 'Sun — Thu: 8:00 AM — 4:00 PM', 'contact'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `site_settings` WHERE `setting_key` = 'contact.officeHours');

INSERT INTO `site_settings` (`setting_key`, `setting_value`, `setting_group`)
SELECT 'contact.officeHoursClosed', 'Fri — Sat: Closed', 'contact'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `site_settings` WHERE `setting_key` = 'contact.officeHoursClosed');

-- ---- social (nullable — stored as SQL NULL) ----
INSERT INTO `site_settings` (`setting_key`, `setting_value`, `setting_group`)
SELECT 'social.facebook', 'https://www.facebook.com/greenleafinternationalschoolandcollege/', 'social'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `site_settings` WHERE `setting_key` = 'social.facebook');

INSERT INTO `site_settings` (`setting_key`, `setting_value`, `setting_group`)
SELECT 'social.youtube', 'https://www.youtube.com/@greenleafinternationalscho29/videos', 'social'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `site_settings` WHERE `setting_key` = 'social.youtube');

INSERT INTO `site_settings` (`setting_key`, `setting_value`, `setting_group`)
SELECT 'social.instagram', NULL, 'social'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `site_settings` WHERE `setting_key` = 'social.instagram');

INSERT INTO `site_settings` (`setting_key`, `setting_value`, `setting_group`)
SELECT 'social.linkedin', NULL, 'social'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `site_settings` WHERE `setting_key` = 'social.linkedin');

-- ---- location ----
INSERT INTO `site_settings` (`setting_key`, `setting_value`, `setting_group`)
SELECT 'location.address', '526-A Rd 12-B, Adabor, Dhaka 1207, Bangladesh', 'location'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `site_settings` WHERE `setting_key` = 'location.address');

INSERT INTO `site_settings` (`setting_key`, `setting_value`, `setting_group`)
SELECT 'location.mapsQuery', 'Green+Leaf+International+School+and+College,+526-A+Rd+12-B,+Adabor,+Dhaka+1207', 'location'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `site_settings` WHERE `setting_key` = 'location.mapsQuery');

INSERT INTO `site_settings` (`setting_key`, `setting_value`, `setting_group`)
SELECT 'location.mapsZoom', '17', 'location'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `site_settings` WHERE `setting_key` = 'location.mapsZoom');

-- ---- seo ----
INSERT INTO `site_settings` (`setting_key`, `setting_value`, `setting_group`)
SELECT 'seo.title', 'Green Leaf International School & College', 'seo'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `site_settings` WHERE `setting_key` = 'seo.title');

INSERT INTO `site_settings` (`setting_key`, `setting_value`, `setting_group`)
SELECT 'seo.description', 'Green Leaf International School & College — Nurturing Minds, Growing Futures', 'seo'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `site_settings` WHERE `setting_key` = 'seo.description');
