// API route prefixes
export const API_ROUTES = {
  HEALTH: '/api/health',
  AUTH: '/api/auth',
  HOME: '/api/home',
  ABOUT: '/api/about',
  ACADEMICS: '/api/academics',
  ADMISSIONS: '/api/admissions',
  GALLERY: '/api/gallery',
  NEWS: '/api/news',
  VIDEOS: '/api/videos',
  CONTACT: '/api/contact',
  NAVIGATION: '/api/navigation',
  LEADERSHIP: '/api/leadership',
  LEADERSHIP_MESSAGES: '/api/leadership-messages',
  SETTINGS: '/api/settings',
  PAGES_HOME: '/api/pages/home',
  // Phase B.3: DB-backed page content (page_sections) for the
  // About / Academics / Campus informational pages.
  PAGES_ABOUT: '/api/pages/about',
  PAGES_ACADEMICS: '/api/pages/academics',
  PAGES_CAMPUS: '/api/pages/campus',
  // Phase B.6: Downloads Center (downloads entity + secure
  // DB-mediated file serving).
  DOWNLOADS: '/api/downloads',
  CONTENT_BLOCKS: '/api/content/blocks',
  UPLOADS: '/api/uploads',
};

// HTTP status codes
export const STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY: 429,
  SERVER_ERROR: 500,
};

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 50,
};
