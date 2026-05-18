// frontend/src/components/Tutor/TutorConceptsCarousel.tsx
//
// Bandeau horizontal "Concepts illustrés" du Tuteur (sprint 2026-05-18).
// Gating Expert (plan ou is_admin). Scroll horizontal manuel snap-x avec
// gradient masks gauche/droite pour signaler le débordement.
//
// Lifecycle :
//   - Mount   → `startConceptsPolling()` (back-off 5s/10s/30s, auto-stop
//                 après 60s sans pending — géré dans le store).
//   - Unmount → `stopConceptsPolling()`.
//
// Source de vérité : `useTutorStore` (Agent B). Lecture en sélecteurs leaf
// (`s => s.x`) — JAMAIS destructure un objet entier sous peine de re-render
// storm React #300/#310 (cf. TutorHub.tsx l.203-213).
//
// i18n inline (pattern identique à TutorHub.tsx). Pas d'ajout de lib.

import React, { useContext, useEffect } from "react";
import { motion } from "framer-motion";
import { useTutorStore } from "../../store/tutorStore";
import { useAuthContext } from "../../contexts/AuthContext";
import { PLAN_FEATURES, type PlanId } from "../../config/planPrivileges";
import { LanguageContext } from "../../contexts/LanguageContext";
import ConceptCard from "./ConceptCard";
import type { TutorConceptItem } from "../../types/conceptImage";

export interface TutorConceptsCarouselProps {
  onConceptClick?: (concept: TutorConceptItem) => void;
}

const I18N = {
  fr: {
    title: "Concepts",
    empty: "Aucun concept illustré pour le moment.",
    loading: "Chargement…",
    throttledHint:
      "Quota d'illustrations atteint — réessayez demain.",
    regionLabel: "Concepts illustrés du Tuteur",
  },
  en: {
    title: "Concepts",
    empty: "No illustrated concepts yet.",
    loading: "Loading…",
    throttledHint: "Illustration quota reached — try again tomorrow.",
    regionLabel: "Tutor illustrated concepts",
  },
} as const;

/**
 * Gating helper : Expert plan OR is_admin → composant rendu.
 * Mirror de la matrice `PLAN_FEATURES[plan].tutorConceptsCarousel`.
 */
function userCanSeeCarousel(
  plan: string | undefined,
  isAdmin: boolean | undefined,
): boolean {
  if (isAdmin === true) return true;
  const normalized = (plan ?? "free") as PlanId;
  return Boolean(PLAN_FEATURES[normalized]?.tutorConceptsCarousel);
}

const TutorConceptsCarousel: React.FC<TutorConceptsCarouselProps> = ({
  onConceptClick,
}) => {
  // ── Auth gating ────────────────────────────────────────────────────────
  const { user } = useAuthContext();
  const allowed = userCanSeeCarousel(user?.plan, user?.is_admin);

  // ── Language (safe fallback if no provider — same pattern as TutorHub) ─
  const languageCtx = useContext(LanguageContext);
  const language: "fr" | "en" =
    languageCtx?.language === "en" ? "en" : "fr";
  const t = I18N[language];

  // ── Zustand selectors (leaf-by-leaf, stable refs) ──────────────────────
  const concepts = useTutorStore((s) => s.concepts);
  const conceptsLoading = useTutorStore((s) => s.conceptsLoading);
  const conceptsLastFetch = useTutorStore((s) => s.conceptsLastFetch);
  const startConceptsPolling = useTutorStore((s) => s.startConceptsPolling);
  const stopConceptsPolling = useTutorStore((s) => s.stopConceptsPolling);

  // ── Lifecycle : mount → polling, unmount → stop ────────────────────────
  useEffect(() => {
    if (!allowed) return undefined;
    startConceptsPolling();
    return () => {
      stopConceptsPolling();
    };
    // Sélecteurs Zustand pour actions = refs stables : safe à omettre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  if (!allowed) {
    return null;
  }

  // Filtre : on n'affiche que ready + pending. Failed/throttled/missing
  // sont retirés du carrousel (la carte serait null de toute façon —
  // évite des trous visuels dans le snap).
  const visibleConcepts = concepts.filter(
    (c) => c.status === "ready" || c.status === "pending",
  );

  const handleClick = (concept: TutorConceptItem) => {
    if (concept.status !== "ready") {
      // Pending → no-op (laisser le polling finir le job).
      return;
    }
    onConceptClick?.(concept);
  };

  // Empty state :
  //   - loading + premier fetch (lastFetch null) → render rien (silent).
  //   - !loading + lastFetch ≠ null + 0 visible → empty message centré.
  const hasFetchedAtLeastOnce = conceptsLastFetch !== null;
  const showEmptyState =
    visibleConcepts.length === 0 && !conceptsLoading && hasFetchedAtLeastOnce;
  const showSilentLoading =
    visibleConcepts.length === 0 && conceptsLoading && !hasFetchedAtLeastOnce;

  return (
    <motion.section
      role="region"
      aria-label={t.regionLabel}
      aria-busy={conceptsLoading}
      className="relative w-full border-b border-white/[0.04] bg-bg-primary/30 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      data-testid="tutor-concepts-carousel"
    >
      {/* Title row */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
          {t.title}
        </h3>
        {conceptsLoading && (
          <span className="text-[10px] text-text-tertiary">{t.loading}</span>
        )}
      </div>

      {/* Body */}
      {showSilentLoading ? (
        // Premier fetch en cours → rien (le badge "loading" suffit).
        <div className="px-4 pb-3" data-testid="tutor-concepts-silent" />
      ) : showEmptyState ? (
        <p
          className="px-4 pb-3 text-xs text-text-tertiary text-center"
          data-testid="tutor-concepts-empty"
        >
          {t.empty}
        </p>
      ) : (
        <div className="relative">
          <ul
            className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory px-4 pb-3 pt-1 scrollbar-thin"
            style={{ scrollbarColor: "rgba(255,255,255,0.05) transparent" }}
            data-testid="tutor-concepts-list"
          >
            {visibleConcepts.map((c) => (
              <ConceptCard
                key={c.term_hash}
                concept={c}
                onClick={handleClick}
              />
            ))}
          </ul>
          {/* Gradient masks pour signaler scrollable */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-bg-primary to-transparent"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-bg-primary to-transparent"
            aria-hidden="true"
          />
        </div>
      )}
    </motion.section>
  );
};

export default TutorConceptsCarousel;
