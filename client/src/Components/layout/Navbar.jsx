import { useState, useEffect, useCallback } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

const navLinks = [
  { path: '/', label: 'Home' },
  { path: '/about', label: 'About' },
  { path: '/academics', label: 'Academics' },
  { path: '/admissions', label: 'Admissions' },
  { path: '/campus', label: 'Campus' },
  { path: '/news', label: 'News' },
  { path: '/contact', label: 'Contact' },
];

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  const closeMenu = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    closeMenu();
  }, [location.pathname, closeMenu]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) closeMenu();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeMenu]);

  return (
    <header
      className={[
        'fixed top-0 left-0 right-0 z-50 transition-all duration-350 ease-premium',
        scrolled
          ? 'bg-white/97 backdrop-blur-md shadow-nav-scrolled'
          : 'bg-white/0 backdrop-blur-none',
      ].join(' ')}
      role="banner"
    >
      <nav className="container-custom" aria-label="Main navigation">
        <div className="flex items-center justify-between h-16 md:h-[72px]">
          {/* ── Logo + School Name ── */}
          <Link
            to="/"
            className="flex items-center gap-3 group shrink-0"
            aria-label="Green Leaf International School & College — Home"
          >
            {/* Real school logo */}
            <img
              src="/logo.jpg"
              alt="Green Leaf International School & College Logo"
              className="w-10 h-10 md:w-11 md:h-11 rounded-lg object-cover transition-transform duration-250 ease-premium group-hover:scale-105 shadow-sm"
            />
            <div className="hidden sm:block">
              <span className="block text-[12px] md:text-[13px] font-bold text-charcoal-900 leading-tight tracking-tight">
                Green Leaf
              </span>
              <span className="block text-[8px] md:text-[9px] text-charcoal-400 tracking-[0.12em] uppercase font-medium leading-tight">
                International School &amp; College
              </span>
            </div>
          </Link>

          {/* ── Desktop Navigation ── */}
          <div className="hidden lg:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                end={link.path === '/'}
                className={({ isActive }) =>
                  [
                    'relative px-3 py-2 text-[13px] font-medium rounded-lg transition-all duration-200',
                    isActive
                      ? 'text-forest-700'
                      : 'text-charcoal-500 hover:text-charcoal-900',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    {link.label}
                    {isActive && (
                      <span className="absolute bottom-0.5 left-3 right-3 h-[2px] bg-forest-600 rounded-full" />
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {/* ── CTA + Mobile Toggle ── */}
          <div className="flex items-center gap-2.5">
            <Link
              to="/admissions"
              className={[
                'hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg',
                'bg-forest-700 text-white text-[13px] font-semibold',
                'transition-all duration-250 ease-premium',
                'hover:bg-forest-800 hover:shadow-lg hover:shadow-forest-700/20',
                'active:bg-forest-900',
              ].join(' ')}
            >
              Admission Enquiry
            </Link>

            {/* Mobile hamburger */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="lg:hidden relative w-10 h-10 flex items-center justify-center rounded-lg text-charcoal-600 hover:bg-charcoal-100 transition-colors duration-200"
              aria-label={isOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isOpen}
            >
              <div className="w-5 h-4 flex flex-col justify-between">
                <span className={`block h-[1.5px] bg-current rounded-full transition-all duration-300 origin-center ${isOpen ? 'rotate-45 translate-y-[5px]' : ''}`} />
                <span className={`block h-[1.5px] bg-current rounded-full transition-all duration-300 ${isOpen ? 'opacity-0 scale-x-0' : ''}`} />
                <span className={`block h-[1.5px] bg-current rounded-full transition-all duration-300 origin-center ${isOpen ? '-rotate-45 -translate-y-[5px]' : ''}`} />
              </div>
            </button>
          </div>
        </div>

        {/* ── Mobile Navigation Backdrop ── */}
        <div
          className={`lg:hidden fixed inset-0 top-16 bg-charcoal-900/20 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          onClick={closeMenu}
          aria-hidden="true"
        />

        {/* ── Mobile Menu Panel ── */}
        <div
          className={[
            'lg:hidden fixed left-0 right-0 top-16 bg-white border-b border-charcoal-100 shadow-elevated',
            'transition-all duration-350 ease-premium',
            isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none',
          ].join(' ')}
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
        >
          <div className="container-custom py-3 space-y-0.5">
            {navLinks.map((link, index) => (
              <NavLink
                key={link.path}
                to={link.path}
                end={link.path === '/'}
                onClick={closeMenu}
                className={({ isActive }) =>
                  [
                    'block px-4 py-2.5 rounded-lg text-[15px] font-medium transition-colors duration-200',
                    isOpen ? 'animate-[fadeInUp_0.3s_ease-out_forwards]' : '',
                    isActive ? 'text-forest-700 bg-forest-50' : 'text-charcoal-600 hover:text-charcoal-900 hover:bg-charcoal-50',
                  ].join(' ')
                }
                style={isOpen ? { animationDelay: `${index * 40}ms` } : undefined}
              >
                {link.label}
              </NavLink>
            ))}
            <div className="pt-2 px-4">
              <Link
                to="/admissions"
                onClick={closeMenu}
                className="block w-full text-center px-4 py-2.5 rounded-lg bg-forest-700 text-white text-[15px] font-semibold hover:bg-forest-800 transition-colors duration-200"
              >
                Admission Enquiry
              </Link>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}

export default Navbar;
