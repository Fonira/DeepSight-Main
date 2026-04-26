import React, { useState, useEffect, useCallback } from "react";
import type { User, PlanInfo, MessageResponse } from "../types";
import Browser from "../utils/browser-polyfill";
import { LoginView } from "./views/LoginView";
import { MainView } from "./views/MainView";
import { DeepSightSpinner } from "./shared/DeepSightSpinner";
import MicroDoodleBackground from "./shared/MicroDoodleBackground";

type ViewName = "loading" | "login" | "main";

export const App: React.FC = () => {
  const [view, setView] = useState<ViewName>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "error" | "success";
  } | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  async function checkAuth(): Promise<void> {
    try {
      const response = await Browser.runtime.sendMessage<
        unknown,
        MessageResponse
      >({
        action: "CHECK_AUTH",
      });
      if (response.authenticated && response.user) {
        setUser(response.user);
        setIsGuest(false);
        await loadPlanInfo();
        setView("main");
      } else {
        setView("login");
      }
    } catch {
      setView("login");
    }
  }

  async function loadPlanInfo(): Promise<void> {
    try {
      const response = await Browser.runtime.sendMessage<
        unknown,
        MessageResponse
      >({
        action: "GET_PLAN",
      });
      if (response.success && response.plan) {
        setPlanInfo(response.plan);
      }
    } catch {
      // Plan info load failed — continue without it
    }
  }

  const handleLogin = useCallback(
    async (email: string, password: string): Promise<void> => {
      setError(null);
      const response = await Browser.runtime.sendMessage<
        unknown,
        MessageResponse
      >({
        action: "LOGIN",
        data: { email, password },
      });

      if (response.success && response.user) {
        setUser(response.user);
        setIsGuest(false);
        await loadPlanInfo();
        setView("main");
      } else {
        throw new Error(response.error || "Login failed");
      }
    },
    [],
  );

  const handleGoogleLogin = useCallback(async (): Promise<void> => {
    setError(null);
    const response = await Browser.runtime.sendMessage<
      unknown,
      MessageResponse
    >({
      action: "GOOGLE_LOGIN",
    });

    if (response.success && response.user) {
      setUser(response.user);
      setIsGuest(false);
      await loadPlanInfo();
      setView("main");
    } else {
      throw new Error(response.error || "Google login failed");
    }
  }, []);

  const handleGuestMode = useCallback(() => {
    setIsGuest(true);
    setUser(null);
    setPlanInfo(null);
    setView("main");
  }, []);

  const handleLogout = useCallback(async (): Promise<void> => {
    await Browser.runtime.sendMessage({ action: "LOGOUT" });
    setUser(null);
    setPlanInfo(null);
    setIsGuest(false);
    setView("login");
  }, []);

  const handleLoginRedirect = useCallback(() => {
    setIsGuest(false);
    setView("login");
  }, []);

  const showError = useCallback((msg: string) => {
    setToast({ message: msg, type: "error" });
  }, []);

  function getCurrentVariant() {
    if (view === "loading") return "default";
    if (view === "login") return "default";
    if (view === "main") return "AI";
    return "default";
  }

  return (
    <div
      className="app-container noise-overlay ambient-glow"
      style={{ position: "relative" }}
    >
      <MicroDoodleBackground variant={getCurrentVariant()} />
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Toast notification */}
        {toast && (
          <div
            className={`ds-toast ds-toast-${toast.type}`}
            onClick={() => setToast(null)}
          >
            {toast.message}
          </div>
        )}

        {view === "loading" && (
          <div className="loading-view">
            <DeepSightSpinner
              size="md"
              speed="normal"
              showLabel
              label="DeepSight"
            />
          </div>
        )}

        {view === "login" && (
          <LoginView
            onLogin={handleLogin}
            onGoogleLogin={handleGoogleLogin}
            onGuestMode={handleGuestMode}
            error={error}
          />
        )}

        {view === "main" && (
          <MainView
            user={user}
            planInfo={planInfo}
            isGuest={isGuest}
            onLogout={handleLogout}
            onLoginRedirect={handleLoginRedirect}
            onError={showError}
          />
        )}
      </div>
    </div>
  );
};
