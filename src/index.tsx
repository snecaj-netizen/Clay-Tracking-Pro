
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { UIProvider } from '../contexts/UIContext';
import { LanguageProvider } from '../contexts/LanguageContext';

// Forcefully unregister any leftover service workers to prevent block/stale cache issues in development
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().then((success) => {
        if (success) {
          console.log('Cleared service worker cache registration:', registration);
        }
      });
    }
  }).catch((err) => {
    console.error('SW registration error:', err);
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <UIProvider>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </UIProvider>
  </React.StrictMode>
);
