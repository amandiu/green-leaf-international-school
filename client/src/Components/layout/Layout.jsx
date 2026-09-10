import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

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
      <Navbar />

      {/* Spacer for fixed navbar */}
      <div className="h-16 md:h-[72px]" />

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
