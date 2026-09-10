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
  SETTINGS: '/api/settings',
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
