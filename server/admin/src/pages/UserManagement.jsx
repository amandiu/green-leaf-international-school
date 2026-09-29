// ------------------------------------------------------------
// User Management page (Phase C.6)
//
// Admin → User Management: the canonical identity administration
// surface (SYSTEM_DESIGN §AN.17 C6 row) over /api/admin/users.
//
// Conventions mirror the existing admin pages: same shell styling,
// Alert banners (Feedback.jsx contract), Loader, ConfirmDialog for
// destructive actions, busy-id gating, and the shared API client
// (401/503 → onUnauthorized). Safe data only — the API never
// returns credential fields, and the raw reset token is shown ONCE
// in a dismissible banner (never stored in component state beyond
// the single display, never logged).
// ------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import request from '../services/api';
import { Alert, Loader } from '../components/Feedback';
import ConfirmDialog from '../components/ConfirmDialog';

const ROLE_CODES = ['admin', 'student', 'teacher', 'guardian'];
const ROLE_CLASS = {
  admin: 'bg-forest-100 text-forest-700',
  student: 'bg-blue-50 text-blue-700',
  teacher: 'bg-gold-100 text-gold-700',
  guardian: 'bg-charcoal-100 text-charcoal-600',
};

const inputClass =
  'mt-1 w-full rounded-lg border border-charcoal-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent';
const labelClass = 'block text-sm font-medium text-charcoal-700';

const EMPTY_FORM = { email: '', name: '', password: '', roles: ['student'], originalRoles: [], primaryRole: 'student' };

function toForm(user) {
  return {
    email: user.email ?? '',
    name: user.name ?? '',
    password: '',
    roles: user.roles?.length ? [...user.roles] : ['student'],
    originalRoles: user.roles ? [...user.roles] : [],
    primaryRole: user.roles?.[0] ?? 'student',
  };
}

/** One-time display banner for an ADMIN-ISSUED reset token. */
function ResetTokenBanner({ token, expiresInMinutes, onClose }) {
  return (
    <div className="mt-4">
      <Alert kind="info" onClose={onClose}>
        <span className="block font-semibold">One-time reset token (valid {expiresInMinutes} minutes)</span>
        <code className="mt-1 block break-all rounded bg-white/70 px-2 py-1 font-mono text-xs">{token}</code>
        <span className="mt-1 block text-xs">
          Copy it now — it is shown only once. The user signs in with it on the reset flow; issuing a new token
          invalidates this one.
        </span>
      </Alert>
    </div>
  );
}

export default function UserManagement({ onUnauthorized }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = create
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');

  const [confirm, setConfirm] = useState(null); // { kind: 'deactivate'|'activate'|'reset', user }
  const [resetBanner, setResetBanner] = useState(null); // { token, expiresInMinutes }

  const load = useCallback(async () => {
    setLoading(true);
    setPageError('');
    try {
      const res = await request('/api/admin/users');
      setUsers(res?.data?.users ?? []);
    } catch (err) {
      if (err?.status === 401 || err?.status === 503) { onUnauthorized(); return; }
      setPageError(err?.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(user) {
    setEditingId(user.id);
    setForm(toForm(user));
    setFormError('');
    setShowForm(true);
  }

  function toggleRole(code) {
    setForm((f) => {
      const has = f.roles.includes(code);
      const roles = has ? f.roles.filter((r) => r !== code) : [...f.roles, code];
      const nextRoles = roles.length ? roles : [code];
      return {
        ...f,
        roles: nextRoles,
        primaryRole: nextRoles.includes(f.primaryRole) ? f.primaryRole : nextRoles[0],
      };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!form.email.trim() || !form.password) { setFormError('Email and password are required.'); return; }
    if (form.roles.length === 0) { setFormError('At least one role is required.'); return; }

    setBusyId('form');
    try {
      if (editingId === null) {
        await request('/api/admin/users', {
          method: 'POST',
          body: {
            email: form.email.trim().toLowerCase(),
            name: form.name.trim() || null,
            roles: form.roles,
            primaryRole: form.primaryRole,
            password: form.password,
          },
        });
        setNotice(`Account created for ${form.email.trim().toLowerCase()}.`);
      } else {
        // Edit = role assignment only (C6 scope: roles are the
        // editable dimension on an existing identity; lifecycle is
        // the separate status action). Newly selected roles are
        // assigned; the chosen primary gets the makePrimary swap.
        const added = form.roles.filter((r) => !form.originalRoles.includes(r));
        for (const role of added) {
          await request(`/api/admin/users/${editingId}/roles`, {
            method: 'POST',
            body: { role, makePrimary: role === form.primaryRole },
          });
        }
        if (added.length === 0 && form.primaryRole !== form.originalRoles[0] && form.roles.includes(form.primaryRole)) {
          await request(`/api/admin/users/${editingId}/roles`, {
            method: 'POST',
            body: { role: form.primaryRole, makePrimary: true },
          });
        }
        setNotice('Role assignments saved.');
      }
      setShowForm(false);
      await load();
    } catch (err) {
      if (err?.status === 401 || err?.status === 503) { onUnauthorized(); return; }
      setFormError(err?.message || 'Request failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRoleAssign(user, role, makePrimary) {
    setBusyId(user.id);
    setNotice('');
    setPageError('');
    try {
      await request(`/api/admin/users/${user.id}/roles`, {
        method: 'POST',
        body: { role, makePrimary },
      });
      await load();
    } catch (err) {
      if (err?.status === 401 || err?.status === 503) { onUnauthorized(); return; }
      setPageError(err?.message || 'Role assignment failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleStatus(user) {
    setBusyId(user.id);
    setPageError('');
    try {
      await request(`/api/admin/users/${user.id}/status`, {
        method: 'PUT',
        body: { isActive: !user.is_active },
      });
      await load();
    } catch (err) {
      if (err?.status === 401 || err?.status === 503) { onUnauthorized(); return; }
      setPageError(err?.message || 'Status change failed.');
    } finally {
      setBusyId(null);
      setConfirm(null);
    }
  }

  async function handleResetIssue(user) {
    setBusyId(user.id);
    setPageError('');
    try {
      const res = await request(`/api/admin/users/${user.id}/reset-token`, { method: 'POST' });
      setResetBanner({
        token: res?.data?.resetToken,
        expiresInMinutes: res?.data?.expiresInMinutes ?? 60,
      });
      setConfirm(null);
    } catch (err) {
      if (err?.status === 401 || err?.status === 503) { onUnauthorized(); return; }
      setPageError(err?.message || 'Reset issuance failed.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-charcoal-50">
        <main className="mx-auto w-full max-w-6xl px-6 py-10"><Loader label="Loading users…" /></main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal-50">
      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-forest-700">User Management</h1>
            <p className="mt-1 text-sm text-charcoal-500">
              Canonical accounts ({users.length}) — create, activate/deactivate, assign roles and issue one-time reset tokens.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-forest-700 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-800"
          >
            + New user
          </button>
        </div>

        {pageError && <div className="mt-4"><Alert kind="error" onClose={() => setPageError('')}>{pageError}</Alert></div>}
        {notice && <div className="mt-4"><Alert kind="success" onClose={() => setNotice('')}>{notice}</Alert></div>}
        {resetBanner && (
          <ResetTokenBanner
            token={resetBanner.token}
            expiresInMinutes={resetBanner.expiresInMinutes}
            onClose={() => setResetBanner(null)}
          />
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="mt-6 rounded-xl border border-charcoal-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold text-charcoal-900">{editingId === null ? 'Create user' : `Edit roles — user #${editingId}`}</h2>
            {formError && <div className="mt-3"><Alert kind="error">{formError}</Alert></div>}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="u-email" className={labelClass}>Email</label>
                <input id="u-email" type="email" autoComplete="off" className={inputClass}
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  disabled={editingId !== null || busyId === 'form'} required />
              </div>
              <div>
                <label htmlFor="u-name" className={labelClass}>Name (optional)</label>
                <input id="u-name" type="text" className={inputClass}
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  disabled={busyId === 'form'} />
              </div>
              {editingId === null && (
                <div>
                  <label htmlFor="u-password" className={labelClass}>Initial password</label>
                  <input id="u-password" type="text" autoComplete="off" className={inputClass}
                    value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    disabled={busyId === 'form'} required minLength={8} />
                  <p className="mt-1 text-xs text-charcoal-400">Minimum 8 characters. Hashed with bcrypt; never stored in plaintext.</p>
                </div>
              )}
            </div>

            <fieldset className="mt-4" disabled={busyId === 'form'}>
              <legend className={labelClass}>Roles (first selected becomes primary)</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {ROLE_CODES.map((code) => (
                  <button key={code} type="button" onClick={() => toggleRole(code)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${
                      form.roles.includes(code)
                        ? 'border-forest-500 bg-forest-50 text-forest-700'
                        : 'border-charcoal-200 bg-white text-charcoal-500 hover:border-forest-300'
                    }`}>
                    {form.primaryRole === code ? `${code} ★` : code}
                  </button>
                ))}
              </div>
              <div className="mt-2">
                <label htmlFor="u-primary" className="text-xs text-charcoal-500">Primary role</label>
                <select id="u-primary" className={inputClass} value={form.primaryRole}
                  onChange={(e) => setForm({ ...form, primaryRole: e.target.value })}>
                  {form.roles.map((code) => <option key={code} value={code}>{code}</option>)}
                </select>
              </div>
            </fieldset>

            <div className="mt-6 flex flex-wrap gap-2">
              <button type="submit" disabled={busyId === 'form'}
                className="rounded-lg bg-forest-700 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-800 disabled:opacity-50">
                {busyId === 'form' ? 'Saving…' : editingId === null ? 'Create user' : 'Save roles'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="rounded-lg border border-charcoal-200 px-4 py-2 text-sm font-medium text-charcoal-600 hover:bg-charcoal-100">
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 overflow-x-auto rounded-xl border border-charcoal-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-charcoal-200 text-sm">
            <thead className="bg-charcoal-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-charcoal-500">ID</th>
                <th className="px-4 py-3 text-left font-semibold text-charcoal-500">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-charcoal-500">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-charcoal-500">Roles</th>
                <th className="px-4 py-3 text-left font-semibold text-charcoal-500">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-charcoal-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-100">
              {users.map((u) => (
                <tr key={u.id} className={u.is_active ? '' : 'bg-charcoal-50/60'}>
                  <td className="px-4 py-3 text-charcoal-400">{u.id}</td>
                  <td className="px-4 py-3 font-medium text-charcoal-800">{u.email}</td>
                  <td className="px-4 py-3 text-charcoal-600">{u.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      {(u.roles ?? []).map((code, i) => (
                        <span key={code} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ROLE_CLASS[code] ?? 'bg-charcoal-100 text-charcoal-600'}`}>
                          {i === 0 ? `${code} ★` : code}
                        </span>
                      ))}
                      {(!u.roles || u.roles.length === 0) && <span className="text-xs text-charcoal-400">no roles</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      <button type="button" disabled={busyId === u.id}
                        onClick={() => handleRoleAssign(u, 'admin', false)}
                        className="rounded-lg border border-charcoal-200 px-2 py-1 text-xs font-medium text-charcoal-600 hover:bg-charcoal-100 disabled:opacity-50">
                        + admin
                      </button>
                      <button type="button" disabled={busyId === u.id}
                        onClick={() => openEdit(u)}
                        className="rounded-lg border border-charcoal-200 px-2 py-1 text-xs font-medium text-charcoal-600 hover:bg-charcoal-100 disabled:opacity-50">
                        Roles
                      </button>
                      <button type="button" disabled={busyId === u.id}
                        onClick={() => setConfirm({ kind: u.is_active ? 'deactivate' : 'activate', user: u })}
                        className={`rounded-lg px-2 py-1 text-xs font-medium disabled:opacity-50 ${
                          u.is_active
                            ? 'border border-red-200 text-red-600 hover:bg-red-50'
                            : 'border border-green-200 text-green-700 hover:bg-green-50'
                        }`}>
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button type="button" disabled={busyId === u.id}
                        onClick={() => setConfirm({ kind: 'reset', user: u })}
                        className="rounded-lg border border-gold-300 px-2 py-1 text-xs font-medium text-gold-700 hover:bg-gold-50 disabled:opacity-50">
                        Reset token
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-charcoal-400">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {confirm && confirm.kind !== 'reset' && (
        <ConfirmDialog
          title={confirm.kind === 'deactivate' ? 'Deactivate this user?' : 'Activate this user?'}
          message={confirm.kind === 'deactivate'
            ? `${confirm.user.email}\n\nTheir sessions stop working immediately (the profile re-read denies deactivated identities).`
            : `${confirm.user.email}\n\nThey will be able to sign in again with their existing password.`}
          confirmLabel={confirm.kind === 'deactivate' ? 'Deactivate' : 'Activate'}
          busy={busyId === confirm.user.id}
          onConfirm={() => handleStatus(confirm.user)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {confirm && confirm.kind === 'reset' && (
        <ConfirmDialog
          title="Issue a one-time reset token?"
          message={`${confirm.user.email}\n\nAny previous outstanding token for this user is invalidated. The new token is valid for 60 minutes and shown once.`}
          confirmLabel="Issue token"
          busy={busyId === confirm.user.id}
          onConfirm={() => handleResetIssue(confirm.user)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
