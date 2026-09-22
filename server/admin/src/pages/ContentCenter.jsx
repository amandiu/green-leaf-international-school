// ------------------------------------------------------------
// Content Center page (Phase C + Phase D)
//
// Admin → Content Center: the hub for CENTRAL content that is
// consumed by multiple pages.
//
//   • Location & Map — site_settings.location.* (Phase C)
//   • Reusable Content — content_blocks (Phase D): the shared
//     Admissions CTA used by the Homepage and the Admissions
//     page. Shows name/type/status/Used In/Last Updated with
//     type-specific fields (no universal form) and delete
//     safety (referenced blocks cannot be deleted).
//
// Auth/session conventions mirror SiteSettings.jsx (401/503 →
// onUnauthorized drops the session).
// ------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import {
  fetchAdminSettings,
  updateAdminSettings,
} from '../services/settingsService';
import {
  fetchAdminContentBlocks,
  updateContentBlock,
  setContentBlockActive,
  deleteContentBlock,
} from '../services/contentBlockService';
import { Alert, Loader } from '../components/Feedback';

/* ================= Location & Map (Phase C) ================= */

/** Field definitions for the Location & Map card. */
const LOCATION_FIELDS = [
  {
    name: 'address',
    label: 'Address',
    type: 'text',
    maxLength: 500,
    nullable: true,
    hint: 'The school address shown on the Homepage, Contact page and Footer.',
  },
  {
    name: 'mapsQuery',
    label: 'Maps Query',
    type: 'text',
    maxLength: 500,
    nullable: true,
    hint: 'Feeds the Google Maps embed and the Get Directions link (spaces as “+”). Empty hides the map.',
  },
  {
    name: 'mapsZoom',
    label: 'Maps Zoom (1–22)',
    type: 'number',
    min: 1,
    max: 22,
    nullable: true,
    hint: 'Embed zoom level. Leave empty for the default (17).',
  },
];

const USAGE = [
  { value: 'Address', usedIn: ['Homepage — Map', 'Contact — Details & Map', 'Footer — Contact Information'] },
  { value: 'Maps Query', usedIn: ['Homepage — Map', 'Contact — Map', 'Get Directions links'] },
  { value: 'Maps Zoom', usedIn: ['Homepage — Map embed', 'Contact — Map embed'] },
];

const inputClass =
  'mt-1 w-full rounded-lg border border-charcoal-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent';
const labelClass = 'block text-sm font-medium text-charcoal-700';

function LocationMapCard({ values, onChange }) {
  return (
    <div className="rounded-xl border border-charcoal-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-charcoal-900">Location &amp; Map</h2>
          <p className="mt-1 text-xs text-charcoal-500">
            The single source of truth for the school location. Every map and
            address on the public site reads these values — edit them ONCE here.
          </p>
        </div>
        <span className="rounded-full bg-forest-50 px-2.5 py-1 text-[11px] font-semibold text-forest-700">
          Site Setting — location.*
        </span>
      </div>

      <div className="mt-3 rounded-lg bg-charcoal-50 px-3 py-2 text-xs text-charcoal-600">
        <span className="font-semibold text-charcoal-700">Used in:</span>{' '}
        {USAGE.map((u) => u.usedIn.join(', ')).join(' · ')}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {LOCATION_FIELDS.map((field) => (
          <div key={field.name}>
            <label htmlFor={`cc-location-${field.name}`} className={labelClass}>
              {field.label}
              {!field.nullable && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
            </label>
            <input
              id={`cc-location-${field.name}`}
              type={field.type === 'number' ? 'number' : 'text'}
              className={inputClass}
              inputMode={field.type === 'number' ? 'numeric' : undefined}
              min={field.type === 'number' ? field.min : undefined}
              max={field.type === 'number' ? field.max : undefined}
              maxLength={field.type === 'number' ? undefined : field.maxLength}
              value={values[field.name] ?? ''}
              onChange={(e) => onChange('location', field.name, e.target.value)}
              placeholder={field.nullable ? 'Not set' : undefined}
            />
            {field.hint && <p className="mt-1 text-xs text-charcoal-400">{field.hint}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= Reusable Content (Phase D) ================= */

/** CTA action ids with their per-page roles (renderers select by id). */
const CTA_ACTION_HINTS = [
  { id: 'info', role: 'Homepage — primary button (page link)' },
  { id: 'contact-page', role: 'Homepage — secondary button (page link)' },
  { id: 'email', role: 'Admissions page — primary button (mailto from Site Settings)' },
  { id: 'call', role: 'Admissions page — secondary button (tel from Site Settings)' },
];

/** One editable CTA action row (label + href). The stable id is fixed. */
function CtaActionRow({ action, hint, onChange }) {
  return (
    <div className="rounded-lg border border-charcoal-100 bg-charcoal-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded bg-white px-2 py-0.5 font-mono text-[11px] text-charcoal-600">
          {action.id}
        </span>
        <span className="text-[11px] text-charcoal-400">{hint}</span>
      </div>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Button Label</label>
          <input
            className={inputClass}
            maxLength={100}
            value={action.label ?? ''}
            onChange={(e) => onChange(action.id, 'label', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Link (supports {"{{tokens}}"})</label>
          <input
            className={inputClass}
            maxLength={500}
            value={action.href ?? ''}
            onChange={(e) => onChange(action.id, 'href', e.target.value)}
            placeholder="/admissions, mailto:{{contact.admissionsEmail}}, tel:{{contact.phone}}"
          />
        </div>
      </div>
    </div>
  );
}

/** Type-specific editor for a CTA block. */
function CtaBlockEditor({ content, onChange }) {
  const setAction = (id, field, value) => {
    onChange('actions', (content.actions || []).map((a) => (a.id === id ? { ...a, [field]: value } : a)));
  };
  return (
    <div className="mt-4 grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Eyebrow (optional)</label>
          <input
            className={inputClass}
            maxLength={100}
            value={content.eyebrow ?? ''}
            onChange={(e) => onChange('eyebrow', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Title <span className="text-red-500">*</span></label>
          <input
            className={inputClass}
            maxLength={200}
            value={content.title ?? ''}
            onChange={(e) => onChange('title', e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <textarea
          className={inputClass}
          rows={3}
          maxLength={1000}
          value={content.description ?? ''}
          onChange={(e) => onChange('description', e.target.value)}
        />
        <p className="mt-1 text-xs text-charcoal-400">
          Supports {'{{identity.shortName}}'} — resolved from Site Settings at render time. Never paste contact details here.
        </p>
      </div>
      <div>
        <p className="text-sm font-medium text-charcoal-700">Actions</p>
        <p className="text-xs text-charcoal-500">
          Each consumer page renders its own pair by stable id. Contact values come from Site Settings via tokens.
        </p>
        <div className="mt-2 space-y-3">
          {(content.actions || []).map((action) => (
            <CtaActionRow
              key={action.id}
              action={action}
              hint={CTA_ACTION_HINTS.find((h) => h.id === action.id)?.role ?? ''}
              onChange={setAction}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** One reusable block card: meta row + type-specific form. */
function BlockCard({ block, usage, onSave, onToggle, onDelete, saving }) {
  const [content, setContent] = useState(block.content ?? {});
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setContent(block.content ?? {});
    setDirty(false);
    setError('');
  }, [block.content]);

  const change = (field, value) => {
    setContent((c) => ({ ...c, [field]: value }));
    setDirty(true);
  };

  const usedIn = (usage || []).filter((u) => u.reference);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await onSave(block.blockKey, { name: block.name, content });
      setDirty(false);
    } catch (err) {
      setError(err.message || 'Save failed.');
    }
  };

  const handleToggle = async () => {
    setError('');
    try {
      await onToggle(block.blockKey, !block.isActive);
    } catch (err) {
      setError(err.message || 'Update failed.');
    }
  };

  const handleDelete = async () => {
    setError('');
    try {
      await onDelete(block.blockKey);
    } catch (err) {
      setError(err.message || 'Delete failed.');
    }
  };

  const updatedAt = block.updatedAt ? new Date(block.updatedAt).toLocaleString() : null;

  return (
    <form onSubmit={handleSave} className="rounded-xl border border-charcoal-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-charcoal-900">{block.name}</h2>
          <p className="mt-0.5 text-xs text-charcoal-500">
            Type: <span className="font-mono">{block.blockType}</span>
            {' · '}Key: <span className="font-mono">{block.blockKey}</span>
            {updatedAt && ` · Updated: ${updatedAt}`}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-charcoal-600">
          <input
            type="checkbox"
            checked={!!block.isActive}
            onChange={handleToggle}
            className="h-4 w-4 rounded border-charcoal-300"
          />
          Active
        </label>
      </div>

      <div className="mt-3 rounded-lg bg-charcoal-50 px-3 py-2 text-xs text-charcoal-600">
        <span className="font-semibold text-charcoal-700">Used in:</span>{' '}
        {usedIn.length > 0 ? usedIn.map((u) => u.label).join(', ') : 'No page references yet'}
        {!block.isActive && ' · Inactive blocks fall back to their defaults on the public site'}
      </div>

      {error && <div className="mt-3"><Alert kind="error" onClose={() => setError('')}>{error}</Alert></div>}

      <CtaBlockEditor content={content} onChange={change} />

      <div className="mt-4 flex items-center justify-end gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-forest-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-forest-700 disabled:opacity-60"
        >
          {saving ? 'Saving…' : dirty ? 'Save Block' : 'Saved'}
        </button>
      </div>
    </form>
  );
}

/* ================= Page ================= */

export default function ContentCenter({ onUnauthorized }) {
  /* --- Location & Map state (Phase C) --- */
  const [values, setValues] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  /* --- Reusable Content state (Phase D) --- */
  const [blocksData, setBlocksData] = useState(null); // { blocks, usage }
  const [blocksLoading, setBlocksLoading] = useState(true);
  const [blocksError, setBlocksError] = useState('');
  const [savingBlock, setSavingBlock] = useState(false);

  const loadLocation = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetchAdminSettings();
      const location = res.data?.location || {};
      const flat = {};
      for (const field of LOCATION_FIELDS) {
        flat[field.name] = location[field.name] == null ? '' : String(location[field.name]);
      }
      setValues(flat);
    } catch (err) {
      if (err.status === 401 || err.status === 503) {
        onUnauthorized?.();
        return;
      }
      setLoadError(err.message || 'Failed to load the location settings.');
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  const loadBlocks = useCallback(async () => {
    setBlocksLoading(true);
    setBlocksError('');
    try {
      const res = await fetchAdminContentBlocks();
      setBlocksData(res.data || { blocks: {}, usage: {} });
    } catch (err) {
      if (err.status === 401 || err.status === 503) {
        onUnauthorized?.();
        return;
      }
      setBlocksError(err.message || 'Failed to load reusable content.');
    } finally {
      setBlocksLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    loadLocation();
    loadBlocks();
  }, [loadLocation, loadBlocks]);

  const handleLocationChange = (group, name, value) => {
    setValues((v) => ({ ...v, [name]: value }));
    setNotice('');
  };

  const handleLocationSubmit = async (e) => {
    e.preventDefault();
    if (!values) return;
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const payload = { location: {} };
      for (const field of LOCATION_FIELDS) {
        payload.location[field.name] = values[field.name];
      }
      await updateAdminSettings(payload);
      setNotice('Location & Map saved — every map and address on the public site now uses these values.');
      await loadLocation();
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

  /* --- Block handlers --- */
  const handleSaveBlock = async (key, payload) => {
    setSavingBlock(true);
    try {
      await updateContentBlock(key, payload);
      await loadBlocks();
    } finally {
      setSavingBlock(false);
    }
  };

  const handleToggleBlock = async (key, isActive) => {
    await setContentBlockActive(key, isActive);
    await loadBlocks();
  };

  const handleDeleteBlock = async (key) => {
    await deleteContentBlock(key); // 409s surface inside BlockCard
  };

  const blocks = blocksData?.blocks ?? {};
  const usage = blocksData?.usage ?? {};
  const blockKeys = Object.keys(blocks);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-forest-700">Content Center</h1>
          <p className="mt-1 text-sm text-charcoal-500">
            Central content managed once and reused by every page that needs it.
          </p>
        </div>
      </div>

      {/* ---- Location & Map (Phase C) ---- */}
      {loadError && (
        <div className="mt-4">
          <Alert kind="error">{loadError}</Alert>
          <button
            type="button"
            onClick={loadLocation}
            className="mt-3 rounded-lg border border-charcoal-200 px-4 py-2 text-sm font-medium text-charcoal-600 hover:bg-charcoal-100"
          >
            Retry
          </button>
        </div>
      )}

      {loading && <Loader label="Loading content center…" />}

      {!loading && values && (
        <form onSubmit={handleLocationSubmit} className="mt-4 space-y-4">
          {error && <Alert kind="error" onClose={() => setError('')}>{error}</Alert>}
          {notice && <Alert kind="success" onClose={() => setNotice('')}>{notice}</Alert>}

          <LocationMapCard values={values} onChange={handleLocationChange} />

          <div className="flex items-center justify-end gap-3 pb-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-forest-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-forest-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Location & Map'}
            </button>
          </div>
        </form>
      )}

      {/* ---- Reusable Content (Phase D) ---- */}
      <h2 className="mt-8 text-lg font-bold text-charcoal-900">Reusable Content</h2>
      <p className="text-xs text-charcoal-500">
        Content managed ONCE and referenced by many pages. Editing a block updates every consumer.
      </p>

      {blocksError && (
        <div className="mt-3">
          <Alert kind="error">{blocksError}</Alert>
          <button
            type="button"
            onClick={loadBlocks}
            className="mt-3 rounded-lg border border-charcoal-200 px-4 py-2 text-sm font-medium text-charcoal-600 hover:bg-charcoal-100"
          >
            Retry
          </button>
        </div>
      )}

      {blocksLoading && <Loader label="Loading reusable content…" />}

      {!blocksLoading && !blocksError && (
        <div className="mt-3 space-y-4">
          {blockKeys.map((key) => (
            <BlockCard
              key={key}
              block={{ blockKey: key, ...blocks[key] }}
              usage={usage[key]}
              onSave={handleSaveBlock}
              onToggle={handleToggleBlock}
              onDelete={handleDeleteBlock}
              saving={savingBlock}
            />
          ))}
          {blockKeys.length === 0 && (
            <div className="rounded-xl border border-dashed border-charcoal-200 p-6 text-center text-sm text-charcoal-500">
              No reusable blocks are defined yet.
            </div>
          )}
        </div>
      )}

      {/* ---- Dynamic Content (Phase E) ---- */}
      <h2 className="mt-8 text-lg font-bold text-charcoal-900">Dynamic Content</h2>
      <p className="text-xs text-charcoal-500">
        Created and removed over time — managed as their own entities, separate from reusable static blocks.
      </p>
      <div className="mt-3 rounded-xl border border-charcoal-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-charcoal-900">News &amp; Notices</h3>
            <p className="mt-1 text-xs text-charcoal-500">
              The ONE source for the Homepage preview, Navbar ticker and the
              News page. Publish once — every consumer updates.
            </p>
          </div>
          <a
            href="/news"
            className="rounded-lg bg-forest-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-forest-700"
          >
            Manage News &amp; Notices →
          </a>
        </div>
      </div>
    </div>
  );
}
