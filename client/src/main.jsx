import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { applyBranding } from './utils/branding';
import { SettingsProvider } from './context/SettingsContext';
import './index.css';

/* Immediate first-paint branding from the central siteConfig —
   the SettingsProvider later overlays the DB-backed values from
   GET /api/settings (SettingsHeadSync re-applies them). If the
   API is down, these siteConfig values simply stay. */
applyBranding();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SettingsProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </SettingsProvider>
  </React.StrictMode>
);
