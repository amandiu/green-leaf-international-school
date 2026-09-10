function Card({
  children,
  className = '',
  hover = true,
  padding = true,
  as: Tag = 'div',
}) {
  return (
    <Tag
      className={[
        'bg-white rounded-xl overflow-hidden',
        'border border-charcoal-100/80',
        'shadow-card',
        hover && [
          'transition-all duration-350 ease-premium',
          'hover:shadow-card-hover',
          'hover:-translate-y-1',
        ].join(' '),
        padding && 'p-6',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </Tag>
  );
}

function CardImage({ src, alt, className = '', aspect = 'aspect-[16/10]' }) {
  return (
    <div className={`relative overflow-hidden ${aspect} ${className}`}>
      {src ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover transition-transform duration-500 ease-premium hover:scale-[1.03]"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-charcoal-50 to-charcoal-100 flex items-center justify-center">
          <svg className="w-10 h-10 text-charcoal-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91M3.75 21h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v13.5A1.5 1.5 0 003.75 21z" />
          </svg>
        </div>
      )}
    </div>
  );
}

function CardImageOverlay({ src, alt, className = '' }) {
  return (
    <div className={`relative overflow-hidden aspect-[16/10] ${className}`}>
      {src ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover transition-transform duration-500 ease-premium group-hover:scale-[1.03]"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-charcoal-50 to-charcoal-100 flex items-center justify-center">
          <svg className="w-10 h-10 text-charcoal-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91M3.75 21h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v13.5A1.5 1.5 0 003.75 21z" />
          </svg>
        </div>
      )}
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/60 via-transparent to-transparent" />
    </div>
  );
}

function CardIcon({ children, className = '' }) {
  return (
    <div
      className={[
        'w-12 h-12 rounded-xl flex items-center justify-center',
        'bg-forest-50 text-forest-600',
        'transition-all duration-300 ease-premium',
        'group-hover:bg-forest-700 group-hover:text-white group-hover:scale-110',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}

function CardTitle({ children, className = '', as: Tag = 'h3' }) {
  return (
    <Tag
      className={[
        'font-heading font-semibold text-charcoal-900',
        'leading-snug tracking-tight',
        className || 'text-lg',
      ].join(' ')}
    >
      {children}
    </Tag>
  );
}

function CardText({ children, className = '' }) {
  return (
    <p className={`text-charcoal-500 leading-relaxed text-body-sm ${className}`}>
      {children}
    </p>
  );
}

function CardBadge({ children, className = '' }) {
  return (
    <span
      className={[
        'inline-block px-2.5 py-0.5 text-eyebrow font-semibold',
        'bg-forest-50 text-forest-700 rounded-full',
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}

export { Card, CardImage, CardImageOverlay, CardIcon, CardTitle, CardText, CardBadge };
