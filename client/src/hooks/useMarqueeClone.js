import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Marquee/loop guard for the `[...list, ...list]` ticker pattern.
 *
 * The CSS `newsTicker` animation (index.css) slides the track by
 * -50%, which is seamless ONLY when ONE copy of the content is at
 * least as wide as the visible track — the clone then supplies the
 * off-screen continuation. When the content is NARROWER than the
 * viewport (e.g. 2 short news items in the Navbar ticker), both
 * copies fit on screen at once and every item appears TWICE — a
 * real duplicate, not a looping effect.
 *
 * This hook measures the single-copy content extent against its
 * scrolling viewport (a `position:relative` container with
 * `overflow:hidden`) and enables the clone + animation only when
 * one copy FILLS the viewport (trackWidth >= viewportWidth):
 *
 *   <div ref={viewportRef} style={{ position: 'relative' }}>
 *     <div ref={contentRef} style={{ width: 'max-content', ...trackStyle }}>
 *       {(clone ? [...items, ...items] : items).map(…)}
 *     </div>
 *   </div>
 *
 * Measurement needs the CONTENT extent, so the track must always be
 * sized to its content (`width: max-content` / the `w-max` class) —
 * otherwise an unfilled flex track reports the container width via
 * scrollWidth and the decision inverts.
 *
 * The refs are callback refs: the ticker markup often mounts only
 * after the news data arrives, so measurement is (re)run whenever a
 * node attaches — not just on hook mount. A ResizeObserver keeps the
 * decision live as items are added/removed and the viewport resizes.
 *
 * `prefers-reduced-motion` never clones (the animation is disabled
 * globally and the track is a plain scrollable row in that mode).
 */
export function useMarqueeClone({ enabled = true, animation = null } = {}) {
  const [clone, setClone] = useState(false);

  const viewportNode = useRef(null);
  const contentNode = useRef(null);
  const observerRef = useRef(null);
  const rafRef = useRef(0);
  // Mirror of `clone` for stable callbacks (no stale closure).
  const cloneRef = useRef(false);

  const measure = useCallback(() => {
    const viewport = viewportNode.current;
    const content = contentNode.current;
    if (!viewport || !content) return;
    const viewportWidth = viewport.clientWidth;
    const trackWidth = content.scrollWidth;
    if (!viewportWidth || !trackWidth) return;
    // Single-copy width depends on the CURRENT state: when cloned
    // the track holds two copies (halve it); otherwise it holds one.
    // Clone + animate only when one copy FILLS the viewport — the
    // -50% slide is seamless exactly in that case. A narrower track
    // would put both copies on screen and duplicate every item.
    const next = cloneRef.current
      ? trackWidth / 2 >= viewportWidth
      : trackWidth >= viewportWidth;
    if (next !== cloneRef.current) {
      cloneRef.current = next;
      setClone(next);
    }
  }, []);

  /* Coalesce bursts of resize/attach events into one measurement. */
  const schedule = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(measure);
  }, [measure]);

  /* Observe whatever nodes are currently attached (refs may attach
     after this observer exists — data often arrives post-mount). */
  const observeAttached = useCallback(() => {
    const observer = observerRef.current;
    if (!observer) return;
    observer.disconnect();
    if (viewportNode.current) observer.observe(viewportNode.current);
    if (contentNode.current) observer.observe(contentNode.current);
  }, []);

  const setViewportRef = useCallback((node) => {
    viewportNode.current = node;
    observeAttached();
    schedule();
  }, [observeAttached, schedule]);

  const setContentRef = useCallback((node) => {
    contentNode.current = node;
    observeAttached();
    schedule();
  }, [observeAttached, schedule]);

  useEffect(() => {
    if (!enabled) {
      cloneRef.current = false;
      setClone(false);
      return undefined;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cloneRef.current = false;
      setClone(false);
      return undefined;
    }

    const observer = new ResizeObserver(schedule);
    observerRef.current = observer;
    observeAttached();
    schedule();

    return () => {
      observer.disconnect();
      observerRef.current = null;
      cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, observeAttached, schedule]);

  const trackStyle = clone && animation ? animation : undefined;

  return { viewportRef: setViewportRef, contentRef: setContentRef, clone, trackStyle };
}

export default useMarqueeClone;
