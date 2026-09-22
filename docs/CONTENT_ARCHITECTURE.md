# Content Architecture — Central Content & Reusable Content (Phase C)

Single-source-of-truth rules for all site content: what is central,
what is reusable, what is page-specific, and where each value lives.

---

## Content categories

### Category A — Global content (the organization itself)

**Source of truth: `site_settings` table (admin-editable), seeded/fallback from `shared/config/siteConfig.js`.**

| Group | Keys | Primary consumers |
|---|---|---|
| `identity` | name, shortName, subName, tagline, description, monogram | Navbar, Footer, Hero, page titles, SEO |
| `branding` | logo, favicon, ogImage | Navbar, Footer, head sync |
| `contact` | email, phone, admissionsEmail, officeHours, officeHoursClosed | Footer, Contact, Admissions |
| `social` | facebook, youtube, instagram, linkedin (nullable) | Footer, Contact, Homepage video showcase |
| `location` | **address, mapsQuery, mapsZoom** | Homepage map, Contact map/details, Footer address |
| `seo` | title, description | Head sync |

**Phase C rule:** the school address is `location.address` ONLY.
The old `contact.address` duplicate is retired: writes are rejected
(400) and the settings service never serves a legacy row. Location
& Map is edited in exactly ONE admin place: **Content Center**.

### Category B — Reusable content blocks (Phase D)

**Source of truth: `content_blocks` table (block_key UNIQUE, per-type
validated JSON, is_active), fallback from `shared/content/contentBlocks.js`.**

| block_key | type | Used in |
|---|---|---|
| `admissions-primary-cta` | CTA | Homepage (admissionsCta section), Admissions page (closing band) |

Rules:
- Consumers REFERENCE blocks by `block_key` — never copy content.
  The home `admissionsCta` section stores
  `{ __block: 'admissions-primary-cta' }` in `page_sections`.
- "Used in" is DERIVED from those references (never stored manually).
- A referenced block cannot be deleted (409 names the consumers);
  deactivate instead. Inactive/missing blocks → consumers fall back
  to the shared defaults (or hide) — pages never crash.
- Settings values are never copied into blocks: sanctioned
  `{{identity.*}}`, `{{contact.*}}`, `{{social.*}}`, `{{location.*}}`
  tokens resolve from Site Settings at render time.

### Category C — Page-specific content

Belongs to one page only; stays in that page (or its `page_sections`
row for the Homepage):

- About history, Academics programs, Campus facilities/gallery,
  Admissions process/requirements, News preview placeholders.

### Category D — Transactional / dynamic data

**Source of truth: dedicated entity tables — NOT `site_settings`, NOT
`content_blocks`.** Created/removed over time; owned by their own
admin CRUD.

| Entity | Table | Since | Consumers |
|---|---|---|---|
| News / Notices / Events / Announcements | `news_items` | Phase E | Homepage preview (first 3 cards), Navbar ticker (title-only), News page (full list), `/news/:slug` detail |

- Types justified by the existing content: `NEWS`, `NOTICE`, `EVENT`,
  `ANNOUNCEMENT`. Status lifecycle: `DRAFT` → `PUBLISHED` → `ARCHIVED`.
  Only `PUBLISHED` rows are served publicly, newest first.
- Slugs are unique (auto-generated from the title, `-2`/`-3` suffixes on
  collision) and never silently regenerated on update — existing URLs
  keep working unless the admin explicitly edits the slug.
- Dates are stored in UTC; every served item also carries a
  preformatted `dateLabel` fixed to **Asia/Dhaka**, so every visitor
  sees identical, predictable dates regardless of device timezone.
- Frontend access: ONE `NewsProvider` (`useNews()`) fetches
  `GET /api/news` once at the app root; Navbar, Homepage and News page
  consume the same cached list — no per-component fetches.
- Empty state is intentional: no published items → "No news or notices
  published yet." Placeholder/demo news is never shown as published.

Future dedicated models (News, Notices, Events, forms). Never merged
into generic reusable blocks. Homepage `newsPreview` section copy is
Phase B; the preview items remain placeholders until the News phase.

---

## Reusable block data flow (Phase D)

```
Admin → Content Center → Reusable Content → Admissions Primary CTA
          ↓  PUT /api/admin/content/blocks/admissions-primary-cta
        content_blocks (single stored source)
          ↓  GET /api/content/blocks (public) / GET /api/pages/home (resolved reference)
   ReusableContentProvider (client, one fetch, defaults fallback)
          ↓  useReusableContent().getBlock(key)
   ┌──────────────────┬──────────────────────┐
   Homepage CTA band   Admissions page band   (future consumers)
   actions: info,      actions: email, call
            contact-page
```

## Map / location data flow (the Phase C driver)

```
Admin → Content Center → Location & Map     (single editing surface)
          ↓  PUT /api/admin/settings  { location: {...} }
        site_settings.location.*             (single stored source)
          ↓  GET /api/settings               (merged effective settings)
      SettingsContext (client, one fetch, siteConfig fallback)
          ↓  useSettings().location + buildMapsUrls()
   ┌────────────┬─────────────┬──────────────┐
   Homepage map  Contact map  Footer address  (any future consumer)
```

`shared/utils/mapsUrls.js` is the ONLY Google Maps URL builder;
`siteConfig.getMapsEmbedUrl()/getMapsDirectionsUrl()` delegate to it.

---

## Frontend access rules

- Components read central content via `useSettings()` /
  `useHomeContent()` / `useReusableContent().getBlock(key)` /
  `useNews()` — never direct API calls, no waterfalls.
- Every central value must have a safe fallback (siteConfig.js /
  homeContent.js) so an API/DB failure never blanks the site.
- Map consumers render a branded placeholder + disabled CTA when
  `mapsQuery` is null (the sanctioned "not configured" signal).

---

## Adding a new central field (checklist)

1. Add the key to `siteConfig.js` (fallback/seed value).
2. Add the key + validation rule in `server/src/validators/settingsValidation.js`.
3. Add a seed row in `server/sql/seeds/003_site_settings.sql` if needed.
4. Surface it in the right admin page (Content Center for multi-page
   content, Site Settings for single-surface globals).
5. Consume it through `useSettings()` — never hardcode the value.
