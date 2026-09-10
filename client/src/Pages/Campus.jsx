import { useScrollReveal } from '../hooks/useScrollReveal';
import { SectionWrapper, SectionHeader } from '../Components/ui/SectionWrapper';

const facilities = [
  { title: 'Classrooms', description: 'Spacious, well-lit classrooms equipped with modern teaching aids.', icon: '🏫' },
  { title: 'Science Labs', description: 'Fully equipped laboratories for Physics, Chemistry, and Biology.', icon: '🔬' },
  { title: 'Computer Lab', description: 'Modern computer laboratory with high-speed internet access.', icon: '💻' },
  { title: 'Library', description: 'A well-stocked library with thousands of books and digital resources.', icon: '📚' },
  { title: 'Sports Ground', description: 'Large playground for cricket, football, basketball, and athletics.', icon: '⚽' },
  { title: 'Auditorium', description: 'Multi-purpose auditorium for events, assemblies, and performances.', icon: '🎭' },
  { title: 'Art Studio', description: 'Creative space for painting, sculpting, and other artistic activities.', icon: '🎨' },
  { title: 'Cafeteria', description: 'Hygienic cafeteria providing nutritious meals and snacks.', icon: '🍽️' },
];

// Real activity images for gallery
const galleryImages = [
  { src: '/Activity/622795504_1331640232311822_8337787275400960079_n.jpg', alt: 'School event at Green Leaf' },
  { src: '/Activity/625315684_1336575921818253_5748372564670646089_n.jpg', alt: 'Student activities' },
  { src: '/Activity/626858006_1336049948537517_773566875872290209_n.jpg', alt: 'Campus life' },
  { src: '/Activity/733964172_1461551332654044_7584369769358467486_n.jpg', alt: 'School celebration' },
  { src: '/Activity/791960429_1520000160142494_7137261715921016786_n.jpg', alt: 'Student life at Green Leaf' },
  { src: '/Activity/793029087_1520000093475834_2743533360760256657_n.jpg', alt: 'School activities' },
  { src: '/Activity/798261974_1522758946533282_4611489181890379367_n.jpg', alt: 'Green Leaf campus' },
  { src: '/Activity/799202517_1523030029839507_1707174830228802214_n.jpg', alt: 'School environment' },
];

function CampusHero() {
  return (
    <section className="relative min-h-[50vh] md:min-h-[60vh] flex items-end overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="/Activity/724738811_1449859873823190_4267762226830169408_n.jpg"
          alt="Green Leaf International School campus"
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
  const overviewRef = useScrollReveal();
  const facilitiesRef = useScrollReveal();
  const galleryRef = useScrollReveal();

  return (
    <>
      <CampusHero />

      {/* Overview */}
      <SectionWrapper bg="bg-white" padding="py-section">
        <div ref={overviewRef} className="reveal">
          <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="relative">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden">
                <img
                  src="/Hero Section/hero 2.jpg"
                  alt="Green Leaf International School campus overview"
                  className="w-full h-full object-cover transition-transform duration-700 ease-premium hover:scale-[1.03]"
                  loading="lazy"
                />
              </div>
              <div className="absolute -bottom-4 -right-4 w-28 h-28 bg-forest-100/60 rounded-2xl -z-10" />
            </div>
            <div>
              <span className="eyebrow mb-4">Our Space</span>
              <h2 className="font-heading text-h2 text-charcoal-900 mb-5 mt-3">
                A Campus Built for Learning
              </h2>
              <p className="text-charcoal-500 leading-relaxed mb-4">
                [Campus description placeholder — Replace with verified information about
                the campus size, location, and notable features.]
              </p>
              <p className="text-charcoal-500 leading-relaxed">
                Our campus provides a safe, stimulating environment where students can explore
                their interests and develop their potential.
              </p>
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* Facilities */}
      <SectionWrapper bg="bg-cream-50" padding="py-section">
        <SectionHeader
          badge="Facilities"
          title="Our Facilities"
          description="World-class infrastructure to support holistic development."
        />
        <div ref={facilitiesRef} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
          {facilities.map((facility) => (
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

      {/* Gallery — Real Images */}
      <SectionWrapper bg="bg-white" padding="py-section">
        <SectionHeader
          badge="Gallery"
          title="Campus Gallery"
          description="A glimpse into life at Green Leaf International School & College."
        />
        <div ref={galleryRef} className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 stagger-children">
          {galleryImages.map((img, i) => (
            <div
              key={i}
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
    </>
  );
}

export default Campus;
