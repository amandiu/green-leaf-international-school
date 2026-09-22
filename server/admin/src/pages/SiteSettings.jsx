// ------------------------------------------------------------
// Site Settings page (Phase A + Phase C)
//
// Admin → Site Settings: edits the global, DB-backed site
// settings (identity, branding, contact, social, seo) via
// GET/PUT /api/admin/settings. Architecture mirrors
// NavigationManagement/LeadershipManagement: section cards +
// shared Alert/Loader primitives + the 401/503 session-drop
// convention. Image fields (logo/favicon/ogImage) accept existing
// valid paths/URLs only — actual media management is Phase E.
//
// Phase C: the Location group moved to Admin → Content Center
// (Location & Map is central content used by multiple pages and
// must have exactly ONE editing surface). The retired
// contact.address duplicate was removed from the Contact card.
// ------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import {
  fetchAdminSettings,
  updateAdminSettings,
} from '../services/settingsService';
import { Alert, Loader } from '../components/Feedback';

/** Field definitions per section — order drives the form layout. */
const SECTIONS = [
  {
    group: 'identity',
    title: 'General',
    description: 'School identity shown across the public website.',
    fields: [
      { name: 'name', label: 'Name', type: 'text', maxLength: 500, required: true },
      { name: 'shortName', label: 'Short Name', type: 'text', maxLength: 500, required: true },
      { name: 'subName', label: 'Sub Name', type: 'text', maxLength: 500, required: true },
      { name: 'tagline', label: 'Tagline', type: 'text', maxLength: 1000, required: true },
      { name: 'description', label: 'Description', type: 'textarea', rows: 2, maxLength: 1000, required: true },
      { name: 'monogram', label: 'Monogram', type: 'text', maxLength: 3, required: true },
    ],
  },
  {
    group: 'branding',
    title: 'Branding',
    description:
      'Site-relative path (e.g. /logo.jpg) or a full https:// URL. Actual media management arrives in Phase E.',
    fields: [
      { name: 'logo', label: 'Logo', type: 'text', maxLength: 500, required: true, asset: true },
      { name: 'favicon', label: 'Favicon', type: 'text', maxLength: 500, required: true, asset: true },
      { name: 'ogImage', label: 'OG Image', type: 'text', maxLength: 500, required: true, asset: true },
    ],
  },
  {
    group: 'contact',
    title: 'Contact',
    description:
      'Shown in the footer and the public Contact page. The school address lives in the Content Center → Location & Map.',
    fields: [
      { name: 'email', label: 'Email', type: 'email', maxLength: 500, required: true },
      { name: 'phone', label: 'Phone', type: 'text', maxLength: 500, required: true },
      { name: 'admissionsEmail', label: 'Admissions Email', type: 'email', maxLength: 500, required: true },
      { name: 'officeHours', label: 'Office Hours', type: 'text', maxLength: 500, required: true },
      { name: 'officeHoursClosed', label: 'Closed Day/Hours', type: 'text', maxLength: 500, required: true },
    ],
  },
  {
    group: 'social',
    title: 'Social',
    description: 'Full http(s) URLs. Leave a field empty to hide the icon on the public site.',
    fields: [
      { name: 'facebook', label: 'Facebook', type: 'url', maxLength: 500, nullable: true },
      { name: 'youtube', label: 'YouTube', type: 'url', maxLength: 500, nullable: true },
      { name: 'instagram', label: 'Instagram', type: 'url', maxLength: 500, nullable: true },
      { name: 'linkedin', label: 'LinkedIn', type: 'url', maxLength: 500, nullable: true },
    ],
  },
  // Phase C: the location group moved to the Content Center —
  // Location & Map is central content consumed by multiple pages,
  // so it is edited in exactly one place.
  {
    group: 'seo',
    title: 'SEO',
    description: 'Default browser tab title and meta description for the public site.',
    fields: [
      { name: 'title', label: 'Site Title', type: 'text', maxLength: 500, required: true },
      { name: 'description', label: 'Site Description', type: 'textarea', rows: 2, maxLength: 1000, required: true },
    ],
  },
];

const inputClass = 'mt-1 w-full rounded-lg border border-charcoal-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent';
const labelClass = 'block text-sm font-medium text-charcoal-700';

function SettingsSectionCard({ section, values, onChange }) {
  return (
    <div className="rounded-xl border border-charcoal-200 bg-white p-4 shadow-sm">
      <h2 className="font-semibold text-charcoal-900">{section.title}</h2>
      <p className="mt-1 text-xs text-charcoal-500">{section.description}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {section.fields.map((field) => (
          <div key={field.name} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
            <label htmlFor={`ss-${section.group}-${field.name}`} className={labelClass}>
              {field.label}
              {field.required && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
            </label>
            {field.type === 'textarea' ? (
              <textarea
                id={`ss-${section.group}-${field.name}`}
                className={inputClass}
                rows={field.rows || 2}
                maxLength={field.maxLength}
                value={values[field.name] ?? ''}
                onChange={(e) => onChange(section.group, field.name, e.target.value)}
              />
            ) : (
              <input
                id={`ss-${section.group}-${field.name}`}
                type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
                className={inputClass}
                inputMode={field.type === 'number' ? 'numeric' : undefined}
                min={field.type === 'number' ? field.min : undefined}
                max={field.type === 'number' ? field.max : undefined}
                maxLength={field.type === 'number' ? undefined : field.maxLength}
                value={values[field.name] ?? ''}
                onChange={(e) => onChange(section.group, field.name, e.target.value)}
                placeholder={field.asset ? '/logo.jpg or https://…' : undefined}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SiteSettings({ onUnauthorized }) {
  const [values, setValues] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetchAdminSettings();
      const data = res.data || {};
      // Flatten grouped API data into the form state shape
      // { 'identity.name': value, ... }; null → '' for inputs.
      const flat = {};
      for (const section of SECTIONS) {
        const group = data[section.group] || {};
        for (const field of section.fields) {
          flat[`${section.group}.${field.name}`] = group[field.name] == null ? '' : String(group[field.name]);
        }
      }
      setValues(flat);
    } catch (err) {
      if (err.status === 401 || err.status === 503) {
        onUnauthorized?.();
        return;
      }
      setLoadError(err.message || 'Failed to load site settings.');
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    load();
  }, [load]);

  const handleChange = (group, name, value) => {
    setValues((v) => ({ ...v, [`${group}.${name}`]: value }));
    // Field-level edits invalidate a stale success banner.
    setNotice('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!values) return;
    setError('');
    setNotice('');
    setSaving(true);
    try {
      // Rebuild the grouped payload from the flat form state.
      // Social/location blanks intentionally become '' — the
      // server normalizes them to null (hides the icon/map).
      const payload = {};
      for (const section of SECTIONS) {
        payload[section.group] = {};
        for (const field of section.fields) {
          payload[section.group][field.name] = values[`${section.group}.${field.name}`];
        }
      }
      const res = await updateAdminSettings(payload);
      const data = res.data || {};
      setValues((v) => {
        const next = { ...v };
        for (const section of SECTIONS) {
          const group = data[section.group] || {};
          for (const field of section.fields) {
            next[`${section.group}.${field.name}`] = group[field.name] == null ? '' : String(group[field.name]);
          }
        }
        return next;
      });
      setNotice('Site settings saved.');
    } catch (err) {
      if (err.status === 401 || err.status === 503) {
        onUnauthorized?.();
      } else {
        setError(err.message || 'Save failed.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-forest-700">Site Settings</h1>
          <p className="mt-1 text-sm text-charcoal-500">
            Global school information used across the public website. Changes appear on the next public page load.
          </p>
        </div>
      </div>

      {loadError && (
        <div className="mt-4">
          <Alert kind="error">{loadError}</Alert>
          <button
            type="button"
            onClick={load}
            className="mt-3 rounded-lg border border-charcoal-200 px-4 py-2 text-sm font-medium text-charcoal-600 hover:bg-charcoal-100"
          >
            Retry
          </button>
        </div>
      )}

      {loading && <Loader label="Loading site settings…" />}

      {!loading && values && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && <Alert kind="error" onClose={() => setError('')}>{error}</Alert>}
          {notice && <Alert kind="success" onClose={() => setNotice('')}>{notice}</Alert>}
          {notice && (
            <p className="text-xs text-charcoal-500">
              Saved values are shown below. A fresh public page load picks up the change immediately.
            </p>
          )}

          {SECTIONS.map((section) => (
            <SettingsSectionCard
              key={section.group}
              section={section}
              values={Object.fromEntries(
                section.fields.map((f) => [f.name, values[`${section.group}.${f.name}`]]),
              )}
              onChange={handleChange}
            />
          ))}

          <div className="flex items-center justify-end gap-3 pb-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-forest-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-forest-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
