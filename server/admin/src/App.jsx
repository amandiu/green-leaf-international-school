import { useCallback } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { siteConfig } from '../../../shared/config/siteConfig';
import useAdminAuth from './hooks/useAdminAuth';
import AuthGate from './components/AuthGate';
import LoginPage from './pages/LoginPage';
import NavigationManagement from './pages/NavigationManagement';
import LeadershipManagement from './pages/LeadershipManagement';
import SiteSettings from './pages/SiteSettings';
import HomepageManagement from './pages/HomepageManagement';
import ContentCenter from './pages/ContentCenter';
import NewsManagement from './pages/NewsManagement';

// Placeholder page — will be built in Phase 6
const Dashboard = ({ onLogout }) => (
  <div className="min-h-screen bg-charcoal-50">
    <header className="bg-white border-b border-charcoal-200 px-6 py-4">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-forest-700">{siteConfig.seo.adminTitle} Dashboard</h1>
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg border border-charcoal-200 px-3 py-1.5 text-xs font-medium text-charcoal-600 hover:bg-charcoal-100"
          >
            Logout
          </button>
        )}
      </div>
    </header>
    <main className="mx-auto w-full max-w-5xl p-6">
      <p className="text-charcoal-600">Welcome to the admin panel. CMS features will be added in Phase 7.</p>
      <nav className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/navigation"
          className="rounded-xl border border-charcoal-200 bg-white p-5 shadow-sm transition-colors hover:border-forest-300 hover:bg-green-50/50"
        >
          <span className="block font-semibold text-charcoal-900">Navigation Management</span>
          <span className="mt-1 block text-sm text-charcoal-500">
            Manage the website menu and submenus
          </span>
        </Link>
        <Link
          to="/leadership"
          className="rounded-xl border border-charcoal-200 bg-white p-5 shadow-sm transition-colors hover:border-forest-300 hover:bg-green-50/50"
        >
          <span className="block font-semibold text-charcoal-900">Leadership Management</span>
          <span className="mt-1 block text-sm text-charcoal-500">
            Manage the Principal and Chairman messages
          </span>
        </Link>
        <Link
          to="/settings"
          className="rounded-xl border border-charcoal-200 bg-white p-5 shadow-sm transition-colors hover:border-forest-300 hover:bg-green-50/50"
        >
          <span className="block font-semibold text-charcoal-900">Site Settings</span>
          <span className="mt-1 block text-sm text-charcoal-500">
            Edit the school's global identity, contact and branding info
          </span>
        </Link>
        <Link
          to="/homepage"
          className="rounded-xl border border-charcoal-200 bg-white p-5 shadow-sm transition-colors hover:border-forest-300 hover:bg-green-50/50"
        >
          <span className="block font-semibold text-charcoal-900">Homepage</span>
          <span className="mt-1 block text-sm text-charcoal-500">
            Edit the hero, life-at-school, video showcase and CTA content
          </span>
        </Link>
        <Link
          to="/content-center"
          className="rounded-xl border border-charcoal-200 bg-white p-5 shadow-sm transition-colors hover:border-forest-300 hover:bg-green-50/50"
        >
          <span className="block font-semibold text-charcoal-900">Content Center</span>
          <span className="mt-1 block text-sm text-charcoal-500">
            Central content managed once — Location &amp; Map, Reusable Content, News &amp; Notices
          </span>
        </Link>
      </nav>
    </main>
  </div>
);

function App() {
  const { user, initializing, login, logout } = useAdminAuth();
  const location = useLocation();

  const isLoginPage = location.pathname === '/login';

  // Shared lock handler: 401/503 from any page drops the session.
  // useCallback keeps the identity stable across renders — pages put
  // this in their load-effect dependency arrays, and a new function
  // identity on every parent render used to re-run those effects,
  // re-fetching data the API rate limiter then had to absorb.
  const handleUnauthorized = useCallback(() => {
    if (user) logout();
  }, [user, logout]);

  // While /api/auth/me resolves, render nothing to avoid a
  // redirect flash on refresh.
  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-forest-500 border-t-transparent" aria-label="Loading" />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={<LoginPage user={user} initializing={initializing} onLogin={login} />}
      />
      <Route
        path="/dashboard"
        element={
          <AuthGate initializing={initializing} user={user}>
            <Dashboard onLogout={logout} />
          </AuthGate>
        }
      />
      <Route
        path="/navigation"
        element={
          <AuthGate initializing={initializing} user={user}>
            <NavigationManagement onUnauthorized={handleUnauthorized} />
          </AuthGate>
        }
      />
      <Route
        path="/leadership"
        element={
          <AuthGate initializing={initializing} user={user}>
            <LeadershipManagement onUnauthorized={handleUnauthorized} />
          </AuthGate>
        }
      />
      <Route
        path="/settings"
        element={
          <AuthGate initializing={initializing} user={user}>
            <SiteSettings onUnauthorized={handleUnauthorized} />
          </AuthGate>
        }
      />
      <Route
        path="/homepage"
        element={
          <AuthGate initializing={initializing} user={user}>
            <HomepageManagement onUnauthorized={handleUnauthorized} />
          </AuthGate>
        }
      />
      <Route
        path="/content-center"
        element={
          <AuthGate initializing={initializing} user={user}>
            <ContentCenter onUnauthorized={handleUnauthorized} />
          </AuthGate>
        }
      />
      <Route
        path="/news"
        element={
          <AuthGate initializing={initializing} user={user}>
            <NewsManagement onUnauthorized={handleUnauthorized} />
          </AuthGate>
        }
      />
      <Route
        path="*"
        element={
          user
            ? <Navigate to="/dashboard" replace />
            : <Navigate to={isLoginPage ? '/login' : '/login'} replace state={{ from: location }} />
        }
      />
    </Routes>
  );
}

export default App;
