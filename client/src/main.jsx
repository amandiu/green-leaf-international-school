import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { applyBranding } from './utils/branding';
import './index.css';

/* Browser title, favicon and Open Graph metadata come from the
   central branding config (shared/config/siteConfig.js). */
applyBranding();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
