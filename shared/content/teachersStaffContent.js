// ═══════════════════════════════════════════════════════════════
// TEACHERS & STAFF DIRECTORY — Phase B.5 static-first content
// ═══════════════════════════════════════════════════════════════
//
// SOURCE OF TRUTH (Phase B.5 decision): NO verified teacher/staff
// data exists in the repository or the database (audited: no people
// tables, no hardcoded lists). Per the MASTER PLAN (§Phase B item 5
// "static-first if verified data isn't ready"), this module is the
// static-first content source for the public /teachers directory.
//
// INTEGRITY RULE: the people arrays are EMPTY until the school
// provides verified names/designations. Placeholder or demo people
// are NEVER fabricated here — the page renders an honest empty
// state per group instead (matching the Leadership module's
// "pending verification" convention).
//
// FUTURE MIGRATION PATH (documented, not implemented): when the
// future Teachers/Employees management phase (MASTER PLAN §13
// "Teachers / Employees CRUD") ships, a DB-backed directory API
// replaces this module's people arrays. The person shape below is
// deliberately aligned with a future public staff record:
//   { id, name, designation, department?, subject?, profile?, image? }
// so the UI maps API records 1:1 without a frontend rewrite
// (same overlay pattern as the page_sections fallbacks).
//
// PRIVACY: only public-facing fields exist by design — no private
// phones/emails, no employee IDs, no HR data. Public contact
// details belong to Site Settings (Contact page), not to people.
// ═══════════════════════════════════════════════════════════════

/** The sanctioned person fields (anything else is rejected by design). */
export const DIRECTORY_PERSON_FIELDS = Object.freeze([
  'id',
  'name',
  'designation',
  'department',
  'subject',
  'profile',
  'image',
]);

export const DEFAULT_TEACHERS_STAFF_INTRO = {
  eyebrow: 'Our People',
  title: 'Teachers & Staff',
  description:
    'The educators and support team behind {{identity.name}} — profiles are published here as they are verified.',
};

/**
 * Directory groups. `people` stays EMPTY until verified content is
 * provided by the school — an honest empty state renders instead
 * of fabricated staff information.
 */
export const DEFAULT_TEACHERS_STAFF_GROUPS = Object.freeze([
  {
    key: 'teachers',
    heading: 'Teachers',
    description: 'Faculty profiles, published as verified.',
    people: Object.freeze([]),
  },
  {
    key: 'staff',
    heading: 'Staff',
    description: 'Administrative and support team profiles, published as verified.',
    people: Object.freeze([]),
  },
]);

export function defaultTeachersStaffContent() {
  return {
    intro: { ...DEFAULT_TEACHERS_STAFF_INTRO },
    groups: DEFAULT_TEACHERS_STAFF_GROUPS.map((group) => ({
      ...group,
      people: group.people.map((person) => ({ ...person })),
    })),
  };
}

export default defaultTeachersStaffContent;
