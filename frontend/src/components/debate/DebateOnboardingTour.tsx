/**
 * Coachmark progressif au 1er lancement de la page Débat IA.
 * 3 étapes, skippable, persistance localStorage.
 *
 * Sprint Débat IA v2 — Wave 4 G.
 * Spec : docs/superpowers/specs/2026-05-04-debate-ia-v2.md §10.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STORAGE_KEY = "debate_onboarding_completed_v2";

type Step = {
  selector: string;
  title: string;
  body: string;
  placement: "top" | "bottom" | "left" | "right";
};

const STEPS: Step[] = [
  {
    selector: '[data-onboard="debate-input"]',
    title: "1. Choisis une vidéo",
    body: "Colle l'URL d'une vidéo YouTube ou TikTok. DeepSight extrait sa thèse et cherche une perspective opposée automatiquement.",
    placement: "bottom",
  },
  {
    selector: '[data-onboard="debate-vs-layout"]',
    title: "2. Confronte les arguments",
    body: "Visualise la vidéo A et la perspective B côte-à-côte. Convergences en vert, divergences en rouge, fact-check inline.",
    placement: "top",
  },
  {
    selector: '[data-onboard="add-perspective"]',
    title: "3. Enrichis le débat",
    body: "Ajoute une perspective complémentaire ou une nuance (3 crédits chacune, max 3 perspectives au total).",
    placement: "top",
  },
];

export function DebateOnboardingTour() {
  const [stepIdx, setStepIdx] = useState(-1);
  const [target, setTarget] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "true") return;
    const timer = setTimeout(() => setStepIdx(0), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (stepIdx < 0 || stepIdx >= STEPS.length) {
      setTarget(null);
      return;
    }
    const el = document.querySelector(STEPS[stepIdx].selector);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => setTarget(el.getBoundingClientRect()), 400);
    } else {
      setTarget(null);
    }
  }, [stepIdx]);

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setStepIdx(-1);
  };

  if (stepIdx < 0 || stepIdx >= STEPS.length) return null;

  const step = STEPS[stepIdx];
  const isLast = stepIdx === STEPS.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        key="onboarding-overlay"
        className="fixed inset-0 z-[100] pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {target && (
          <div
            className="absolute rounded-2xl ring-4 ring-violet-500/60 shadow-[0_0_60px_rgba(139,92,246,0.5)] pointer-events-none transition-all duration-300"
            style={{
              top: target.top - 8,
              left: target.left - 8,
              width: target.width + 16,
              height: target.height + 16,
            }}
          />
        )}

        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
          onClick={finish}
        />

        <motion.div
          key={`step-${stepIdx}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute left-1/2 -translate-x-1/2 bottom-12 w-[min(520px,90vw)] pointer-events-auto"
        >
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a1428] to-[#0f0a1a] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-wider text-violet-400">
                Étape {stepIdx + 1} / {STEPS.length}
              </span>
              <button
                onClick={finish}
                className="text-xs text-white/50 hover:text-white/80 transition"
              >
                Passer le tutoriel
              </button>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {step.title}
            </h3>
            <p className="text-sm text-white/70 mb-5 leading-relaxed">
              {step.body}
            </p>
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === stepIdx ? "w-8 bg-violet-500" : "w-1.5 bg-white/20"
                    }`}
                  />
                ))}
              </div>
              <button
                onClick={() => (isLast ? finish() : setStepIdx(stepIdx + 1))}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition shadow-lg shadow-violet-500/30"
              >
                {isLast ? "Compris !" : "Suivant →"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/** Hook utilitaire pour relancer le tour (ex: bouton "Voir le tutoriel" dans paramètres). */
export function useResetDebateOnboarding() {
  return () => localStorage.removeItem(STORAGE_KEY);
}
