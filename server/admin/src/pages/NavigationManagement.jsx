// ------------------------------------------------------------
// Navigation Management page (Phase 3.3)
//
// Hierarchical list of main menus and submenus with create,
// edit, activate/deactivate and delete flows. All data changes
// go through the admin navigation API service.
// ------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import {
  fetchAdminNavigation,
  createNavigationItem,
  updateNavigationItem,
  deleteNavigationItem,
} from '../services/navigationService';
import { Alert, Loader } from '../components/Feedback';
import NavigationForm from '../components/NavigationForm';
import ConfirmDialog from '../components/ConfirmDialog';

const NONE = { mode: 'none' };

function Badge({ tone, children }) {
  const tones = {
    green: 'bg-green-100 text-green-800',
    gray: 'bg-charcoal-100 text-charcoal-600',
    blue: 'bg-blue-100 text-blue-800',
    amber: 'bg-amber-100 text-amber-800',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

function ItemMeta({ item }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-charcoal-500">
      <Badge tone={item.type === 'DROPDOWN' ? 'blue' : 'gray'}>{item.type}</Badge>
      {item.url ? (
        <span className="max-w-[16rem] truncate font-mono">{item.url}</span>
      ) : (
        <span className="italic">no URL</span>
      )}
      <Badge tone={item.is_active ? 'green' : 'amber'}>
        {item.is_active ? 'Active' : 'Inactive'}
      </Badge>
      <span>Order: {item.sort_order}</span>
      {item.open_new_tab && <Badge tone="gray">new tab</Badge>}
      {item.icon && <span title={item.icon}>icon: {item.icon}</span>}
    </div>
  );
}

function RowActions({ item, onEdit, onAddChild, onDelete }) {
  const btn = 'rounded-lg border border-charcoal-200 px-3 py-1.5 text-xs font-medium text-charcoal-600 transition-colors hover:bg-charcoal-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500';
  return (
    <div className="mt-2 flex flex-wrap gap-2 sm:mt-0 sm:shrink-0">
      {item.type === 'DROPDOWN' && item.parent_id === null && (
        <button type="button" className={btn} onClick={() => onAddChild(item)}>
          + Submenu
        </button>
      )}
      <button type="button" className={btn} onClick={() => onEdit(item)}>Edit</button>
      <button
        type="button"
        className={`${btn} border-red-200 text-red-600 hover:bg-red-50`}
        onClick={() => onDelete(item)}
      >
        Delete
      </button>
    </div>
  );
}

export default function NavigationManagement({ onUnauthorized }) {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(NONE);
  const [confirming, setConfirming] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetchAdminNavigation();
      setTree(res.data || []);
    } catch (err) {
      if (err.status === 401 || err.status === 503) {
        onUnauthorized?.();
        return;
      }
      setLoadError(err.message || 'Failed to load navigation.');
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  const parents = tree.filter((item) => item.type === 'DROPDOWN' && item.parent_id === null);

  const closeForm = () => setForm(NONE);

  const handleCreate = async (payload) => {
    const target = form.mode === 'create-child' ? form.parent : null;
    const body = target ? { ...payload, parent_id: target.id } : payload;
    await createNavigationItem(body);
    setNotice(target
      ? `Submenu “${payload.title}” created under “${target.title}”.`
      : `Menu item “${payload.title}” created.`);
    closeForm();
    await load();
  };

  const handleUpdate = async (payload) => {
    const item = form.item;
    await updateNavigationItem(item.id, payload);
    setNotice(`Menu item “${payload.title}” updated.`);
    closeForm();
    await load();
  };

  const handleDelete = async () => {
    const item = confirming;
    if (!item) return;
    setDeleteBusy(true);
    try {
      await deleteNavigationItem(item.id);
      setNotice(`Menu item “${item.title}” deleted.`);
      setConfirming(null);
      await load();
    } catch (err) {
      if (err.status === 401 || err.status === 503) {
        onUnauthorized?.();
      } else {
        setLoadError(err.message || 'Delete failed.');
      }
      setConfirming(null);
    } finally {
      setDeleteBusy(false);
    }
  };

  const confirmMessage = confirming
    ? (confirming.children && confirming.children.length > 0
      ? `This menu has ${confirming.children.length} submenu item(s). Deletion is blocked until they are deleted or reassigned.`
      : `This action cannot be undone.`)
    : '';

  const itemCard = 'rounded-xl border border-charcoal-200 bg-white p-4 shadow-sm';

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-forest-700">Navigation Management</h1>
          <p className="mt-1 text-sm text-charcoal-500">
            Manage the website menu and submenus. Changes appear on the public site in Phase 3.4.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForm({ mode: 'create' })}
          className="rounded-lg bg-forest-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-forest-700"
        >
          + Add Menu
        </button>
      </div>

      {(notice || loadError) && (
        <div className="mt-4">
          {notice && <Alert kind="success" onClose={() => setNotice('')}>{notice}</Alert>}
          {loadError && <Alert kind="error" onClose={() => setLoadError('')}>{loadError}</Alert>}
        </div>
      )}

      {form.mode === 'create' && (
        <div className="mt-4">
          <NavigationForm
            parents={parents}
            onSubmit={handleCreate}
            onCancel={closeForm}
          />
        </div>
      )}

      {form.mode === 'create-child' && (
        <div className="mt-4">
          <NavigationForm
            parents={parents}
            lockedParentId={form.parent.id}
            onSubmit={handleCreate}
            onCancel={closeForm}
          />
        </div>
      )}

      {form.mode === 'edit' && (
        <div className="mt-4">
          <NavigationForm
            key={form.item.id}
            parents={parents}
            initial={form.item}
            onSubmit={handleUpdate}
            onCancel={closeForm}
          />
        </div>
      )}

      <div className="mt-6">
        {loading ? (
          <Loader label="Loading navigation…" />
        ) : loadError && tree.length === 0 ? (
          <div className={itemCard}>
            <Alert kind="error">{loadError}</Alert>
            <button
              type="button"
              onClick={load}
              className="mt-3 rounded-lg border border-charcoal-200 px-4 py-2 text-sm font-medium text-charcoal-600 hover:bg-charcoal-100"
            >
              Retry
            </button>
          </div>
        ) : tree.length === 0 ? (
          <div className={`${itemCard} text-center`}>
            <p className="text-charcoal-600">No navigation items yet.</p>
            <button
              type="button"
              onClick={() => setForm({ mode: 'create' })}
              className="mt-3 rounded-lg bg-forest-600 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700"
            >
              Create the first menu item
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {tree.map((item) => (
              <li key={item.id}>
                <div className={itemCard}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-charcoal-400" title="Menu order">☰</span>
                        <span className="truncate font-semibold text-charcoal-900">{item.title}</span>
                      </div>
                      <ItemMeta item={item} />
                    </div>
                    <RowActions
                      item={item}
                      onEdit={(it) => setForm({ mode: 'edit', item: it })}
                      onAddChild={(parent) => setForm({ mode: 'create-child', parent })}
                      onDelete={setConfirming}
                    />
                  </div>

                  {item.children.length > 0 && (
                    <ul className="mt-3 space-y-2 border-l-2 border-charcoal-100 pl-4">
                      {item.children.map((child) => (
                        <li key={child.id}>
                          <div className="rounded-lg bg-charcoal-50/70 p-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-charcoal-400">↳</span>
                                  <span className="truncate text-sm font-semibold text-charcoal-800">
                                    {child.title}
                                  </span>
                                </div>
                                <ItemMeta item={child} />
                              </div>
                              <RowActions
                                item={child}
                                onEdit={(it) => setForm({ mode: 'edit', item: it })}
                                onAddChild={() => {}}
                                onDelete={setConfirming}
                              />
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {confirming && (
        <ConfirmDialog
          title={`Delete “${confirming.title}”?`}
          message={confirmMessage}
          busy={deleteBusy}
          onConfirm={handleDelete}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}
