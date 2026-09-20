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
// ------------------------------------------------------------

/**
 * Fetch wrapper for all admin API calls.
 * Resolves with the parsed JSON payload; rejects { status, message }.
 */
async function request(path, { method = 'GET', body, headers: extraHeaders } = {}) {
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
    throw {
      status: response.status,
      message: payload?.message || `Request failed (${response.status})`,
    };
  }
  return payload;
}

export default request;
