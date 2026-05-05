/**
 * 🎓 ShepherdTour — Tour interactif Shepherd.js (chantier B Sprint Growth & UX).
 *
 * Démarre APRÈS le `OnboardingFlow` (modal welcome) sur `/dashboard` la
 * première fois qu'un user se logue. Pointe sur les zones clés de l'UI
 * existante via des selectors `[data-tour-step="..."]`.
 *
 * Étapes (5) :
 *   1. welcome (centré)
 *   2. analyze-input (SmartInputBar `/dashboard`)
 *   3. hub-nav (Sidebar item Hub)
 *   4. study-nav (Sidebar item Study)
 *   5. profile-menu (Sidebar UserCard)
 *
 * Persistance fin/skip : `authApi.updatePreferences({ extra_preferences:
 * { has_completed_onboarding: true } })` pour ne plus reproposer le tour.
 *
 * Analytics : `analytics.trackOnboardingStep(...)` (gated consent RGPD via
 * `hasAnalyticsConsent`). Events tracés :
 *   - onboarding_tour_<step>_shown
 *   - onboarding_tour_<step>_completed (au passage step suivant)
 *   - onboarding_tour_tour_started / completed / skipped
 *
 * Lazy-loadé (frontend/src/App.tsx via `React.lazy`) pour éviter d'embarquer
 * Shepherd.js (~30KB gz) dans le bundle initial.
 */

import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../../services/api";
import { analytics } from "../../services/analytics";
import { useTranslation } from "../../hooks/useTranslation";

import "shepherd.js/dist/css/shepherd.css";
import "./ShepherdTour.css";

// ═══════════════════════════════════════════════════════════════════════════════
// 🧩 TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ShepherdTourProps {
  /**
   * Si true, le tour ne se monte pas (user déjà onboardé). Le composant
   * parent (App.tsx) calcule cette valeur depuis `user.preferences.
   * has_completed_onboarding` + état du modal welcome.
   */
  disabled?: boolean;

  /**
   * Callback appelé à la fin (complete OU skip OU cancel) — utile pour le
   * parent qui peut alors ne plus monter le composant.
   */
  onClose?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🔧 CONFIG STEPS
// ═══════════════════════════════════════════════════════════════════════════════

interface StepDef {
  /** Identifiant logique (utilisé pour analytics + i18n key). */
  id: string;
  /** CSS selector du target dans le DOM. `null` = step centré (welcome). */
  target: string | null;
  /** Position du popup vs target. Ignoré si target = null (centré). */
  on?:
    | "auto"
    | "auto-start"
    | "auto-end"
    | "top"
    | "top-start"
    | "top-end"
    | "bottom"
    | "bottom-start"
    | "bottom-end"
    | "right"
    | "right-start"
    | "right-end"
    | "left"
    | "left-start"
    | "left-end";
  /** i18n key dans `t.onboarding.tour.<key>`. */
  i18nKey:
    | "welcome"
    | "analyze_input"
    | "hub_nav"
    | "study_nav"
    | "profile_menu";
}

const TOUR_STEPS: StepDef[] = [
  { id: "welcome", target: null, i18nKey: "welcome" },
  {
    id: "analyze-input",
    target: '[data-tour-step="analyze-input"]',
    on: "bottom",
    i18nKey: "analyze_input",
  },
  {
    id: "hub-nav",
    target: '[data-tour-step="hub-nav"]',
    on: "right",
    i18nKey: "hub_nav",
  },
  {
    id: "study-nav",
    target: '[data-tour-step="study-nav"]',
    on: "right",
    i18nKey: "study_nav",
  },
  {
    id: "profile-menu",
    target: '[data-tour-step="profile-menu"]',
    on: "right-end",
    i18nKey: "profile_menu",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 🪝 HOOK : persiste has_completed_onboarding=true (best-effort)
// ═══════════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line react-refresh/only-export-components
export function useTourCompletion() {
  const persisted = useRef(false);

  return async (reason: "completed" | "skipped" | "cancelled") => {
    if (persisted.current) return;
    persisted.current = true;
    try {
      await authApi.updatePreferences({
        extra_preferences: { has_completed_onboarding: true },
      });
    } catch (err) {
      // Best-effort. Si réseau down, l'autre flow OnboardingFlow l'aura
      // probablement déjà flagué côté backend. À défaut, on retentera à la
      // prochaine session via le check `user.preferences`.
      console.warn("[shepherd-tour] persist completion failed", err);
    }
    if (reason === "completed") {
      analytics.capture("onboarding_tour_completed");
    } else if (reason === "skipped") {
      analytics.capture("onboarding_tour_skipped");
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🎬 COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const ShepherdTour: React.FC<ShepherdTourProps> = ({
  disabled = false,
  onClose,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const persistCompletion = useTourCompletion();
  // Garde le tour Shepherd dans une ref pour le destroy au unmount.
  // Type unknown pour rester compatible avec le code-splitting dynamique
  // (Shepherd.Tour vs default export selon les versions).
  const tourRef = useRef<unknown | null>(null);

  useEffect(() => {
    if (disabled) return;

    let cancelled = false;
    let tour: {
      addStep: (opts: Record<string, unknown>) => void;
      start: () => void;
      complete: () => void;
      cancel: () => void;
      next: () => void;
      back: () => void;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      isActive: () => boolean;
    } | null = null;

    // Import dynamique → Shepherd reste hors bundle initial.
    void import("shepherd.js").then((mod) => {
      if (cancelled) return;
      // Shepherd v14 expose `Tour` à la racine du module (named export).
      // Fallback `default` au cas où la résolution interop diffère.
      const ShepherdNS = mod as unknown as {
        Tour?: new (opts: Record<string, unknown>) => typeof tour;
        default?: {
          Tour?: new (opts: Record<string, unknown>) => typeof tour;
        };
      };
      const TourCtor =
        ShepherdNS.Tour || ShepherdNS.default?.Tour || undefined;
      if (!TourCtor) {
        console.warn("[shepherd-tour] Shepherd.Tour ctor introuvable");
        return;
      }

      tour = new TourCtor({
        useModalOverlay: true,
        defaultStepOptions: {
          cancelIcon: { enabled: true, label: t.onboarding.tour.buttons.skip },
          classes: "ds-shepherd-step",
          scrollTo: { behavior: "smooth", block: "center" },
          modalOverlayOpeningPadding: 6,
          modalOverlayOpeningRadius: 12,
        },
        // a11y : Shepherd attache aria-label sur l'overlay et focus le
        // premier élément focusable du popup.
        exitOnEsc: true,
        keyboardNavigation: true,
      });

      // Attache des listeners globaux pour analytics
      tour!.on("start", () => {
        analytics.capture("onboarding_tour_started");
      });
      tour!.on("complete", () => {
        void persistCompletion("completed");
        onClose?.();
      });
      tour!.on("cancel", () => {
        void persistCompletion("skipped");
        onClose?.();
      });

      // Construit les steps
      const total = TOUR_STEPS.length;
      TOUR_STEPS.forEach((step, idx) => {
        const isLast = idx === total - 1;
        const isFirst = idx === 0;
        const i18n = t.onboarding.tour[step.i18nKey];

        const buttons: Array<Record<string, unknown>> = [];
        if (!isFirst) {
          buttons.push({
            text: t.onboarding.tour.buttons.back,
            classes: "ds-shepherd-btn ds-shepherd-btn-secondary",
            action: () => {
              if (tour) tour.back();
            },
          });
        }
        // Skip toujours visible (sauf dernier step → remplacé par "Done")
        if (!isLast) {
          buttons.push({
            text: t.onboarding.tour.buttons.skip,
            classes: "ds-shepherd-btn ds-shepherd-btn-ghost",
            action: () => {
              if (tour) tour.cancel();
            },
          });
          buttons.push({
            text: t.onboarding.tour.buttons.next,
            classes: "ds-shepherd-btn ds-shepherd-btn-primary",
            action: () => {
              analytics.trackOnboardingStep(step.id, "completed", {
                stepIndex: idx,
                total,
              });
              if (tour) tour.next();
            },
          });
        } else {
          buttons.push({
            text: t.onboarding.tour.buttons.done,
            classes: "ds-shepherd-btn ds-shepherd-btn-primary",
            action: () => {
              analytics.trackOnboardingStep(step.id, "completed", {
                stepIndex: idx,
                total,
              });
              // CTA final : scroll vers l'input principal puis termine.
              const inputEl = document.querySelector(
                '[data-tour-step="analyze-input"]',
              ) as HTMLElement | null;
              if (inputEl) {
                inputEl.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
                // Focus l'input texte si trouvable (URL/search)
                const focusable = inputEl.querySelector(
                  'input[type="url"], input[type="text"], textarea',
                ) as HTMLElement | null;
                focusable?.focus();
              } else {
                navigate("/dashboard");
              }
              if (tour) tour.complete();
            },
          });
        }

        // Préparation du step. Si target null → step centré (modal-like).
        const stepConfig: Record<string, unknown> = {
          id: step.id,
          title: i18n.title,
          text: i18n.text,
          buttons,
          classes: `ds-shepherd-step ds-shepherd-step-${step.id}`,
          when: {
            show: () => {
              analytics.trackOnboardingStep(step.id, "shown", {
                stepIndex: idx,
                total,
              });
            },
          },
        };

        if (step.target) {
          // Vérification gracieuse : si le target est absent (ex: route où
          // Sidebar n'existe pas), on ne casse pas le tour — Shepherd skip
          // automatiquement avec showOn=false.
          stepConfig.attachTo = { element: step.target, on: step.on };
          stepConfig.showOn = () =>
            !!document.querySelector(step.target as string);
        }

        tour!.addStep(stepConfig);
      });

      tourRef.current = tour;

      // Démarre — petit setTimeout pour laisser le temps au DOM de monter
      // tous les targets après le first paint post-onboarding.
      setTimeout(() => {
        if (!cancelled && tour && !tour.isActive()) {
          try {
            tour.start();
          } catch (err) {
            console.warn("[shepherd-tour] start failed", err);
          }
        }
      }, 250);
    });

    return () => {
      cancelled = true;
      if (tour && tour.isActive()) {
        try {
          tour.cancel();
        } catch {
          /* noop */
        }
      }
      tourRef.current = null;
    };
    // ESLint react-hooks/exhaustive-deps : on ignore volontairement t/navigate/
    // persistCompletion/onClose pour éviter de redémarrer le tour à chaque
    // re-render. Le tour est mounté une seule fois (cycle de vie du composant).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  return null;
};

export default ShepherdTour;
export { ShepherdTour };
