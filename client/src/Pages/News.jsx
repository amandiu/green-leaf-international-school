import { useState, useEffect, useCallback } from 'react';
import { siteConfig } from '../../../shared/config/siteConfig';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { SectionWrapper } from '../Components/ui/SectionWrapper';
import { Card, CardBadge } from '../Components/ui/Card';

const placeholderNews = [
  {
    id: 1,
    title: '[News Title Placeholder 1]',
    excerpt:
      '[News excerpt placeholder — This will be populated from the database via the API in Phase 8.]',
    date: '[Date]',
    category: 'Event',
    image: '/Activity/791074857_1519300476879129_5256173980750495448_n.jpg',
  },
  {
    id: 2,
    title: '[News Title Placeholder 2]',
    excerpt:
      '[News excerpt placeholder — News articles will be managed through the admin panel.]',
    date: '[Date]',
    category: 'Achievement',
    image: '/Activity/733146204_1461550822654095_1531413830165513343_n.jpg',
  },
  {
    id: 3,
    title: '[News Title Placeholder 3]',
    excerpt:
      '[News excerpt placeholder — Real news content will replace these placeholders.]',
    date: '[Date]',
    category: 'Announcement',
    image: '/Activity/745503622_1472778644864646_857229043481260756_n.jpg',
  },
  {
    id: 4,
    title: '[News Title Placeholder 4]',
    excerpt:
      '[News excerpt placeholder — Real news content will replace these placeholders.]',
    date: '[Date]',
    category: 'Announcement',
    image: '/Activity/745503622_1472778644864646_857229043481260756_n.jpg',
  },
  {
    id: 5,
    title: '[News Title Placeholder 5]',
    excerpt:
      '[News excerpt placeholder — Real news content will replace these placeholders.]',
    date: '[Date]',
    category: 'Announcement',
    image: '/Activity/745503622_1472778644864646_857229043481260756_n.jpg',
  },
];

/* ═══════════════════════════════════════════
   NEWS CARD — Shared for both modes
   ═══════════════════════════════════════════ */
function NewsCard({ article, className = '' }) {
  return (
    <article className={`group ${className}`}>
      <Card className="h-full" padding={false}>
        {/* Image */}
        <div className="aspect-[16/10] overflow-hidden relative">
          <img
            src={article.image}
            alt={article.title}
            className="w-full h-full object-cover transition-transform duration-700 ease-premium group-hover:scale-[1.03]"
            loading="lazy"
          />
        </div>

        {/* Content */}
        <div className="p-5 md:p-6">
          <div className="flex items-center gap-2.5 mb-3">
            <CardBadge>{article.category}</CardBadge>
            <span className="text-caption text-charcoal-400">
              {article.date}
            </span>
          </div>
          <h3 className="font-heading text-[15px] md:text-h3 font-semibold text-charcoal-900 mb-2 leading-snug group-hover:text-forest-700 transition-colors duration-200">
            {article.title}
          </h3>
          <p className="text-body-sm text-charcoal-500 leading-relaxed mb-4 line-clamp-2">
            {article.excerpt}
          </p>
          <span className="inline-flex items-center gap-1.5 text-body-sm font-medium text-forest-600 group-hover:text-forest-700 transition-colors">
            Read more
            <svg
              className="w-3.5 h-3.5 transition-transform duration-250 ease-premium group-hover:translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </span>
        </div>
      </Card>
    </article>
  );
}

/* ═══════════════════════════════════════════
   NEWS HERO
   ═══════════════════════════════════════════ */
function NewsHero() {
  return (
    <section className="relative min-h-[50vh] md:min-h-[60vh] flex items-end overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="/Activity/798261940_1522758883199955_4596081823843794397_n.jpg"
          alt={`News and events at ${siteConfig.identity.name}`}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/90 via-charcoal-900/50 to-charcoal-900/30" />
      </div>
      <div className="container-custom relative z-10 pb-16 md:pb-20 pt-32">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.08] border border-white/[0.12] text-[11px] font-semibold uppercase tracking-[0.15em] text-white/80 mb-5">
          <span className="w-1.5 h-1.5 bg-leaf-400 rounded-full" />
          News &amp; Events
        </span>
        <h1 className="font-heading text-display text-white mb-4">
          News &amp; Events
        </h1>
        <p className="text-body-lg text-white/70 max-w-2xl">
          Stay updated with the latest happenings at {siteConfig.identity.name}.
        </p>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   NEWS PAGE — Main Component
   ═══════════════════════════════════════════ */
function News() {
  const articlesRef = useScrollReveal();
  const [showAll, setShowAll] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    setPrefersReduced(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
  }, []);

  const handleMouseEnter = useCallback(() => setIsPaused(true), []);
  const handleMouseLeave = useCallback(() => setIsPaused(false), []);
  const handleFocusIn = useCallback(() => setIsPaused(true), []);
  const handleFocusOut = useCallback(() => setIsPaused(false), []);

  const toggleShowAll = useCallback(() => setShowAll((prev) => !prev), []);

  const duplicatedNews = [...placeholderNews, ...placeholderNews];

  return (
    <>
      <NewsHero />

      <SectionWrapper bg="bg-white" padding="py-section">
        {/* ── Section Header + Show All Button ── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12 md:mb-16 text-center sm:text-left">
          <div>
            <span className="eyebrow mb-4">Latest</span>
            <h2 className="font-heading text-h2 text-charcoal-900 mb-4 mt-3">
              Recent News
            </h2>
            <p className="text-body-lg text-charcoal-500 leading-relaxed max-w-2xl">
              Discover events, achievements, and announcements from our school.
            </p>
          </div>
          <button
            onClick={toggleShowAll}
            className={[
              'inline-flex items-center gap-2 px-5 py-2.5 rounded-lg shrink-0',
              'text-[13px] font-semibold transition-all duration-250 ease-premium',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600',
              showAll
                ? 'bg-charcoal-100 text-charcoal-700 hover:bg-charcoal-200'
                : 'bg-forest-700 text-white hover:bg-forest-800 hover:shadow-lg hover:shadow-forest-700/20 active:bg-forest-900',
            ].join(' ')}
            aria-expanded={showAll}
          >
            {showAll ? 'Show Less' : 'Show All'}
          </button>
        </div>

        {/* ── MODE A: Horizontal Animated Showcase ── */}
        {!showAll && (
          <div
            className="overflow-hidden"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onFocus={handleFocusIn}
            onBlur={handleFocusOut}
            aria-label="Recent news carousel"
          >
            <div
              ref={articlesRef}
              className="flex gap-6"
              style={
                prefersReduced
                  ? {
                      overflowX: 'auto',
                      scrollSnapType: 'x mandatory',
                      WebkitOverflowScrolling: 'touch',
                    }
                  : {
                      animation: 'newsTicker 35s linear infinite',
                      animationPlayState: isPaused ? 'paused' : 'running',
                      width: 'max-content',
                    }
              }
            >
              {duplicatedNews.map((article, index) => (
                <div
                  key={`${article.id}-${index}`}
                  className="flex-shrink-0 w-[300px] md:w-[340px]"
                  aria-hidden={index >= placeholderNews.length}
                >
                  <NewsCard article={article} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── MODE B: Static Responsive Grid ── */}
        {showAll && (
          <div
            ref={articlesRef}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 stagger-children"
          >
            {placeholderNews.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </div>
        )}

        <p className="text-center mt-10 text-caption text-charcoal-400 italic">
          News content will be managed through the admin panel and fetched via
          API in Phase 8.
        </p>
      </SectionWrapper>
    </>
  );
}

export default News;
