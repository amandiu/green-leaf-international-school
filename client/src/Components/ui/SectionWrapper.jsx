import { useScrollReveal } from '../../hooks/useScrollReveal';

function SectionWrapper({
  children,
  id,
  className = '',
  bg = 'bg-cream-50',
  padding = 'py-section',
  // eslint-disable-next-line no-unused-vars -- accepted for API compat; no caller passes it (verified), so always-reveal is behavior-identical
  reveal = true,
}) {
  // Hook must be called unconditionally (rules-of-hooks): the hook is
  // side-effect-free until its ref attaches to a DOM element, so with
  // reveal={false} it simply never attaches and does nothing.
  const ref = useScrollReveal();

  return (
    <section id={id} className={`${bg} ${padding} ${className}`}>
      <div ref={ref} className="container-custom reveal">
        {children}
      </div>
    </section>
  );
}

function SectionHeader({
  badge,
  title,
  description,
  align = 'center',
  cta,
  className = '',
}) {
  const alignClass = align === 'center' ? 'text-center' : 'text-left';

  return (
    <div className={`mb-12 md:mb-16 ${alignClass} ${className}`}>
      {badge && <span className="eyebrow mb-4">{badge}</span>}
      <h2 className="font-heading text-h2 text-charcoal-900 mb-4 mt-3">
        {title}
      </h2>
      {description && (
        <p
          className={[
            'text-body-lg text-charcoal-500 leading-relaxed',
            'max-w-2xl',
            align === 'center' ? 'mx-auto' : '',
          ].join(' ')}
        >
          {description}
        </p>
      )}
      {cta && <div className="mt-6">{cta}</div>}
    </div>
  );
}

function Divider({ className = '' }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="w-12 h-0.5 bg-forest-300/50 rounded-full" />
    </div>
  );
}

export { SectionWrapper, SectionHeader, Divider };
