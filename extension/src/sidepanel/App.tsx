import React, { useState, useEffect, useCallback } from "react";
import type { User, PlanInfo, MessageResponse } from "../types";
import Browser from "../utils/browser-polyfill";
import { LoginView } from "./views/LoginView";
import { MainView } from "./views/MainView";
import { ConversationView } from "./views/ConversationView";
import type { VoicePanelContext, PendingVoiceCall } from "./types";
import { DeepSightSpinner } from "./shared/DeepSightSpinner";
import MicroDoodleBackground from "./shared/MicroDoodleBackground";
import DoodleBackground from "./components/DoodleBackground";

type ViewName = "loading" | "login" | "main";

interface SessionStorage {
  get: (key: string) => Promise<Record<string, unknown>>;
  remove?: (key: string) => Promise<void>;
}

interface StorageOnChanged {
  addListener: (
    cb: (
      changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
      area: string,
    ) => void,
  ) => void;
  removeListener?: (
    cb: (
      changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
      area: string,
    ) => void,
  ) => void;
}

function getSessionStorage(): SessionStorage | null {
  const storage = (Browser as unknown as { storage?: Record<string, unknown> })
    .storage;
  if (!storage) return null;
  const session = storage.session as SessionStorage | undefined;
  if (!session || typeof session.get !== "function") return null;
  return session;
}

function getStorageOnChanged(): StorageOnChanged | null {
  const storage = (Browser as unknown as { storage?: Record<string, unknown> })
    .storage;
  if (!storage) return null;
  const onChanged = storage.onChanged as StorageOnChanged | undefined;
  if (!onChanged?.addListener) return null;
  return onChanged;
}

export const App: React.FC = () => {
  // Voice flow integration (Spec #4 + Quick Voice Call Task 16) :
  // - `voicePanelContext` (legacy)         → ouvre VoiceView avec context
  // - `pendingVoiceCall` (Quick Voice Call) → centralisé ici (B4) :
  //     1. Lecture initiale au mount + suppression immédiate de la clé.
  //     2. Listener chrome.storage.onChanged pour réagir si le SW set
  //        la clé après le mount (cas user qui a déjà le sidepanel ouvert
  //        et clique 🎙️ depuis YouTube — finding I6).
  //     3. Le payload est passé en prop à VoiceView (qui ne lit plus
  //        session storage lui-même → fini la race condition StrictMode
  //        et le bug "double mount = clé déjà supprimée").
  const [voiceContext, setVoiceContext] = useState<VoicePanelContext | null>(
    null,
  );
  const [pendingVoiceCall, setPendingVoiceCall] =
    useState<PendingVoiceCall | null>(null);
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

  // Initial read at mount + cleanup of the consumed key (B4 centralisation).
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
        .then(
          (data) =>
            (data?.pendingVoiceCall as PendingVoiceCall | undefined) ?? null,
        )
        .catch(() => null),
    ])
      .then(([ctx, pending]) => {
        setVoiceContext(ctx);
        if (pending?.videoId) {
          setPendingVoiceCall(pending);
          // Suppression best-effort — l'idempotence repose sur la prop
          // passée à VoiceView, pas sur la présence de la clé en storage.
          void session.remove?.("pendingVoiceCall").catch(() => {});
        }
      })
      .finally(() => setVoiceChecked(true));
  }, []);

  // Listener live (I6) — réagit si le SW set pendingVoiceCall après mount.
  useEffect(() => {
    const onChanged = getStorageOnChanged();
    const session = getSessionStorage();
    if (!onChanged || !session) return;
    const listener = (
      changes: Record<string, { newValue?: unknown; oldValue?: unknown }>,
      area: string,
    ) => {
      if (area !== "session") return;
      const change = changes["pendingVoiceCall"];
      if (!change) return;
      const pending = change.newValue as PendingVoiceCall | undefined;
      if (pending?.videoId) {
        setPendingVoiceCall(pending);
        void session.remove?.("pendingVoiceCall").catch(() => {});
      }
    };
    onChanged.addListener(listener);
    return () => {
      onChanged.removeListener?.(listener);
    };
  }, []);

  useEffect(() => {
    if (voiceChecked && !voiceContext && !pendingVoiceCall) {
      checkAuth();
    }
  }, [voiceChecked, voiceContext, pendingVoiceCall]);

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

  // Voice flow — retour à la main view après hangup.
  // Clear les deux states qui font court-circuiter App.tsx vers VoiceView,
  // puis force un re-check auth (le useEffect [voiceChecked, voiceContext,
  // pendingVoiceCall] ne re-déclenche checkAuth() que si voiceChecked est
  // déjà true et que les deux states deviennent falsy — c'est notre cas).
  const handleReturnFromVoice = useCallback(() => {
    setVoiceContext(null);
    setPendingVoiceCall(null);
    // Best-effort cleanup du legacy `voicePanelContext` en session storage
    // pour éviter qu'un re-mount du sidepanel rebascule en VoiceView.
    const session = getSessionStorage();
    void session?.remove?.("voicePanelContext").catch(() => {});
    void session?.remove?.("pendingVoiceCall").catch(() => {});
    // Si user est déjà authentifié on peut directement aller en main,
    // sinon le useEffect ci-dessus rebasculera vers login via checkAuth().
    if (user) {
      setView("main");
    } else {
      void checkAuth();
    }
  }, [user]);

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
      <div className="ds-app-root">
        <DoodleBackground />
        <div className="app-container">
          <div className="loading-view">
            <DeepSightSpinner size="md" speed="normal" />
          </div>
        </div>
      </div>
    );
  }
  if (voiceContext || pendingVoiceCall) {
    // Quick Voice Call (B4) — déclenché depuis le widget YouTube. La
    // ConversationView s'ouvre directement en mode 'call' avec le videoId
    // du payload session storage. Le hook useConversation gère :
    //   - auto-start de la session ElevenLabs (initialMode='call')
    //   - création backend du Summary placeholder (explorer_streaming)
    //   - bascule mute/end et toast post-hangup
    // L'utilisateur peut taper du texte pendant le call (envoyé à l'agent
    // qui répond à l'oral) et hangup retombe en mode chat dans la même UI.
    const ctxVideoId =
      pendingVoiceCall?.videoId ?? voiceContext?.videoId ?? null;
    const ctxVideoTitle =
      pendingVoiceCall?.videoTitle ?? voiceContext?.videoTitle ?? "Live";
    const ctxSummaryId =
      typeof voiceContext?.summaryId === "number"
        ? voiceContext.summaryId
        : null;
    const ctxPlatform = voiceContext?.platform ?? null;
    return (
      <div className="ds-app-root">
        <DoodleBackground />
        <ConversationView
          summaryId={ctxSummaryId}
          videoTitle={ctxVideoTitle}
          videoId={ctxVideoId}
          platform={ctxPlatform}
          initialMode="call"
          userPlan={planInfo?.plan_id || user?.plan || "free"}
          onClose={handleReturnFromVoice}
          onSessionExpired={handleLogout}
        />
      </div>
    );
  }

  return (
    <div className="ds-app-root">
      <DoodleBackground />
      <div
        className="app-container noise-overlay"
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
    </div>
  );
};
