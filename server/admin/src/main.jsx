import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { siteConfig } from '../../../shared/config/siteConfig';
import './index.css';

/* Admin browser title/favicon come from the central branding config
   (shared/config/siteConfig.js → seo.adminTitle + branding.favicon). */
applyAdminBranding();

function applyAdminBranding() {
  document.title = siteConfig.seo.adminTitle;
  const favicon = document.head.querySelector('link[rel="icon"]');
  if (favicon) favicon.setAttribute('href', siteConfig.branding.favicon);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
