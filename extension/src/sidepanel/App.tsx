import React, { useState, useEffect, useCallback } from "react";
import type { User, PlanInfo, MessageResponse } from "../types";
import Browser from "../utils/browser-polyfill";
import { LoginView } from "./views/LoginView";
import { MainView } from "./views/MainView";
import { VoiceView } from "./VoiceView";
import type { VoicePanelContext } from "./types";
import { DeepSightSpinner } from "./shared/DeepSightSpinner";
import MicroDoodleBackground from "./shared/MicroDoodleBackground";
import { AmbientLightingProvider } from "./contexts/AmbientLightingContext";
import { AmbientLightLayer } from "./components/AmbientLightLayer";
import { SunflowerLayer } from "./components/SunflowerLayer";

const AMBIENT_PREF_KEY = "ambient_lighting_enabled";

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
  // Voice flow integration (Spec #4): when SW set voicePanelContext in
  // chrome.storage.session, render VoiceView instead of the regular router.
  const [voiceContext, setVoiceContext] = useState<VoicePanelContext | null>(
    null,
  );
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

  // Ambient lighting v3 — pref `ambient_lighting_enabled` (default true).
  // Synced with backend pref via /api/auth/preferences (PR1 backend), but
  // for the extension we read the locally cached value to avoid blocking
  // the first paint on a network round-trip.
  const [ambientEnabled, setAmbientEnabled] = useState<boolean>(true);
  useEffect(() => {
    const localStore = (
      Browser as unknown as {
        storage?: { local?: { get?: (k: string) => Promise<unknown> } };
      }
    ).storage?.local;
    if (!localStore?.get) return;
    localStore
      .get(AMBIENT_PREF_KEY)
      .then((data) => {
        const raw = (data as Record<string, unknown> | undefined)?.[
          AMBIENT_PREF_KEY
        ];
        // Default ON when undefined; OFF only on explicit `false`.
        if (raw === false) setAmbientEnabled(false);
      })
      .catch(() => {
        /* fall back to default ON */
      });
  }, []);

  useEffect(() => {
    const session = getSessionStorage();
    if (!session) {
      setVoiceChecked(true);
      return;
    }
    session
      .get("voicePanelContext")
      .then((data) => {
        const ctx = (data?.voicePanelContext as VoicePanelContext) ?? null;
        setVoiceContext(ctx);
      })
      .catch(() => {
        // No stored context — fall through to regular router.
      })
      .finally(() => setVoiceChecked(true));
  }, []);

  useEffect(() => {
    if (voiceChecked && !voiceContext) {
      checkAuth();
    }
  }, [voiceChecked, voiceContext]);

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
      <AmbientLightingProvider enabled={ambientEnabled}>
        <AmbientLightLayer />
        <SunflowerLayer />
        <div className="app-container">
          <div className="loading-view">
            <DeepSightSpinner size="md" speed="normal" />
          </div>
        </div>
      </AmbientLightingProvider>
    );
  }
  if (voiceContext) {
    return (
      <AmbientLightingProvider enabled={ambientEnabled}>
        <AmbientLightLayer />
        <SunflowerLayer />
        <VoiceView context={voiceContext} />
      </AmbientLightingProvider>
    );
  }

  return (
    <AmbientLightingProvider enabled={ambientEnabled}>
      <AmbientLightLayer />
      <SunflowerLayer />
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
    </AmbientLightingProvider>
  );
};
