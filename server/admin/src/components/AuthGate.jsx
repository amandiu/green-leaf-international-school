// ------------------------------------------------------------
// AuthGate (Admin auth phase)
//
// Route guard driven by the REAL authentication state from
// useAdminAuth (server session cookie):
//   initializing   → neutral loading screen (avoids redirect
//                    flicker while /api/auth/me resolves)
//   unauthenticated → redirect to /login
//   authenticated  → render the admin page
// ------------------------------------------------------------

import { Navigate } from 'react-router-dom';
import { Loader } from './Feedback';

export default function AuthGate({ initializing, user, children }) {
  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal-50">
        <Loader label="Checking session…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
