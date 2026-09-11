import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import useNavigation from '../../hooks/useNavigation';

/* ═══════════════════════════════════════════
   NAV LINKS — now served from the MySQL navigation API
   (GET /api/navigation → useNavigation). Menu order, labels,
   active/inactive state and submenus are managed in Admin →
   Navigation Management. The verified static 7-item list lives
   only as the safe fallback inside utils/navigation.js.
   ═══════════════════════════════════════════ */

/* ═══════════════════════════════════════════
   LATEST NEWS — existing project placeholder
   news data (mirrors Home.jsx newsItems).
   No fabricated school news, no invented dates/URLs.
   Items are non-clickable until real news URLs exist.
   ═══════════════════════════════════════════ */
const tickerItems = [
  { id: 1, category: 'Notice', title: 'Admission Information for [Year]' },
  { id: 2, category: 'News', title: '[News Title Placeholder]' },
  { id: 3, category: 'Event', title: '[School Event Placeholder]' },
  { id: 4, category: 'Announcement', title: '[Important Announcement]' },
  { id: 5, category: 'Notice', title: '[Exam Schedule Placeholder]' },
];

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReduced, setPrefersReduced] = useState(false);
  const location = useLocation();

  const closeMenu = useCallback(() => setIsOpen(false), []);

  /* Ticker pause/resume — hover + keyboard focus */
  const pauseTicker = useCallback(() => setIsPaused(true), []);
  const resumeTicker = useCallback(() => setIsPaused(false), []);

  /* Close mobile menu on route change */
  useEffect(() => {
    closeMenu();
  }, [location.pathname, closeMenu]);

  /* Detect reduced-motion preference */
  useEffect(() => {
    setPrefersReduced(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
  }, []);

  /* Lock body scroll when mobile menu is open */
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  /* Escape key closes the mobile menu */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) closeMenu();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeMenu]);

  /* Ticker animation style: reduced-motion users get a static,
     horizontally scrollable news state instead of a moving ticker */
  const tickerTrackStyle = useMemo(
    () =>
      prefersReduced
        ? {
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
          }
        : {
            width: 'max-content',
            animation: 'newsTicker 35s linear infinite',
            animationPlayState: isPaused ? 'paused' : 'running',
          },
    [prefersReduced, isPaused],
  );

  /* Data-driven navigation (Phase 3.4): one API request per mount,
     fallback keeps the menu shape stable while loading/on error. */
  const { items: navItems } = useNavigation();

  /* ---- Desktop Row 2 rendering (same visual classes as before).
     item.children are kept on each entry for the dedicated
     dropdown UI phase — they are not yet rendered inline here. */
  const desktopLinkClass = (active) =>
    [
      'relative px-3.5 py-2 text-[13px] font-medium rounded-md transition-all duration-200',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500',
      active
        ? 'text-forest-700 font-bold'
        : 'text-charcoal-600 hover:text-charcoal-900',
    ].join(' ');

  const desktopIndicator = (active) => (
    <span
      className={[
        'absolute bottom-0 left-3 right-3 h-[2px] rounded-full',
        'bg-forest-600 transition-all duration-300 ease-premium',
        active ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-50',
      ].join(' ')}
    />
  );

  const renderDesktopNav = (item) => {
    if (item.kind === 'external') {
      return (
        <a
          key={item.id}
          href={item.url}
          target={item.openNewTab ? '_blank' : undefined}
          rel={item.openNewTab ? 'noopener noreferrer' : undefined}
          className={desktopLinkClass(false)}
        >
          {item.label}
          {desktopIndicator(false)}
        </a>
      );
    }
    if (item.kind === 'label') {
      // DROPDOWN parent without a URL — non-interactive until the
      // dropdown UI phase; never rendered as a dead "#" link.
      return (
        <span key={item.id} className={`${desktopLinkClass(false)} cursor-default`} aria-disabled="true">
          {item.label}
          {desktopIndicator(false)}
        </span>
      );
    }
    return (
      <NavLink
        key={item.id}
        to={item.url}
        end={item.url === '/'}
        className={({ isActive }) => desktopLinkClass(isActive)}
      >
        {({ isActive }) => (
          <>
            {item.label}
            {desktopIndicator(isActive)}
          </>
        )}
      </NavLink>
    );
  };

  /* ---- Mobile menu rendering (same visual classes as before).
     Submenu children render as simple indented rows so nested
     data is never shown as broken top-level links; the full
     mobile submenu UX is refined in a later phase. */
  const mobileLinkClass = (active) =>
    [
      'block px-4 py-2.5 rounded-lg text-[15px] font-medium transition-colors duration-200',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500',
      active
        ? 'text-forest-700 bg-forest-50 font-semibold'
        : 'text-charcoal-600 hover:text-charcoal-900 hover:bg-charcoal-50',
    ].join(' ');

  const renderMobileNav = (item, index) => {
    const stagger = isOpen
      ? { animation: `fadeInUp 0.3s ease-out ${index * 40}ms forwards`, opacity: 0 }
      : undefined;

    let main;
    if (item.kind === 'external') {
      main = (
        <a
          key={item.id}
          href={item.url}
          target={item.openNewTab ? '_blank' : undefined}
          rel={item.openNewTab ? 'noopener noreferrer' : undefined}
          onClick={item.openNewTab ? undefined : closeMenu}
          className={mobileLinkClass(false)}
          style={stagger}
        >
          {item.label}
        </a>
      );
    } else if (item.kind === 'label') {
      main = (
        <span
          key={item.id}
          className={`${mobileLinkClass(false)} cursor-default`}
          aria-disabled="true"
          style={stagger}
        >
          {item.label}
        </span>
      );
    } else {
      main = (
        <NavLink
          key={item.id}
          to={item.url}
          end={item.url === '/'}
          onClick={closeMenu}
          className={({ isActive }) => mobileLinkClass(isActive)}
          style={stagger}
        >
          {item.label}
        </NavLink>
      );
    }

    const children = item.children.map((child) => (
      <NavLink
        key={child.id}
        to={child.url}
        end={child.url === '/'}
        onClick={closeMenu}
        className={({ isActive }) =>
          [
            'block pl-8 pr-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500',
            isActive
              ? 'text-forest-700 bg-forest-50 font-semibold'
              : 'text-charcoal-500 hover:text-charcoal-900 hover:bg-charcoal-50',
          ].join(' ')
        }
        style={isOpen
          ? { animation: `fadeInUp 0.3s ease-out ${(index + 0.5) * 40}ms forwards`, opacity: 0 }
          : undefined}
      >
        {child.label}
      </NavLink>
    ));

    return [main, ...children];
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 bg-cream-50/95 backdrop-blur-xl border-b border-charcoal-200/60 shadow-nav"
      role="banner"
    >
      <nav aria-label="Main navigation">
        {/* ═══════════ ROW 1 — SCHOOL BRANDING ═══════════ */}
        <div className="bg-white/80 border-b border-charcoal-100/70">
          <div className="container-custom h-14 md:h-16 flex items-center justify-between gap-3">
            <Link
              to="/"
              className="flex items-center gap-2.5 md:gap-3 group shrink-0 min-w-0"
              aria-label="Green Leaf International School & College — Home"
            >
              {/* Real school logo — do NOT replace */}
              <img
                src="/logo.jpg"
                alt="Green Leaf International School & College Logo"
                className="w-10 h-10 md:w-11 md:h-11 rounded-lg object-cover shadow-sm transition-transform duration-250 ease-premium group-hover:scale-105"
              />
              <div className="leading-tight min-w-0">
                <span className="block text-[13px] sm:text-[14px] md:text-[15px] font-bold text-charcoal-900 tracking-tight whitespace-nowrap">
                  Green Leaf
                </span>
                <span className="block text-[9px] sm:text-[10px] md:text-[10.5px] text-charcoal-500 tracking-[0.14em] uppercase font-medium whitespace-nowrap">
                  International School &amp; College
                </span>
              </div>
            </Link>

            {/* Mobile hamburger — only visible below md, keeps Row 1 identity intact */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-charcoal-600 hover:bg-charcoal-100 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500"
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isOpen}
            >
              <div className="w-5 h-4 flex flex-col justify-between">
                <span className={`block h-[1.5px] bg-current rounded-full transition-all duration-300 ${isOpen ? 'rotate-45 translate-y-[5px]' : ''}`} />
                <span className={`block h-[1.5px] bg-current rounded-full transition-all duration-300 ${isOpen ? 'opacity-0 scale-x-0' : ''}`} />
                <span className={`block h-[1.5px] bg-current rounded-full transition-all duration-300 ${isOpen ? '-rotate-45 -translate-y-[5px]' : ''}`} />
              </div>
            </button>

          </div>
        </div>

        {/* ═══════════ ROW 2 — MAIN NAVIGATION (desktop ≥ md) ═══════════ */}
        <div className="hidden md:block bg-white/60 border-b border-charcoal-100/70">
          <div className="container-custom relative">
            <div className="flex items-center justify-center gap-1 h-11">              {navItems.map(renderDesktopNav)}

              {/* Admission Enquiry CTA — pinned to the right edge of the nav row */}
              <Link
                to="/admissions"
                className={ [
                  'absolute right-0 top-1/2 -translate-y-1/2 inline-flex items-center gap-2 px-4 py-2 rounded-lg shrink-0',
                  'bg-forest-700 text-white text-[13px] font-semibold',
                  'transition-all duration-250 ease-premium',
                  'hover:bg-forest-800 hover:shadow-lg hover:shadow-forest-700/20',
                  'focus:outline-none focus:ring-2 focus:ring-forest-500 focus:ring-offset-2',
                  'active:bg-forest-900',
                ].join(' ') }
              >
                Admission Enquiry
              </Link>
            </div>
          </div>
        </div>

        {/* ═══════════ ROW 3 — LATEST NEWS TICKER ═══════════ */}
        <div className="bg-forest-50/90 border-b border-forest-100">
          <div className="container-custom">
            <div className="flex items-center gap-3 h-9">
              {/* Static label — only the news content moves */}
              <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-forest-700 text-white text-[10px] font-bold uppercase tracking-[0.14em]">
                Latest News
              </span>

              {/* Ticker viewport — moving content is clipped here only */}
              <div
                className="relative flex-1 min-w-0 overflow-hidden"
                onMouseEnter={pauseTicker}
                onMouseLeave={resumeTicker}
                onFocus={pauseTicker}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) resumeTicker();
                }}
              >
                <div
                  className="flex items-center gap-8 w-max"
                  style={tickerTrackStyle}
                  aria-label="Latest news and notices"
                >
                  {[...tickerItems, ...tickerItems].map((item, index) => (
                    <span
                      key={`${item.id}-${index}`}
                      className="flex items-center gap-2 whitespace-nowrap"
                      aria-hidden={index >= tickerItems.length}
                    >
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider text-white ${['bg-forest-600', 'bg-charcoal-500', 'bg-gold-500', 'bg-leaf-600', 'bg-forest-600'][index % 5]}`}
                      >
                        {item.category}
                      </span>
                      <span className="text-[11px] text-charcoal-700 font-medium">
                        {item.title}
                      </span>
                      <span className="text-forest-400 text-[11px] font-bold select-none" aria-hidden="true">
                        →
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* ═══════════ MOBILE NAVIGATION (below md) ═══════════ */}
      {/* Backdrop — covers page but sits under the menu panel */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-charcoal-900/30 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}

        onClick={closeMenu}
        aria-hidden="true"
      />

      {/* Slide-down mobile menu panel with opaque surface */}
      <div
        className={[
          'md:hidden fixed left-0 right-0 z-50 top-[5.75rem]',
          'bg-white border-b border-charcoal-100 shadow-elevated',
          'transition-all duration-300 ease-premium',
          isOpen
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 -translate-y-2 pointer-events-none',
        ].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
      >
        <div className="container-custom py-3 space-y-0.5">
          {navItems.flatMap((item, index) => renderMobileNav(item, index))}
          <div className="pt-2 px-1">
            <Link
              to="/admissions"
              onClick={closeMenu}
              className="block w-full text-center px-4 py-2.5 rounded-lg bg-forest-700 text-white text-[15px] font-semibold hover:bg-forest-800 active:bg-forest-900 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500 focus-visible:ring-offset-2"
            >
              Admission Enquiry
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
