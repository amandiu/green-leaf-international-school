// ------------------------------------------------------------
// Admin navigation controller (Phase 3.3)
//
// HTTP concerns only — validation and hierarchy rules live in
// the service; SQL lives in the model. All routes are behind
// the admin auth middleware. HttpErrors map to their status;
// everything else becomes a safe generic 500.
// ------------------------------------------------------------

import {
  getAdminNavigation,
  createNavigationItem,
  updateNavigationItem,
  deleteNavigationItem,
} from '../services/navigationService.js';
import { HttpError } from '../utils/errors.js';

export async function listNavigation(_req, res) {
  try {
    const data = await getAdminNavigation();
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('Admin: failed to list navigation:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load navigation' });
  }
}

export async function createNavigation(req, res) {
  try {
    const item = await createNavigationItem(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('Admin: failed to create navigation item:', err.message);
    res.status(500).json({ success: false, message: 'Failed to create menu item' });
  }
}

export async function updateNavigation(req, res) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid menu item id' });
    }
    const item = await updateNavigationItem(id, req.body);
    res.status(200).json({ success: true, data: item });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('Admin: failed to update navigation item:', err.message);
    res.status(500).json({ success: false, message: 'Failed to update menu item' });
  }
}

export async function deleteNavigation(req, res) {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid menu item id' });
    }
    await deleteNavigationItem(id);
    res.status(200).json({ success: true, message: 'Menu item deleted' });
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    console.error('Admin: failed to delete navigation item:', err.message);
    res.status(500).json({ success: false, message: 'Failed to delete menu item' });
  }
}
