/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  📊 STATE COMPONENTS — Composants réutilisables pour les états UI                 ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  - LoadingState: États de chargement                                              ║
 * ║  - EmptyState: États vides                                                        ║
 * ║  - ErrorState: États d'erreur (différent de ErrorBoundary)                       ║
 * ║  - ApiErrorDisplay: Affichage d'erreurs API                                       ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import React, { ReactNode } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  X,
  RefreshCw,
  FileQuestion,
  Inbox,
  Search,
  Video,
  MessageSquare,
  History,
  Bookmark,
  FolderOpen,
  Wifi,
  WifiOff,
  Lock,
  CreditCard,
  ArrowRight,
} from 'lucide-react';
import { DeepSightSpinner, DeepSightSpinnerMicro, DeepSightSpinnerSmall } from './ui';
import { ApiError } from '../services/api';

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 LOADING STATE
// ═══════════════════════════════════════════════════════════════════════════════

interface LoadingStateProps {
  /** Loading message */
  message?: string;
  /** Secondary message */
  description?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show spinner */
  showSpinner?: boolean;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Custom icon */
  icon?: ReactNode;
  /** Full page loading */
  fullPage?: boolean;
  /** Language */
  language?: 'fr' | 'en';
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message,
  description,
  size = 'md',
  showSpinner = true,
  progress,
  icon,
  fullPage = false,
  language = 'fr',
}) => {
  const defaultMessage = language === 'fr' ? 'Chargement...' : 'Loading...';
  const displayMessage = message || defaultMessage;

  const sizeClasses = {
    sm: {
      container: 'py-4',
      icon: 'w-6 h-6',
      text: 'text-sm',
      progress: 'h-1.5',
    },
    md: {
      container: 'py-8',
      icon: 'w-8 h-8',
      text: 'text-base',
      progress: 'h-2',
    },
    lg: {
      container: 'py-12',
      icon: 'w-12 h-12',
      text: 'text-lg',
      progress: 'h-3',
    },
  };

  const classes = sizeClasses[size];

  const content = (
    <div className={`flex flex-col items-center justify-center text-center ${classes.container}`}>
      {/* Icon or Spinner */}
      {showSpinner && (
        <div className="mb-4">
          {icon || <DeepSightSpinner size="md" />}
        </div>
      )}

      {/* Message */}
      <p className={`${classes.text} text-text-primary font-medium mb-1`}>
        {displayMessage}
      </p>

      {/* Description */}
      {description && (
        <p className="text-sm text-text-secondary max-w-md">
          {description}
        </p>
      )}

      {/* Progress bar */}
      {progress !== undefined && (
        <div className="w-full max-w-xs mt-4">
          <div className={`${classes.progress} w-full bg-bg-tertiary rounded-full overflow-hidden`}>
            <div
              className={`${classes.progress} bg-accent-primary transition-all duration-300 rounded-full`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <p className="text-xs text-text-tertiary mt-1 tabular-nums">
            {Math.round(progress)}%
          </p>
        </div>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
        {content}
      </div>
    );
  }

  return content;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📭 EMPTY STATE
// ═══════════════════════════════════════════════════════════════════════════════

type EmptyStateType =
  | 'default'
  | 'search'
  | 'videos'
  | 'history'
  | 'favorites'
  | 'chat'
  | 'folder'
  | 'results';

interface EmptyStateProps {
  /** Type of empty state (determines icon) */
  type?: EmptyStateType;
  /** Title */
  title?: string;
  /** Description */
  description?: string;
  /** Custom icon */
  icon?: ReactNode;
  /** Primary action button */
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  /** Secondary action button */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Language */
  language?: 'fr' | 'en';
}

const EMPTY_STATE_ICONS: Record<EmptyStateType, React.ElementType> = {
  default: Inbox,
  search: Search,
  videos: Video,
  history: History,
  favorites: Bookmark,
  chat: MessageSquare,
  folder: FolderOpen,
  results: FileQuestion,
};

const EMPTY_STATE_DEFAULTS: Record<EmptyStateType, { fr: { title: string; description: string }; en: { title: string; description: string } }> = {
  default: {
    fr: { title: 'Rien ici', description: 'Aucun élément à afficher pour le moment.' },
    en: { title: 'Nothing here', description: 'No items to display at the moment.' },
  },
  search: {
    fr: { title: 'Aucun résultat', description: 'Essayez de modifier vos critères de recherche.' },
    en: { title: 'No results', description: 'Try adjusting your search criteria.' },
  },
  videos: {
    fr: { title: 'Aucune vidéo', description: 'Analysez votre première vidéo pour commencer.' },
    en: { title: 'No videos', description: 'Analyze your first video to get started.' },
  },
  history: {
    fr: { title: 'Historique vide', description: 'Vos analyses passées apparaîtront ici.' },
    en: { title: 'Empty history', description: 'Your past analyses will appear here.' },
  },
  favorites: {
    fr: { title: 'Pas de favoris', description: 'Marquez des analyses comme favorites pour les retrouver facilement.' },
    en: { title: 'No favorites', description: 'Mark analyses as favorites to find them easily.' },
  },
  chat: {
    fr: { title: 'Aucun message', description: 'Posez une question pour démarrer la conversation.' },
    en: { title: 'No messages', description: 'Ask a question to start the conversation.' },
  },
  folder: {
    fr: { title: 'Dossier vide', description: 'Ce dossier ne contient aucun élément.' },
    en: { title: 'Empty folder', description: 'This folder contains no items.' },
  },
  results: {
    fr: { title: 'Aucun résultat trouvé', description: 'Nous n\'avons rien trouvé correspondant à votre recherche.' },
    en: { title: 'No results found', description: 'We couldn\'t find anything matching your search.' },
  },
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'default',
  title,
  description,
  icon,
  action,
  secondaryAction,
  size = 'md',
  language = 'fr',
}) => {
  const defaults = EMPTY_STATE_DEFAULTS[type][language];
  const displayTitle = title || defaults.title;
  const displayDescription = description || defaults.description;
  const IconComponent = EMPTY_STATE_ICONS[type];

  const sizeClasses = {
    sm: {
      container: 'py-6',
      iconWrapper: 'w-12 h-12',
      icon: 'w-6 h-6',
      title: 'text-sm',
      description: 'text-xs',
      button: 'px-3 py-1.5 text-xs',
    },
    md: {
      container: 'py-12',
      iconWrapper: 'w-16 h-16',
      icon: 'w-8 h-8',
      title: 'text-base',
      description: 'text-sm',
      button: 'px-4 py-2 text-sm',
    },
    lg: {
      container: 'py-16',
      iconWrapper: 'w-20 h-20',
      icon: 'w-10 h-10',
      title: 'text-lg',
      description: 'text-base',
      button: 'px-5 py-2.5 text-base',
    },
  };

  const classes = sizeClasses[size];

  return (
    <div className={`flex flex-col items-center justify-center text-center ${classes.container}`}>
      {/* Icon */}
      <div className={`${classes.iconWrapper} rounded-2xl bg-bg-tertiary flex items-center justify-center mb-4`}>
        {icon || <IconComponent className={`${classes.icon} text-text-muted`} />}
      </div>

      {/* Title */}
      <h3 className={`${classes.title} font-semibold text-text-primary mb-2`}>
        {displayTitle}
      </h3>

      {/* Description */}
      <p className={`${classes.description} text-text-secondary max-w-sm mb-6`}>
        {displayDescription}
      </p>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {action && (
            <button
              onClick={action.onClick}
              className={`${classes.button} flex items-center gap-2 bg-accent-primary text-white font-medium rounded-xl hover:bg-accent-hover transition-colors`}
            >
              {action.icon}
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className={`${classes.button} text-text-secondary hover:text-text-primary transition-colors`}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ❌ ERROR STATE
// ═══════════════════════════════════════════════════════════════════════════════

type ErrorType = 'default' | 'network' | 'auth' | 'permission' | 'payment' | 'notFound';

interface ErrorStateProps {
  /** Error type */
  type?: ErrorType;
  /** Error title */
  title?: string;
  /** Error message */
  message?: string;
  /** Error object */
  error?: Error | ApiError | null;
  /** Retry handler */
  onRetry?: () => void;
  /** Dismiss handler */
  onDismiss?: () => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show as inline banner or card */
  variant?: 'inline' | 'card' | 'banner';
  /** Language */
  language?: 'fr' | 'en';
}

const ERROR_ICONS: Record<ErrorType, React.ElementType> = {
  default: AlertCircle,
  network: WifiOff,
  auth: Lock,
  permission: Lock,
  payment: CreditCard,
  notFound: FileQuestion,
};

const ERROR_DEFAULTS: Record<ErrorType, { fr: { title: string; message: string }; en: { title: string; message: string } }> = {
  default: {
    fr: { title: 'Une erreur est survenue', message: 'Quelque chose s\'est mal passé. Veuillez réessayer.' },
    en: { title: 'An error occurred', message: 'Something went wrong. Please try again.' },
  },
  network: {
    fr: { title: 'Erreur de connexion', message: 'Impossible de se connecter au serveur. Vérifiez votre connexion internet.' },
    en: { title: 'Connection error', message: 'Unable to connect to server. Check your internet connection.' },
  },
  auth: {
    fr: { title: 'Session expirée', message: 'Veuillez vous reconnecter pour continuer.' },
    en: { title: 'Session expired', message: 'Please log in again to continue.' },
  },
  permission: {
    fr: { title: 'Accès refusé', message: 'Vous n\'avez pas les permissions nécessaires.' },
    en: { title: 'Access denied', message: 'You don\'t have the required permissions.' },
  },
  payment: {
    fr: { title: 'Erreur de paiement', message: 'Le paiement n\'a pas pu être traité.' },
    en: { title: 'Payment error', message: 'Payment could not be processed.' },
  },
  notFound: {
    fr: { title: 'Non trouvé', message: 'La ressource demandée n\'existe pas.' },
    en: { title: 'Not found', message: 'The requested resource does not exist.' },
  },
};

export const ErrorState: React.FC<ErrorStateProps> = ({
  type = 'default',
  title,
  message,
  error,
  onRetry,
  onDismiss,
  size = 'md',
  variant = 'card',
  language = 'fr',
}) => {
  const defaults = ERROR_DEFAULTS[type][language];
  const IconComponent = ERROR_ICONS[type];

  // Determine error message from error object
  const errorMessage = message || (error instanceof ApiError ? error.message : error?.message) || defaults.message;
  const displayTitle = title || defaults.title;

  const retryLabel = language === 'fr' ? 'Réessayer' : 'Retry';

  // Inline banner variant
  if (variant === 'banner') {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
        <span className="flex-1 text-sm text-red-400">{errorMessage}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs text-red-400 hover:text-red-300 font-medium"
          >
            {retryLabel}
          </button>
        )}
        {onDismiss && (
          <button onClick={onDismiss} className="text-red-400 hover:text-red-300">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  // Inline variant
  if (variant === 'inline') {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <IconComponent className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-red-400 mb-1">{displayTitle}</h4>
            <p className="text-sm text-text-secondary">{errorMessage}</p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="mt-3 flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                {retryLabel}
              </button>
            )}
          </div>
          {onDismiss && (
            <button onClick={onDismiss} className="text-text-tertiary hover:text-text-secondary">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Card variant (default)
  const sizeClasses = {
    sm: { container: 'py-6 px-4', icon: 'w-10 h-10', iconInner: 'w-5 h-5', title: 'text-sm', message: 'text-xs' },
    md: { container: 'py-8 px-6', icon: 'w-14 h-14', iconInner: 'w-7 h-7', title: 'text-base', message: 'text-sm' },
    lg: { container: 'py-12 px-8', icon: 'w-16 h-16', iconInner: 'w-8 h-8', title: 'text-lg', message: 'text-base' },
  };

  const classes = sizeClasses[size];

  return (
    <div className={`flex flex-col items-center justify-center text-center ${classes.container}`}>
      <div className={`${classes.icon} rounded-2xl bg-red-500/10 flex items-center justify-center mb-4`}>
        <IconComponent className={`${classes.iconInner} text-red-400`} />
      </div>

      <h3 className={`${classes.title} font-semibold text-text-primary mb-2`}>
        {displayTitle}
      </h3>

      <p className={`${classes.message} text-text-secondary max-w-sm mb-6`}>
        {errorMessage}
      </p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-accent-primary text-white font-medium rounded-xl hover:bg-accent-hover transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          {retryLabel}
        </button>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔌 API ERROR DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════

interface ApiErrorDisplayProps {
  /** The API error */
  error: ApiError | Error | null | undefined;
  /** Retry handler */
  onRetry?: () => void;
  /** Dismiss handler */
  onDismiss?: () => void;
  /** Language */
  language?: 'fr' | 'en';
}

export const ApiErrorDisplay: React.FC<ApiErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  language = 'fr',
}) => {
  if (!error) return null;

  // Determine error type based on status code
  let errorType: ErrorType = 'default';
  let status = 0;

  if (error instanceof ApiError) {
    status = error.status;
    if (status === 0) errorType = 'network';
    else if (status === 401) errorType = 'auth';
    else if (status === 403) errorType = 'permission';
    else if (status === 402) errorType = 'payment';
    else if (status === 404) errorType = 'notFound';
  } else if (error.message.includes('network') || error.message.includes('fetch')) {
    errorType = 'network';
  }

  return (
    <ErrorState
      type={errorType}
      error={error}
      onRetry={onRetry}
      onDismiss={onDismiss}
      variant="inline"
      language={language}
    />
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  LoadingState,
  EmptyState,
  ErrorState,
  ApiErrorDisplay,
};
