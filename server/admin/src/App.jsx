import { Routes, Route, Navigate } from 'react-router-dom';

// Placeholder pages — will be built in Phase 6
const Login = () => (
  <div className="min-h-screen flex items-center justify-center bg-charcoal-50">
    <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg">
      <h1 className="text-2xl font-bold text-forest-700 text-center mb-2">
        Green Leaf Admin
      </h1>
      <p className="text-charcoal-500 text-center mb-6">Sign in to manage content</p>
      <form className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-charcoal-700 mb-1">Email</label>
          <input
            type="email"
            className="w-full px-4 py-2 border border-charcoal-200 rounded-lg focus:ring-2 focus:ring-forest-500 focus:border-transparent outline-none"
            placeholder="admin@greenleaf.edu"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-charcoal-700 mb-1">Password</label>
          <input
            type="password"
            className="w-full px-4 py-2 border border-charcoal-200 rounded-lg focus:ring-2 focus:ring-forest-500 focus:border-transparent outline-none"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          className="w-full py-2.5 bg-forest-600 text-white font-semibold rounded-lg hover:bg-forest-700 transition-colors"
        >
          Sign In
        </button>
      </form>
    </div>
  </div>
);

const Dashboard = () => (
  <div className="min-h-screen bg-charcoal-50">
    <header className="bg-white border-b border-charcoal-200 px-6 py-4">
      <h1 className="text-xl font-bold text-forest-700">Green Leaf Admin Dashboard</h1>
    </header>
    <main className="p-6">
      <p className="text-charcoal-600">Welcome to the admin panel. CMS features will be added in Phase 7.</p>
    </main>
  </div>
);

const Unauthorized = () => (
  <div className="min-h-screen flex items-center justify-center bg-charcoal-50">
    <div className="text-center">
      <h1 className="text-4xl font-bold text-charcoal-800 mb-4">403</h1>
      <p className="text-charcoal-500 mb-6">You are not authorized to access this page.</p>
      <a href="/login" className="text-forest-600 hover:text-forest-700 font-medium">
        Go to Login
      </a>
    </div>
  </div>
);

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
