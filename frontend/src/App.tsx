/**
 * ╔════════════════════════════════════════════════════════════════════════════════════╗
 * ║  DEEP SIGHT v7.0 — App Entry Point Optimisé                                        ║
 * ╠════════════════════════════════════════════════════════════════════════════════════╣
 * ║  🆕 v7.0: Lazy Loading + Error Boundaries + Prefetching intelligent               ║
 * ║  • -40% taille bundle initial                                                     ║
 * ║  • Chargement des pages à la demande                                              ║
 * ║  • Skeletons pendant le chargement                                                ║
 * ║  • Récupération gracieuse des erreurs                                             ║
 * ╚════════════════════════════════════════════════════════════════════════════════════╝
 */

import {
  Suspense,
  lazy,
  useEffect,
  useRef,
  useState,
  ReactNode,
  Component,
  ErrorInfo,
} from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "./hooks/useAuth";
import { AuthProvider } from "./contexts/AuthContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { LoadingWordProvider } from "./contexts/LoadingWordContext";
import { TTSProvider } from "./contexts/TTSContext";
import { PrivateRoute } from "./components/PrivateRoute";
import { AmbientLightLayer } from "./components/AmbientLightLayer";
import { SunflowerLayer } from "./components/SunflowerLayer";
import { AmbientLightingProvider } from "./contexts/AmbientLightingContext";
import { SkipLink } from "./components/SkipLink";
import { SEO } from "./components/SEO";

// "Le Saviez-Vous" widgets remplacés par placements organiques dans chaque page
import { ErrorBoundary as RouteErrorBoundary } from "./components/ErrorBoundary";
import { CrispChat } from "./components/CrispChat";
import { CookieBanner } from "./components/CookieBanner";
import { UpgradeModal } from "./components/UpgradeModal";
import { VoicePrefsStagingProvider } from "./components/voice/staging/VoicePrefsStagingProvider";
import { StagedPrefsToolbar } from "./components/voice/staging/StagedPrefsToolbar";
import { OnboardingFlow } from "./components/onboarding/OnboardingFlow";
import { Tutor } from "./components/Tutor";
import { analytics } from "./services/analytics";
import { DeepSightSpinner } from "./components/ui/DeepSightSpinner";

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 QUERY CLIENT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes (anciennement cacheTime)
      retry: (failureCount, error: any) => {
        // Ne pas réessayer les erreurs 4xx (sauf 429)
        if (
          error?.status >= 400 &&
          error?.status < 500 &&
          error?.status !== 429
        ) {
          return false;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 SKELETON COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

interface SkeletonProps {
  variant?: "full" | "dashboard" | "simple" | "form";
}

const PageSkeleton = ({ variant = "full" }: SkeletonProps) => {
  const baseClass = "animate-pulse bg-bg-secondary/50 rounded-lg";

  if (variant === "dashboard") {
    return (
      <div className="min-h-screen bg-bg-primary p-4 md:p-8">
        {/* Header skeleton */}
        <div className="flex items-center justify-between mb-8">
          <div className={`${baseClass} h-10 w-48`} />
          <div className={`${baseClass} h-10 w-32`} />
        </div>

        {/* Main input area */}
        <div className={`${baseClass} h-40 w-full max-w-3xl mx-auto mb-8`} />

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {[...Array(6)].map((_, i) => (
            <div key={i} className={`${baseClass} h-48`} />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "simple") {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="w-full max-w-md p-8">
          <div className={`${baseClass} h-12 w-48 mx-auto mb-8`} />
          <div className={`${baseClass} h-64 w-full`} />
        </div>
      </div>
    );
  }

  if (variant === "form") {
    return (
      <div className="min-h-screen bg-bg-primary p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <div className={`${baseClass} h-10 w-64 mb-8`} />
          {[...Array(5)].map((_, i) => (
            <div key={i} className={`${baseClass} h-16 w-full mb-4`} />
          ))}
          <div className={`${baseClass} h-12 w-32 mt-8`} />
        </div>
      </div>
    );
  }

  // Full page skeleton (default)
  return (
    <div className="min-h-screen bg-bg-primary p-4 md:p-8">
      <div className={`${baseClass} h-16 w-full mb-8`} />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className={`${baseClass} h-96 lg:col-span-1`} />
        <div className={`${baseClass} h-96 lg:col-span-3`} />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🛡️ ERROR BOUNDARY
// ═══════════════════════════════════════════════════════════════════════════════

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);

    // Reporter à Sentry
    import("./lib/sentry").then(({ captureError }) => {
      captureError(error, { componentStack: errorInfo.componentStack });
    });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">😵</div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">
              Oups, quelque chose s'est mal passé
            </h1>
            <p className="text-text-secondary mb-6">
              Une erreur inattendue s'est produite. Essayez de rafraîchir la
              page.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-accent-primary text-gray-900 rounded-lg hover:bg-accent-hover transition-colors"
              >
                Rafraîchir
              </button>
              <button
                onClick={() => (window.location.href = "/")}
                className="px-6 py-3 bg-bg-secondary text-text-primary rounded-lg hover:bg-bg-tertiary transition-colors"
              >
                Retour à l'accueil
              </button>
            </div>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="mt-8 text-left bg-red-900/20 p-4 rounded-lg">
                <summary className="cursor-pointer text-red-400">
                  Détails de l'erreur
                </summary>
                <pre className="mt-2 text-xs text-red-300 overflow-auto">
                  {this.state.error.toString()}
                  {"\n\n"}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 📦 LAZY LOADED PAGES — avec retry automatique pour éviter les crashes
//    après déploiement (chunks obsolètes sur Safari/mobile)
// ═══════════════════════════════════════════════════════════════════════════════

function lazyWithRetry(importFn: () => Promise<any>) {
  return lazy(() =>
    importFn().catch((error: any) => {
      // Chunk loading failure after deployment — reload page once
      const isChunkError =
        error?.message?.includes(
          "Failed to fetch dynamically imported module",
        ) ||
        error?.message?.includes("Loading chunk") ||
        error?.message?.includes("Loading CSS chunk") ||
        error?.message?.includes("Unable to preload CSS") ||
        error?.name === "ChunkLoadError" ||
        error?.message?.includes("error loading dynamically imported module");

      if (isChunkError) {
        const RELOAD_KEY = "chunk_reload_ts";
        try {
          const lastReload = sessionStorage.getItem(RELOAD_KEY);
          const now = Date.now();
          // Only auto-reload once per 30 seconds to prevent infinite loop
          if (!lastReload || now - parseInt(lastReload) > 30000) {
            sessionStorage.setItem(RELOAD_KEY, now.toString());
            window.location.reload();
            return new Promise(() => {}); // Never resolves — page is reloading
          }
        } catch {
          // sessionStorage unavailable (Safari private) — try reload once via URL param
          if (!window.location.search.includes("_cr=1")) {
            const sep = window.location.search ? "&" : "?";
            window.location.href = window.location.href + sep + "_cr=1";
            return new Promise(() => {});
          }
        }
      }
      throw error;
    }),
  );
}

// Pages publiques
const LandingPage = lazyWithRetry(() => import("./pages/LandingPage"));
const Login = lazyWithRetry(() => import("./pages/Login"));
const ForgotPassword = lazyWithRetry(() => import("./pages/ForgotPassword"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const ChangePassword = lazyWithRetry(() => import("./pages/ChangePassword"));
const AuthCallback = lazyWithRetry(() => import("./pages/AuthCallback"));
const LegalPage = lazyWithRetry(() => import("./pages/LegalPage"));
const LegalCGU = lazyWithRetry(() => import("./pages/LegalCGU"));
const LegalCGV = lazyWithRetry(() => import("./pages/LegalCGV"));
const PaymentSuccess = lazyWithRetry(() => import("./pages/PaymentSuccess"));
const PaymentCancel = lazyWithRetry(() => import("./pages/PaymentCancel"));
const StatusPage = lazyWithRetry(() => import("./pages/StatusPage"));
const ContactPage = lazyWithRetry(() => import("./pages/ContactPage"));
const AboutPage = lazyWithRetry(() => import("./pages/AboutPage"));
const SharedAnalysisPage = lazyWithRetry(
  () => import("./pages/SharedAnalysisPage"),
);

// Pages protégées
const DashboardPageLegacy = lazyWithRetry(
  () => import("./pages/DashboardPageLegacy"),
);
const DashboardPageMinimal = lazyWithRetry(
  () => import("./pages/DashboardPageMinimal"),
);
const PlaylistPage = lazyWithRetry(() => import("./pages/PlaylistPage"));
const PlaylistDetailPage = lazyWithRetry(
  () => import("./pages/PlaylistDetailPage"),
);
const History = lazyWithRetry(() => import("./pages/History"));
const UpgradePage = lazyWithRetry(() => import("./pages/UpgradePage"));
const Settings = lazyWithRetry(() => import("./pages/Settings"));
const MyAccount = lazyWithRetry(() => import("./pages/MyAccount"));
const AdminPage = lazyWithRetry(() => import("./pages/AdminPage"));
const UsageDashboard = lazyWithRetry(() => import("./pages/UsageDashboard"));
const AnalyticsPage = lazyWithRetry(() => import("./pages/AnalyticsPage"));
const StudyPage = lazyWithRetry(() => import("./pages/StudyPage"));
const StudyHubPage = lazyWithRetry(() => import("./pages/StudyHubPage"));
const HubPage = lazyWithRetry(() => import("./pages/HubPage"));
const DebatePage = lazyWithRetry(() => import("./pages/DebatePage"));
const NotFoundPage = lazyWithRetry(() => import("./pages/NotFoundPage"));
const ExtensionWelcomePage = lazyWithRetry(
  () => import("./pages/ExtensionWelcomePage"),
);
const PrivacyPolicy = lazyWithRetry(() => import("./pages/PrivacyPolicy"));
const ApiDocsPage = lazyWithRetry(() => import("./pages/ApiDocsPage"));

// ═══════════════════════════════════════════════════════════════════════════════
// 🔮 PREFETCH CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const PREFETCH_MAP: Record<string, string[]> = {
  "/": ["/dashboard", "/login"],
  "/login": ["/dashboard"],
  "/dashboard": [
    "/history",
    "/settings",
    "/debate",
    "/analytics",
    "/hub",
    "/chat",
    "/voice-call",
    "/study",
    "/about",
  ],
  "/history": ["/dashboard", "/analytics"],
  "/settings": ["/account"],
  "/debate": ["/dashboard", "/history"],
  "/upgrade": ["/dashboard", "/payment/success"],
  "/analytics": ["/dashboard", "/history"],
};

const PAGE_LOADERS: Record<string, () => Promise<any>> = {
  "/dashboard": () => import("./pages/DashboardPageMinimal"),
  "/history": () => import("./pages/History"),
  "/settings": () => import("./pages/Settings"),
  "/debate": () => import("./pages/DebatePage"),
  "/account": () => import("./pages/MyAccount"),
  "/login": () => import("./pages/Login"),
  "/upgrade": () => import("./pages/UpgradePage"),
  "/payment/success": () => import("./pages/PaymentSuccess"),
  "/analytics": () => import("./pages/AnalyticsPage"),
  "/chat": () => import("./pages/ChatPage"),
  "/voice-call": () => import("./pages/VoiceCallPage"),
  "/hub": () => import("./pages/HubPage"),
  "/study": () => import("./pages/StudyHubPage"),
  "/about": () => import("./pages/AboutPage"),
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 ROUTE PREFETCHER
// ═══════════════════════════════════════════════════════════════════════════════

const RoutePrefetcher = () => {
  const location = useLocation();
  const prefetchedRef = useRef<Set<string>>(new Set());

  // 📊 PostHog pageview tracking (SPA)
  useEffect(() => {
    analytics.pageview(window.location.href);
  }, [location.pathname]);

  useEffect(() => {
    const currentPath = location.pathname;
    const routesToPrefetch = PREFETCH_MAP[currentPath] || [];

    // Précharger après un délai pour ne pas impacter le chargement initial
    const timeoutId = setTimeout(() => {
      routesToPrefetch.forEach((route) => {
        if (!prefetchedRef.current.has(route) && PAGE_LOADERS[route]) {
          prefetchedRef.current.add(route);
          PAGE_LOADERS[route]().catch(() => {
            // Ignorer les erreurs de prefetch
          });
        }
      });
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [location.pathname]);

  return null;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🏠 HOME ROUTE
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// 📊 DASHBOARD ROUTE — minimal landing par défaut, legacy via opt-out
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Bascule entre `DashboardPageMinimal` (default depuis 2026-04-30) et
 * `DashboardPageLegacy` (1781 lignes : analyse + chat + voice + AnalysisHub).
 * Opt-out légacy via :
 *   - URL : `?legacy=1`
 *   - localStorage : `ds_hub_legacy_home=1`
 */
const DashboardRoute: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const useLegacy =
    params.get("legacy") === "1" ||
    (typeof window !== "undefined" &&
      window.localStorage.getItem("ds_hub_legacy_home") === "1");
  return useLegacy ? <DashboardPageLegacy /> : <DashboardPageMinimal />;
};

const HomeRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        className="min-h-screen bg-bg-primary flex items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-4">
          <DeepSightSpinner size="lg" />
          <span className="text-text-secondary">Chargement...</span>
        </div>
      </div>
    );
  }

  return user ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <RouteErrorBoundary variant="full" componentName="LandingPage">
      <Suspense fallback={<PageSkeleton variant="full" />}>
        <LandingPage />
      </Suspense>
    </RouteErrorBoundary>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🔒 PROTECTED LAYOUT
// ═══════════════════════════════════════════════════════════════════════════════

const ProtectedLayout = () => {
  const { user } = useAuth();
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  // Décision DB-3 (RELEASE-ORCHESTRATION L.562) : show pour anciens users sans flag
  // → tous les users dont preferences.has_completed_onboarding !== true voient le flow.
  const shouldShowOnboarding =
    user !== null &&
    user !== undefined &&
    user.preferences?.has_completed_onboarding !== true &&
    !onboardingDismissed;

  // noindex sur toutes les routes protégées (dashboard, history, settings, etc.)
  return (
    <>
      <SEO noindex />
      <Outlet />
      {shouldShowOnboarding && (
        <OnboardingFlow onComplete={() => setOnboardingDismissed(true)} />
      )}
      {/* 🎓 Le Tuteur — compagnon d'apprentissage (remplace DidYouKnowCard) */}
      {/* Le composant fait son propre check isAuthenticated + currentWord (early return null) */}
      <Tutor />
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🌅 AMBIENT LIGHTING — read user preference (default ON)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Read the ambient lighting preference from localStorage. Default: enabled.
 * The preference is also synced to the backend via /api/auth/preferences when
 * the user toggles it from Settings.
 */
function getAmbientLightingEnabled(): boolean {
  try {
    const raw = localStorage.getItem("ambient_lighting_enabled");
    if (raw === null || raw === undefined) return true;
    return raw !== "false";
  } catch {
    return true;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🌅 ROUTER-AWARE AMBIENT LIGHT — gated to showcase routes only
// ═══════════════════════════════════════════════════════════════════════════════

// AmbientLight v3 affiché sur TOUTES les routes (signature visuelle DeepSight,
// le rayon de soleil + tournesol héliotrope sont une marque de fabrique
// présente partout, plus juste sur les routes vitrines).
// Routes où l'ambient lighting (beam + halo) est masqué pour ne pas alourdir
// l'interface — les vues conversationnelles (Hub) ont déjà leur propre ambiance.
const AMBIENT_LIGHT_HIDDEN_ROUTES = ["/hub"];

const RouterAwareAmbientLight = () => {
  const location = useLocation();
  const hidden = AMBIENT_LIGHT_HIDDEN_ROUTES.some(
    (path) =>
      location.pathname === path || location.pathname.startsWith(path + "/"),
  );
  if (hidden) return null;
  return <AmbientLightLayer intensity="normal" />;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🛣️ APP ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

const AppRoutes = () => {
  const auth = useAuth();

  return (
    <LanguageProvider>
      <LoadingWordProvider>
        <AuthProvider value={auth}>
          <TTSProvider>
            <VoicePrefsStagingProvider>
              <Router>
                <AmbientLightingProvider enabled={getAmbientLightingEnabled()}>
                  {/* ✨ Couche lumineuse cosmique (engine v3 — beam + halo) — restreinte aux routes vitrines */}
                  <RouterAwareAmbientLight />
                  {/* 🌻 Tournesol mascot suivant la course du soleil */}
                  <SunflowerLayer />

                  {/* ♿ Skip Link pour l'accessibilité */}
                  <SkipLink targetId="main-content" />

                  {/* 🔮 Prefetcher intelligent */}
                  <RoutePrefetcher />

                  <ErrorBoundary>
                    <Routes>
                      {/* Routes publiques */}
                      <Route path="/" element={<HomeRoute />} />

                      <Route
                        path="/login"
                        element={
                          <RouteErrorBoundary
                            variant="full"
                            componentName="Login"
                          >
                            <Suspense
                              fallback={<PageSkeleton variant="simple" />}
                            >
                              <Login />
                            </Suspense>
                          </RouteErrorBoundary>
                        }
                      />

                      <Route
                        path="/auth/callback"
                        element={
                          <RouteErrorBoundary
                            variant="full"
                            componentName="AuthCallback"
                          >
                            <Suspense
                              fallback={<PageSkeleton variant="simple" />}
                            >
                              <AuthCallback />
                            </Suspense>
                          </RouteErrorBoundary>
                        }
                      />

                      <Route
                        path="/forgot-password"
                        element={
                          <RouteErrorBoundary
                            variant="full"
                            componentName="ForgotPassword"
                          >
                            <Suspense
                              fallback={<PageSkeleton variant="simple" />}
                            >
                              <ForgotPassword />
                            </Suspense>
                          </RouteErrorBoundary>
                        }
                      />

                      <Route
                        path="/reset-password"
                        element={
                          <RouteErrorBoundary
                            variant="full"
                            componentName="ResetPassword"
                          >
                            <Suspense
                              fallback={<PageSkeleton variant="simple" />}
                            >
                              <ResetPassword />
                            </Suspense>
                          </RouteErrorBoundary>
                        }
                      />

                      <Route
                        path="/legal/cgu"
                        element={
                          <RouteErrorBoundary
                            variant="full"
                            componentName="LegalCGU"
                          >
                            <Suspense
                              fallback={<PageSkeleton variant="full" />}
                            >
                              <LegalCGU />
                            </Suspense>
                          </RouteErrorBoundary>
                        }
                      />

                      <Route
                        path="/legal/cgv"
                        element={
                          <RouteErrorBoundary
                            variant="full"
                            componentName="LegalCGV"
                          >
                            <Suspense
                              fallback={<PageSkeleton variant="full" />}
                            >
                              <LegalCGV />
                            </Suspense>
                          </RouteErrorBoundary>
                        }
                      />

                      <Route
                        path="/legal/privacy"
                        element={
                          <RouteErrorBoundary
                            variant="full"
                            componentName="PrivacyPolicy"
                          >
                            <Suspense
                              fallback={<PageSkeleton variant="full" />}
                            >
                              <PrivacyPolicy />
                            </Suspense>
                          </RouteErrorBoundary>
                        }
                      />

                      <Route
                        path="/legal"
                        element={
                          <RouteErrorBoundary
                            variant="full"
                            componentName="LegalPage"
                          >
                            <Suspense
                              fallback={<PageSkeleton variant="full" />}
                            >
                              <LegalPage />
                            </Suspense>
                          </RouteErrorBoundary>
                        }
                      />

                      <Route
                        path="/status"
                        element={
                          <RouteErrorBoundary
                            variant="full"
                            componentName="StatusPage"
                          >
                            <Suspense
                              fallback={<PageSkeleton variant="simple" />}
                            >
                              <StatusPage />
                            </Suspense>
                          </RouteErrorBoundary>
                        }
                      />

                      <Route
                        path="/contact"
                        element={
                          <RouteErrorBoundary
                            variant="full"
                            componentName="ContactPage"
                          >
                            <Suspense
                              fallback={<PageSkeleton variant="full" />}
                            >
                              <ContactPage />
                            </Suspense>
                          </RouteErrorBoundary>
                        }
                      />

                      <Route
                        path="/about"
                        element={
                          <RouteErrorBoundary
                            variant="full"
                            componentName="AboutPage"
                          >
                            <Suspense
                              fallback={<PageSkeleton variant="full" />}
                            >
                              <AboutPage />
                            </Suspense>
                          </RouteErrorBoundary>
                        }
                      />

                      <Route
                        path="/payment/success"
                        element={
                          <RouteErrorBoundary
                            variant="full"
                            componentName="PaymentSuccess"
                          >
                            <Suspense
                              fallback={<PageSkeleton variant="simple" />}
                            >
                              <PaymentSuccess />
                            </Suspense>
                          </RouteErrorBoundary>
                        }
                      />

                      <Route
                        path="/payment/cancel"
                        element={
                          <RouteErrorBoundary
                            variant="full"
                            componentName="PaymentCancel"
                          >
                            <Suspense
                              fallback={<PageSkeleton variant="simple" />}
                            >
                              <PaymentCancel />
                            </Suspense>
                          </RouteErrorBoundary>
                        }
                      />

                      <Route
                        path="/api-docs"
                        element={
                          <RouteErrorBoundary
                            variant="full"
                            componentName="ApiDocsPage"
                          >
                            <Suspense
                              fallback={<PageSkeleton variant="full" />}
                            >
                              <ApiDocsPage />
                            </Suspense>
                          </RouteErrorBoundary>
                        }
                      />

                      {/* /upgrade — public pricing page (indexable) */}
                      <Route
                        path="/upgrade"
                        element={
                          <RouteErrorBoundary
                            variant="full"
                            componentName="UpgradePage"
                          >
                            <Suspense
                              fallback={<PageSkeleton variant="form" />}
                            >
                              <UpgradePage />
                            </Suspense>
                          </RouteErrorBoundary>
                        }
                      />

                      <Route
                        path="/s/:shareToken"
                        element={
                          <RouteErrorBoundary
                            variant="full"
                            componentName="SharedAnalysisPage"
                          >
                            <Suspense
                              fallback={<PageSkeleton variant="simple" />}
                            >
                              <SharedAnalysisPage />
                            </Suspense>
                          </RouteErrorBoundary>
                        }
                      />

                      {/* Routes protégées */}
                      <Route
                        element={
                          <PrivateRoute>
                            <ProtectedLayout />
                          </PrivateRoute>
                        }
                      >
                        <Route
                          path="/dashboard"
                          element={
                            <RouteErrorBoundary
                              variant="full"
                              componentName="DashboardPage"
                              showDetails
                            >
                              <Suspense
                                fallback={<PageSkeleton variant="dashboard" />}
                              >
                                <DashboardRoute />
                              </Suspense>
                            </RouteErrorBoundary>
                          }
                        />

                        <Route
                          path="/playlists"
                          element={<Navigate to="/debate" replace />}
                        />

                        <Route
                          path="/playlist/:id"
                          element={
                            <Suspense
                              fallback={<PageSkeleton variant="dashboard" />}
                            >
                              <PlaylistDetailPage />
                            </Suspense>
                          }
                        />

                        <Route
                          path="/history"
                          element={
                            <RouteErrorBoundary
                              variant="full"
                              componentName="History"
                            >
                              <Suspense
                                fallback={<PageSkeleton variant="full" />}
                              >
                                <History />
                              </Suspense>
                            </RouteErrorBoundary>
                          }
                        />

                        <Route
                          path="/usage"
                          element={
                            <RouteErrorBoundary
                              variant="full"
                              componentName="UsageDashboard"
                            >
                              <Suspense
                                fallback={<PageSkeleton variant="dashboard" />}
                              >
                                <UsageDashboard />
                              </Suspense>
                            </RouteErrorBoundary>
                          }
                        />

                        <Route
                          path="/analytics"
                          element={
                            <Suspense
                              fallback={<PageSkeleton variant="dashboard" />}
                            >
                              <AnalyticsPage />
                            </Suspense>
                          }
                        />

                        <Route
                          path="/settings"
                          element={
                            <RouteErrorBoundary
                              variant="full"
                              componentName="Settings"
                            >
                              <Suspense
                                fallback={<PageSkeleton variant="form" />}
                              >
                                <Settings />
                              </Suspense>
                            </RouteErrorBoundary>
                          }
                        />

                        <Route
                          path="/account"
                          element={
                            <RouteErrorBoundary
                              variant="full"
                              componentName="MyAccount"
                            >
                              <Suspense
                                fallback={<PageSkeleton variant="form" />}
                              >
                                <MyAccount />
                              </Suspense>
                            </RouteErrorBoundary>
                          }
                        />

                        <Route
                          path="/change-password"
                          element={
                            <RouteErrorBoundary
                              variant="full"
                              componentName="ChangePassword"
                            >
                              <Suspense
                                fallback={<PageSkeleton variant="form" />}
                              >
                                <ChangePassword />
                              </Suspense>
                            </RouteErrorBoundary>
                          }
                        />

                        <Route
                          path="/admin"
                          element={
                            <RouteErrorBoundary
                              variant="full"
                              componentName="AdminPage"
                            >
                              <Suspense
                                fallback={<PageSkeleton variant="dashboard" />}
                              >
                                <AdminPage />
                              </Suspense>
                            </RouteErrorBoundary>
                          }
                        />

                        <Route
                          path="/hub"
                          element={
                            <RouteErrorBoundary
                              variant="full"
                              componentName="HubPage"
                            >
                              <Suspense
                                fallback={<PageSkeleton variant="full" />}
                              >
                                <HubPage />
                              </Suspense>
                            </RouteErrorBoundary>
                          }
                        />

                        <Route
                          path="/chat"
                          element={<Navigate to="/hub" replace />}
                        />

                        <Route
                          path="/voice-call"
                          element={<Navigate to="/hub" replace />}
                        />

                        <Route
                          path="/study"
                          element={
                            <RouteErrorBoundary
                              variant="full"
                              componentName="StudyHubPage"
                            >
                              <Suspense
                                fallback={<PageSkeleton variant="dashboard" />}
                              >
                                <StudyHubPage />
                              </Suspense>
                            </RouteErrorBoundary>
                          }
                        />

                        <Route
                          path="/study/:summaryId"
                          element={
                            <Suspense
                              fallback={<PageSkeleton variant="dashboard" />}
                            >
                              <StudyPage />
                            </Suspense>
                          }
                        />

                        <Route
                          path="/debate"
                          element={
                            <RouteErrorBoundary
                              variant="full"
                              componentName="DebatePage"
                            >
                              <Suspense
                                fallback={<PageSkeleton variant="dashboard" />}
                              >
                                <DebatePage />
                              </Suspense>
                            </RouteErrorBoundary>
                          }
                        />

                        <Route
                          path="/debate/:id"
                          element={
                            <RouteErrorBoundary
                              variant="full"
                              componentName="DebatePage"
                            >
                              <Suspense
                                fallback={<PageSkeleton variant="dashboard" />}
                              >
                                <DebatePage />
                              </Suspense>
                            </RouteErrorBoundary>
                          }
                        />
                      </Route>

                      {/* Extension Welcome — post-install landing */}
                      <Route
                        path="/extension-welcome"
                        element={
                          <RouteErrorBoundary
                            variant="full"
                            componentName="ExtensionWelcome"
                          >
                            <Suspense
                              fallback={<PageSkeleton variant="simple" />}
                            >
                              <ExtensionWelcomePage />
                            </Suspense>
                          </RouteErrorBoundary>
                        }
                      />

                      {/* 404 Page */}
                      <Route
                        path="*"
                        element={
                          <Suspense
                            fallback={<PageSkeleton variant="simple" />}
                          >
                            <NotFoundPage />
                          </Suspense>
                        }
                      />
                    </Routes>
                  </ErrorBoundary>

                  <CrispChat />

                  {/* 🔒 Modal upgrade global (403/429 interceptor) — wrapped to prevent crash */}
                  <ErrorBoundary fallback={null}>
                    <UpgradeModal />
                  </ErrorBoundary>

                  {/* 🍪 RGPD: Cookie consent banner — wrapped to prevent crash */}
                  <ErrorBoundary fallback={null}>
                    <CookieBanner />
                  </ErrorBoundary>

                  {/* 🎙️ Floating "Apply staged voice prefs" toolbar */}
                  <ErrorBoundary fallback={null}>
                    <StagedPrefsToolbar />
                  </ErrorBoundary>
                </AmbientLightingProvider>
              </Router>
            </VoicePrefsStagingProvider>
          </TTSProvider>
        </AuthProvider>
      </LoadingWordProvider>
    </LanguageProvider>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 APP WITH PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

const App = () => {
  // 📊 Initialiser PostHog analytics (RGPD-compliant, attend le consentement)
  useEffect(() => {
    analytics.init();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
    </QueryClientProvider>
  );
};

export default App;
