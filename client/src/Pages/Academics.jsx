import { Link } from 'react-router-dom';
import { siteConfig } from '../../../shared/config/siteConfig';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { usePageContent } from '../hooks/usePageContent';
import { SectionWrapper, SectionHeader } from '../Components/ui/SectionWrapper';
import { Card } from '../Components/ui/Card';
import Button from '../Components/ui/Button';
import { defaultAcademicsContent } from '../../../shared/content/academicsContent';
import usePageSeo from '../hooks/usePageSeo';

// Phase B.3: the Academics page's editable sections are DB-backed
// (page_sections, page='academics'). These verified fallback
// constants render immediately and stay as the safe baseline when
// the API is unavailable or a section is empty. This page is the
// public INFORMATIONAL page only — attendance/results/classes/
// exam management remain future phases.
const FALLBACK_CONTENT = defaultAcademicsContent();

function AcademicsHero() {
  return (
    <section className="relative min-h-[50vh] md:min-h-[60vh] flex items-end overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="/Activity/724720915_1449859823823195_1182340900377047256_n.jpg"
          alt={`Academic environment at ${siteConfig.identity.name}`}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/90 via-charcoal-900/50 to-charcoal-900/30" />
      </div>
      <div className="container-custom relative z-10 pb-16 md:pb-20 pt-32">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.08] border border-white/[0.12] text-[11px] font-semibold uppercase tracking-[0.15em] text-white/80 mb-5">
          <span className="w-1.5 h-1.5 bg-leaf-400 rounded-full" />
          Academics
        </span>
        <h1 className="font-heading text-display text-white mb-4">Academic Programs</h1>
        <p className="text-body-lg text-white/70 max-w-2xl">
          A comprehensive curriculum designed to challenge, inspire, and prepare students for tomorrow.
        </p>
      </div>
    </section>
  );
}

function Academics() {
  // Phase B.7: per-page metadata.
  usePageSeo({
    title: 'Academics',
    description:
      'Academic programs, curriculum overview and learning environment at Green Leaf International School & College.',
    path: '/academics',
  });

  const { content } = usePageContent('academics', FALLBACK_CONTENT);
  const overviewRef = useScrollReveal();
  const programsRef = useScrollReveal();
  const envRef = useScrollReveal();

  const { overview, programs, environment, academicsCta } = content;

  return (
    <>
      <AcademicsHero />

      {/* Curriculum Overview */}
      {overview?.isActive !== false && (
      <SectionWrapper bg="bg-white" padding="py-section">
        <div ref={overviewRef} className="reveal">
          <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="order-2 md:order-1">
              <span className="eyebrow mb-4">{overview.eyebrow}</span>
              <h2 className="font-heading text-h2 text-charcoal-900 mb-5 mt-3">
                {overview.title}
              </h2>
              <p className="text-charcoal-500 leading-relaxed mb-4">
                {overview.paragraph1}
              </p>
              <p className="text-charcoal-500 leading-relaxed">
                {overview.paragraph2}
              </p>
            </div>
            <div className="order-1 md:order-2 relative">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden">
                <img
                  src={overview.image}
                  alt={overview.imageAlt || `Students learning at ${siteConfig.identity.name}`}
                  className="w-full h-full object-cover transition-transform duration-700 ease-premium hover:scale-[1.03]"
                  loading="lazy"
                />
              </div>
              <div className="absolute -bottom-4 -right-4 w-28 h-28 bg-forest-100/60 rounded-2xl -z-10" />
            </div>
          </div>
        </div>
      </SectionWrapper>
      )}

      {/* Programs */}
      {programs?.isActive !== false && (
      <SectionWrapper bg="bg-cream-50" padding="py-section">
        <SectionHeader
          badge={programs.eyebrow}
          title={programs.title}
          description={programs.description}
        />
        <div ref={programsRef} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
          {(programs.programs ?? []).map((program) => (
            <Card key={program.title} className="group">
              <span className="text-4xl mb-4 block">{program.icon}</span>
              <h3 className="font-heading text-h3 text-charcoal-900 mb-1">{program.title}</h3>
              <p className="text-body-sm font-medium text-forest-600 mb-3">{program.subtitle}</p>
              <p className="text-body-sm text-charcoal-500 leading-relaxed">{program.description}</p>
            </Card>
          ))}
        </div>
        </SectionWrapper>
      )}

      {/* Learning Environment */}
      {environment?.isActive !== false && (
      <SectionWrapper bg="bg-white" padding="py-section">
        <SectionHeader
          badge={environment.eyebrow}
          title={environment.title}
          description={environment.description}
        />
        <div ref={envRef} className="grid md:grid-cols-3 gap-6 stagger-children">
          {(environment.items ?? []).map((item) => (
            <Card key={item.title} className="group text-center">
              <span className="text-4xl mb-4 block">{item.icon}</span>
              <h4 className="font-heading text-h3 text-charcoal-900 mb-2">{item.title}</h4>
              <p className="text-body-sm text-charcoal-500">{item.description}</p>
            </Card>
          ))}
        </div>
      </SectionWrapper>
      )}

      {/* CTA */}
      {academicsCta?.isActive !== false && (
      <section className="bg-forest-800 py-16">
        <div className="container-custom text-center">
          <h2 className="font-heading text-h2 text-white mb-3">
            {academicsCta.title}
          </h2>
          <p className="text-body-lg text-forest-200 mb-8">{academicsCta.description}</p>
          <Link to={academicsCta.buttonLink || '/contact'} className="group">
            <Button variant="gold" size="lg">{academicsCta.buttonText}</Button>
          </Link>
        </div>
      </section>
      )}
    </>
  );
}

export default Academics;
