// ------------------------------------------------------------
// Navigation routes (Phase 3.2 — read-only)
//
// Mounted at /api/navigation. Only the public GET endpoint
// exists in this phase; admin CRUD arrives in a later phase.
// ------------------------------------------------------------

import { Router } from 'express';
import { getNavigation } from '../controllers/navigationController.js';

const router = Router();

router.get('/', getNavigation);

export default router;
