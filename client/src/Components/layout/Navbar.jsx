import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import useNavigation from '../../hooks/useNavigation';
import { siteConfig } from '../../../../shared/config/siteConfig';
import BrandBlock from '../ui/BrandBlock';

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

  /* Close mobile menu + any desktop dropdown on route change */
  useEffect(() => {
    closeMenu();
    setOpenDropdownId(null);
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

  /* ---- Desktop dropdown state (Phase 3.5) ----
     One open dropdown at a time; driven entirely by the API data
     (item.children) — nothing about dropdowns is hardcoded. */
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const navRowRef = useRef(null);

  /* Click outside the nav row closes the open dropdown */
  useEffect(() => {
    if (!openDropdownId) return undefined;
    const handlePointerDown = (e) => {
      if (navRowRef.current && !navRowRef.current.contains(e.target)) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [openDropdownId]);

  /* Escape closes the open dropdown */
  useEffect(() => {
    if (!openDropdownId) return undefined;
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpenDropdownId(null);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [openDropdownId]);

  /* Data-driven navigation (Phase 3.4): one API request per mount,
     fallback keeps the menu shape stable while loading/on error. */
  const { items: navItems } = useNavigation();

  /* ---- Desktop Row 2 rendering (same visual classes as before).
     Items WITH children render a chevron trigger + dropdown panel;
     items without children render exactly as in Phase 3.4. */
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

  const toggleDropdown = (itemId) =>
    setOpenDropdownId((current) => (current === itemId ? null : itemId));

  /* Section-active: a parent lights up when one of its children
     is the current route (NavLink handles plain parents itself). */
  const childRouteIsActive = (item) =>
    item.children.some((c) => c.kind === 'internal' && c.url === location.pathname);

  /* Premium dropdown panel — own opaque surface (readable over any
     page background), subtle border + shadow, 200ms fade/slide. */
  const dropdownPanel = (item) => {
    const open = openDropdownId === item.id;
    return (
      <div
        id={`nav-dd-${item.id}`}
        role="menu"
        aria-label={`${item.label} submenu`}
        onKeyDown={handlePanelKeyDown}
        className={[
          'absolute left-0 top-full z-50 pt-2',
          prefersReduced ? '' : 'transition-all duration-200 ease-premium',
          open
            ? 'visible translate-y-0 opacity-100'
            : 'invisible -translate-y-1 opacity-0',
        ].join(' ')}
      >
        <div className="min-w-[13rem] max-w-[15rem] rounded-xl border border-charcoal-100 bg-white py-2 shadow-elevated">
          <ul className="space-y-0.5 px-2">
            {item.children.map((child) => {
              if (child.kind === 'external') {
                return (
                  <li key={child.id} role="none">
                    <a
                      role="menuitem"
                      href={child.url}
                      target={child.openNewTab ? '_blank' : undefined}
                      rel={child.openNewTab ? 'noopener noreferrer' : undefined}
                      onClick={() => setOpenDropdownId(null)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-charcoal-600 transition-colors duration-150 hover:bg-forest-50 hover:text-forest-700 focus-visible:bg-forest-50 focus-visible:text-forest-700 focus:outline-none"
                    >
                      <span className="truncate">{child.label}</span>
                      <span aria-hidden="true" className="text-[10px] text-charcoal-400">↗</span>
                    </a>
                  </li>
                );
              }
              return (
                <li key={child.id} role="none">
                  <NavLink
                    role="menuitem"
                    to={child.url}
                    end={child.url === '/'}
                    onClick={() => setOpenDropdownId(null)}
                    className={({ isActive }) =>
                      [
                        'flex w-full items-center rounded-lg px-3 py-2 text-[13px] font-medium transition-colors duration-150 focus:outline-none',
                        isActive
                          ? 'bg-forest-50 font-semibold text-forest-700'
                          : 'text-charcoal-600 hover:bg-forest-50 hover:text-forest-700 focus-visible:bg-forest-50 focus-visible:text-forest-700',
                      ].join(' ')
                    }
                  >
                    <span className="truncate">{child.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  };

  /* ArrowDown/ArrowUp move focus between panel items (no trap —
     Tab still leaves the menu normally). */
  function handlePanelKeyDown(e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const focusables = e.currentTarget.querySelectorAll('a[href], button:not(:disabled)');
    if (focusables.length === 0) return;
    const index = Array.prototype.indexOf.call(focusables, document.activeElement);
    e.preventDefault();
    const next = e.key === 'ArrowDown'
      ? focusables[(index + 1) % focusables.length]
      : focusables[(index - 1 + focusables.length) % focusables.length];
    next?.focus();
  }

  /* Accessible dropdown trigger for parents WITH children.
     - parent with URL  → the link stays clickable; the chevron is
       a separate toggle button (no duplicate navigation link)
     - parent w/o URL   → the whole control is the toggle button
       (never navigates to "#"/null/undefined) */
  const dropdownTrigger = (item, active) => {
    const open = openDropdownId === item.id;
    const chevron = (
      <span
        aria-hidden="true"
        className={`inline-flex items-center text-current transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      >
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 4.5 L6 8 L9.5 4.5" />
        </svg>
      </span>
    );

    if (item.kind === 'label') {
      return (
        <button
          type="button"
          onClick={() => toggleDropdown(item.id)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={`nav-dd-${item.id}`}
          className={[
            desktopLinkClass(active),
            'inline-flex cursor-pointer items-center gap-1.5',
          ].join(' ')}
        >
          {item.label}
          {chevron}
          {desktopIndicator(active)}
        </button>
      );
    }

    /* Parent has a real URL: keep the NavLink, chevron toggles. */
    const link = item.kind === 'external' ? (
      <a
        href={item.url}
        target={item.openNewTab ? '_blank' : undefined}
        rel={item.openNewTab ? 'noopener noreferrer' : undefined}
        className={desktopLinkClass(active)}
      >
        {item.label}
        {desktopIndicator(active)}
      </a>
    ) : (
      <NavLink
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

    return (
      <>
        {link}
        <button
          type="button"
          onClick={() => toggleDropdown(item.id)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={`nav-dd-${item.id}`}
          aria-label={`${item.label} submenu`}
          className="-ml-1 inline-flex items-center rounded-md px-1 py-2 text-charcoal-400 transition-colors duration-200 hover:text-charcoal-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500"
        >
          {chevron}
        </button>
      </>
    );
  };

  const renderDesktopNav = (item) => {
    const hasChildren = item.children.length > 0;

    if (!hasChildren) {
      /* Plain item — identical rendering to Phase 3.4, no arrow. */
      if (item.kind === 'external') {
        return (
          <div key={item.id} className="flex items-center">
            <a
              href={item.url}
              target={item.openNewTab ? '_blank' : undefined}
              rel={item.openNewTab ? 'noopener noreferrer' : undefined}
              className={desktopLinkClass(false)}
            >
              {item.label}
              {desktopIndicator(false)}
            </a>
          </div>
        );
      }
      return (
        <div key={item.id} className="flex items-center">
          <NavLink
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
        </div>
      );
    }

    /* Parent with children: hover opens, leaving closes, the
       chevron toggles for click/keyboard, one open at a time. */
    const active = item.kind === 'internal' && location.pathname === item.url
      || childRouteIsActive(item);
    return (
      <div
        key={item.id}
        className="relative flex items-center"
        onMouseEnter={() => setOpenDropdownId(item.id)}
        onMouseLeave={() => setOpenDropdownId((c) => (c === item.id ? null : c))}
      >
        {dropdownTrigger(item, active)}
        {dropdownPanel(item)}
      </div>
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
              aria-label={`${siteConfig.identity.name} — Home`}
            >
              {/* Brand (logo + wordmark) from the central site config */}
              <BrandBlock size="sm" theme="light" />
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
            <div ref={navRowRef} className="flex items-center justify-center gap-1 h-11">              {navItems.map(renderDesktopNav)}

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
