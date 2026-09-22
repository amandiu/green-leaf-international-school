// ═══════════════════════════════════════════════════════════════
// REUSABLE CONTENT BLOCKS — Phase D fallback + seed source
// ═══════════════════════════════════════════════════════════════
//
// The single source for:
//   1. server/sql/seeds/005_admissions_cta_block.sql (initial DB row)
//   2. server contentBlockService fallbacks (missing/failed DB row)
//   3. client ReusableContentProvider fallbacks (API down)
//
// RULES (see docs/CONTENT_ARCHITECTURE.md):
//   • block_key is the stable system identity (never the display name)
//   • one block type = one validated schema (no arbitrary JSON)
//   • settings values are NEVER copied into a block — sanctioned
//     {{tokens}} keep following Site Settings at render time
//   • DB rows override these defaults; a missing row or failed
//     request falls back here so consumers never break
// ═══════════════════════════════════════════════════════════════

/** Known block keys (allow-list — unknown keys are ignored). */
export const CONTENT_BLOCK_KEYS = Object.freeze([
  'admissions-primary-cta',
]);

/** Known block types (each has its own validated schema). */
export const CONTENT_BLOCK_TYPES = Object.freeze(['CTA']);

/**
 * CTA block — the shared call-to-action band content.
 *
 * `actions` carry the union of every consumer's action so ONE
 * block preserves all of them; each page renders its own pair by
 * the action's stable `id` (a reference, not a copy):
 *
 *   admissions-primary-cta actions:
 *     info         → "Admission Information" page link  (Homepage primary)
 *     contact-page → "Contact School" page link         (Homepage secondary)
 *     email        → "Email Admissions" mailto (token)  (Admissions primary)
 *     call         → "Call Us" tel (token)              (Admissions secondary)
 */
export const DEFAULT_ADMISSIONS_CTA_BLOCK = {
  eyebrow: '',
  title: 'Ready to Give Your Child a Place to Grow?',
  description:
    'Join the {{identity.shortName}} community — admissions are open for the upcoming academic year. Contact our admissions office for the application form and more information.',
  actions: [
    { id: 'info', label: 'Admission Information', href: '/admissions' },
    { id: 'contact-page', label: 'Contact School', href: '/contact' },
    { id: 'email', label: 'Email Admissions', href: 'mailto:{{contact.admissionsEmail}}' },
    { id: 'call', label: 'Call Us', href: 'tel:{{contact.phone}}' },
  ],
};

/** Fresh default content per block key (never shared references). */
export function defaultContentBlocks() {
  return {
    'admissions-primary-cta': {
      eyebrow: DEFAULT_ADMISSIONS_CTA_BLOCK.eyebrow,
      title: DEFAULT_ADMISSIONS_CTA_BLOCK.title,
      description: DEFAULT_ADMISSIONS_CTA_BLOCK.description,
      actions: DEFAULT_ADMISSIONS_CTA_BLOCK.actions.map((a) => ({ ...a })),
    },
  };
}

export default defaultContentBlocks;
