// ------------------------------------------------------------
// Admin API client
//
// Single fetch wrapper for the admin app. Attaches the stored
// admin token as a Bearer credential and normalizes errors into
// { status, message } so pages can show safe messages.
// ------------------------------------------------------------

const TOKEN_KEY = 'greenleaf_admin_token';

export function getStoredToken() {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function storeToken(token) {
  try {
    window.sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable — session-only unlock won't persist */
  }
}

export function clearToken() {
  try {
    window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function request(path, { method = 'GET', body, headers: extraHeaders } = {}) {
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(path, {
      method,
      headers,
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
