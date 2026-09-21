// ═══════════════════════════════════════════════════════════════
// SITE CONFIG — Single Source of Truth for Organization Branding
// ═══════════════════════════════════════════════════════════════
//
// Change the values in THIS file to rebrand the entire website —
// the public site, the admin panel, browser titles, favicon, SEO
// metadata, contact details and social links all read from here.
//
// This is application-level branding, NOT environment config:
// environment-specific values (ports, DB credentials, AUTH_SECRET,
// CLIENT_URL, ADMIN_URL) belong in server/.env — never here.
//
// Consumed by:
//   client/  (public website)  — imported directly (Vite monorepo)
//   server/admin/ (admin panel) — imported directly (Vite monorepo)
//   server/src/  (API)         — imported directly (ESM monorepo)
// ═══════════════════════════════════════════════════════════════

export const siteConfig = {
  identity: {
    /** Full organization name (headings, SEO, copyright, alt text). */
    name: 'Green Leaf International School & College',
    /** Short brand line shown next to the logo (keep it compact). */
    shortName: 'Green Leaf',
    /** Second line under the short name (Navbar/Footer brand block). */
    subName: 'International School & College',
    /** Hero tagline / main headline support text. */
    tagline: 'Excellence in Knowledge & Character',
    /** Short mission line used in the Footer brand column. */
    description:
      'Providing quality education with a focus on academic excellence, moral values, and character development.',
    /**
     * Initial letter(s) used in monogram fallbacks (leadership
     * portraits, logo placeholders). Keep it 1–2 characters.
     */
    monogram: 'G',
  },

  branding: {
    /** Logo shown in Navbar, Footer, Hero and Contact. */
    logo: '/logo.jpg',
    /** Browser tab icon for the public site AND the admin panel. */
    favicon: '/favicon.svg',
    /** Social preview image (Open Graph). Site-relative path. */
    ogImage: '/logo.jpg',
  },

  contact: {
    /** Shown in Footer/Contact. Keep placeholders until verified. */
    email: '[Email Address]',
    phone: '[Phone Number]',
    address: '[School Address]',
    /** Public contact form address (Admissions "Email Admissions" CTA). */
    admissionsEmail: '[admissions@greenleaf.edu]',
    officeHours: 'Sun — Thu: 8:00 AM — 4:00 PM',
    officeHoursClosed: 'Fri — Sat: Closed',
  },

  social: {
    /** Any entry set to null is hidden from the UI automatically. */
    facebook:
      'https://www.facebook.com/greenleafinternationalschoolandcollege/',
    youtube:
      'https://www.youtube.com/@greenleafinternationalscho29/videos',
    instagram: null,
    linkedin: null,
  },

  location: {
    /**
     * Google Maps embed + directions links. Built from the address
     * below so a new school only edits ONE place. Set to null to
     * hide the map and show the branded placeholder instead.
     */
    address:
      '526-A Rd 12-B, Adabor, Dhaka 1207, Bangladesh',
    mapsQuery: 'Green+Leaf+International+School+and+College,+526-A+Rd+12-B,+Adabor,+Dhaka+1207',
    mapsZoom: 17,
  },

  seo: {
    /** Default browser tab title. */
    title: 'Green Leaf International School & College',
    /** Meta description for the public site. */
    description:
      'Green Leaf International School & College — Nurturing Minds, Growing Futures',
    /** Admin panel browser title suffix (e.g. "<name> Admin"). */
    adminTitle: 'Green Leaf Admin',
  },

  /** API identity (health endpoint message, startup logs). */
  api: {
    healthMessage: 'Green Leaf API is running',
  },
};

// ═══════════════════════════════════════════════════════════════
// DERIVED VALUES — computed from the config above.
// Components should use these helpers instead of re-building URLs.
// ═══════════════════════════════════════════════════════════════

/** Google Maps embed URL for the campus map iframe. */
export const getMapsEmbedUrl = () =>
  siteConfig.location.mapsQuery
    ? `https://maps.google.com/maps?q=${siteConfig.location.mapsQuery}&z=${siteConfig.location.mapsZoom}&output=embed`
    : null;

/** Google Maps "Get Directions" URL. */
export const getMapsDirectionsUrl = () =>
  siteConfig.location.mapsQuery
    ? `https://www.google.com/maps/dir/?api=1&destination=${siteConfig.location.mapsQuery}`
    : null;

export default siteConfig;
