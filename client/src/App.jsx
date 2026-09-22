import { Routes, Route } from 'react-router-dom';
import { Layout } from './Components/layout';
import ErrorBoundary from './Components/ui/ErrorBoundary';
import { Home, About, Academics, Admissions, Campus, News, Contact, NewsDetail } from './Pages';
import { HomeContentProvider } from './hooks/useHomeContent';
import { ReusableContentProvider } from './hooks/useReusableContent';
import { NewsProvider } from './hooks/useNews';

function App() {
  return (
    <ErrorBoundary>
      {/* Phase D: reusable content blocks load once at the app
          root (single /api/content/blocks request) — any page can
          consume a block with no per-page fetches. */}
      <ReusableContentProvider>
        {/* Phase E: ONE /api/news request at the app root — Navbar
            ticker, Homepage preview and the News page all consume
            the same cached list. One entity, many presentations. */}
        <NewsProvider>
        <Routes>
          <Route element={<Layout />}>
            {/* Phase B: one /api/pages/home request, scoped to the
                Homepage route only — other pages never fetch it. */}
            <Route
              path="/"
              element={
                <HomeContentProvider>
                  <Home />
                </HomeContentProvider>
              }
            />
            <Route path="/about" element={<About />} />
            <Route path="/academics" element={<Academics />} />
            <Route path="/admissions" element={<Admissions />} />
            <Route path="/campus" element={<Campus />} />
            <Route path="/news" element={<News />} />
            <Route path="/news/:slug" element={<NewsDetail />} />
            <Route path="/contact" element={<Contact />} />
          </Route>
        </Routes>
        </NewsProvider>
      </ReusableContentProvider>
    </ErrorBoundary>
  );
}

export default App;
