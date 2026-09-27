import { useState } from 'react';
import { siteConfig } from '../../../shared/config/siteConfig';
import { useScrollReveal } from '../hooks/useScrollReveal';
import useGallery from '../hooks/useGallery';
import { SectionWrapper, SectionHeader } from '../Components/ui/SectionWrapper';
import usePageSeo from '../hooks/usePageSeo';

/* ═══════════════════════════════════════════
   GALLERY PAGE (Phase B.2)
   The photo grid comes from the CENTRAL public
   gallery API (useGallery → GET /api/gallery,
   PUBLISHED items only). Category filter chips
   render only categories that currently have
   published items. The page never invents
   placeholder content — empty state is intentional.
   ═══════════════════════════════════════════ */

function GalleryHero() {
  return (
    <section className="relative min-h-[50vh] md:min-h-[60vh] flex items-end overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="/Activity/626858006_1336049948537517_773566875872290209_n.jpg"
          alt={`Gallery at ${siteConfig.identity.name}`}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/90 via-charcoal-900/50 to-charcoal-900/30" />
      </div>
      <div className="container-custom relative z-10 pb-16 md:pb-20 pt-32">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.08] border border-white/[0.12] text-[11px] font-semibold uppercase tracking-[0.15em] text-white/80 mb-5">
          <span className="w-1.5 h-1.5 bg-leaf-400 rounded-full" />
          Gallery
        </span>
        <h1 className="font-heading text-display text-white mb-4">Photo Gallery</h1>
        <p className="text-body-lg text-white/70 max-w-2xl">
          Moments, events, and everyday life at {siteConfig.identity.name}.
        </p>
      </div>
    </section>
  );
}

function Gallery() {
  // Phase B.7: per-page metadata. One page-level schema set only —
  // gallery photos stay in gallery_items (no per-image schema).
  usePageSeo({
    title: 'Photo Gallery',
    description:
      'Photo gallery of events, activities and campus life at Green Leaf International School & College.',
    path: '/gallery',
  });

  const [activeCategory, setActiveCategory] = useState('');
  const gridRef = useScrollReveal();
  const { items, categories, status } = useGallery(
    activeCategory ? { category: activeCategory } : {},
  );

  const isLoading = status === 'loading';
  const isEmpty = !isLoading && items.length === 0;

  return (
    <>
      <GalleryHero />

      <SectionWrapper bg="bg-white" padding="py-section">
        <SectionHeader
          badge="Gallery"
          title="Our Photo Gallery"
          description={`A glimpse into life at ${siteConfig.identity.name}.`}
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

        {/* Loading / empty states (intentional — no fake content) */}
        {isLoading && (
          <p className="text-center text-body-lg text-charcoal-400 py-12" role="status">
            Loading gallery…
          </p>
        )}
        {isEmpty && (
          <p className="text-center text-body-lg text-charcoal-400 py-12" role="status">
            {activeCategory
              ? 'No photos in this category yet. Check back soon.'
              : 'No photos published yet. Check back soon.'}
          </p>
        )}

        {/* Responsive masonry-style grid. aspect-square placeholders
            reserve the layout box BEFORE each image loads (no layout
            shift); images lazy-load below the fold. */}
        {items.length > 0 && (
          <div
            ref={gridRef}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 stagger-children"
          >
            {items.map((item) => (
              <figure
                key={item.id}
                className="group relative aspect-square overflow-hidden rounded-xl bg-charcoal-50"
              >
                <img
                  src={item.image}
                  alt={item.caption || item.title}
                  className="h-full w-full object-cover transition-transform duration-700 ease-premium group-hover:scale-[1.05]"
                  loading="lazy"
                />
                <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-charcoal-900/80 via-charcoal-900/30 to-transparent p-3 pt-8 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  <span className="block text-[13px] font-semibold text-white">
                    {item.title}
                  </span>
                  {item.caption && (
                    <span className="mt-0.5 block text-[11px] leading-snug text-white/70">
                      {item.caption}
                    </span>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </SectionWrapper>
    </>
  );
}

export default Gallery;
