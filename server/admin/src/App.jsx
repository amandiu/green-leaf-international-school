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
import ContactInbox from './pages/ContactInbox';
import GalleryManagement from './pages/GalleryManagement';
import PageContentManagement from './pages/PageContentManagement';
import DownloadsManagement from './pages/DownloadsManagement';
import ChangePassword from './pages/ChangePassword';
import UserManagement from './pages/UserManagement';

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
        <Link
          to="/contact-inbox"
          className="rounded-xl border border-charcoal-200 bg-white p-5 shadow-sm transition-colors hover:border-forest-300 hover:bg-green-50/50"
        >
          <span className="block font-semibold text-charcoal-900">Contact Inbox</span>
          <span className="mt-1 block text-sm text-charcoal-500">
            Messages from the public Contact form — mark read, replied or archived
          </span>
        </Link>
        <Link
          to="/gallery"
          className="rounded-xl border border-charcoal-200 bg-white p-5 shadow-sm transition-colors hover:border-forest-300 hover:bg-green-50/50"
        >
          <span className="block font-semibold text-charcoal-900">Gallery</span>
          <span className="mt-1 block text-sm text-charcoal-500">
            Manage the public photo gallery shown on the Campus page
          </span>
        </Link>
        <Link
          to="/downloads"
          className="rounded-xl border border-charcoal-200 bg-white p-5 shadow-sm transition-colors hover:border-forest-300 hover:bg-green-50/50"
        >
          <span className="block font-semibold text-charcoal-900">Downloads</span>
          <span className="mt-1 block text-sm text-charcoal-500">
            Manage public PDF documents — prospectus, forms, syllabus, circulars
          </span>
        </Link>
        <Link
          to="/about-page"
          className="rounded-xl border border-charcoal-200 bg-white p-5 shadow-sm transition-colors hover:border-forest-300 hover:bg-green-50/50"
        >
          <span className="block font-semibold text-charcoal-900">About Page</span>
          <span className="mt-1 block text-sm text-charcoal-500">
            Edit the About page story, core values and vision &amp; mission
          </span>
        </Link>
        <Link
          to="/academics-page"
          className="rounded-xl border border-charcoal-200 bg-white p-5 shadow-sm transition-colors hover:border-forest-300 hover:bg-green-50/50"
        >
          <span className="block font-semibold text-charcoal-900">Academics Page</span>
          <span className="mt-1 block text-sm text-charcoal-500">
            Edit the Academics overview, programs, environment and CTA content
          </span>
        </Link>
        <Link
          to="/campus-page"
          className="rounded-xl border border-charcoal-200 bg-white p-5 shadow-sm transition-colors hover:border-forest-300 hover:bg-green-50/50"
        >
          <span className="block font-semibold text-charcoal-900">Campus Page</span>
          <span className="mt-1 block text-sm text-charcoal-500">
            Edit the Campus overview and facilities (photos stay in the Gallery module)
          </span>
        </Link>
        <Link
          to="/users"
          className="rounded-xl border border-charcoal-200 bg-white p-5 shadow-sm transition-colors hover:border-forest-300 hover:bg-green-50/50"
        >
          <span className="block font-semibold text-charcoal-900">User Management</span>
          <span className="mt-1 block text-sm text-charcoal-500">
            Canonical accounts — create, deactivate, assign roles, issue reset tokens (Phase C.6)
          </span>
        </Link>
        <Link
          to="/change-password"
          className="rounded-xl border border-charcoal-200 bg-white p-5 shadow-sm transition-colors hover:border-forest-300 hover:bg-green-50/50"
        >
          <span className="block font-semibold text-charcoal-900">Change Password</span>
          <span className="mt-1 block text-sm text-charcoal-500">
            Update your own password — signs you out everywhere (Phase C.5)
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
        path="/contact-inbox"
        element={
          <AuthGate initializing={initializing} user={user}>
            <ContactInbox onUnauthorized={handleUnauthorized} />
          </AuthGate>
        }
      />
      <Route
        path="/gallery"
        element={
          <AuthGate initializing={initializing} user={user}>
            <GalleryManagement onUnauthorized={handleUnauthorized} />
          </AuthGate>
        }
      />
      {/* Phase B.3: DB-backed informational pages (page_sections) —
          one generic editor, three page identifiers. */}
      <Route
        path="/downloads"
        element={
          <AuthGate initializing={initializing} user={user}>
            <DownloadsManagement onUnauthorized={handleUnauthorized} />
          </AuthGate>
        }
      />
      <Route
        path="/about-page"
        element={
          <AuthGate initializing={initializing} user={user}>
            <PageContentManagement page="about" onUnauthorized={handleUnauthorized} />
          </AuthGate>
        }
      />
      <Route
        path="/academics-page"
        element={
          <AuthGate initializing={initializing} user={user}>
            <PageContentManagement page="academics" onUnauthorized={handleUnauthorized} />
          </AuthGate>
        }
      />
      <Route
        path="/campus-page"
        element={
          <AuthGate initializing={initializing} user={user}>
            <PageContentManagement page="campus" onUnauthorized={handleUnauthorized} />
          </AuthGate>
        }
      />
      <Route
        path="/users"
        element={
          <AuthGate initializing={initializing} user={user}>
            <UserManagement onUnauthorized={handleUnauthorized} />
          </AuthGate>
        }
      />
      <Route
        path="/change-password"
        element={
          <AuthGate initializing={initializing} user={user}>
            <ChangePassword onUnauthorized={handleUnauthorized} />
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
