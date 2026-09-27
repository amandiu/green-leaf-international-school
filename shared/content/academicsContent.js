// ═══════════════════════════════════════════════════════════════
// ACADEMICS PAGE CONTENT — Phase B.3 fallback + first-save source
// ═══════════════════════════════════════════════════════════════
//
// The exact content extracted from the existing Academics.jsx at
// the time of the Phase B.3 audit. Mirrors the homeContent.js
// pattern: client fallback constants + server per-section merge;
// rows are created on the first admin save (no seed).
//
// This is the PUBLIC INFORMATIONAL page only. Attendance,
// results, classes, exams, syllabus management etc. are future
// academic-management phases and are deliberately NOT represented
// here.
//
// SOURCE-OF-TRUTH NOTES:
//   • School name references use {{identity.name}} /
//     {{identity.shortName}} tokens — never copied here.
//   • Hero imagery/branding remains code-structure (visual shell).
// ═══════════════════════════════════════════════════════════════

export const ACADEMICS_SECTION_KEYS = Object.freeze([
  'overview',
  'programs',
  'environment',
  'academicsCta',
]);

/** Curriculum overview: "Our Academic Approach" band. */
export const DEFAULT_ACADEMICS_OVERVIEW = {
  eyebrow: 'Curriculum',
  title: 'Our Academic Approach',
  paragraph1:
    '[Curriculum details placeholder — Replace with verified information about the curriculum framework, examination boards, and academic standards.]',
  paragraph2:
    'We believe that education should develop the whole person — intellectually, socially, emotionally, and physically.',
  image: '/Activity/732747749_1461551622654015_1537158411137272684_n.jpg',
  imageAlt: 'Students learning at {{identity.name}}',
  isActive: true,
};

/** Programs: heading + the 4 level cards. */
export const DEFAULT_ACADEMICS_PROGRAMS = {
  eyebrow: 'Programs',
  title: 'Academic Programs',
  description: "Structured pathways for every stage of your child's educational journey.",
  programs: [
    { title: 'Primary', subtitle: 'Class I — Class V', description: 'Building strong foundations in literacy, numeracy, and creative thinking.', icon: '📚' },
    { title: 'Middle School', subtitle: 'Class VI — Class VIII', description: 'Deepening knowledge, developing critical thinking and independence.', icon: '🔬' },
    { title: 'Secondary', subtitle: 'Class IX — Class X', description: 'Preparing for board examinations with focused academic rigor.', icon: '🎓' },
    { title: 'Higher Secondary', subtitle: 'Class XI — Class XII', description: 'Specialized streams preparing students for university and careers.', icon: '🏛️' },
  ],
  isActive: true,
};

/** Learning Environment: heading + the 3 highlight cards. */
export const DEFAULT_ACADEMICS_ENVIRONMENT = {
  eyebrow: 'Environment',
  title: 'Learning Environment',
  description: 'Creating spaces and experiences that inspire curiosity and growth.',
  items: [
    { title: 'Smart Classrooms', description: 'Technology-enhanced learning spaces with interactive displays.', icon: '💻' },
    { title: 'Science Laboratories', description: 'Fully equipped labs for hands-on scientific exploration.', icon: '🧪' },
    { title: 'Library & Resource Center', description: 'A vast collection of books, digital resources, and study spaces.', icon: '📚' },
  ],
  isActive: true,
};

/** Bottom CTA band (page-specific — distinct from the reusable
 *  admissions block, which this page has never consumed). */
export const DEFAULT_ACADEMICS_CTA = {
  title: 'Interested in Our Academic Programs?',
  description: 'Contact us to learn more about admissions.',
  buttonText: 'Get in Touch',
  buttonLink: '/contact',
  isActive: true,
};

/**
 * The complete default content object for the academics page,
 * keyed by section_key — the shape served by
 * GET /api/pages/academics when a section is missing from the DB.
 */
export function defaultAcademicsContent() {
  return {
    overview: { ...DEFAULT_ACADEMICS_OVERVIEW },
    programs: {
      ...DEFAULT_ACADEMICS_PROGRAMS,
      programs: DEFAULT_ACADEMICS_PROGRAMS.programs.map((p) => ({ ...p })),
    },
    environment: {
      ...DEFAULT_ACADEMICS_ENVIRONMENT,
      items: DEFAULT_ACADEMICS_ENVIRONMENT.items.map((i) => ({ ...i })),
    },
    academicsCta: { ...DEFAULT_ACADEMICS_CTA },
  };
}

export default defaultAcademicsContent;
