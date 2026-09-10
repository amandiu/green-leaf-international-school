import { useEffect, useRef } from 'react';

/**
 * Attaches scroll-reveal behavior to a DOM element via IntersectionObserver.
 * Applies CSS classes: reveal, reveal-left, reveal-right, reveal-scale, stagger-children.
 * Respects prefers-reduced-motion.
 *
 * @param {Object} options
 * @param {number} options.threshold - Visibility threshold (0–1). Default 0.15
 * @param {string} options.rootMargin - Observer root margin. Default '0px 0px -60px 0px'
 * @param {boolean} options.once - Trigger only once. Default true
 */
export function useScrollReveal({
  threshold = 0.15,
  rootMargin = '0px 0px -60px 0px',
  once = true,
} = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced motion
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      el.classList.add('revealed');
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('revealed');
          if (once) observer.unobserve(el);
        } else if (!once) {
          el.classList.remove('revealed');
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return ref;
}

/**
 * Applies scroll reveal to all children with stagger delay.
 * Each child should have a reveal* CSS class.
 */
export function useStaggerReveal({
  threshold = 0.1,
  rootMargin = '0px 0px -40px 0px',
} = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      el.classList.add('revealed');
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('revealed');
          observer.unobserve(el);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return ref;
}
