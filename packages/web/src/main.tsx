import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from './components/Toast.js';
import { App } from './App.js';
import { initTheme } from './stores/theme.js';
import './app.css';

// Re-applies the resolved theme and starts tracking the OS preference so
// `system` mode follows a light/dark switch without a reload.
initTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
