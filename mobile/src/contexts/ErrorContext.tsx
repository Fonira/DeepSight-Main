/**
 * ErrorContext - Global error handling context
 *
 * Provides centralized error handling, reporting, and user notifications.
 * Integrates with crash reporting (Sentry) in production.
 */

import React, { createContext, useContext, useCallback, useState, ReactNode } from 'react';
import { ApiError } from '../services/api';

// Error severity levels
export type ErrorSeverity = 'info' | 'warning' | 'error' | 'fatal';

// Error types for categorization
export type ErrorType =
  | 'network'
  | 'auth'
  | 'validation'
  | 'server'
  | 'timeout'
  | 'quota'
  | 'permission'
  | 'unknown';

// Structured error interface
export interface AppError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  code?: string;
  timestamp: Date;
  context?: Record<string, unknown>;
  originalError?: Error;
}

// Error context interface
interface ErrorContextType {
  lastError: AppError | null;
  errorHistory: AppError[];
  handleError: (error: unknown, context?: Record<string, unknown>) => AppError;
  clearError: () => void;
  clearHistory: () => void;
  reportError: (error: AppError) => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

// Error message translations (French)
const ERROR_MESSAGES: Record<ErrorType, Record<string, string>> = {
  network: {
    default: 'Erreur de connexion. Vérifiez votre connexion internet.',
    offline: 'Vous êtes hors ligne. Les données seront synchronisées à la reconnexion.',
  },
  auth: {
    default: 'Erreur d\'authentification. Veuillez vous reconnecter.',
    expired: 'Votre session a expiré. Veuillez vous reconnecter.',
    invalid: 'Identifiants invalides.',
  },
  validation: {
    default: 'Les données fournies sont invalides.',
  },
  server: {
    default: 'Erreur serveur. Veuillez réessayer plus tard.',
    maintenance: 'Service en maintenance. Réessayez dans quelques minutes.',
  },
  timeout: {
    default: 'La requête a pris trop de temps. Veuillez réessayer.',
  },
  quota: {
    default: 'Vous avez atteint votre limite. Passez à un forfait supérieur.',
    credits: 'Plus de crédits disponibles. Attendez le renouvellement ou upgradez.',
    analyses: 'Nombre maximum d\'analyses atteint ce mois-ci.',
  },
  permission: {
    default: 'Vous n\'avez pas accès à cette fonctionnalité.',
    plan: 'Cette fonctionnalité nécessite un forfait supérieur.',
  },
  unknown: {
    default: 'Une erreur inattendue s\'est produite.',
  },
};

// Categorize error from API error or generic error
function categorizeError(error: unknown): { type: ErrorType; severity: ErrorSeverity; code?: string } {
  if (error instanceof ApiError) {
    const { status, code } = error;

    // Network errors
    if (status === 0 || code === 'NETWORK_ERROR') {
      return { type: 'network', severity: 'warning', code };
    }

    // Timeout
    if (status === 408 || code === 'TIMEOUT') {
      return { type: 'timeout', severity: 'warning', code };
    }

    // Auth errors
    if (status === 401 || code === 'SESSION_EXPIRED' || code === 'UNAUTHORIZED') {
      return { type: 'auth', severity: 'error', code };
    }

    // Forbidden / Permission
    if (status === 403) {
      if (code === 'QUOTA_EXCEEDED' || code === 'CREDITS_EXHAUSTED') {
        return { type: 'quota', severity: 'warning', code };
      }
      if (code === 'PLAN_REQUIRED' || code === 'FEATURE_LOCKED') {
        return { type: 'permission', severity: 'info', code };
      }
      return { type: 'permission', severity: 'warning', code };
    }

    // Validation errors
    if (status === 400 || status === 422) {
      return { type: 'validation', severity: 'warning', code };
    }

    // Server errors
    if (status >= 500) {
      return { type: 'server', severity: 'error', code };
    }

    // Rate limiting
    if (status === 429) {
      return { type: 'quota', severity: 'warning', code: 'RATE_LIMITED' };
    }
  }

  return { type: 'unknown', severity: 'error' };
}

// Get user-friendly message
function getUserMessage(type: ErrorType, code?: string): string {
  const messages = ERROR_MESSAGES[type];
  if (code && messages[code]) {
    return messages[code];
  }
  return messages.default;
}

// Generate unique error ID
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Provider component
export const ErrorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [lastError, setLastError] = useState<AppError | null>(null);
  const [errorHistory, setErrorHistory] = useState<AppError[]>([]);

  // Report error to monitoring service (Sentry in production)
  const reportError = useCallback((appError: AppError) => {
    // Log in development
    if (__DEV__) {
      console.error('[ErrorContext]', {
        type: appError.type,
        severity: appError.severity,
        message: appError.message,
        code: appError.code,
        context: appError.context,
      });
    }

    // In production, this would send to Sentry
    // Sentry integration is set up separately
  }, []);

  // Main error handler
  const handleError = useCallback((error: unknown, context?: Record<string, unknown>): AppError => {
    const { type, severity, code } = categorizeError(error);

    const originalMessage = error instanceof Error ? error.message : String(error);
    const userMessage = getUserMessage(type, code);

    const appError: AppError = {
      id: generateErrorId(),
      type,
      severity,
      message: originalMessage,
      userMessage,
      code,
      timestamp: new Date(),
      context,
      originalError: error instanceof Error ? error : undefined,
    };

    // Update state
    setLastError(appError);
    setErrorHistory(prev => [appError, ...prev].slice(0, 50)); // Keep last 50 errors

    // Report to monitoring
    reportError(appError);

    return appError;
  }, [reportError]);

  // Clear current error
  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  // Clear error history
  const clearHistory = useCallback(() => {
    setErrorHistory([]);
  }, []);

  return (
    <ErrorContext.Provider
      value={{
        lastError,
        errorHistory,
        handleError,
        clearError,
        clearHistory,
        reportError,
      }}
    >
      {children}
    </ErrorContext.Provider>
  );
};

// Hook to use error context
export const useError = (): ErrorContextType => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within ErrorProvider');
  }
  return context;
};

// Hook for simple error handling with toast
export const useErrorHandler = () => {
  const { handleError } = useError();

  return useCallback(
    (error: unknown, context?: Record<string, unknown>) => {
      const appError = handleError(error, context);
      return appError.userMessage;
    },
    [handleError]
  );
};

export default ErrorContext;
