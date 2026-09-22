import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import SettingsHeadSync from './SettingsHeadSync';

function Layout() {
  const { pathname } = useLocation();
  const [displayLocation, setDisplayLocation] = useState(pathname);
  const [transitionStage, setTransitionStage] = useState('entered');

  useEffect(() => {
    if (pathname !== displayLocation) {
      setTransitionStage('exiting');
    }
  }, [pathname, displayLocation]);

  useEffect(() => {
    if (transitionStage === 'exiting') {
      const timer = setTimeout(() => {
        setDisplayLocation(pathname);
        window.scrollTo(0, 0);
        setTransitionStage('entering');
      }, 150);
      return () => clearTimeout(timer);
    }

    if (transitionStage === 'entering') {
      const timer = setTimeout(() => {
        setTransitionStage('entered');
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [transitionStage, pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-cream-50 font-body text-charcoal-800">
      {/* Applies DB-backed title/favicon/OG once /api/settings resolves */}
      <SettingsHeadSync />

      <Navbar />

      {/* Spacer for fixed 3-row navbar: mobile = row1 3.5rem + row3 2.25rem = 5.75rem; md = 4 + 2.75 + 2.25 = 9rem */}
      <div className="h-[5.75rem] md:h-36" aria-hidden="true" />

      <main className="flex-1">
        <div
          className={[
            'transition-opacity duration-200 ease-in-out',
            transitionStage === 'entered' ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        >
          <Outlet key={displayLocation} />
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default Layout;
