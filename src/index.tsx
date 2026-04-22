
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { UIProvider } from '@/contexts/UIContext';
import { LanguageProvider } from '@/contexts/LanguageContext';

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
