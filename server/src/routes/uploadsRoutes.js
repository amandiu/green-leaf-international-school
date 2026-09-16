// ------------------------------------------------------------
// Public uploads routes
//
// Mounted at /api/uploads. Serves stored leadership portraits:
//   GET /api/uploads/leadership/:file
//
// The URL shape matches the IMAGE_RE whitelist in
// leadershipValidation.js and the LEADERSHIP_PUBLIC_PREFIX in
// utils/imageUpload.js. Filename is strictly validated before
// any filesystem access (path-traversal safe).
// ------------------------------------------------------------

import { Router } from 'express';
import { resolve } from 'node:path';
import { stat } from 'node:fs/promises';

const router = Router();

const ROOT = resolve(process.cwd(), 'src', 'uploads', 'leadership');

router.get('/leadership/:file', async (req, res) => {
  const { file } = req.params;

  // Plain filename only — no slashes, no "..", no null bytes.
  if (!/^[A-Za-z0-9._-]+$/.test(file) || file.includes('..')) {
    return res.status(400).json({ success: false, message: 'Invalid file name' });
  }

  const target = resolve(ROOT, file);
  // Defense in depth: resolved path must stay inside ROOT.
  if (target !== ROOT && !target.startsWith(`${ROOT}\\`) && !target.startsWith(`${ROOT}/`)) {
    return res.status(400).json({ success: false, message: 'Invalid file name' });
  }

  try {
    await stat(target);
  } catch {
    return res.status(404).json({ success: false, message: 'Not found' });
  }

  res.sendFile(target, (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ success: false, message: 'Not found' });
    }
  });
});

export default router;
