import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Send, Plus } from "lucide-react";
import type { TabId } from "./types";

interface Props {
  onSend: (text: string) => void;
  /**
   * Called when the user releases the mic button after holding > 0.4s.
   * Le CTA Démarrer un appel vocal (hero) est désormais géré par HubPage
   * via QuickVoiceCallCTA — l'ancienne icône Phone à droite a été retirée
   * pour éviter deux CTA redondants.
   */
  onPttHoldComplete: (durationSecs: number) => void;
  disabled?: boolean;
  /** Onglet actif — l'envoi sur autre que "chat" doit aussi switcher (F4). */
  activeTab?: TabId;
  /** Setter d'onglet — si fourni et activeTab !== "chat", l'envoi switche d'abord. */
  onTabChange?: (tab: TabId) => void;
}

export const InputBar: React.FC<Props> = ({
  onSend,
  onPttHoldComplete,
  disabled,
  activeTab,
  onTabChange,
}) => {
  const [val, setVal] = useState("");
  const [holding, setHolding] = useState(false);
  const [duration, setDuration] = useState(0);
  const startRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  // Chip Plateformes — repliable, état persisté en localStorage (F4).
  const [platformsOpen, setPlatformsOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("hub-platforms-chip-collapsed") !== "1";
  });
  const togglePlatforms = () => {
    setPlatformsOpen((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(
          "hub-platforms-chip-collapsed",
          next ? "0" : "1",
        );
      } catch {
        /* localStorage indisponible — silencieux */
      }
      return next;
    });
  };

  useEffect(() => {
    if (!holding) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    startRef.current = performance.now();
    const tick = (t: number) => {
      setDuration((t - startRef.current) / 1000);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [holding]);

  const startHold = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setHolding(true);
    setDuration(0);
  };

  const endHold = () => {
    if (holding && duration > 0.4) {
      onPttHoldComplete(duration);
    }
    setHolding(false);
    setDuration(0);
  };

  const send = () => {
    const trimmed = val.trim();
    if (!trimmed) return;
    // F4 — si on est sur un autre onglet que Chat, switcher d'abord.
    if (activeTab && activeTab !== "chat" && onTabChange) {
      onTabChange("chat");
    }
    onSend(trimmed);
    setVal("");
  };

  return (
    <div className="relative flex items-center gap-2 px-4 py-3 border-t border-white/10 bg-[#0a0a0f]/95 backdrop-blur-xl flex-shrink-0">
      <div className="absolute -top-7 left-4 right-4 flex justify-center pointer-events-none">
        <button
          type="button"
          onClick={togglePlatforms}
          aria-expanded={platformsOpen}
          aria-controls="hub-platforms-chip"
          className="pointer-events-auto px-2.5 py-1 text-[10px] font-mono tracking-wider text-white/45 hover:text-white/70 bg-[#0a0a0f]/80 backdrop-blur rounded-full border border-white/10 transition-colors"
        >
          {platformsOpen ? "▾" : "▸"} Plateformes : YouTube · TikTok
        </button>
      </div>
      <button
        type="button"
        aria-label="attachments"
        className="w-8 h-8 grid place-items-center text-white/45 hover:text-white/80 rounded-full"
      >
        <Plus className="w-4 h-4" />
      </button>
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        placeholder="Posez votre question — ou maintenez le micro…"
        disabled={disabled}
        className="flex-1 bg-white/[0.04] border border-white/10 rounded-full px-4 py-2 text-sm text-white outline-none focus:border-indigo-500/40"
      />
      {val.trim() ? (
        <button
          type="button"
          aria-label="Envoyer"
          onClick={send}
          disabled={disabled}
          className="w-9 h-9 rounded-full bg-indigo-500 text-white grid place-items-center hover:bg-indigo-400 transition-colors disabled:opacity-40"
        >
          <Send className="w-4 h-4 -ml-px" />
        </button>
      ) : (
        <button
          type="button"
          aria-label="Maintenir pour enregistrer"
          onMouseDown={startHold}
          onMouseUp={endHold}
          onMouseLeave={() => holding && endHold()}
          onTouchStart={startHold}
          onTouchEnd={endHold}
          className={
            "w-9 h-9 grid place-items-center rounded-full transition-all " +
            (holding
              ? "bg-red-500 text-white scale-110 shadow-[0_8px_24px_rgba(239,68,68,.4)]"
              : "bg-indigo-500/15 text-indigo-400")
          }
        >
          <Mic className="w-4 h-4" />
        </button>
      )}

      <AnimatePresence>
        {holding && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute right-4 -top-10 px-3.5 py-2 bg-red-500 rounded-xl text-white font-mono text-[12px] shadow-[0_8px_24px_rgba(239,68,68,.4)] whitespace-nowrap"
          >
            ● ENREGISTREMENT · {duration.toFixed(1)}s
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
