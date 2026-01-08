/**
 * 🔍 SENTRY CONFIGURATION — Error Monitoring for Deep Sight
 * ═══════════════════════════════════════════════════════════════════════════════
 * Configuration Sentry pour le monitoring des erreurs frontend
 * 
 * Pour activer Sentry:
 * 1. Créer un compte sur https://sentry.io
 * 2. Créer un projet React
 * 3. Copier le DSN
 * 4. Ajouter VITE_SENTRY_DSN dans les variables d'environnement Vercel
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import * as Sentry from '@sentry/react';

// Configuration
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';
const ENVIRONMENT = import.meta.env.VITE_ENVIRONMENT || 'development';
const APP_VERSION = '1.0.0';

// Flag pour savoir si Sentry est activé
export const isSentryEnabled = !!SENTRY_DSN;

/**
 * Initialise Sentry pour le monitoring des erreurs
 */
export function initSentry(): void {
  if (!SENTRY_DSN) {
    console.log('ℹ️ Sentry DSN not configured, monitoring disabled');
    return;
  }

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: ENVIRONMENT,
      release: `deepsight-frontend@${APP_VERSION}`,
      
      // Intégrations
      integrations: [
        // Capture automatique des erreurs React
        Sentry.browserTracingIntegration(),
        // Replay des sessions (optionnel, consomme du quota)
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      
      // Échantillonnage
      tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      
      // Ne pas envoyer les données personnelles
      sendDefaultPii: false,
      
      // Filtrer certaines erreurs
      beforeSend(event, hint) {
        const error = hint.originalException;
        
        // Ignorer les erreurs réseau courantes
        if (error instanceof Error) {
          const message = error.message.toLowerCase();
          if (
            message.includes('network error') ||
            message.includes('failed to fetch') ||
            message.includes('load failed') ||
            message.includes('cancelled')
          ) {
            return null;
          }
        }
        
        // Ignorer les erreurs 401/403 (pas des bugs)
        if (event.exception?.values?.[0]?.value?.includes('401') ||
            event.exception?.values?.[0]?.value?.includes('403')) {
          return null;
        }
        
        return event;
      },
      
      // Ignorer certaines URLs
      denyUrls: [
        // Extensions Chrome
        /extensions\//i,
        /^chrome:\/\//i,
        /^chrome-extension:\/\//i,
        // Firefox extensions
        /^moz-extension:\/\//i,
      ],
    });

    console.log(`🔍 Sentry initialized (env: ${ENVIRONMENT})`);
  } catch (error) {
    console.error('❌ Failed to initialize Sentry:', error);
  }
}

/**
 * Capture une erreur manuellement
 */
export function captureError(error: Error, context?: Record<string, unknown>): void {
  if (!isSentryEnabled) {
    console.error('Error (Sentry disabled):', error, context);
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
}

/**
 * Capture un message (pour le logging)
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
  if (!isSentryEnabled) {
    console.log(`[${level}] ${message}`);
    return;
  }

  Sentry.captureMessage(message, level);
}

/**
 * Définit l'utilisateur actuel pour le contexte Sentry
 */
export function setUser(user: { id: number; email: string; plan?: string } | null): void {
  if (!isSentryEnabled) return;

  if (user) {
    Sentry.setUser({
      id: String(user.id),
      email: user.email,
      // Custom data
      plan: user.plan || 'free',
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Ajoute un breadcrumb (fil d'Ariane pour le debug)
 */
export function addBreadcrumb(
  message: string,
  category: string = 'user-action',
  data?: Record<string, unknown>
): void {
  if (!isSentryEnabled) return;

  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
}

/**
 * Wrapper pour les composants React avec Error Boundary Sentry
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

/**
 * HOC pour wrapper un composant avec Sentry profiling
 */
export const withSentryProfiler = Sentry.withProfiler;

// Export Sentry pour usage avancé
export { Sentry };
