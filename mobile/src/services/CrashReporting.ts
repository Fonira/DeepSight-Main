/**
 * CrashReporting - Centralized crash and error reporting service
 *
 * This module provides a unified interface for crash reporting.
 * In production, it integrates with Sentry. In development, it logs to console.
 *
 * To enable Sentry in production:
 * 1. Install: npx expo install @sentry/react-native
 * 2. Add SENTRY_DSN to app.json extra config
 * 3. Run: npx sentry-expo-upload-sourcemaps
 */

import Constants from 'expo-constants';

// Error severity levels for reporting
export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

// User context for error reports
export interface UserContext {
  id?: string | number;
  email?: string;
  username?: string;
  plan?: string;
}

// Breadcrumb for tracking user actions
export interface Breadcrumb {
  message: string;
  category?: string;
  level?: ErrorSeverity;
  data?: Record<string, unknown>;
  timestamp?: number;
}

// Error context for additional metadata
export interface ErrorContext {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  fingerprint?: string[];
}

// Configuration
interface CrashReportingConfig {
  dsn?: string;
  environment: string;
  release: string;
  enabled: boolean;
  debug: boolean;
  sampleRate: number;
}

// Default configuration
const defaultConfig: CrashReportingConfig = {
  dsn: Constants.expoConfig?.extra?.sentryDsn,
  environment: __DEV__ ? 'development' : 'production',
  release: `${Constants.expoConfig?.name}@${Constants.expoConfig?.version}`,
  enabled: !__DEV__, // Disabled in development by default
  debug: __DEV__,
  sampleRate: __DEV__ ? 1.0 : 0.1, // 10% sampling in production
};

// Sentry module type (simplified for optional dependency)
interface SentryModule {
  init: (options: Record<string, unknown>) => void;
  captureException: (error: Error, options?: Record<string, unknown>) => string;
  captureMessage: (message: string, options?: Record<string, unknown>) => string;
  setUser: (user: Record<string, unknown> | null) => void;
  setTag: (key: string, value: string) => void;
  setExtra: (key: string, value: unknown) => void;
  addBreadcrumb: (breadcrumb: Record<string, unknown>) => void;
  startTransaction?: (options: { name: string; op: string }) => { finish: () => void };
  withErrorBoundary?: <P extends object>(
    component: React.ComponentType<P>,
    options?: { fallback?: React.ReactNode }
  ) => React.ComponentType<P>;
}

// Sentry instance (lazy loaded)
let Sentry: SentryModule | null = null;
let isInitialized = false;

/**
 * Initialize crash reporting
 */
export async function initCrashReporting(
  config: Partial<CrashReportingConfig> = {}
): Promise<void> {
  if (isInitialized) return;

  const finalConfig = { ...defaultConfig, ...config };

  // Skip if disabled or no DSN
  if (!finalConfig.enabled) {
    console.log('[CrashReporting] Disabled (development mode)');
    isInitialized = true;
    return;
  }

  if (!finalConfig.dsn) {
    console.warn('[CrashReporting] No DSN configured - crash reporting disabled');
    isInitialized = true;
    return;
  }

  try {
    // Try to import Sentry (optional dependency)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sentryModule = require('@sentry/react-native');
    Sentry = sentryModule as SentryModule;

    Sentry.init({
      dsn: finalConfig.dsn,
      environment: finalConfig.environment,
      release: finalConfig.release,
      debug: finalConfig.debug,
      sampleRate: finalConfig.sampleRate,
      // Performance monitoring (optional)
      tracesSampleRate: finalConfig.debug ? 1.0 : 0.1,
      // Attach stack traces to all messages
      attachStacktrace: true,
      // Enable native crash reporting
      enableNative: true,
      // Enable auto session tracking
      enableAutoSessionTracking: true,
      // Session close timeout (in seconds)
      sessionTrackingIntervalMillis: 30000,
      // Integrations configuration
      integrations: (defaultIntegrations: any[]) => {
        return defaultIntegrations.filter(
          // Filter out integrations that cause issues with Expo
          (integration: any) => integration.name !== 'ReactNativeTracing'
        );
      },
    });

    isInitialized = true;
    console.log('[CrashReporting] Initialized successfully');
  } catch (error) {
    // Sentry not installed - use fallback
    console.log('[CrashReporting] Sentry not available, using fallback logger');
    isInitialized = true;
  }
}

/**
 * Capture an exception
 */
export function captureException(
  error: Error | unknown,
  context?: ErrorContext
): string {
  const errorObj = error instanceof Error ? error : new Error(String(error));

  // Always log in development
  if (__DEV__) {
    console.error('[CrashReporting] Exception:', errorObj);
    if (context) {
      console.error('[CrashReporting] Context:', context);
    }
  }

  // Send to Sentry if available
  if (Sentry && isInitialized) {
    return Sentry.captureException(errorObj, {
      tags: context?.tags,
      extra: context?.extra,
      fingerprint: context?.fingerprint,
    });
  }

  return `local_${Date.now()}`;
}

/**
 * Capture a message
 */
export function captureMessage(
  message: string,
  severity: ErrorSeverity = 'info',
  context?: ErrorContext
): string {
  // Always log in development
  if (__DEV__) {
    const logFn = severity === 'error' || severity === 'fatal' ? console.error :
                  severity === 'warning' ? console.warn : console.log;
    logFn(`[CrashReporting] ${severity.toUpperCase()}: ${message}`);
  }

  // Send to Sentry if available
  if (Sentry && isInitialized) {
    return Sentry.captureMessage(message, {
      level: mapSeverityToSentryLevel(severity),
      tags: context?.tags,
      extra: context?.extra,
    });
  }

  return `local_${Date.now()}`;
}

/**
 * Set user context for error reports
 */
export function setUser(user: UserContext | null): void {
  if (__DEV__) {
    console.log('[CrashReporting] Set user:', user);
  }

  if (Sentry && isInitialized) {
    if (user) {
      Sentry.setUser({
        id: user.id?.toString(),
        email: user.email,
        username: user.username,
      });
      if (user.plan) {
        Sentry.setTag('plan', user.plan);
      }
    } else {
      Sentry.setUser(null);
    }
  }
}

/**
 * Set a tag for error context
 */
export function setTag(key: string, value: string): void {
  if (Sentry && isInitialized) {
    Sentry.setTag(key, value);
  }
}

/**
 * Set extra context data
 */
export function setExtra(key: string, value: unknown): void {
  if (Sentry && isInitialized) {
    Sentry.setExtra(key, value);
  }
}

/**
 * Add a breadcrumb for tracking user actions
 */
export function addBreadcrumb(breadcrumb: Breadcrumb): void {
  if (__DEV__) {
    console.log('[CrashReporting] Breadcrumb:', breadcrumb.message);
  }

  if (Sentry && isInitialized) {
    Sentry.addBreadcrumb({
      message: breadcrumb.message,
      category: breadcrumb.category,
      level: breadcrumb.level,
      data: breadcrumb.data,
      timestamp: breadcrumb.timestamp || Date.now() / 1000,
    });
  }
}

/**
 * Start a performance transaction
 */
export function startTransaction(
  name: string,
  op: string
): { finish: () => void } | null {
  if (Sentry && isInitialized && Sentry.startTransaction) {
    const transaction = Sentry.startTransaction({ name, op });
    return {
      finish: () => transaction.finish(),
    };
  }
  return null;
}

/**
 * Wrap a component with Sentry error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ReactNode
): React.ComponentType<P> {
  if (Sentry && Sentry.withErrorBoundary) {
    return Sentry.withErrorBoundary(Component, {
      fallback: fallback || undefined,
    });
  }
  return Component;
}

/**
 * Map severity to Sentry level
 */
function mapSeverityToSentryLevel(severity: ErrorSeverity): any {
  switch (severity) {
    case 'fatal':
      return 'fatal';
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
    case 'debug':
      return 'debug';
    default:
      return 'info';
  }
}

/**
 * React hook for crash reporting
 */
export function useCrashReporting() {
  return {
    captureException,
    captureMessage,
    setUser,
    setTag,
    setExtra,
    addBreadcrumb,
  };
}

// Export default interface
export default {
  init: initCrashReporting,
  captureException,
  captureMessage,
  setUser,
  setTag,
  setExtra,
  addBreadcrumb,
  startTransaction,
  withErrorBoundary,
};
