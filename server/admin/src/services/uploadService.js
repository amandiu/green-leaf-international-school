// ------------------------------------------------------------
// Admin image upload service (secure image-upload phase)
//
// ONE uploader service for every admin image field (news, hero
// slides, life images, video thumbnails, branding). Sends
// multipart/form-data with a single "image" part to the
// centralized endpoint; the HttpOnly session cookie authenticates
// the request (credentials: 'include'). Errors are normalized to
// { status, message } like the shared fetch wrapper.
// ------------------------------------------------------------

/**
 * Upload one image file to POST /api/admin/uploads/image.
 * Returns { image_path, width, height, bytes } on success;
 * rejects with { status, message } on failure.
 */
export async function uploadImage(file) {
  const form = new FormData();
  form.append('image', file, file.name);

  let response;
  try {
    response = await fetch('/api/admin/uploads/image', {
      method: 'POST',
      credentials: 'include', // HttpOnly session cookie
      body: form, // browser sets the multipart Content-Type + boundary
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
      message: payload?.message || `Upload failed (${response.status})`,
    };
  }
  return payload?.data || {};
}
