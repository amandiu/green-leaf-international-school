import { useScrollReveal } from '../hooks/useScrollReveal';
import { SectionWrapper, SectionHeader } from '../Components/ui/SectionWrapper';
import { Card, CardBadge } from '../Components/ui/Card';

const placeholderNews = [
  {
    id: 1,
    title: '[News Title Placeholder 1]',
    excerpt: '[News excerpt placeholder — This will be populated from the database via the API in Phase 8.]',
    date: '[Date]',
    category: 'Event',
    image: '/Activity/791074857_1519300476879129_5256173980750495448_n.jpg',
  },
  {
    id: 2,
    title: '[News Title Placeholder 2]',
    excerpt: '[News excerpt placeholder — News articles will be managed through the admin panel.]',
    date: '[Date]',
    category: 'Achievement',
    image: '/Activity/733146204_1461550822654095_1531413830165513343_n.jpg',
  },
  {
    id: 3,
    title: '[News Title Placeholder 3]',
    excerpt: '[News excerpt placeholder — Real news content will replace these placeholders.]',
    date: '[Date]',
    category: 'Announcement',
    image: '/Activity/745503622_1472778644864646_857229043481260756_n.jpg',
  },
];

function NewsHero() {
  return (
    <section className="relative min-h-[50vh] md:min-h-[60vh] flex items-end overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="/Activity/798261940_1522758883199955_4596081823843794397_n.jpg"
          alt="News and events at Green Leaf International School"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/90 via-charcoal-900/50 to-charcoal-900/30" />
      </div>
      <div className="container-custom relative z-10 pb-16 md:pb-20 pt-32">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.08] border border-white/[0.12] text-[11px] font-semibold uppercase tracking-[0.15em] text-white/80 mb-5">
          <span className="w-1.5 h-1.5 bg-leaf-400 rounded-full" />
          News &amp; Events
        </span>
        <h1 className="font-heading text-display text-white mb-4">News &amp; Events</h1>
        <p className="text-body-lg text-white/70 max-w-2xl">
          Stay updated with the latest happenings at Green Leaf International School &amp; College.
        </p>
      </div>
    </section>
  );
}

function News() {
  const articlesRef = useScrollReveal();

  return (
    <>
      <NewsHero />

      <SectionWrapper bg="bg-white" padding="py-section">
        <SectionHeader
          badge="Latest"
          title="Recent News"
          description="Discover events, achievements, and announcements from our school."
        />

        <div ref={articlesRef} className="grid md:grid-cols-3 gap-8 stagger-children">
          {placeholderNews.map((article) => (
            <article key={article.id} className="group">
              <Card className="h-full" padding={false}>
                {/* Real image */}
                <div className="aspect-[16/10] overflow-hidden relative">
                  <img
                    src={article.image}
                    alt={article.title}
                    className="w-full h-full object-cover transition-transform duration-700 ease-premium group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="flex items-center gap-2.5 mb-3">
                    <CardBadge>{article.category}</CardBadge>
                    <span className="text-caption text-charcoal-400">{article.date}</span>
                  </div>
                  <h3 className="font-heading text-h3 text-charcoal-900 mb-2 group-hover:text-forest-700 transition-colors duration-200">
                    {article.title}
                  </h3>
                  <p className="text-body-sm text-charcoal-500 leading-relaxed mb-4">
                    {article.excerpt}
                  </p>
                  <span className="inline-flex items-center gap-1.5 text-body-sm font-medium text-forest-600 group-hover:text-forest-700 transition-colors">
                    Read more
                    <svg className="w-3.5 h-3.5 transition-transform duration-250 ease-premium group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </span>
                </div>
              </Card>
            </article>
          ))}
        </div>

        <p className="text-center mt-10 text-caption text-charcoal-400 italic">
          News content will be managed through the admin panel and fetched via API in Phase 8.
        </p>
      </SectionWrapper>
    </>
  );
}

export default News;
