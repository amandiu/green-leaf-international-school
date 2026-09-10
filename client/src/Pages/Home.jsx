import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useScrollReveal } from "../hooks/useScrollReveal";
import { SectionWrapper, SectionHeader } from "../Components/ui/SectionWrapper";
import { Card, CardIcon } from "../Components/ui/Card";
import Button from "../Components/ui/Button";

/* ═══════════════════════════════════════════
   HERO — Split Layout with Ken Burns
   ═══════════════════════════════════════════ */
const heroImages = [
  {
    src: "/Hero Section/hero 1.jpg",
    alt: "Green Leaf International School & College Campus",
  },
  {
    src: "/Hero Section/hero 2.jpg",
    alt: "Green Leaf International School Students",
  },
  {
    src: "/Hero Section/hero 3.jpg",
    alt: "Green Leaf International School Activities",
  },
];

function Hero() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-[520px] md:min-h-[600px] lg:min-h-[620px] flex items-center overflow-hidden bg-charcoal-50">
      <div className="absolute inset-0">
        {heroImages.map((img, index) => (
          <img
            key={img.src}
            src={img.src}
            alt={img.alt}
            fetchPriority={index === 0 ? "high" : undefined}
            className={`absolute inset-0 w-full h-full object-cover hero-ken-burns transition-opacity duration-1000 ease-in-out ${index === currentSlide ? "opacity-100" : "opacity-0"}`}
            style={{ animationDelay: `${index * 5}s` }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-forest-950/90 via-forest-900/75 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
      </div>

      <div className="container-custom relative z-10 py-12 md:py-16 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-3 mb-5 opacity-0 animate-[fadeInUp_0.5s_ease-out_0.1s_forwards]">
              <img
                src="/logo.jpg"
                alt="Green Leaf International School & College Logo"
                className="w-12 h-12 md:w-14 md:h-14 rounded-xl object-cover shadow-md"
              />
              <div>
                <span className="block text-[11px] md:text-[12px] font-bold text-white/90 uppercase tracking-[0.1em] leading-tight">
                  Green Leaf
                </span>
                <span className="block text-[9px] md:text-[10px] text-white/60 uppercase tracking-[0.12em] font-medium">
                  International School &amp; College
                </span>
              </div>
            </div>
            <h1 className="font-heading text-[2.25rem] md:text-[2.75rem] lg:text-[3.25rem] leading-[1.1] text-white mb-4 opacity-0 animate-[fadeInUp_0.6s_ease-out_0.2s_forwards]">
              Excellence in <br className="hidden sm:block" />
              Knowledge <span className="text-leaf-300">&amp;</span> Character
            </h1>
            <p className="text-[15px] md:text-body-lg text-white/75 max-w-md mb-7 leading-relaxed opacity-0 animate-[fadeInUp_0.6s_ease-out_0.35s_forwards]">
              A place where knowledge grows, character develops, and students
              prepare for a successful future.
            </p>
            <div className="flex flex-wrap items-center gap-3 opacity-0 animate-[fadeInUp_0.6s_ease-out_0.5s_forwards]">
              <Link to="/about" className="group">
                <Button
                  variant="primary"
                  size="lg"
                  className="bg-leaf-600 hover:bg-leaf-700 hover:shadow-leaf-600/25"
                >
                  Explore Our School
                  <svg
                    className="w-4 h-4 transition-transform duration-250 ease-premium group-hover:translate-x-0.5"
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
                </Button>
              </Link>
              <Link to="/admissions">
                <Button
                  variant="secondary"
                  size="lg"
                  className="border-white/25 text-white hover:bg-white/10"
                >
                  Admissions
                </Button>
              </Link>
            </div>
          </div>
          <div className="hidden lg:block opacity-0 animate-[heroSlideIn_0.8s_ease-out_0.3s_forwards]">
            <div className="relative">
              <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-elevated">
                <img
                  src={heroImages[currentSlide].src}
                  alt={heroImages[currentSlide].alt}
                  className="w-full h-full object-cover hero-ken-burns"
                />
              </div>
              <div className="absolute -bottom-3 -right-3 w-24 h-24 bg-leaf-400/20 rounded-2xl -z-10" />
              <div className="absolute -top-2 -left-2 w-16 h-16 bg-white/10 rounded-xl -z-10" />
            </div>
          </div>
        </div>
        <div className="lg:hidden mt-6 opacity-0 animate-[fadeInUp_0.7s_ease-out_0.5s_forwards]">
          <div className="aspect-[16/10] rounded-xl overflow-hidden shadow-elevated">
            <img
              src={heroImages[currentSlide].src}
              alt={heroImages[currentSlide].alt}
              className="w-full h-full object-cover hero-ken-burns"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   RECENT NEWS & NOTICES — Ticker
   ═══════════════════════════════════════════ */
const newsItems = [
  {
    id: 1,
    category: "Notice",
    title: "Admission Information for [Year]",
    date: "[Date]",
    color: "bg-forest-600",
  },
  {
    id: 2,
    category: "News",
    title: "[News Title Placeholder]",
    date: "[Date]",
    color: "bg-charcoal-600",
  },
  {
    id: 3,
    category: "Event",
    title: "[School Event Placeholder]",
    date: "[Date]",
    color: "bg-gold-600",
  },
  {
    id: 4,
    category: "Announcement",
    title: "[Important Announcement]",
    date: "[Date]",
    color: "bg-leaf-600",
  },
  {
    id: 5,
    category: "Notice",
    title: "[Exam Schedule Placeholder]",
    date: "[Date]",
    color: "bg-forest-600",
  },
];

function NewsTicker() {
  const [isPaused, setIsPaused] = useState(false);
  const trackRef = useRef(null);
  const handleMouseEnter = useCallback(() => setIsPaused(true), []);
  const handleMouseLeave = useCallback(() => setIsPaused(false), []);
  const [prefersReduced, setPrefersReduced] = useState(false);
  useEffect(() => {
    setPrefersReduced(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  return (
    <section className="bg-white border-b border-charcoal-100/60 relative z-20">
      <div className="container-custom">
        <div className="flex items-center justify-between py-4 border-b border-charcoal-100/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-forest-100 rounded-lg flex items-center justify-center">
              <svg
                className="w-4 h-4 text-forest-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6V7.5z"
                />
              </svg>
            </div>
            <h2 className="font-heading text-[15px] md:text-h3 font-semibold text-charcoal-900">
              Recent News &amp; Notices
            </h2>
          </div>
          <Link
            to="/news"
            className="text-body-sm font-medium text-forest-600 hover:text-forest-700 transition-colors hidden sm:inline-flex items-center gap-1"
          >
            View All
            <svg
              className="w-3.5 h-3.5"
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
          </Link>
        </div>
        <div
          className="overflow-hidden py-4"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          role="marquee"
          aria-label="Recent news and notices"
        >
          <div
            ref={trackRef}
            className="flex gap-4"
            style={
              prefersReduced
                ? { overflowX: "auto", scrollSnapType: "x mandatory" }
                : {
                    animation: "newsTicker 30s linear infinite",
                    animationPlayState: isPaused ? "paused" : "running",
                    width: "max-content",
                  }
            }
          >
            {[...newsItems, ...newsItems].map((item, index) => (
              <Link
                key={`${item.id}-${index}`}
                to="/news"
                className={`flex-shrink-0 w-[280px] md:w-[320px] p-4 rounded-xl border border-charcoal-100/60 bg-cream-50/50 hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300 ease-premium group ${prefersReduced ? "scroll-snap-start" : ""}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white rounded ${item.color}`}
                  >
                    {item.category}
                  </span>
                  <span className="text-[11px] text-charcoal-400">
                    {item.date}
                  </span>
                </div>
                <h3 className="font-heading text-[14px] font-semibold text-charcoal-900 leading-snug group-hover:text-forest-700 transition-colors">
                  {item.title}
                </h3>
              </Link>
            ))}
          </div>
        </div>
        <div className="sm:hidden text-center pb-3">
          <span className="text-[10px] text-charcoal-400 uppercase tracking-wider">
            Scroll →
          </span>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   WELCOME SECTION
   ═══════════════════════════════════════════ */
function WelcomeSection() {
  const ref = useScrollReveal();
  return (
    <SectionWrapper bg="bg-white" padding="py-section">
      <div ref={ref} className="reveal">
        <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="relative">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden">
              <img
                src="/Activity/791934034_1520000023475841_6916330100427667640_n.jpg"
                alt="Students at Green Leaf International School"
                className="w-full h-full object-cover transition-transform duration-700 ease-premium hover:scale-[1.03]"
                loading="lazy"
              />
            </div>
            <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-leaf-100/60 rounded-2xl -z-10" />
            <div className="absolute -top-3 -left-3 w-20 h-20 bg-gold-100/40 rounded-xl -z-10" />
          </div>
          <div>
            <span className="eyebrow mb-4">Welcome</span>
            <h2 className="font-heading text-h2 text-charcoal-900 mb-5 mt-3">
              Welcome to Green Leaf
            </h2>
            <p className="text-charcoal-500 leading-relaxed mb-4">
              A place where knowledge grows, character develops, and students
              prepare for the future. Green Leaf International School &amp;
              College is committed to providing quality education with an
              international perspective.
            </p>
            <p className="text-charcoal-500 leading-relaxed mb-8">
              We believe every child deserves the opportunity to discover their
              potential in an environment that values both tradition and
              innovation.
            </p>
            <Link to="/about" className="group">
              <Button variant="secondary" size="md" showArrow>
                Discover Our School
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}

/* ═══════════════════════════════════════════
   WHY GREEN LEAF — Premium Pillars
   ═══════════════════════════════════════════ */
const pillars = [
  {
    title: "Academic Excellence",
    description:
      "Rigorous curriculum designed to build strong foundations and inspire a love for learning.",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342"
        />
      </svg>
    ),
  },
  {
    title: "Character & Values",
    description:
      "Building integrity, respect, and responsibility in every student through holistic education.",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
        />
      </svg>
    ),
  },
  {
    title: "Student Activities",
    description:
      "Diverse extracurricular programs that develop creativity, leadership, and teamwork.",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
        />
      </svg>
    ),
  },
  {
    title: "Supportive Environment",
    description:
      "A caring community where every student is known, valued, and supported to thrive.",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75a2.25 2.25 0 110-4.5 2.25 2.25 0 010 4.5z"
        />
      </svg>
    ),
  },
];

function PillarCard({ pillar, index, featured }) {
  const number = String(index + 1).padStart(2, "0");

  return (
    <div
      className={`
        group relative flex flex-col
        bg-white rounded-2xl overflow-hidden
        border border-charcoal-100
        shadow-card
        transition-all duration-400 ease-premium
        ${
          featured
            ? "shadow-card-hover border-forest-200/60 bg-gradient-to-b from-white to-leaf-50/40"
            : "hover:shadow-card-hover"
        }
        hover:-translate-y-1.5
      `}
    >
      {/* Number */}
      <div className="px-7 pt-6 pb-0">
        <span className="text-[11px] font-semibold tracking-[0.2em] text-charcoal-300 uppercase select-none transition-all duration-300 ease-premium group-hover:text-charcoal-400 group-hover:translate-x-0.5">
          {number}
        </span>
      </div>

      {/* Icon */}
      <div className="px-7 pt-4 pb-0">
        <div
          className={`
            w-14 h-14 rounded-xl flex items-center justify-center
            border transition-all duration-300 ease-premium
            ${
              featured
                ? "bg-forest-50 border-forest-100 text-forest-700"
                : "bg-cream-100/60 border-cream-200/60 text-forest-600"
            }
            group-hover:bg-forest-50 group-hover:border-forest-100 group-hover:text-forest-700 group-hover:scale-110
          `}
        >
          {pillar.icon}
        </div>
      </div>

      {/* Title */}
      <h3 className="font-heading text-h3 text-charcoal-900 px-7 pt-5 pb-2">
        {pillar.title}
      </h3>

      {/* Description */}
      <p className="text-body-sm text-charcoal-500 leading-relaxed px-7 pb-6 flex-1">
        {pillar.description}
      </p>

      {/* Accent line */}
      <div className="px-7 pb-6">
        <div className="pillar-accent-line" />
      </div>
    </div>
  );
}

function WhyGreenLeaf() {
  const ref = useScrollReveal();
  return (
    <section className="relative bg-cream-50 py-4 md:py-6 lg:py-8 overflow-hidden">
      {/* Subtle decorative background */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        {/* Large low-opacity circle */}
        <div className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full bg-forest-100/30" />
        <div className="absolute -bottom-48 -left-48 w-[600px] h-[600px] rounded-full bg-leaf-100/20" />
        {/* Subtle radial glow at center */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <img
            src="/logo.jpg"
            alt=""
            className="w-[420px] h-[420px] object-contain opacity-[0.20] mix-blend-multiply select-none"
          />
        </div>
      </div>

      <div className="container-custom relative z-10">
        {/* Section Header */}
        <div className="text-center mb-12 md:mb-16">
          <span className="eyebrow mb-4">Our Pillars</span>
          <h2 className="font-heading text-h2 text-charcoal-900 mb-4 mt-3">
            Why Green Leaf?
          </h2>
          <p className="text-body-lg text-charcoal-500 leading-relaxed max-w-2xl mx-auto">
            Four pillars that define the Green Leaf experience and shape our
            students' futures.
          </p>
        </div>

        {/* Pillar Grid */}
        <div
          ref={ref}
          className="grid mt-[-40px] sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 stagger-children"
        >
          {pillars.map((pillar, index) => (
            <PillarCard
              key={pillar.title}
              pillar={pillar}
              index={index}
              featured={index === 0}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   STUDENT LIFE
   ═══════════════════════════════════════════ */
const lifeImages = [
  {
    src: "/Activity/791074857_1519300476879129_5256173980750495448_n.jpg",
    alt: "Students participating in school activities",
  },
  {
    src: "/Activity/733146204_1461550822654095_1531413830165513343_n.jpg",
    alt: "School event at Green Leaf",
  },
  {
    src: "/Activity/745503622_1472778644864646_857229043481260756_n.jpg",
    alt: "Students in classroom",
  },
  {
    src: "/Activity/798261940_1522758883199955_4596081823843794397_n.jpg",
    alt: "Student life at Green Leaf",
  },
  {
    src: "/Activity/799202494_1523030196506157_181619563109164848_n.jpg",
    alt: "School activities and celebrations",
  },
];

function StudentLife() {
  const ref = useScrollReveal();
  return (
    <SectionWrapper bg="bg-white" padding="py-section">
      <SectionHeader
        badge="School Life"
        title="Life at Green Leaf"
        description="A vibrant community where students learn, grow, and create lasting memories."
      />
      <div
        ref={ref}
        className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 stagger-children"
      >
        <div className="col-span-2 row-span-2 rounded-xl overflow-hidden group">
          <img
            src={lifeImages[0].src}
            alt={lifeImages[0].alt}
            className="w-full h-full object-cover min-h-[280px] md:min-h-[400px] transition-transform duration-700 ease-premium group-hover:scale-[1.03]"
            loading="lazy"
          />
        </div>
        {lifeImages.slice(1).map((img, i) => (
          <div key={i} className="rounded-xl overflow-hidden group">
            <img
              src={img.src}
              alt={img.alt}
              className="w-full aspect-square object-cover transition-transform duration-700 ease-premium group-hover:scale-[1.03]"
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </SectionWrapper>
  );
}

/* ═══════════════════════════════════════════
   ACADEMICS PREVIEW
   ═══════════════════════════════════════════ */
function AcademicsPreview() {
  const ref = useScrollReveal();
  return (
    <SectionWrapper bg="bg-cream-50" padding="py-4 md:py-6 lg:py-[1rem]">
      <div ref={ref} className="reveal">
        <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="order-2 md:order-1">
            <span className="eyebrow mb-4">Academics</span>
            <h2 className="font-heading text-h2 text-charcoal-900 mb-5 mt-3">
              Learning Designed to Build Knowledge, Confidence &amp; Character
            </h2>
            <p className="text-charcoal-500 leading-relaxed mb-6">
              Our academic programs are structured to develop well-rounded
              individuals who are prepared for the challenges of tomorrow.
            </p>
            <Link to="/academics" className="group">
              <Button variant="secondary" size="md" showArrow>
                View Academic Programs
              </Button>
            </Link>
          </div>
          <div className="order-1 md:order-2 relative">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden">
              <img
                src="/Activity/724138882_1448846993924478_5789741995812830014_n.jpg"
                alt="Students in academic setting at Green Leaf"
                className="w-full h-full object-cover transition-transform duration-700 ease-premium hover:scale-[1.03]"
                loading="lazy"
              />
            </div>
            <div className="absolute -bottom-4 -right-4 w-28 h-28 bg-forest-100/60 rounded-2xl -z-10" />
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}

/* ═══════════════════════════════════════════
   VIDEO SECTION — Multi-Video Carousel
   ═══════════════════════════════════════════ */

const CAROUSEL_INTERVAL = 6000;
const SLIDE_CHANNEL_URL =
  "https://www.youtube.com/@greenleafinternationalscho29/videos";

const videoShowcaseData = [
  {
    id: 1,
    eyebrow: "Campus Life",
    title: "Life at Green Leaf",
    description:
      "Experience the vibrant campus life and activities at Green Leaf International School & College.",
    videoUrl: SLIDE_CHANNEL_URL,
    thumbnail: "/Activity/796941384_1521802823295561_1039006011241713451_n.jpg",
    buttonText: "Watch Video",
    metadata: ["Campus", "Student Life"],
  },
  {
    id: 2,
    eyebrow: "Student Activities",
    title: "Learning Beyond the Classroom",
    description:
      "Discover learning experiences, activities, and memorable moments from Green Leaf International School & College.",
    videoUrl: SLIDE_CHANNEL_URL,
    thumbnail: "/Activity/791074857_1519300476879129_5256173980750495448_n.jpg",
    buttonText: "Watch Video",
    metadata: ["Activities", "Learning"],
  },
  {
    id: 3,
    eyebrow: "School Events",
    title: "Moments That Matter",
    description:
      "Explore events and special moments from our school community at Green Leaf International School & College.",
    videoUrl: SLIDE_CHANNEL_URL,
    thumbnail: "/Activity/733146204_1461550822654095_1531413830165513343_n.jpg",
    buttonText: "Watch Video",
    metadata: ["Events", "Community"],
  },
  {
    id: 4,
    eyebrow: "Student Life",
    title: "Growing Together",
    description:
      "See how our students grow, learn, and thrive in a nurturing educational environment at Green Leaf.",
    videoUrl: SLIDE_CHANNEL_URL,
    thumbnail: "/Activity/745503622_1472778644864646_857229043481260756_n.jpg",
    buttonText: "Watch Video",
    metadata: ["Growth", "Education"],
  },
  {
    id: 5,
    eyebrow: "Our Community",
    title: "School Spirit in Action",
    description:
      "Witness the spirit, dedication, and joy that define the Green Leaf International School & College experience.",
    videoUrl: SLIDE_CHANNEL_URL,
    thumbnail: "/Activity/798261940_1522758883199955_4596081823843794397_n.jpg",
    buttonText: "Watch Video",
    metadata: ["Spirit", "Dedication"],
  },
];

function VideoSection() {
  const sectionRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState("next");
  const [isPaused, setIsPaused] = useState(false);
  const [textState, setTextState] = useState("visible"); // 'visible' | 'exiting' | 'entering'
  const [prefersReduced, setPrefersReduced] = useState(false);

  const intervalRef = useRef(null);
  const textTimeoutRef = useRef(null);
  const enterTimeoutRef = useRef(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const total = videoShowcaseData.length;
  const activeVideo = videoShowcaseData[activeIndex];

  // Detect reduced motion
  useEffect(() => {
    setPrefersReduced(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  // Intersection observer for initial reveal
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    if (prefersReduced) {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [prefersReduced]);

  // Navigate to a specific slide with direction
  const goToSlide = useCallback(
    (nextIndex, dir) => {
      if (nextIndex === activeIndex) return;

      // Clear any pending transition timeouts
      clearTimeout(textTimeoutRef.current);
      clearTimeout(enterTimeoutRef.current);

      // Restart auto-rotation timer
      clearInterval(intervalRef.current);

      const computedDir =
        dir ||
        (nextIndex > activeIndex ||
        (activeIndex === total - 1 && nextIndex === 0)
          ? "next"
          : "prev");

      setDirection(computedDir);
      setTextState("exiting");

      const exitDelay = prefersReduced ? 0 : 280;
      textTimeoutRef.current = setTimeout(() => {
        setActiveIndex(nextIndex);
        setTextState("entering");
        enterTimeoutRef.current = setTimeout(
          () => setTextState("visible"),
          450,
        );
      }, exitDelay);
    },
    [activeIndex, total, prefersReduced],
  );

  // Auto-rotation
  useEffect(() => {
    if (isPaused || prefersReduced) return;
    intervalRef.current = setInterval(() => {
      clearTimeout(textTimeoutRef.current);
      clearTimeout(enterTimeoutRef.current);
      setDirection("next");
      setTextState("exiting");
      textTimeoutRef.current = setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % total);
        setTextState("entering");
        enterTimeoutRef.current = setTimeout(
          () => setTextState("visible"),
          450,
        );
      }, 280);
    }, CAROUSEL_INTERVAL);
    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(textTimeoutRef.current);
      clearTimeout(enterTimeoutRef.current);
    };
  }, [isPaused, total, prefersReduced]);

  const goToNext = useCallback(() => {
    goToSlide((activeIndex + 1) % total, "next");
  }, [activeIndex, total, goToSlide]);

  const goToPrev = useCallback(() => {
    goToSlide((activeIndex - 1 + total) % total, "prev");
  }, [activeIndex, total, goToSlide]);

  // Touch swipe
  const handleTouchStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goToNext();
      else goToPrev();
    }
  }, [goToNext, goToPrev]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      }
    },
    [goToNext, goToPrev],
  );

  // Progress key reset when slide changes
  const [progressKey, setProgressKey] = useState(0);
  useEffect(() => {
    setProgressKey((k) => k + 1);
  }, [activeIndex]);

  const slideAnimClass =
    direction === "next" ? "carousel-slide-in-right" : "carousel-slide-in-left";

  return (
    <section
      ref={sectionRef}
      className="relative bg-charcoal-900 py-12 md:py-16 lg:py-[4.5rem] overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setIsPaused(false);
        }
      }}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      role="region"
      aria-label="Video showcase carousel"
      aria-roledescription="carousel"
    >
      {/* Background ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-[600px] h-[600px] bg-forest-600/[0.06] rounded-full blur-[140px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-leaf-500/[0.04] rounded-full blur-[120px]" />
      </div>

      <div className="container-custom relative z-10">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          {/* ── LEFT: Text content ── */}
          <div
            className={`min-h-[280px] md:min-h-[320px] flex flex-col justify-center ${
              isVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            <div
              key={`text-${activeIndex}`}
              className={`
                ${isVisible && textState !== "exiting" ? "carousel-text-in" : ""}
                ${textState === "exiting" ? "carousel-text-out" : ""}
                ${!isVisible ? "opacity-0" : ""}
              `}
            >
              <span className="eyebrow !bg-white/10 !text-leaf-300 mb-5 inline-block">
                {activeVideo.eyebrow}
              </span>

              <h2 className="font-heading text-h2 text-white mb-4 mt-3 leading-[1.15]">
                {activeVideo.title}
              </h2>

              <p className="text-body-lg text-charcoal-400 max-w-md leading-relaxed mb-5">
                {activeVideo.description}
              </p>

              {activeVideo.metadata && activeVideo.metadata.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-6">
                  {activeVideo.metadata.map((item, i) => (
                    <span
                      key={`${activeIndex}-meta-${i}`}
                      className="flex items-center gap-2"
                    >
                      {i > 0 && (
                        <span className="w-1 h-1 rounded-full bg-leaf-400/40" />
                      )}
                      <span className="text-caption text-charcoal-500 font-medium tracking-wide uppercase">
                        {item}
                      </span>
                    </span>
                  ))}
                </div>
              )}

              <a
                href={activeVideo.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group/btn inline-flex items-center gap-2.5 bg-leaf-600 hover:bg-leaf-700 text-white font-semibold text-body-sm px-6 py-3 rounded-xl transition-all duration-300 ease-premium hover:shadow-lg hover:shadow-leaf-600/20 focus:outline-none focus:ring-2 focus:ring-leaf-400 focus:ring-offset-2 focus:ring-offset-charcoal-900"
                aria-label={`${activeVideo.buttonText} — opens in a new tab`}
              >
                <svg
                  className="w-4 h-4 transition-transform duration-300 ease-premium group-hover/btn:scale-110"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
                {activeVideo.buttonText}
                <svg
                  className="w-4 h-4 transition-transform duration-300 ease-premium group-hover/btn:translate-x-0.5"
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
              </a>
            </div>
          </div>

          {/* ── RIGHT: Cinematic video card carousel ── */}
          <div
            className={`${isVisible ? "" : "opacity-0"} relative`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${activeIndex + 1} of ${total}: ${activeVideo.title}`}
          >
            <div
              key={`card-${activeIndex}`}
              className={`${
                isVisible && textState !== "exiting" ? slideAnimClass : ""
              } ${
                textState === "exiting"
                  ? direction === "next"
                    ? "carousel-slide-out-left"
                    : "carousel-slide-out-right"
                  : ""
              } ${!isVisible ? "opacity-0" : ""}`}
            >
              <a
                href={activeVideo.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group block relative rounded-2xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-leaf-400 focus:ring-offset-2 focus:ring-offset-charcoal-900"
                aria-label={`Watch ${activeVideo.title} on YouTube`}
              >
                {/* Thumbnail image */}
                <div className="aspect-video relative bg-charcoal-800">
                  <img
                    src={activeVideo.thumbnail}
                    alt={`${activeVideo.title} — Green Leaf International School`}
                    className="w-full h-full object-cover transition-transform duration-700 ease-premium group-hover:scale-[1.03]"
                  />

                  {/* Cinematic dark gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/70 via-charcoal-900/25 to-transparent" />

                  {/* Subtle forest-green glow overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-forest-900/[0.15] via-transparent to-transparent" />

                  {/* Play button */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative">
                      <div className="absolute inset-0 w-16 h-16 md:w-[4.5rem] md:h-[4.5rem] bg-leaf-400/20 rounded-full blur-xl scale-150 transition-all duration-500 ease-premium group-hover:bg-leaf-400/30 group-hover:scale-[1.8]" />
                      <div className="relative w-14 h-14 md:w-16 md:h-16 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 ease-premium group-hover:scale-110 group-hover:bg-white group-hover:shadow-leaf-500/20">
                        <svg
                          className="w-5 h-5 md:w-6 md:h-6 text-forest-700 ml-0.5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Bottom-left YouTube indicator */}
                  <div className="absolute bottom-3 left-3 md:bottom-4 md:left-4 flex items-center gap-2 px-3 py-1.5 bg-charcoal-900/75 backdrop-blur-sm rounded-lg border border-white/5">
                    <svg
                      className="w-3.5 h-3.5 text-red-500"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                    <span className="text-white/90 text-[11px] font-medium tracking-wide">
                      YouTube
                    </span>
                  </div>
                </div>

                {/* Subtle border and hover shadow overlay */}
                <div className="absolute inset-0 rounded-2xl border border-white/5 group-hover:border-white/10 transition-colors duration-500 pointer-events-none" />
              </a>
            </div>

            {/* ── Controls row ── */}
            <div className="flex items-center justify-between mt-5">
              {/* Prev button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToPrev();
                }}
                className="w-9 h-9 md:w-10 md:h-10 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 flex items-center justify-center transition-all duration-300 ease-premium focus:outline-none focus:ring-2 focus:ring-leaf-400 focus:ring-offset-2 focus:ring-offset-charcoal-900"
                aria-label="Previous video"
              >
                <svg
                  className="w-4 h-4 text-white/70"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>

              {/* Indicators + counter */}
              <div className="flex items-center gap-3">
                <span className="text-charcoal-500 text-caption font-medium tabular-nums">
                  {String(activeIndex + 1).padStart(2, "0")} /{" "}
                  {String(total).padStart(2, "0")}
                </span>
                <div
                  className="flex items-center gap-2"
                  role="tablist"
                  aria-label="Video slides"
                >
                  {videoShowcaseData.map((v, i) => (
                    <button
                      key={v.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        goToSlide(i);
                      }}
                      className={`rounded-full transition-all duration-300 ease-premium focus:outline-none focus:ring-2 focus:ring-leaf-400 focus:ring-offset-1 focus:ring-offset-charcoal-900 ${
                        i === activeIndex
                          ? "w-6 h-2 bg-leaf-400"
                          : "w-2 h-2 bg-white/20 hover:bg-white/40"
                      }`}
                      role="tab"
                      aria-selected={i === activeIndex}
                      aria-label={`Go to slide ${i + 1}: ${v.title}`}
                    />
                  ))}
                </div>
              </div>

              {/* Next button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  goToNext();
                }}
                className="w-9 h-9 md:w-10 md:h-10 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 flex items-center justify-center transition-all duration-300 ease-premium focus:outline-none focus:ring-2 focus:ring-leaf-400 focus:ring-offset-2 focus:ring-offset-charcoal-900"
                aria-label="Next video"
              >
                <svg
                  className="w-4 h-4 text-white/70"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>

            {/* ── Progress bar ── */}
            <div className="mt-3 h-[2px] w-full bg-white/5 rounded-full overflow-hidden">
              {!isPaused && !prefersReduced && (
                <div
                  key={progressKey}
                  className="h-full bg-leaf-400/60 rounded-full carousel-progress-fill"
                  style={{ "--carousel-duration": `${CAROUSEL_INTERVAL}ms` }}
                />
              )}
              {isPaused && !prefersReduced && (
                <div
                  className="h-full bg-leaf-400/30 rounded-full"
                  style={{ width: "100%" }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   ADMISSIONS CTA — School-style
   ═══════════════════════════════════════════ */
function AdmissionsCTA() {
  const ref = useScrollReveal();

  return (
    <section
      className="relative py-16 md:py-20 overflow-hidden"
      style={{ backgroundColor: "#0a2010" }}
    >
      <div className="absolute inset-0">
        <img
          src="/Activity/798038998_1521802776628899_2711813091562440061_n.jpg"
          alt=""
          className="w-full h-full object-cover opacity-10"
          aria-hidden="true"
          loading="lazy"
        />
      </div>

      <div
        ref={ref}
        className="container-custom relative z-10 text-center reveal"
      >
        <h2 className="font-heading text-h2 text-white mb-4">
          Give Your Child a Place to Grow
        </h2>
        <p className="text-body-lg text-white/60 mb-8 max-w-xl mx-auto">
          Join the Green Leaf community. Admissions are open for the upcoming
          academic year.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/admissions" className="group">
            <Button variant="gold" size="lg">
              Admission Information
              <svg
                className="w-4 h-4 transition-transform duration-250 ease-premium group-hover:translate-x-0.5"
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
            </Button>
          </Link>
          <Link to="/contact">
            <Button
              variant="secondary"
              size="lg"
              className="border-white/25 text-white hover:bg-white/10"
            >
              Contact School
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   HOME PAGE
   ═══════════════════════════════════════════ */
function Home() {
  return (
    <>
      <Hero />
      <NewsTicker />
      <WelcomeSection />
      <WhyGreenLeaf />
      <StudentLife />
      <AcademicsPreview />
      <VideoSection />
      <AdmissionsCTA />
    </>
  );
}

export default Home;
