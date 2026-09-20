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
