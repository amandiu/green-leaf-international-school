import { useEffect, useRef } from "react";
import { useScrollReveal } from "../../hooks/useScrollReveal";
import { SectionHeader } from "../ui/SectionWrapper";
import { leadershipMessages } from "../../data/leadershipMessages";

/* ═══════════════════════════════════════════
   LEADERSHIP MESSAGE — 2×2 Grid with Travelling Border Light
   Row 1: Principal (image | message) · Row 2: Chairman (image | message)
   One connected table-like component — shared borders, not four cards.
   Data: client/src/data/leadershipMessages.js (admin-ready; verified
   fields are null until the school provides official content).
   ═══════════════════════════════════════════ */

/* Portrait — real image when verified, dignified monogram otherwise.
   Never renders a stock/AI/placeholder person (data-safety rule). */
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
  const { roleBadge, heading, message, name, designation, placeholderMessage } =
    person;

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
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* Reduced motion: hide comets entirely, keep the border system. */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      ringPauseRef.current?.classList.add("no-light");
    }
  }, []);

  return (
    <section
      id="leadership-message"
      className="bg-cream-50 py-section relative overflow-hidden"
    >
      <div ref={containerRef} className="container-custom reveal">
        <SectionHeader
          badge="Leadership Message"
          title="Messages from Our Leadership"
          description="Words of guidance and inspiration from the leaders of Green Leaf International School & College."
        />

        {/* 2×2 premium table with travelling border light */}
        <div ref={setRingRef} className="lm-ring">
          {/* Travelling lights — decorative only */}
          <span className="lm-comet lm-comet-a" aria-hidden="true" />
          <span className="lm-comet lm-comet-b" aria-hidden="true" />

          <div className="lm-grid">
            {leadershipMessages.map((person) => (
              <div className="lm-row" key={person.id}>
                {/* IMAGE CELL — ~40% width */}
                <div className="lm-cell-image">
                  <div className="lm-portrait">
                    <LeadershipPortrait person={person} />
                  </div>
                </div>

                {/* MESSAGE CELL — ~60% width */}
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
