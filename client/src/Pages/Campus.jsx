import { useScrollReveal } from '../hooks/useScrollReveal';
import useGallery from '../hooks/useGallery';
import { usePageContent } from '../hooks/usePageContent';
import { SectionWrapper, SectionHeader } from '../Components/ui/SectionWrapper';
import { siteConfig } from '../../../shared/config/siteConfig';
import { defaultCampusContent } from '../../../shared/content/campusContent';
import usePageSeo from '../hooks/usePageSeo';

// Phase B.3: the Campus page's editable sections are DB-backed
// (page_sections, page='campus'). These verified fallback
// constants render immediately and stay as the safe baseline when
// the API is unavailable or a section is empty.
const FALLBACK_CONTENT = defaultCampusContent();

// Phase B.2: the Campus gallery grid is DB-backed. The DB gallery
// (admin-managed, published items only) is the source of truth; these
// verified site images remain the VISIBLE FALLBACK while no published
// items exist (API down or gallery still empty) — same fallback-first
// convention as the navigation items. Real published rows replace them
// automatically; content is never copied between the two sources.
const FALLBACK_GALLERY_IMAGES = [
  { id: 'fb-1', src: '/Activity/622795504_1331640232311822_8337787275400960079_n.jpg', alt: `School event at ${siteConfig.identity.shortName}` },
  { id: 'fb-2', src: '/Activity/625315684_1336575921818253_5748372564670646089_n.jpg', alt: 'Student activities' },
  { id: 'fb-3', src: '/Activity/626858006_1336049948537517_773566875872290209_n.jpg', alt: 'Campus life' },
  { id: 'fb-4', src: '/Activity/733964172_1461551332654044_7584369769358467486_n.jpg', alt: 'School celebration' },
  { id: 'fb-5', src: '/Activity/791960429_1520000160142494_7137261715921016786_n.jpg', alt: `Student life at ${siteConfig.identity.shortName}` },
  { id: 'fb-6', src: '/Activity/793029087_1520000093475834_2743533360760256657_n.jpg', alt: 'School activities' },
  { id: 'fb-7', src: '/Activity/798261974_1522758946533282_4611489181890379367_n.jpg', alt: `${siteConfig.identity.shortName} campus` },
  { id: 'fb-8', src: '/Activity/799202517_1523030029839507_1707174830228802214_n.jpg', alt: 'School environment' },
];

function CampusHero() {
  return (
    <section className="relative min-h-[50vh] md:min-h-[60vh] flex items-end overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="/Activity/724738811_1449859873823190_4267762226830169408_n.jpg"
          alt={`${siteConfig.identity.name} campus`}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/90 via-charcoal-900/50 to-charcoal-900/30" />
      </div>
      <div className="container-custom relative z-10 pb-16 md:pb-20 pt-32">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.08] border border-white/[0.12] text-[11px] font-semibold uppercase tracking-[0.15em] text-white/80 mb-5">
          <span className="w-1.5 h-1.5 bg-leaf-400 rounded-full" />
          Campus
        </span>
        <h1 className="font-heading text-display text-white mb-4">Our Campus</h1>
        <p className="text-body-lg text-white/70 max-w-2xl">
          A sprawling campus designed to inspire learning, creativity, and exploration.
        </p>
      </div>
    </section>
  );
}

function Campus() {
  // Phase B.7: per-page metadata.
  usePageSeo({
    title: 'Campus & Facilities',
    description:
      'Campus, facilities and student life at Green Leaf International School & College — classrooms, library, labs, playground and more.',
    path: '/campus',
  });

  const overviewRef = useScrollReveal();
  const facilitiesRef = useScrollReveal();
  const galleryRef = useScrollReveal();
  // Phase B.3: editable section copy from page_sections (page='campus')
  // with the shared fallback as the safe baseline.
  const { content } = usePageContent('campus', FALLBACK_CONTENT);
  const { overview, facilities, galleryHighlight } = content;
  // Phase B.2 (unchanged): one fetch per mount; published items only.
  // Empty/fallback → the hardcoded verified images render (the grid
  // never goes blank). Gallery data stays in gallery_items ONLY —
  // page_sections holds this band's heading copy, never images.
  const { items: galleryItems } = useGallery({ limit: 8 });
  const gallery = galleryItems.length > 0
    ? galleryItems.map((item) => ({ id: item.id, src: item.image, alt: item.caption || item.title }))
    : FALLBACK_GALLERY_IMAGES;

  return (
    <>
      <CampusHero />

      {/* Overview */}
      {overview?.isActive !== false && (
      <SectionWrapper bg="bg-white" padding="py-section">
        <div ref={overviewRef} className="reveal">
          <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="relative">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden">
                <img
                  src={overview.image}
                  alt={overview.imageAlt || `${siteConfig.identity.name} campus overview`}
                  className="w-full h-full object-cover transition-transform duration-700 ease-premium hover:scale-[1.03]"
                  loading="lazy"
                />
              </div>
              <div className="absolute -bottom-4 -right-4 w-28 h-28 bg-forest-100/60 rounded-2xl -z-10" />
            </div>
            <div>
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
          </div>
        </div>
      </SectionWrapper>
      )}

      {/* Facilities */}
      {facilities?.isActive !== false && (
      <SectionWrapper bg="bg-cream-50" padding="py-section">
        <SectionHeader
          badge={facilities.eyebrow}
          title={facilities.title}
          description={facilities.description}
        />
        <div ref={facilitiesRef} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
          {(facilities.facilities ?? []).map((facility) => (
            <div
              key={facility.title}
              className="p-7 bg-white rounded-xl border border-charcoal-100/60 text-center hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 ease-premium"
            >
              <span className="text-4xl mb-4 block">{facility.icon}</span>
              <h3 className="font-heading text-h3 text-charcoal-900 mb-2">{facility.title}</h3>
              <p className="text-body-sm text-charcoal-500 leading-relaxed">{facility.description}</p>
            </div>
          ))}
        </div>
      </SectionWrapper>
      )}

      {/* Gallery — Real Images (data: gallery_items via useGallery) */}
      {galleryHighlight?.isActive !== false && (
      <SectionWrapper bg="bg-white" padding="py-section">
        <SectionHeader
          badge={galleryHighlight.eyebrow}
          title={galleryHighlight.title}
          description={galleryHighlight.description}
        />
        <div ref={galleryRef} className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 stagger-children">
          {gallery.map((img) => (
            <div
              key={img.id}
              className="aspect-square rounded-xl overflow-hidden group cursor-pointer"
            >
              <img
                src={img.src}
                alt={img.alt}
                className="w-full h-full object-cover transition-transform duration-700 ease-premium group-hover:scale-[1.05]"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </SectionWrapper>
      )}
    </>
  );
}

export default Campus;
