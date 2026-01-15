/**
 * DEEP SIGHT v6.2 — App Entry Point
 * 
 * 🆕 v6.2: PWA - Progressive Web App
 * 🆕 v6.1: Accessibilité améliorée (SkipLink, ARIA)
 * 
 * NOTE: Les doodles sont maintenant dans chaque PAGE individuellement
 * car le fond opaque des pages (bg-bg-primary) les couvrait.
 */

import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { PrivateRoute } from "./components/PrivateRoute";
import { SkipLink } from "./components/SkipLink";
import { InstallPrompt, UpdatePrompt } from "./components/InstallPrompt";

// Pages - utilisation des imports par défaut pour éviter les problèmes de résolution
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import DashboardPage from "./pages/DashboardPage";
import PlaylistPage from "./pages/PlaylistPage";
import History from "./pages/History";
import UpgradePage from "./pages/UpgradePage";
import Settings from "./pages/Settings";
import MyAccount from "./pages/MyAccount";
import AdminPage from "./pages/AdminPage";
import LegalPage from "./pages/LegalPage";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";
import UsageDashboard from "./pages/UsageDashboard";

// Route intelligente pour la home
const HomeRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div 
        className="min-h-screen bg-bg-primary flex items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <div 
          className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin"
          aria-hidden="true" 
        />
        <span className="sr-only">Chargement de l'application...</span>
      </div>
    );
  }

  return user ? <Navigate to="/dashboard" replace /> : <LandingPage />;
};

// Layout simple pour les pages protégées
const ProtectedLayout = () => {
  return <Outlet />;
};

const AppRoutes = () => {
  const auth = useAuth();

  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider value={auth}>
          {/* 
            🎨 Les doodles sont maintenant DANS chaque page
            Voir Settings.tsx, DashboardPage.tsx etc. pour l'intégration
          */}
          
          <Router>
            {/* ♿ Skip Link pour l'accessibilité */}
            <SkipLink targetId="main-content" />
            
            <Routes>
              {/* Routes publiques */}
              <Route path="/" element={<HomeRoute />} />
              <Route path="/login" element={<Login />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/legal" element={<LegalPage />} />
              <Route path="/payment/success" element={<PaymentSuccess />} />
              <Route path="/payment/cancel" element={<PaymentCancel />} />
              
              {/* Routes protégées */}
              <Route
                element={
                  <PrivateRoute>
                    <ProtectedLayout />
                  </PrivateRoute>
                }
              >
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/playlists" element={<PlaylistPage />} />
                <Route path="/history" element={<History />} />
                <Route path="/upgrade" element={<UpgradePage />} />
                <Route path="/usage" element={<UsageDashboard />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/account" element={<MyAccount />} />
                <Route path="/admin" element={<AdminPage />} />
              </Route>

              {/* 404 Redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            
            {/* 📱 PWA: Prompt d'installation */}
            <InstallPrompt position="bottom" />
            
            {/* 🔄 PWA: Notification de mise à jour */}
            <UpdatePrompt />
          </Router>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
};

export default AppRoutes;
