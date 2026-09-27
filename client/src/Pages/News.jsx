import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { siteConfig } from '../../../shared/config/siteConfig';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { useMarqueeClone } from '../hooks/useMarqueeClone';
import usePageSeo from '../hooks/usePageSeo';
import { useNews } from '../hooks/useNews';
import { SectionWrapper, SectionHeader } from '../Components/ui/SectionWrapper';
import { Card, CardBadge } from '../Components/ui/Card';

/* ═══════════════════════════════════════════
   Phase B item 4: the News page now FILTERS the
   central NewsProvider list by type (NEWS |
   NOTICE | EVENT | ANNOUNCEMENT) and renders an
   Upcoming Events view (EVENT items with a
   future "Event Date:" line, chronologically).
   No second data source, no extra fetches —
   everything derives from the same /api/news
   payload shared with the Homepage preview and
   the Navbar ticker.
   ═══════════════════════════════════════════ */

/* ═══════════════════════════════════════════
   NEWS CARD — Shared for both modes.
   Links to /news/:slug (detail page). Image and
   excerpt render only when present; a neutral
   branded block replaces a missing image.
   ═══════════════════════════════════════════ */
function NewsCard({ article, className = '' }) {
  const href = `/news/${article.slug}`;
  return (
    <article className={`group ${className}`}>
      <Link to={href} className="block h-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600 rounded-2xl">
        <Card className="h-full" padding={false}>
          {/* Image */}
          {article.image ? (
            <div className="aspect-[16/10] overflow-hidden relative">
              <img
                src={article.image}
                alt={article.title}
                className="w-full h-full object-cover transition-transform duration-700 ease-premium group-hover:scale-[1.03]"
                loading="lazy"
              />
            </div>
          ) : (
            <div
              className="aspect-[16/10] bg-gradient-to-br from-charcoal-50 to-charcoal-100 flex items-center justify-center"
              aria-hidden="true"
            >
              <svg
                className="w-10 h-10 text-charcoal-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 7.25h6m-6 4h6m-9.75 3.5h9.75M12 3.75H5.625c-.621 0-1.125.504-1.125 1.125v14.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a7.5 7.5 0 00-7.5-7.5z"
                />
              </svg>
            </div>
          )}

          {/* Content */}
          <div className="p-5 md:p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <CardBadge>{article.type}</CardBadge>
              {article.dateLabel && (
                <span className="text-caption text-charcoal-400">
                  {article.dateLabel}
                </span>
              )}
            </div>
            <h3 className="font-heading text-[15px] md:text-h3 font-semibold text-charcoal-900 mb-2 leading-snug group-hover:text-forest-700 transition-colors duration-200">
              {article.title}
            </h3>
            {article.excerpt && (
              <p className="text-body-sm text-charcoal-500 leading-relaxed mb-4 line-clamp-2">
                {article.excerpt}
              </p>
            )}
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
      </Link>
    </article>
  );
}

/* ═══════════════════════════════════════════
   FILTER CHIPS — same chip pattern as the
   Gallery page category filter. Values are the
   ACTUAL backend types; "All" maps to no filter.
   ═══════════════════════════════════════════ */
const FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'NEWS', label: 'News' },
  { key: 'EVENT', label: 'Events' },
  { key: 'NOTICE', label: 'Notices' },
  { key: 'ANNOUNCEMENT', label: 'Announcements' },
];

function chipClass(active) {
  return [
    'rounded-full px-4 py-1.5 text-[13px] font-semibold transition-all duration-200',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500',
    active
      ? 'bg-forest-700 text-white'
      : 'border border-charcoal-200 text-charcoal-600 hover:bg-charcoal-50',
  ].join(' ');
}

function FilterChips({ active, onChange }) {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
      {FILTERS.map((filter) => (
        <button
          key={filter.key}
          type="button"
          onClick={() => onChange(filter.key)}
          className={chipClass(active === filter.key)}
          aria-pressed={active === filter.key}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   UPCOMING EVENT CARD — event date is shown
   when the item carries a derived eventDate
   (parsed server-side from the item's content
   "Event Date:" line). Cards link to the same
   /news/:slug detail pages.
   ═══════════════════════════════════════════ */
function UpcomingEventCard({ article }) {
  return (
    <article className="group">
      <Link
        to={`/news/${article.slug}`}
        className="flex h-full items-stretch gap-4 rounded-xl border border-charcoal-100/70 bg-white p-4 transition-all duration-300 ease-premium hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
      >
        <div className="flex w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-forest-50 py-2">
          <span className="text-caption font-semibold uppercase tracking-wide text-forest-600">
            {article.eventDate
              ? new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'Asia/Dhaka' }).format(new Date(article.eventDate))
              : 'TBA'}
          </span>
          <span className="font-heading text-2xl font-bold text-forest-700">
            {article.eventDate
              ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', timeZone: 'Asia/Dhaka' }).format(new Date(article.eventDate))
              : '—'}
          </span>
        </div>
        <div className="min-w-0">
          <h3 className="font-heading text-[15px] font-semibold text-charcoal-900 leading-snug group-hover:text-forest-700 transition-colors duration-200">
            {article.title}
          </h3>
          {article.excerpt && (
            <p className="mt-1 text-body-sm text-charcoal-500 leading-relaxed line-clamp-2">
              {article.excerpt}
            </p>
          )}
        </div>
      </Link>
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
  // Phase B.7: per-page metadata. Filtered views (?type=…) share
  // this canonical — the CONSERVATIVE choice keeps one indexable
  // News URL instead of hundreds of duplicate filter URLs.
  usePageSeo({
    title: 'News & Events',
    description:
      'Latest news, notices, events and announcements from Green Leaf International School & College.',
    path: '/news',
  });

  const articlesRef = useScrollReveal();
  const [showAll, setShowAll] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReduced, setPrefersReduced] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const { items: news, status } = useNews();

  /* Client-side projection of the ONE central list — no extra
     fetch per filter (the provider payload already carries every
     published item; type filtering here mirrors the validated
     ?type= capability of the same API). */
  const filtered = useMemo(
    () => (filter === 'ALL' ? news : news.filter((item) => item.type === filter)),
    [news, filter],
  );
  const showTicker = filter === 'ALL';

  /* Upcoming events: EVENT items with a future derived eventDate,
     chronologically. Missing dates are excluded (handled safely). */
  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return news
      .filter((item) => item.type === 'EVENT' && item.eventDate)
      .map((item) => ({ ...item, ts: new Date(item.eventDate).getTime() }))
      .filter((item) => Number.isFinite(item.ts) && item.ts >= now)
      .sort((a, b) => a.ts - b.ts);
  }, [news]);

  /* Loop guard: the ticker animation slides the track by -50%, which
     is only seamless when one copy fills the viewport. With few items
     both copies would sit on screen at once — every card visible
     twice. Clone (and animate) ONLY when one copy is narrower than
     the viewport; until then the carousel is a static row. */
  const marquee = useMarqueeClone({
    enabled: showTicker && !showAll && !prefersReduced,
    animation: {
      animation: 'newsTicker 35s linear infinite',
      width: 'max-content',
    },
  });
  const carouselStyle = prefersReduced
    ? {
        overflowX: 'auto',
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
      }
    : {
        /* Always content-sized: the clone guard measures this
           track's extent — and the original layout had max-content
           here in both animated and static states. */
        width: 'max-content',
        ...(marquee.trackStyle ?? {}),
      };
  const carouselNews = marquee.clone ? [...filtered, ...filtered] : filtered;

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

  const isLoading = status === 'loading';
  const isEmpty = !isLoading && filtered.length === 0;

  return (
    <>
      <NewsHero />

      {/* ── Upcoming Events (chronological, future only) ── */}
      {upcomingEvents.length > 0 && (
        <SectionWrapper bg="bg-cream-50" padding="py-section">
          <SectionHeader
            badge="Save the Date"
            title="Upcoming Events"
            description="What's coming up next at our school."
          />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {upcomingEvents.map((event) => (
              <UpcomingEventCard key={event.slug} article={event} />
            ))}
          </div>
        </SectionWrapper>
      )}

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
          {news.length > 0 && (
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
          )}
        </div>

        {/* ── Type filter chips (actual backend type values) ── */}
        {news.length > 0 && <FilterChips active={filter} onChange={setFilter} />}

        {/* ── Empty / loading state (intentional, no fake content) ── */}
        {isEmpty && (
          <p className="text-center text-body-lg text-charcoal-400 py-12" role="status">
            {filter === 'ALL'
              ? 'No news or notices published yet. Check back soon.'
              : `No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase() ?? 'items'} published in this category yet.`}
          </p>
        )}
        {isLoading && (
          <p className="text-center text-body-lg text-charcoal-400 py-12" role="status">
            Loading news…
          </p>
        )}

        {/* ── MODE A: Horizontal Animated Showcase (All filter only —
             the ticker is an "everything happening" showcase) ── */}
        {showTicker && !showAll && filtered.length > 0 && (
          <div
            ref={marquee.viewportRef}
            className="overflow-hidden relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onFocus={handleFocusIn}
            onBlur={handleFocusOut}
            aria-label="Recent news carousel"
          >
            <div
              ref={(node) => {
                articlesRef.current = node;
                marquee.contentRef(node);
              }}
              className="flex gap-6"
              style={isPaused && carouselStyle?.animation
                ? { ...carouselStyle, animationPlayState: 'paused' }
                : carouselStyle}
            >
              {carouselNews.map((article, index) => (
                <div
                  key={marquee.clone ? `${article.slug}-${index}` : article.slug}
                  className="flex-shrink-0 w-[300px] md:w-[340px]"
                  aria-hidden={index >= filtered.length || undefined}
                >
                  <NewsCard article={article} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── MODE B: Static Responsive Grid (filtered or Show All) ── */}
        {(!showTicker || showAll) && filtered.length > 0 && (
          <div
            ref={articlesRef}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 stagger-children"
          >
            {filtered.map((article) => (
              <NewsCard key={article.slug} article={article} />
            ))}
          </div>
        )}
      </SectionWrapper>
    </>
  );
}

export default News;
