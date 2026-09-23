// ------------------------------------------------------------
// Public uploads routes
//
// Mounted at /api/uploads. Serves ONLY sanitized, server-generated
// images from the managed upload directories:
//   GET /api/uploads/leadership/:file   (portraits)
//   GET /api/uploads/images/:file       (generic CMS images)
//
// The URL shapes match the public prefixes in utils/imageUpload.js
// (LEADERSHIP_PUBLIC_PREFIX / IMAGES_PUBLIC_PREFIX). Filenames are
// strictly validated before any filesystem access (path-traversal
// safe): plain names only — no slashes, no "..", no null bytes —
// plus a defense-in-depth containment check on the resolved path.
// Only files produced by the sanitizer ever live in these
// directories; nothing else is exposed.
// ------------------------------------------------------------

import { Router } from 'express';
import { resolve } from 'node:path';
import { stat } from 'node:fs/promises';

const router = Router();

const ROOTS = {
  leadership: resolve(process.cwd(), 'src', 'uploads', 'leadership'),
  images: resolve(process.cwd(), 'src', 'uploads', 'images'),
};

function serveFromRoot(root, file, res) {
  // Plain filename only — no slashes, no "..", no null bytes.
  if (!/^[A-Za-z0-9._-]+$/.test(file) || file.includes('..')) {
    return res.status(400).json({ success: false, message: 'Invalid file name' });
  }

  const target = resolve(root, file);
  // Defense in depth: resolved path must stay inside the root.
  if (target !== root && !target.startsWith(`${root}\\`) && !target.startsWith(`${root}/`)) {
    return res.status(400).json({ success: false, message: 'Invalid file name' });
  }

  stat(target)
    .then(() => {
      res.sendFile(target, (err) => {
        if (err && !res.headersSent) {
          res.status(404).json({ success: false, message: 'Not found' });
        }
      });
    })
    .catch(() => {
      res.status(404).json({ success: false, message: 'Not found' });
    });
}

router.get('/leadership/:file', (req, res) => {
  serveFromRoot(ROOTS.leadership, req.params.file, res);
});

router.get('/images/:file', (req, res) => {
  serveFromRoot(ROOTS.images, req.params.file, res);
});

export default router;
