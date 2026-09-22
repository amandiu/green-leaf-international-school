import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { siteConfig } from '../../../shared/config/siteConfig';
import { SectionWrapper } from '../Components/ui/SectionWrapper';
import { CardBadge } from '../Components/ui/Card';
import { getPublishedNewsBySlug } from '../services/newsService';

/* ═══════════════════════════════════════════
   NEWS DETAIL (Phase E) — /news/:slug
   Same central News API (public, PUBLISHED only).
   Renders the item's own content paragraphs; a
   missing item shows a calm "not found" state with
   a route back — never an ErrorBoundary.
   ═══════════════════════════════════════════ */

function DetailSkeleton() {
  return (
    <SectionWrapper bg="bg-white" padding="py-section">
      <div className="max-w-3xl mx-auto animate-pulse" role="status" aria-label="Loading news">
        <div className="h-6 w-28 bg-charcoal-100 rounded-full mb-6" />
        <div className="h-10 bg-charcoal-100 rounded mb-4" />
        <div className="h-5 w-1/3 bg-charcoal-100 rounded mb-10" />
        <div className="aspect-[16/9] bg-charcoal-100 rounded-2xl mb-10" />
        <div className="space-y-4">
          <div className="h-4 bg-charcoal-100 rounded" />
          <div className="h-4 bg-charcoal-100 rounded" />
          <div className="h-4 w-2/3 bg-charcoal-100 rounded" />
        </div>
      </div>
    </SectionWrapper>
  );
}

function DetailNotFound() {
  return (
    <SectionWrapper bg="bg-white" padding="py-section">
      <div className="max-w-2xl mx-auto text-center py-12">
        <h1 className="font-heading text-h2 text-charcoal-900 mb-4">
          News item not found
        </h1>
        <p className="text-body-lg text-charcoal-500 mb-8">
          This item may have been unpublished or removed.
        </p>
        <Link
          to="/news"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-forest-700 text-white text-body-sm font-semibold hover:bg-forest-800 transition-colors duration-250 ease-premium"
        >
          Back to News &amp; Events
        </Link>
      </div>
    </SectionWrapper>
  );
}

function NewsDetail() {
  const { slug } = useParams();
  const [item, setItem] = useState(undefined); // undefined = loading
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setItem(undefined);
    setFailed(false);
    getPublishedNewsBySlug(slug)
      .then((data) => {
        if (!cancelled) setItem(data); // null = not found (or unpublished)
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('[News] detail unavailable:', err?.message);
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (item?.title) document.title = `${item.title} — ${siteConfig.identity.name}`;
  }, [item?.title]);

  if (item === undefined && !failed) return <DetailSkeleton />;
  if (failed) {
    return (
      <SectionWrapper bg="bg-white" padding="py-section">
        <div className="max-w-2xl mx-auto text-center py-12">
          <h1 className="font-heading text-h2 text-charcoal-900 mb-4">
            News is unavailable
          </h1>
          <p className="text-body-lg text-charcoal-500 mb-8">
            We couldn&apos;t load this item right now. Please try again later.
          </p>
          <Link
            to="/news"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-forest-700 text-white text-body-sm font-semibold hover:bg-forest-800 transition-colors duration-250 ease-premium"
          >
            Back to News &amp; Events
          </Link>
        </div>
      </SectionWrapper>
    );
  }
  if (item === null) return <DetailNotFound />;

  const paragraphs = String(item.content ?? '')
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <>
      {/* Hero — image or branded gradient fallback */}
      <section className="relative min-h-[50vh] md:min-h-[60vh] flex items-end overflow-hidden">
        <div className="absolute inset-0">
          {item.image ? (
            <img
              src={item.image}
              alt={item.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full bg-gradient-to-br from-forest-800 via-forest-900 to-charcoal-900"
              aria-hidden="true"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/90 via-charcoal-900/50 to-charcoal-900/30" />
        </div>
        <div className="container-custom relative z-10 pb-16 md:pb-20 pt-32">
          <div className="flex items-center gap-3 mb-5">
            <CardBadge>{item.type}</CardBadge>
            {item.dateLabel && (
              <span className="text-caption text-white/60">{item.dateLabel}</span>
            )}
          </div>
          <h1 className="font-heading text-display text-white mb-4 max-w-3xl">
            {item.title}
          </h1>
          {item.excerpt && (
            <p className="text-body-lg text-white/70 max-w-2xl">{item.excerpt}</p>
          )}
        </div>
      </section>

      <SectionWrapper bg="bg-white" padding="py-section">
        <div className="max-w-3xl mx-auto">
          {paragraphs.length > 0 ? (
            <div className="space-y-6">
              {paragraphs.map((paragraph, i) => (
                <p key={i} className="text-body-lg text-charcoal-600 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-body-lg text-charcoal-400 italic">
              Full details will be published soon.
            </p>
          )}

          <div className="mt-12 pt-8 border-t border-charcoal-100">
            <Link
              to="/news"
              className="inline-flex items-center gap-2 text-body-sm font-semibold text-forest-700 hover:text-forest-800 transition-colors"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
              </svg>
              Back to News &amp; Events
            </Link>
          </div>
        </div>
      </SectionWrapper>
    </>
  );
}

export default NewsDetail;
