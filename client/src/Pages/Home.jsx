import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useScrollReveal } from "../hooks/useScrollReveal";
import { SectionWrapper, SectionHeader } from "../Components/ui/SectionWrapper";
import { Card, CardBadge } from "../Components/ui/Card";
import Button from "../Components/ui/Button";
import LeadershipMessage from "../Components/home/LeadershipMessage";

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
    image: "/Activity/733146204_1461550822654095_1531413830165513343_n.jpg",
    excerpt:
      "[News excerpt placeholder — real news content will replace this via the admin panel.]",
    color: "bg-charcoal-600",
  },
  {
    id: 3,
    category: "Event",
    title: "[School Event Placeholder]",
    date: "[Date]",
    image: "/Activity/745503622_1472778644864646_857229043481260756_n.jpg",
    excerpt:
      "[News excerpt placeholder — real news content will replace this via the admin panel.]",
    color: "bg-gold-600",
  },
  {
    id: 4,
    category: "Announcement",
    title: "[Important Announcement]",
    date: "[Date]",
    image: "/Activity/799202494_1523030196506157_181619563109164848_n.jpg",
    excerpt:
      "[News excerpt placeholder — real news content will replace this via the admin panel.]",
    color: "bg-leaf-600",
  },
  {
    id: 5,
    category: "Notice",
    title: "[Exam Schedule Placeholder]",
    date: "[Date]",
    image: "/Activity/791074857_1519300476879129_5256173980750495448_n.jpg",
    excerpt:
      "[News excerpt placeholder — real news content will replace this via the admin panel.]",
    color: "bg-forest-600",
  },
];






/* ═══════════════════════════════════════════
   NEWS CARD — static card for Recent News & Notices
   Fields render only when present in the data.
   ═══════════════════════════════════════════ */
function NewsCard({ article }) {
  return (
    <article className="group h-full">
      <Card className="h-full" padding={false}>
        {/* Image — elegant neutral fallback when missing */}
        {article.image ? (
          <div className="aspect-[16/10] overflow-hidden relative">
            <img
              src={article.image}
              alt={article.title}
              className="w-full h-full object-cover transition-transform duration-700 ease-premium group-hover:scale-[1.03]"
              loading="lazy"
            />
          </div>
        ) : (
          <div
            className="aspect-[16/10] bg-gradient-to-br from-charcoal-50 to-charcoal-100 flex items-center justify-center"
            aria-hidden="true"
          >
            <svg
              className="w-10 h-10 text-charcoal-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91M3.75 21h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v13.5A1.5 1.5 0 003.75 21z"
              />
            </svg>
          </div>
        )}

        {/* Content */}
        <div className="p-5 md:p-6">
          <div className="flex items-center gap-2.5 mb-3">
            <CardBadge>{article.category}</CardBadge>
            <span className="text-caption text-charcoal-400">
              {article.date}
            </span>
          </div>
          <h3 className="font-heading text-[15px] md:text-h3 font-semibold text-charcoal-900 mb-2 leading-snug group-hover:text-forest-700 transition-colors duration-200">
            {article.title}
          </h3>
          {article.excerpt && (
            <p className="text-body-sm text-charcoal-500 leading-relaxed line-clamp-2">
              {article.excerpt}
            </p>
          )}
        </div>
      </Card>
    </article>
  );
}

function RecentNewsSection() {
  const ref = useScrollReveal();
  const [showAll, setShowAll] = useState(false);

  /* Default: first 3 items. Expanded: all items, natural height. */
  const visibleItems = showAll ? newsItems : newsItems.slice(0, 3);
  const hasMore = newsItems.length > 3;

  return (
    <section className="relative bg-cream-50 py-4 md:py-6 lg:py-8 overflow-hidden">
      {/* Subtle decorative background — unchanged from Why Green Leaf */}
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
          <span className="eyebrow mb-4">Recent Updates</span>
          <h2 className="font-heading text-h2 text-charcoal-900 mb-4 mt-3">
            Recent News &amp; Notices
          </h2>
          <p className="text-body-lg text-charcoal-500 leading-relaxed max-w-2xl mx-auto">
            Stay updated with the latest news, notices, events, and
            announcements from Green Leaf.
          </p>
        </div>

        {newsItems.length === 0 ? (
          /* Empty state — no empty grid, keep the section clean */
          <Card hover={false} className="max-w-xl mx-auto text-center">
            <p className="text-charcoal-500">
              No recent news or notices available.
            </p>
          </Card>
        ) : (
          <>
            {/* Static news grid — 1 / 2 / 3 cards per row */}
            <div
              ref={ref}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 stagger-children"
            >
              {visibleItems.map((article) => (
                <NewsCard key={article.id} article={article} />
              ))}
            </div>

            {/* Show All / Show Less — only when more than 3 items */}
            {hasMore && (
              <div className="mt-10 text-center">
                <Button
                  variant={showAll ? "secondary" : "primary"}
                  size="md"
                  onClick={() => setShowAll(!showAll)}
                  aria-expanded={showAll}
                >
                  {showAll ? "Show Less" : "Show All"}
                </Button>
              </div>
            )}
          </>
        )}
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
   MAP SECTION — Find Us (location + directions)
   Location data verified on the Contact page
   ═══════════════════════════════════════════ */
const GOOGLE_MAPS_EMBED_URL =
  "https://maps.google.com/maps?q=Green+Leaf+International+School+and+College,+526-A+Rd+12-B,+Adabor,+Dhaka+1207&z=17&output=embed";
const GOOGLE_MAPS_DIRECTIONS_URL =
  "https://www.google.com/maps/dir/?api=1&destination=Green+Leaf+International+School+and+College,+526-A+Rd+12-B,+Adabor,+Dhaka+1207";
const SCHOOL_ADDRESS =
  "526-A Rd 12-B, Adabor, Dhaka 1207, Bangladesh";

function MapSection() {
  const ref = useScrollReveal();

  return (
    <SectionWrapper bg="bg-white" padding="py-section">
      <div ref={ref} className="reveal">
        <div className="text-center mb-10 md:mb-12">
          <span className="eyebrow">Our Location</span>
          <h2 className="font-heading text-h2 text-charcoal-900 mb-3 mt-3">
            Find Us on the Map
          </h2>
          <p className="text-body-lg text-charcoal-500 leading-relaxed max-w-2xl mx-auto">
            Visit our campus in Adabor, Dhaka — we would love to show you
            around.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1.7fr_1fr] gap-6 lg:gap-8 items-stretch">
          {/* ── MAP AREA ── */}
          <div className="relative rounded-2xl overflow-hidden border border-charcoal-100 shadow-card bg-forest-50/40 min-h-[300px] md:min-h-[360px] lg:min-h-[420px]">
            <iframe
              src={GOOGLE_MAPS_EMBED_URL}
              title="Green Leaf International School & College location map"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 w-full h-full"
            />
            {/* Overlay badge — top placement keeps Google map controls clear */}
            <span className="absolute top-4 left-4 z-10 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white/90 backdrop-blur-sm border border-charcoal-100 shadow-sm text-[11px] font-bold uppercase tracking-[0.14em] text-forest-700">
              <span className="w-1.5 h-1.5 bg-forest-600 rounded-full" />
              Our Campus
            </span>
          </div>

          {/* ── LOCATION INFORMATION CARD ── */}
          <div className="bg-cream-50 rounded-2xl border border-charcoal-100/60 shadow-card p-7 md:p-8 flex flex-col">
            <div className="w-11 h-11 bg-forest-50 rounded-xl flex items-center justify-center text-forest-600 mb-5">
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
                  d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
                />
              </svg>
            </div>

            <h3 className="font-heading text-h3 text-charcoal-900 mb-2">
              Green Leaf International School &amp; College
            </h3>
            <p className="text-body-sm text-charcoal-500 leading-relaxed mb-5">
              Located in the heart of Adabor, easily reachable from across
              Dhaka.
            </p>

            <p className="text-body-sm text-charcoal-700 leading-relaxed mb-6">
              {SCHOOL_ADDRESS}
            </p>

            <a
              href={GOOGLE_MAPS_DIRECTIONS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-forest-700 text-white text-body-sm font-semibold transition-all duration-250 ease-premium hover:bg-forest-800 hover:shadow-lg hover:shadow-forest-700/20 active:bg-forest-900 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:ring-offset-2"
            >
              Get Directions
              <svg
                className="w-4 h-4"
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

            <div className="mt-auto pt-6 border-t border-charcoal-100/70">
              <p className="text-caption text-charcoal-400 uppercase tracking-[0.1em] font-semibold mb-1">
                Office Hours
              </p>
              <p className="text-body-sm text-charcoal-500">
                Sun — Thu: 8:00 AM — 4:00 PM
              </p>
              <p className="text-body-sm text-charcoal-400">Fri — Sat: Closed</p>
            </div>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}

/* ═══════════════════════════════════════════
   HOME PAGE
   ═══════════════════════════════════════════ */
function Home() {
  return (
    <>
      <Hero />
      {/* Leadership Message — immediately after Hero (phase requirement) */}
      <LeadershipMessage />
      <RecentNewsSection />
      <StudentLife />
      <AcademicsPreview />
      <VideoSection />
      <AdmissionsCTA />
      {/* Map — last section, sits right above the footer */}
      <MapSection />
    </>
  );
}

export default Home;
