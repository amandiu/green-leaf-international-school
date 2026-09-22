// ═══════════════════════════════════════════════════════════════
// BRAND BLOCK — logo + name, reused wherever the brand appears
// ═══════════════════════════════════════════════════════════════
// Single rendering point for the logo/wordmark so Navbar, Footer,
// Hero, Contact and the admin panel all stay in sync with the
// EFFECTIVE site settings (SettingsContext → /api/settings, with
// siteConfig.js as the fallback).
// ═══════════════════════════════════════════════════════════════

import { useSettings } from '../../context/SettingsContext';

/**
 * Props:
 *   size        — 'sm' (navbar/contact) | 'md' (footer) | 'lg' (hero)
 *   theme       — 'light' (dark text) | 'dark' (light text on photos)
 *   showSubName — render the subName line (default true)
 */
function BrandBlock({
  size = 'sm',
  theme = 'light',
  showSubName = true,
  className = '',
}) {
  const { settings } = useSettings();
  const { identity, branding } = settings;

  const sizeClasses = {
    sm: {
      img: 'w-10 h-10 rounded-lg',
      name: 'text-[13px] font-bold',
      sub: 'text-[9px]',
    },
    md: {
      img: 'w-12 h-12 rounded-xl',
      name: 'text-[14px] font-bold',
      sub: 'text-[10px]',
    },
    lg: {
      img: 'w-12 h-12 md:w-14 md:h-14 rounded-xl',
      name: 'text-[11px] md:text-[12px] font-bold uppercase tracking-[0.1em]',
      sub: 'text-[9px] md:text-[10px]',
    },
  }[size];

  const isDark = theme === 'dark';
  const nameColor = isDark ? 'text-white/90' : 'text-charcoal-900';
  const subColor = isDark ? 'text-white/60' : 'text-charcoal-500';

  return (
    <span className={`inline-flex items-center gap-2.5 md:gap-3 leading-tight min-w-0 ${className}`}>
      <img
        src={branding.logo}
        alt={`${identity.name} Logo`}
        className={`${sizeClasses.img} object-cover shadow-sm shrink-0`}
      />
      <span className="min-w-0">
        <span className={`block whitespace-nowrap ${sizeClasses.name} ${nameColor}`}>
          {identity.shortName}
        </span>
        {showSubName && identity.subName && (
          <span
            className={`block tracking-[0.14em] uppercase font-medium whitespace-nowrap ${sizeClasses.sub} ${subColor}`}
          >
            {identity.subName}
          </span>
        )}
      </span>
    </span>
  );
}

export default BrandBlock;
