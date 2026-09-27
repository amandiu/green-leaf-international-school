import { useScrollReveal } from '../hooks/useScrollReveal';
import { SectionWrapper, SectionHeader } from '../Components/ui/SectionWrapper';
import useLeadership from '../hooks/useLeadershipMessages';
import { useSettings } from '../context/SettingsContext';
import { defaultTeachersStaffContent } from '../../../shared/content/teachersStaffContent';
import usePageSeo from '../hooks/usePageSeo';

/* ═══════════════════════════════════════════
   Phase B.5 — PUBLIC TEACHERS & STAFF DIRECTORY
   Static-first per the MASTER PLAN: no verified
   teacher/staff records exist (audited — no DB
   entity, no hardcoded lists), so the page ships
   with honest, structured empty states instead of
   fabricated people. The person shape in
   shared/content/teachersStaffContent.js is the
   future migration seam: when the Teachers/
   Employees management phase lands, API records
   map 1:1 onto these cards — no UI rewrite.

   LEADERSHIP (one source of truth): the Principal
   /Head Teacher and Chairman messages remain the
   Leadership module's data — linked here, never
   copied into a directory data source.
   ═══════════════════════════════════════════ */

const FALLBACK_CONTENT = defaultTeachersStaffContent();

function DirectoryHero() {
  const { settings } = useSettings();
  const { identity } = settings;
  return (
    <section className="relative min-h-[50vh] md:min-h-[60vh] flex items-end overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="/Activity/791074857_1519300476879129_5256173980750495448_n.jpg"
          alt={`${identity.name} teachers and staff`}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/90 via-charcoal-900/50 to-charcoal-900/30" />
      </div>
      <div className="container-custom relative z-10 pb-16 md:pb-20 pt-32">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.08] border border-white/[0.12] text-[11px] font-semibold uppercase tracking-[0.15em] text-white/80 mb-5">
          <span className="w-1.5 h-1.5 bg-leaf-400 rounded-full" />
          Our People
        </span>
        <h1 className="font-heading text-display text-white mb-4">
          Teachers &amp; Staff
        </h1>
        <p className="text-body-lg text-white/70 max-w-2xl">
          The educators and support team who make every school day possible.
        </p>
      </div>
    </section>
  );
}

/* Directory person card. Renders ONLY verified fields: name,
   designation and (when present) department/subject/profile. A
   missing photo renders the same neutral monogram placeholder the
   Leadership module uses — never an invented portrait. */
function PersonCard({ person }) {
  const initial = (person.name ?? '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <div className="text-center p-7 rounded-xl bg-white border border-charcoal-100/60 hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 ease-premium">
      {person.image ? (
        <img
          src={person.image}
          alt={person.name ? `Portrait of ${person.name}` : 'Staff portrait'}
          className="w-20 h-20 mx-auto rounded-full object-cover mb-4"
          loading="lazy"
        />
      ) : (
        <div
          className="w-20 h-20 mx-auto rounded-full bg-forest-50 flex items-center justify-center mb-4"
          aria-hidden="true"
        >
          <span className="font-heading text-2xl font-bold text-forest-600">{initial}</span>
        </div>
      )}
      <h3 className="font-heading text-h3 text-charcoal-900 mb-1">{person.name}</h3>
      {person.designation && (
        <p className="text-body-sm font-medium text-forest-600 mb-1">{person.designation}</p>
      )}
      {(person.department || person.subject) && (
        <p className="text-caption text-charcoal-400 mb-2">
          {[person.subject, person.department].filter(Boolean).join(' · ')}
        </p>
      )}
      {person.profile && (
        <p className="text-body-sm text-charcoal-500 leading-relaxed">{person.profile}</p>
      )}
    </div>
  );
}

/* One group section (Teachers / Staff). Empty groups render the
   honest "awaiting verified content" state — the site never shows
   placeholder people as if they were real. */
function DirectoryGroup({ group }) {
  const revealRef = useScrollReveal();
  const people = group.people ?? [];

  return (
    <SectionWrapper bg={group.key === 'teachers' ? 'bg-white' : 'bg-cream-50'} padding="py-section">
      <SectionHeader
        badge={group.heading}
        title={group.heading}
        description={group.description}
      />
      {people.length > 0 ? (
        <div
          ref={revealRef}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children"
        >
          {people.map((person) => (
            <PersonCard key={person.id ?? person.name} person={person} />
          ))}
        </div>
      ) : (
        <p
          className="text-center text-body-lg text-charcoal-400 py-10 max-w-2xl mx-auto"
          role="status"
        >
          Profiles are being verified and will be published here soon.
        </p>
      )}
    </SectionWrapper>
  );
}

function TeachersStaff() {
  // Phase B.7: per-page metadata. NO Person schema — the directory
  // is static-first with honest empty groups; unverified people
  // are never emitted as structured data (Step 8 rule).
  usePageSeo({
    title: 'Teachers & Staff',
    description:
      'Teachers, leadership and staff of Green Leaf International School & College.',
    path: '/teachers',
  });

  const { groups } = FALLBACK_CONTENT;
  const { section, records, status: leadershipStatus } = useLeadership();
  const introRef = useScrollReveal();

  return (
    <>
      <DirectoryHero />

      {/* Leadership — reused from the Leadership module (one source
          of truth; linked, never duplicated into directory data). */}
      {leadershipStatus !== 'inactive' && records.length > 0 && (
        <SectionWrapper bg="bg-white" padding="py-section">
          <div ref={introRef} className="reveal">
            <SectionHeader
              badge={section.eyebrow}
              title={section.title}
              description={section.description}
            />
            <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {records.map((leader) => (
                <div
                  key={leader.id}
                  className="flex items-center gap-4 p-5 rounded-xl border border-charcoal-100/70 bg-cream-50"
                >
                  {leader.image ? (
                    <img
                      src={leader.image}
                      alt={leader.imageAlt ?? leader.name ?? leader.role}
                      className="w-14 h-14 rounded-full object-cover shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="w-14 h-14 rounded-full bg-forest-50 flex items-center justify-center shrink-0"
                      aria-hidden="true"
                    >
                      <span className="font-heading text-xl font-bold text-forest-600">
                        {(leader.name ?? leader.role ?? '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-charcoal-900 truncate">
                      {leader.name ?? leader.role}
                    </p>
                    <p className="text-body-sm text-forest-600 truncate">{leader.roleBadge}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-body-sm text-charcoal-400">
              Messages from our leadership are on the{' '}
              <a href="/" className="text-forest-600 font-medium hover:underline">homepage</a>.
            </p>
          </div>
        </SectionWrapper>
      )}

      {/* Directory groups — static-first content. */}
      {groups.map((group) => (
        <DirectoryGroup key={group.key} group={group} />
      ))}
    </>
  );
}

export default TeachersStaff;
