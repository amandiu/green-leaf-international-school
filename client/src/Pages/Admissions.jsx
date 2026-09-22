import { useScrollReveal } from '../hooks/useScrollReveal';
import { SectionWrapper, SectionHeader } from '../Components/ui/SectionWrapper';
import { useSettings } from '../context/SettingsContext';
import { useReusableContent } from '../hooks/useReusableContent';
import CtaBand from '../Components/content/CtaBand';

const steps = [
  { number: '01', title: 'Inquiry', description: 'Reach out to us for information about admissions and available programs.' },
  { number: '02', title: 'Application', description: 'Complete the application form with required documents.' },
  { number: '03', title: 'Assessment', description: 'Students undergo an age-appropriate assessment and interview.' },
  { number: '04', title: 'Enrollment', description: 'Upon acceptance, complete enrollment and fee payment.' },
];

const requirements = [
  'Completed application form',
  'Birth certificate (original and photocopy)',
  'Previous school transfer certificate',
  'Academic records / report cards',
  'Passport-size photographs of student',
  'Parent/Guardian identification documents',
  'Medical records / vaccination certificate',
];

function AdmissionsHero() {
  const { settings } = useSettings();
  const { identity } = settings;
  return (
    <section className="relative min-h-[50vh] md:min-h-[60vh] flex items-end overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="/Activity/798038998_1521802776628899_2711813091562440061_n.jpg"
          alt={`Admissions at ${identity.name}`}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/90 via-charcoal-900/50 to-charcoal-900/30" />
      </div>
      <div className="container-custom relative z-10 pb-16 md:pb-20 pt-32">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.08] border border-white/[0.12] text-[11px] font-semibold uppercase tracking-[0.15em] text-white/80 mb-5">
          <span className="w-1.5 h-1.5 bg-leaf-400 rounded-full" />
          Admissions
        </span>
        <h1 className="font-heading text-display text-white mb-4">Join {identity.shortName}</h1>
        <p className="text-body-lg text-white/70 max-w-2xl">
          Begin your child&apos;s journey toward academic excellence and personal growth.
        </p>
      </div>
    </section>
  );
}

/* Shared admissions CTA content (Phase D): resolved from the
   reusable block 'admissions-primary-cta'. Shows this page's
   original action pair (email, call) with the original button
   styles. Gold primary matches the pre-Phase-D band. */
function AdmissionsCtaBandContent() {
  const { getBlock } = useReusableContent();
  const block = getBlock('admissions-primary-cta');
  return (
    <CtaBand
      block={block}
      actionIds={['email', 'call']}
      actionButtonProps={[
        { variant: 'gold', size: 'lg' },
        { variant: 'secondary', size: 'lg', className: 'border-white/25 text-white hover:bg-white/10' },
      ]}
      descriptionClass="text-forest-100"
    />
  );
}

function Admissions() {
  const { settings } = useSettings();
  const introRef = useScrollReveal();
  const processRef = useScrollReveal();
  const reqRef = useScrollReveal();

  return (
    <>
      <AdmissionsHero />

      {/* Introduction */}
      <SectionWrapper bg="bg-white" padding="py-section">
        <div ref={introRef} className="reveal">
          <div className="max-w-3xl mx-auto text-center">
            <span className="eyebrow mb-4">Open Now</span>
            <h2 className="font-heading text-h2 text-charcoal-900 mb-5 mt-3">
              Admissions Open for [Academic Year]
            </h2>
            <p className="text-body-lg text-charcoal-500 leading-relaxed">
              [Admissions introduction placeholder — Replace with verified information about
              admission periods, eligibility, and available seats.]
            </p>
          </div>
        </div>
      </SectionWrapper>

      {/* Process */}
      <SectionWrapper bg="bg-cream-50" padding="py-section">
        <SectionHeader
          badge="Process"
          title="Admission Process"
          description="A simple, transparent process designed to welcome new families."
        />
        <div ref={processRef} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
          {steps.map((step) => (
            <div key={step.number} className="relative p-7 bg-white rounded-xl border border-charcoal-100/60 hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 ease-premium">
              <span className="text-[2.5rem] font-heading font-bold text-forest-100 leading-none">{step.number}</span>
              <h3 className="font-heading text-h3 text-charcoal-900 mt-3 mb-2">{step.title}</h3>
              <p className="text-body-sm text-charcoal-500 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* Requirements */}
      <SectionWrapper bg="bg-white" padding="py-section">
        <div ref={reqRef} className="reveal">
          <div className="max-w-3xl mx-auto">
            <SectionHeader
              badge="Requirements"
              title="Required Documents"
              description="Please prepare the following documents for the application process."
            />
            <div className="bg-cream-50 rounded-2xl p-8 border border-charcoal-100/60">
              <ul className="space-y-3.5">
                {requirements.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-forest-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-charcoal-600 text-body-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-4 text-caption text-charcoal-400 italic">
              * Requirements may vary by grade level. Please contact the admissions office for specific requirements.
            </p>
          </div>
        </div>
      </SectionWrapper>

      {/* CTA — reusable block (Phase D): same shared content as
          the Homepage band; this page shows its original pair of
          contact actions (email, call). The contact values come
          from Site Settings via {{tokens}} — never copied here. */}
      <section className="relative bg-forest-700 py-section overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="/Activity/799142983_1523030073172836_1172060919875647706_n.jpg"
            alt=""
            className="w-full h-full object-cover opacity-15"
            aria-hidden="true"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-forest-700/80" />
        </div>
        <div className="container-custom relative z-10 text-center">
          <AdmissionsCtaBandContent />
        </div>
      </section>
    </>
  );
}

export default Admissions;
