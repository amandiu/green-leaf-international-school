import { Link } from 'react-router-dom';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { SectionWrapper, SectionHeader } from '../Components/ui/SectionWrapper';
import { Card } from '../Components/ui/Card';
import Button from '../Components/ui/Button';

const programs = [
  { level: 'Primary', grades: 'Class I — Class V', description: 'Building strong foundations in literacy, numeracy, and creative thinking.', icon: '📚' },
  { level: 'Middle School', grades: 'Class VI — Class VIII', description: 'Deepening knowledge, developing critical thinking and independence.', icon: '🔬' },
  { level: 'Secondary', grades: 'Class IX — Class X', description: 'Preparing for board examinations with focused academic rigor.', icon: '🎓' },
  { level: 'Higher Secondary', grades: 'Class XI — Class XII', description: 'Specialized streams preparing students for university and careers.', icon: '🏛️' },
];

function AcademicsHero() {
  return (
    <section className="relative min-h-[50vh] md:min-h-[60vh] flex items-end overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="/Activity/724720915_1449859823823195_1182340900377047256_n.jpg"
          alt="Academic environment at Green Leaf International School"
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
  const overviewRef = useScrollReveal();
  const programsRef = useScrollReveal();
  const envRef = useScrollReveal();

  return (
    <>
      <AcademicsHero />

      {/* Curriculum Overview */}
      <SectionWrapper bg="bg-white" padding="py-section">
        <div ref={overviewRef} className="reveal">
          <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="order-2 md:order-1">
              <span className="eyebrow mb-4">Curriculum</span>
              <h2 className="font-heading text-h2 text-charcoal-900 mb-5 mt-3">
                Our Academic Approach
              </h2>
              <p className="text-charcoal-500 leading-relaxed mb-4">
                [Curriculum details placeholder — Replace with verified information about the
                curriculum framework, examination boards, and academic standards.]
              </p>
              <p className="text-charcoal-500 leading-relaxed">
                We believe that education should develop the whole person — intellectually,
                socially, emotionally, and physically.
              </p>
            </div>
            <div className="order-1 md:order-2 relative">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden">
                <img
                  src="/Activity/732747749_1461551622654015_1537158411137272684_n.jpg"
                  alt="Students learning at Green Leaf International School"
                  className="w-full h-full object-cover transition-transform duration-700 ease-premium hover:scale-[1.03]"
                  loading="lazy"
                />
              </div>
              <div className="absolute -bottom-4 -right-4 w-28 h-28 bg-forest-100/60 rounded-2xl -z-10" />
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* Programs */}
      <SectionWrapper bg="bg-cream-50" padding="py-section">
        <SectionHeader
          badge="Programs"
          title="Academic Programs"
          description="Structured pathways for every stage of your child's educational journey."
        />
        <div ref={programsRef} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 stagger-children">
          {programs.map((program) => (
            <Card key={program.level} className="group">
              <span className="text-4xl mb-4 block">{program.icon}</span>
              <h3 className="font-heading text-h3 text-charcoal-900 mb-1">{program.level}</h3>
              <p className="text-body-sm font-medium text-forest-600 mb-3">{program.grades}</p>
              <p className="text-body-sm text-charcoal-500 leading-relaxed">{program.description}</p>
            </Card>
          ))}
        </div>
      </SectionWrapper>

      {/* Learning Environment */}
      <SectionWrapper bg="bg-white" padding="py-section">
        <SectionHeader
          badge="Environment"
          title="Learning Environment"
          description="Creating spaces and experiences that inspire curiosity and growth."
        />
        <div ref={envRef} className="grid md:grid-cols-3 gap-6 stagger-children">
          {[
            { title: 'Smart Classrooms', description: 'Technology-enhanced learning spaces with interactive displays.', icon: '💻' },
            { title: 'Science Laboratories', description: 'Fully equipped labs for hands-on scientific exploration.', icon: '🧪' },
            { title: 'Library & Resource Center', description: 'A vast collection of books, digital resources, and study spaces.', icon: '📚' },
          ].map((item) => (
            <Card key={item.title} className="group text-center">
              <span className="text-4xl mb-4 block">{item.icon}</span>
              <h4 className="font-heading text-h3 text-charcoal-900 mb-2">{item.title}</h4>
              <p className="text-body-sm text-charcoal-500">{item.description}</p>
            </Card>
          ))}
        </div>
      </SectionWrapper>

      {/* CTA */}
      <section className="bg-forest-800 py-16">
        <div className="container-custom text-center">
          <h2 className="font-heading text-h2 text-white mb-3">
            Interested in Our Academic Programs?
          </h2>
          <p className="text-body-lg text-forest-200 mb-8">Contact us to learn more about admissions.</p>
          <Link to="/contact" className="group">
            <Button variant="gold" size="lg">Get in Touch</Button>
          </Link>
        </div>
      </section>
    </>
  );
}

export default Academics;
