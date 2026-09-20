import { useEffect, useRef } from "react";
import { useScrollReveal } from "../../hooks/useScrollReveal";
import { SectionHeader } from "../ui/SectionWrapper";
import useLeadership from "../../hooks/useLeadershipMessages";
import "./LeadershipMessage.css"; // Imported the style engine managing width & height variables

/* ═══════════════════════════════════════════
   LEADERSHIP MESSAGE — 2×2 Grid with Travelling Border Light
   ═══════════════════════════════════════════ */

/* Portrait — real image when verified, dignified monogram otherwise. */
function LeadershipPortrait({ person }) {
  if (person.image) {
    return (
      <img
        src={person.image}
        alt={person.imageAlt || `Portrait of the ${person.role} of Green Leaf International School & College`}
        className="lm-portrait-img"
        loading="lazy"
      />
    );
  }
  return (
    <div className="lm-portrait-fallback">
      <span className="lm-portrait-initial" aria-hidden="true">
        G
      </span>
      <span className="lm-portrait-note">Official portrait pending</span>
    </div>
  );
}

/* Message cell — role badge, heading, message, signature. */
function LeadershipMessageCell({ person }) {
  const { roleBadge, heading, message, name, designation, placeholderMessage } = person;
  return (
    <div className="lm-cell-message">
      {/* Decorative quotation mark (behind content, low opacity) */}
      <span className="lm-quote-mark" aria-hidden="true">
        &ldquo;
      </span>
      <div className="lm-message-content">
        <span className="eyebrow">{roleBadge}</span>
        <h3 className="lm-message-heading">{heading}</h3>
        {message ? (
          <blockquote className="lm-message-text">
            <p>{message}</p>
          </blockquote>
        ) : (
          <p className="lm-message-text lm-message-pending">
            {placeholderMessage}
          </p>
        )}
        <div className="lm-signature">
          <p className="lm-name">
            {name || <span className="lm-name-pending">[Name to be confirmed]</span>}
          </p>
          <p className="lm-designation">{designation}</p>
        </div>
      </div>
    </div>
  );
}

function LeadershipMessage() {
  /* Header + grid entrance (existing reveal + stagger utilities). */
  const containerRef = useScrollReveal();

  /* Ring entrance: drives per-row reveal CSS via `.revealed`. */
  const ringRevealRef = useScrollReveal();

  /* Local ref for the same node — pause lights when off-screen. */
  const ringPauseRef = useRef(null);

  const setRingRef = (node) => {
    ringRevealRef.current = node;
    ringPauseRef.current = node;
  };

  /* Pause travelling lights while the section is off-screen (perf). */
  useEffect(() => {
    const el = ringPauseRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => el.classList.toggle("is-paused", !entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  /* Reduced motion: hide lights entirely, keep the border system. */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ringPauseRef.current?.classList.add("no-light");
    }
  }, []);

  /* DATA SOURCE (Leadership database phase): GET /api/leadership
     (section copy + active messages). Rendering structure, classes,
     and the travelling-light CSS are untouched — only the data
     source changed. While loading / on error / when empty, the
     verified local placeholders render. When the admin deactivates
     the section, the whole block is hidden (no broken layout). */
  const { section, records: leadershipMessages, status } = useLeadership();

  /* Feed the exact border geometry to the CSS keyframes via custom
     properties. Measured once + on resize (ResizeObserver) — pure DOM
     writes, no React state, no rAF loop, no per-frame updates. */
  useEffect(() => {
    const el = ringPauseRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const applySize = () => {
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--lm-w", `${Math.round(rect.width)}px`);
      el.style.setProperty("--lm-h", `${Math.round(rect.height)}px`);
    };

    applySize();
    const observer = new ResizeObserver(applySize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* Admin deactivated the section → render nothing (no broken
     empty layout; the rest of the homepage is unaffected). */
  if (status === "inactive") return null;

  return (
    <section
      id="leadership-message"
      className="bg-cream-50 py-[20px] relative overflow-hidden"
    >
      <div ref={containerRef} className="container-custom reveal">
        <SectionHeader
          badge={section.eyebrow}
          title={section.title}
          description={section.description}
        />

        {/* 2×2 premium table with travelling border light */}
        <div ref={setRingRef} className="lm-ring">
          {/* Travelling lights — decorative only (pointer-events: none in CSS) */}
          {/* Outer perimeter: 2 lights orbiting opposite directions */}
          <div className="lm-light lm-light-outer-a" aria-hidden="true">
            <span className="lm-light-tail" />
            <span className="lm-light-head" />
          </div>
          <div className="lm-light lm-light-outer-b" aria-hidden="true">
            <span className="lm-light-tail" />
            <span className="lm-light-head" />
          </div>
          {/* Center dividers: 1 vertical + 1 horizontal (desktop 2×2 only) */}
          <div className="lm-light lm-light-divider-v" aria-hidden="true">
            <span className="lm-light-tail" />
            <span className="lm-light-head" />
          </div>
          <div className="lm-light lm-light-divider-h" aria-hidden="true">
            <span className="lm-light-tail" />
            <span className="lm-light-head" />
          </div>

          <div className="lm-grid">
            {leadershipMessages.map((person) => (
              <div className="lm-row" key={person.id}>

                {/* IMAGE CELL — 30% width, image fills cell (5px inset) */}
                <div className="lm-cell-image">
                  <div className="lm-portrait">
                    <LeadershipPortrait person={person} />
                  </div>
                </div>

                {/* MESSAGE CELL — 70% width, 10px padding, no inner card */}
                <LeadershipMessageCell person={person} />

              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default LeadershipMessage;
