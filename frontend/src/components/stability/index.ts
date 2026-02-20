/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  🛡️ STABILITY COMPONENTS — Exports centralisés                                    ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  Composants pour améliorer la stabilité de l'application:                         ║
 * ║  - ErrorBoundary: Gestion des erreurs React                                       ║
 * ║  - State Components: Loading, Empty, Error states                                 ║
 * ║  - PremiumFeatureGate: Contrôle d'accès aux features premium                     ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

// Error Boundary
export {
  ErrorBoundary,
  useErrorHandler,
  withErrorBoundary,
} from '../ErrorBoundary';
export type { } from '../ErrorBoundary';

// State Components
export {
  LoadingState,
  EmptyState,
  ErrorState,
  ApiErrorDisplay,
} from '../StateComponents';

// Premium Feature Gate
export {
  PremiumFeatureGate,
  useFeatureAccess,
} from '../PremiumFeatureGate';

// Re-export existing stability-related components
export { UpgradePromptModal } from '../UpgradePromptModal';
export { FreeTrialLimitModal } from '../FreeTrialLimitModal';
export { CreditAlert } from '../CreditAlert';
