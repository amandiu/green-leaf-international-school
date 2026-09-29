// ------------------------------------------------------------
// Minimal HTTP-aware error types used by the service layer.
// Controllers map `status` onto the HTTP response; anything else
// becomes a generic 500 so internals never leak.
// ------------------------------------------------------------

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function badRequest(message) {
  return new HttpError(400, message);
}

export function notFound(message = 'Not found') {
  return new HttpError(404, message);
}

export function conflict(message) {
  return new HttpError(409, message);
}

export function unauthorized(message = 'Authentication required') {
  return new HttpError(401, message);
}

/**
 * Authenticated but not permitted (§AN.11: 403 is introduced with
 * the role-aware gates; Phase C.6 uses it for the single approved
 * admin-role boundary on /api/admin/users — the full RBAC 403
 * framework remains C7).
 */
export function forbidden(message = 'Access denied') {
  return new HttpError(403, message);
}
