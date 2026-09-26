// ------------------------------------------------------------
// Admin API client (Admin auth phase)
//
// Cookie-session mode: the browser automatically attaches the
// HttpOnly session cookie issued by POST /api/auth/login, so no
// token is stored or sent manually. `credentials: 'include'`
// keeps the cookie flowing through the Vite proxy (5174 → 5000).
//
// Errors are normalized into { status, message } so pages can
// react (401/503 → lock the UI) and show safe messages.
//
// Real 429s carry the server's Retry-After header (draft-7 standard
// rate-limit headers); the wait is surfaced as retryAfterMs and noted
// in the message so the UI can show a meaningful countdown instead of
// a dead end. No automatic retry happens here — retrying immediately
// into a throttled window only makes throttling worse.
// ------------------------------------------------------------

/**
 * In-flight identical GET deduplication. React StrictMode mounts
 * effects twice in development, which used to fire every page-load
 * fetch twice against the API rate-limit budget; concurrent callers
 * of the same GET now share one request instead of re-fetching.
 * Keyed by "METHOD path" (GETs carry no body). Entries are removed
 * as soon as the request settles so navigation always refetches.
 */
const inflightGets = new Map();

/**
 * Fetch wrapper for all admin API calls.
 * Resolves with the parsed JSON payload;
 * rejects { status, message, retryAfterMs? }.
 */
async function request(path, { method = 'GET', body, headers: extraHeaders } = {}) {
  const dedupeKey = `${method} ${path}`;
  if (method === 'GET' && body === undefined) {
    const existing = inflightGets.get(dedupeKey);
    if (existing) return existing;
  }

  const run = async () => {
    const headers = { 'Content-Type': 'application/json', ...extraHeaders };

    let response;
    try {
      response = await fetch(path, {
        method,
        headers,
        credentials: 'include', // send the HttpOnly session cookie
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw { status: 0, message: 'Cannot reach the server. Check your connection.' };
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const message = payload?.message || `Request failed (${response.status})`;
      if (response.status === 429) {
        const retryAfterMs = Number(response.headers.get('retry-after')) * 1000 || null;
        throw {
          status: 429,
          retryAfterMs,
          message: retryAfterMs
            ? `${message} The server will accept requests again in about ${Math.ceil(retryAfterMs / 1000)} seconds.`
            : message,
        };
      }
      throw { status: response.status, message };
    }
    return payload;
  };

  const pending = run();
  if (method === 'GET' && body === undefined) {
    inflightGets.set(dedupeKey, pending);
    pending.finally(() => inflightGets.delete(dedupeKey)).catch(() => {
      /* rejections are handled by the original callers */
    });
  }
  return pending;
}

export default request;
