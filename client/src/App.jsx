import { Routes, Route } from 'react-router-dom';
import { Layout } from './Components/layout';
import ErrorBoundary from './Components/ui/ErrorBoundary';
import { Home, About, Academics, Admissions, Campus, News, Contact } from './Pages';

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/academics" element={<Academics />} />
          <Route path="/admissions" element={<Admissions />} />
          <Route path="/campus" element={<Campus />} />
          <Route path="/news" element={<News />} />
          <Route path="/contact" element={<Contact />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
