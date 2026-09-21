import { useScrollReveal } from '../hooks/useScrollReveal';
import { SectionWrapper, SectionHeader } from '../Components/ui/SectionWrapper';
import { Card } from '../Components/ui/Card';
import { siteConfig } from '../../../shared/config/siteConfig';

const values = [
  { title: 'Excellence', description: 'We strive for the highest standards in everything we do.', icon: '⭐' },
  { title: 'Integrity', description: 'Honesty, transparency, and ethical conduct guide our actions.', icon: '🛡️' },
  { title: 'Innovation', description: 'Embracing new ideas and creative approaches to education.', icon: '💡' },
  { title: 'Respect', description: 'Fostering a culture of mutual respect and understanding.', icon: '🤝' },
];

function AboutHero() {
  return (
    <section className="relative min-h-[50vh] md:min-h-[60vh] flex items-end overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="/Activity/723042553_1448847033924474_4016011292812671924_n.jpg"
          alt={`${siteConfig.identity.name} campus`}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/90 via-charcoal-900/50 to-charcoal-900/30" />
      </div>
      <div className="container-custom relative z-10 pb-16 md:pb-20 pt-32">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.08] border border-white/[0.12] text-[11px] font-semibold uppercase tracking-[0.15em] text-white/80 mb-5">
          <span className="w-1.5 h-1.5 bg-leaf-400 rounded-full" />
          About Us
        </span>
        <h1 className="font-heading text-display text-white mb-4">About {siteConfig.identity.shortName}</h1>
        <p className="text-body-lg text-white/70 max-w-2xl">
          Discover our story, our values, and our commitment to shaping futures.
        </p>
      </div>
    </section>
  );
}

function About() {
  const introRef = useScrollReveal();
  const vmRef = useScrollReveal();
  const valuesRef = useScrollReveal();
  const principalRef = useScrollReveal();

  return (
    <>
      <AboutHero />

      {/* Introduction */}
      <SectionWrapper bg="bg-white" padding="py-section">
        <div ref={introRef} className="reveal">
          <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <span className="eyebrow mb-4">Our Story</span>
              <h2 className="font-heading text-h2 text-charcoal-900 mb-5 mt-3">
                A Tradition of Excellence
              </h2>
              <p className="text-charcoal-500 leading-relaxed mb-4">
                [School introduction placeholder — Replace with verified school history and background information.]
              </p>
              <p className="text-charcoal-500 leading-relaxed">
                {siteConfig.identity.name} is dedicated to providing a nurturing
                environment where students can thrive academically, socially, and personally.
              </p>
            </div>
            <div className="relative">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden">
                <img
                  src="/Activity/799142983_1523030073172836_1172060919875647706_n.jpg"
                  alt={`${siteConfig.identity.name} students and campus`}
                  className="w-full h-full object-cover transition-transform duration-700 ease-premium hover:scale-[1.03]"
                  loading="lazy"
                />
              </div>
              <div className="absolute -bottom-4 -right-4 w-28 h-28 bg-leaf-100/60 rounded-2xl -z-10" />
              <div className="absolute -top-3 -left-3 w-16 h-16 bg-gold-100/40 rounded-xl -z-10" />
            </div>
          </div>
        </div>
      </SectionWrapper>
       {/* Core Values */}
      <SectionWrapper bg="bg-white" padding="py-section">
        <SectionHeader
          badge="Our Values"
          title="Core Values"
          description={`The principles that guide everything we do at ${siteConfig.identity.shortName}.`}
        />
        <div ref={valuesRef} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
          {values.map((value) => (
            <div key={value.title} className="text-center p-7 rounded-xl bg-cream-50 border border-charcoal-100/60 hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 ease-premium">
              <span className="text-4xl mb-4 block">{value.icon}</span>
              <h4 className="font-heading text-h3 text-charcoal-900 mb-2">{value.title}</h4>
              <p className="text-body-sm text-charcoal-500">{value.description}</p>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* Vision & Mission */}

      <SectionWrapper bg="bg-cream-50" padding="py-section">
        <div ref={vmRef} className="reveal py-10">
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="border-l-4 border-l-forest-500 !p-8" hover={false}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 bg-forest-50 rounded-xl flex items-center justify-center text-2xl">
                  👁️
                </div>
                <h3 className="font-heading text-h3 text-charcoal-900">Our Vision</h3>
              </div>
              <p className="text-charcoal-500 leading-relaxed">
                [Vision statement placeholder — Replace with the school&apos;s verified vision statement.]
              </p>
            </Card>

            <Card className="border-l-4 border-l-leaf-500 !p-8" hover={false}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 bg-leaf-50 rounded-xl flex items-center justify-center text-2xl">
                  🎯
                </div>
                <h3 className="font-heading text-h3 text-charcoal-900">Our Mission</h3>
              </div>
              <p className="text-charcoal-500 leading-relaxed">
                [Mission statement placeholder — Replace with the school&apos;s verified mission statement.]
              </p>
            </Card>
          </div>
        </div>
      </SectionWrapper>

     
      
    </>
  );
}

export default About;
