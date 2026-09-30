import { useState } from 'react';
import { siteConfig } from '../../../shared/config/siteConfig';
import useDownloads from '../hooks/useDownloads';
import { SectionWrapper, SectionHeader } from '../Components/ui/SectionWrapper';
import { downloadFileUrl, formatDownloadSize } from '../services/downloadService';
import usePageSeo from '../hooks/usePageSeo';

/* ═══════════════════════════════════════════
   Phase B.6 — PUBLIC DOWNLOADS CENTER
   DB-backed (downloads entity, PUBLISHED rows
   only). Downloads are served through
   /api/downloads/:id/file — the server resolves
   the managed file from the DB record (never a
   client path) and sends safe headers. No
   fallback files are fabricated: an empty or
   failing API renders the honest empty state.
   ═══════════════════════════════════════════ */

function DownloadsHero() {
  return (
    <section className="relative min-h-[50vh] md:min-h-[60vh] flex items-end overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="/Activity/733964172_1461551332654044_7584369769358467486_n.jpg"
          alt={`Downloads at ${siteConfig.identity.name}`}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/90 via-charcoal-900/50 to-charcoal-900/30" />
      </div>
      <div className="container-custom relative z-10 pb-16 md:pb-20 pt-32">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.08] border border-white/[0.12] text-[11px] font-semibold uppercase tracking-[0.15em] text-white/80 mb-5">
          <span className="w-1.5 h-1.5 bg-leaf-400 rounded-full" />
          Downloads
        </span>
        <h1 className="font-heading text-display text-white mb-4">
          Downloads Center
        </h1>
        <p className="text-body-lg text-white/70 max-w-2xl">
          Official documents, forms and publications from {siteConfig.identity.name}.
        </p>
      </div>
    </section>
  );
}

function DownloadRow({ item }) {
  const size = formatDownloadSize(item.file_bytes);
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-charcoal-100/70 bg-white p-5 transition-all duration-300 ease-premium hover:shadow-card-hover sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        {/* File-type badge (PDF) */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-forest-50">
          <span className="text-caption font-bold uppercase text-forest-700">
            {item.file_ext || 'pdf'}
          </span>
        </div>
        <div className="min-w-0">
          <h3 className="font-heading text-[15px] font-semibold text-charcoal-900">
            {item.title}
          </h3>
          {item.description && (
            <p className="mt-1 text-body-sm text-charcoal-500 leading-relaxed">
              {item.description}
            </p>
          )}
          <p className="mt-1.5 text-caption text-charcoal-400">
            {item.category}
            {size ? ` · ${size}` : ''}
            {item.original_filename ? ` · ${item.original_filename}` : ''}
          </p>
        </div>
      </div>
      <a
        href={downloadFileUrl(item.id)}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-forest-700 px-5 py-2.5 text-[13px] font-semibold text-white transition-all duration-250 ease-premium hover:bg-forest-800 hover:shadow-lg hover:shadow-forest-700/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-600"
        aria-label={`Download ${item.title}`}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"
          />
        </svg>
        Download
      </a>
    </div>
  );
}

function Downloads() {
  // Phase B.7: per-page metadata. Only the Center page itself is
  // indexable — individual document files are never put into
  // metadata and no filesystem URLs are exposed (Step 7 rule).
  usePageSeo({
    title: 'Downloads Center',
    description:
      'Official downloadable documents from Green Leaf International School & College — prospectus, forms, syllabus, routines and circulars.',
    path: '/downloads',
  });

  const [activeCategory, setActiveCategory] = useState('');
  const { items, categories, status } = useDownloads({
    category: activeCategory || undefined,
  });

  const isLoading = status === 'loading';
  const isEmpty = !isLoading && items.length === 0;

  return (
    <>
      <DownloadsHero />

      <SectionWrapper bg="bg-white" padding="py-section">
        <SectionHeader
          badge="Documents"
          title="Downloads Center"
          description="Find and download official school documents and forms."
        />

        {/* Category filter chips — only non-empty categories render */}
        {categories.length > 0 && (
          <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setActiveCategory('')}
              className={[
                'rounded-full px-4 py-1.5 text-[13px] font-semibold transition-all duration-200',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500',
                activeCategory === ''
                  ? 'bg-forest-700 text-white'
                  : 'border border-charcoal-200 text-charcoal-600 hover:bg-charcoal-50',
              ].join(' ')}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={[
                  'rounded-full px-4 py-1.5 text-[13px] font-semibold transition-all duration-200',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500',
                  activeCategory === category
                    ? 'bg-forest-700 text-white'
                    : 'border border-charcoal-200 text-charcoal-600 hover:bg-charcoal-50',
                ].join(' ')}
              >
                {category}
              </button>
            ))}
          </div>
        )}

        {/* Loading / empty states */}
        {isLoading && (
          <p className="py-12 text-center text-body-lg text-charcoal-400" role="status">
            Loading downloads…
          </p>
        )}
        {isEmpty && (
          <p className="py-12 text-center text-body-lg text-charcoal-400" role="status">
            No documents published yet. Check back soon.
          </p>
        )}

        {/* Document list */}
        {items.length > 0 && (
          <div className="mx-auto grid max-w-4xl gap-4">
            {items.map((item) => (
              <DownloadRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </SectionWrapper>
    </>
  );
}

export default Downloads;
