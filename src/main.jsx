import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import { initSentry } from './lib/monitoring';

// No-op until VITE_SENTRY_DSN is set (see .env.example) — safe to leave in
// place for every environment.
initSentry();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
