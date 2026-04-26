import React, { useEffect, useState } from "react";
import Browser from "../utils/browser-polyfill";
import { VoiceView } from "./VoiceView";
import type { VoicePanelContext } from "./types";

type SessionStorage = {
  get: (key: string) => Promise<Record<string, unknown>>;
};

function getSessionStorage(): SessionStorage | null {
  // chrome.storage.session existe en MV3 mais pas dans tous les polyfills,
  // notamment en Firefox MV2. On feature-detect proprement.
  const storage = (Browser as unknown as { storage?: Record<string, unknown> })
    .storage;
  if (!storage) return null;
  const session = storage.session as SessionStorage | undefined;
  if (!session || typeof session.get !== "function") return null;
  return session;
}

export const App: React.FC = () => {
  const [context, setContext] = useState<VoicePanelContext | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const session = getSessionStorage();
    if (!session) {
      setHydrated(true);
      return;
    }
    session
      .get("voicePanelContext")
      .then((data) => {
        const ctx = (data?.voicePanelContext as VoicePanelContext) ?? null;
        setContext(ctx);
      })
      .catch(() => {
        // Aucun contexte stocké : on laisse en mode companion.
      })
      .finally(() => setHydrated(true));
  }, []);

  if (!hydrated) {
    return (
      <div className="dsp-app">
        <p className="dsp-status" style={{ marginTop: 32, textAlign: "center" }}>
          Chargement…
        </p>
      </div>
    );
  }

  return <VoiceView context={context} />;
};
