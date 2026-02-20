/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🛡️ ERROR BOUNDARY — Composant réutilisable pour la gestion des erreurs          ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  - Capture les erreurs React dans les composants enfants                          ║
 * ║  - Affiche un fallback gracieux                                                   ║
 * ║  - Permet la récupération (retry)                                                 ║
 * ║  - Intégration Sentry optionnelle                                                ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback component */
  fallback?: ReactNode;
  /** Custom fallback render function with error info */
  fallbackRender?: (props: FallbackProps) => ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Called when user clicks retry */
  onReset?: () => void;
  /** Component name for error reporting */
  componentName?: string;
  /** Whether to show technical details */
  showDetails?: boolean;
  /** Variant of the error display */
  variant?: 'full' | 'inline' | 'minimal';
  /** Language for error messages */
  language?: 'fr' | 'en';
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface FallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  resetError: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🌍 TRANSLATIONS
// ═══════════════════════════════════════════════════════════════════════════════

const MESSAGES = {
  fr: {
    title: 'Oups, une erreur est survenue',
    titleInline: 'Erreur de chargement',
    description: 'Cette partie de l\'application a rencontré un problème. Vous pouvez essayer de recharger.',
    descriptionInline: 'Ce composant n\'a pas pu se charger correctement.',
    retry: 'Réessayer',
    home: 'Retour à l\'accueil',
    refresh: 'Rafraîchir la page',
    details: 'Détails techniques',
    hideDetails: 'Masquer les détails',
    reportSent: 'Notre équipe a été notifiée du problème.',
  },
  en: {
    title: 'Oops, something went wrong',
    titleInline: 'Loading error',
    description: 'This part of the application encountered a problem. You can try reloading.',
    descriptionInline: 'This component failed to load correctly.',
    retry: 'Retry',
    home: 'Back to home',
    refresh: 'Refresh page',
    details: 'Technical details',
    hideDetails: 'Hide details',
    reportSent: 'Our team has been notified of the issue.',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 FALLBACK COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

interface DefaultFallbackProps extends FallbackProps {
  variant: 'full' | 'inline' | 'minimal';
  language: 'fr' | 'en';
  showDetails: boolean;
  componentName?: string;
}

const DefaultFallback: React.FC<DefaultFallbackProps> = ({
  error,
  errorInfo,
  resetError,
  variant,
  language,
  showDetails,
  componentName,
}) => {
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const t = MESSAGES[language];

  // Minimal variant - just a small error indicator
  if (variant === 'minimal') {
    return (
      <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
        <span className="text-sm text-red-400">{t.titleInline}</span>
        <button
          onClick={resetError}
          className="ml-auto text-xs text-red-400 hover:text-red-300 underline"
        >
          {t.retry}
        </button>
      </div>
    );
  }

  // Inline variant - for component-level errors
  if (variant === 'inline') {
    return (
      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-red-400 mb-1">
              {t.titleInline}
              {componentName && (
                <span className="font-normal text-red-400/70 ml-2">
                  ({componentName})
                </span>
              )}
            </h3>
            <p className="text-xs text-text-secondary mb-3">
              {t.descriptionInline}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={resetError}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {t.retry}
              </button>
              {showDetails && error && (
                <button
                  onClick={() => setDetailsOpen(!detailsOpen)}
                  className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-secondary"
                >
                  {detailsOpen ? (
                    <>
                      <ChevronUp className="w-3 h-3" />
                      {t.hideDetails}
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3" />
                      {t.details}
                    </>
                  )}
                </button>
              )}
            </div>
            {showDetails && detailsOpen && error && (
              <pre className="mt-3 p-2 bg-bg-tertiary rounded text-xs text-red-300 overflow-auto max-h-32">
                {error.message}
                {errorInfo?.componentStack && (
                  <>
                    {'\n\n'}Stack:{'\n'}
                    {errorInfo.componentStack}
                  </>
                )}
              </pre>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Full variant - for page-level errors
  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <AlertTriangle className="w-10 h-10 text-red-400" />
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-text-primary mb-2">
          {t.title}
        </h2>

        {/* Description */}
        <p className="text-text-secondary text-sm mb-6">
          {t.description}
        </p>

        {/* Sentry notification */}
        <p className="text-xs text-text-tertiary mb-6">
          {t.reportSent}
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={resetError}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-accent-primary text-white font-medium rounded-xl hover:bg-accent-hover transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {t.retry}
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-bg-secondary text-text-primary font-medium rounded-xl hover:bg-bg-tertiary transition-colors"
          >
            <Home className="w-4 h-4" />
            {t.home}
          </button>
        </div>

        {/* Technical details (development only or when showDetails is true) */}
        {(showDetails || process.env.NODE_ENV === 'development') && error && (
          <div className="mt-8">
            <button
              onClick={() => setDetailsOpen(!detailsOpen)}
              className="flex items-center justify-center gap-2 mx-auto text-sm text-text-tertiary hover:text-text-secondary"
            >
              {detailsOpen ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  {t.hideDetails}
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  {t.details}
                </>
              )}
            </button>
            {detailsOpen && (
              <div className="mt-4 p-4 bg-red-900/20 rounded-xl text-left overflow-hidden">
                <p className="text-xs font-mono text-red-300 mb-2">
                  {error.name}: {error.message}
                </p>
                {errorInfo?.componentStack && (
                  <pre className="text-xs font-mono text-red-400/70 overflow-auto max-h-48">
                    {errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🛡️ ERROR BOUNDARY CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Call custom error handler
    this.props.onError?.(error, errorInfo);

    // Report to Sentry if available
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        extra: {
          componentStack: errorInfo.componentStack,
          componentName: this.props.componentName,
        },
      });
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error);
      console.error('Component stack:', errorInfo.componentStack);
    }
  }

  resetError = () => {
    this.props.onReset?.();
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    const {
      children,
      fallback,
      fallbackRender,
      variant = 'full',
      language = 'fr',
      showDetails = false,
      componentName,
    } = this.props;

    if (this.state.hasError) {
      // Custom fallback component
      if (fallback) {
        return fallback;
      }

      // Custom fallback render function
      if (fallbackRender) {
        return fallbackRender({
          error: this.state.error,
          errorInfo: this.state.errorInfo,
          resetError: this.resetError,
        });
      }

      // Default fallback
      return (
        <DefaultFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          resetError={this.resetError}
          variant={variant}
          language={language}
          showDetails={showDetails}
          componentName={componentName}
        />
      );
    }

    return children;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎣 HOOK FOR FUNCTIONAL COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook to use error boundary functionality in functional components
 * Note: This doesn't actually catch errors - it's for triggering error state
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const handleError = React.useCallback((err: Error) => {
    setError(err);
  }, []);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  // If there's an error, throw it to be caught by nearest ErrorBoundary
  if (error) {
    throw error;
  }

  return { handleError, resetError };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 HIGHER-ORDER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * HOC to wrap a component with an ErrorBoundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const ComponentWithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary
      componentName={displayName}
      {...errorBoundaryProps}
    >
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;

  return ComponentWithErrorBoundary;
}

export default ErrorBoundary;
