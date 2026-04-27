import React, { useState, useEffect, useCallback } from "react";
import type { User, PlanInfo, MessageResponse } from "../types";
import Browser from "../utils/browser-polyfill";
import { LoginView } from "./views/LoginView";
import { MainView } from "./views/MainView";
import { VoiceView } from "./VoiceView";
import type { VoicePanelContext } from "./types";
import { DeepSightSpinner } from "./shared/DeepSightSpinner";
import MicroDoodleBackground from "./shared/MicroDoodleBackground";

type ViewName = "loading" | "login" | "main";

type SessionStorage = {
  get: (key: string) => Promise<Record<string, unknown>>;
};

function getSessionStorage(): SessionStorage | null {
  const storage = (Browser as unknown as { storage?: Record<string, unknown> })
    .storage;
  if (!storage) return null;
  const session = storage.session as SessionStorage | undefined;
  if (!session || typeof session.get !== "function") return null;
  return session;
}

export const App: React.FC = () => {
  // Voice flow integration (Spec #4 + Quick Voice Call Task 16) :
  // - `voicePanelContext` (legacy)         → ouvre VoiceView avec context
  // - `pendingVoiceCall` (Quick Voice Call) → VoiceView lit elle-même la clé
  // Dans les deux cas on rend `<VoiceView />` ; on lui passe le legacy ctx
  // si dispo pour compat.
  const [voiceContext, setVoiceContext] = useState<VoicePanelContext | null>(
    null,
  );
  const [hasPendingVoiceCall, setHasPendingVoiceCall] = useState(false);
  const [voiceChecked, setVoiceChecked] = useState(false);

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
    const session = getSessionStorage();
    if (!session) {
      setVoiceChecked(true);
      return;
    }
    Promise.all([
      session
        .get("voicePanelContext")
        .then(
          (data) =>
            (data?.voicePanelContext as VoicePanelContext | null) ?? null,
        )
        .catch(() => null),
      session
        .get("pendingVoiceCall")
        .then((data) => Boolean(data?.pendingVoiceCall))
        .catch(() => false),
    ])
      .then(([ctx, pending]) => {
        setVoiceContext(ctx);
        setHasPendingVoiceCall(pending);
      })
      .finally(() => setVoiceChecked(true));
  }, []);

  useEffect(() => {
    if (voiceChecked && !voiceContext && !hasPendingVoiceCall) {
      checkAuth();
    }
  }, [voiceChecked, voiceContext, hasPendingVoiceCall]);

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

  // Voice flow short-circuit: when SW set voicePanelContext, render VoiceView only.
  if (!voiceChecked) {
    return (
      <div className="app-container">
        <div className="loading-view">
          <DeepSightSpinner size="md" speed="normal" />
        </div>
      </div>
    );
  }
  if (voiceContext || hasPendingVoiceCall) {
    return <VoiceView context={voiceContext} />;
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
