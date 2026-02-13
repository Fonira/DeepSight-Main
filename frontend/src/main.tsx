import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './contexts/ThemeContext';

// 🔍 Initialisation Sentry (monitoring des erreurs)
import { initSentry, SentryErrorBoundary, isSentryEnabled } from './lib/sentry';
initSentry();

document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') document.body.classList.add('user-is-tabbing');
});
document.addEventListener('mousedown', () => {
  document.body.classList.remove('user-is-tabbing');
});

// Composant de fallback en cas d'erreur critique
const ErrorFallback = () => (
  <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 max-w-md text-center">
      <h1 className="text-2xl font-bold text-red-400 mb-4">😵 Oups !</h1>
      <p className="text-white/80 mb-6">
        Une erreur inattendue s'est produite. Notre équipe a été notifiée.
      </p>
      <button 
        onClick={() => window.location.reload()} 
        className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors"
      >
        Recharger la page
      </button>
    </div>
  </div>
);

// Render avec ou sans Sentry Error Boundary
const AppWithErrorBoundary = isSentryEnabled ? (
  <HelmetProvider>
    <SentryErrorBoundary fallback={<ErrorFallback />} showDialog>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </SentryErrorBoundary>
  </HelmetProvider>
) : (
  <HelmetProvider>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </HelmetProvider>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {AppWithErrorBoundary}
  </StrictMode>
);
