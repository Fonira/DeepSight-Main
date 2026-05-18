// frontend/src/components/Tutor/ConceptCard.tsx
//
// Carte individuelle pour le carrousel "Concepts illustrés du Tuteur"
// (sprint 2026-05-18 — Expert only). Sous-composant feuille de
// `TutorConceptsCarousel` — minimaliste, dimensions compactes pour ~6-8
// visibles côte à côte sur une largeur Hub typique.
//
// Comportement par status :
//   - "ready"   + image_url truthy → <img> carrée lazy, alt=term.
//                                    Si onError → composant retourne null
//                                    (spec Maxime : pas de fallback texte).
//   - "pending"                    → DoodleIcon "sparkles" pulse 32px
//                                    centré dans la même boîte (placeholder
//                                    discret pendant la génération Gemini).
//   - "failed" / "throttled" /     → null (carte invisible — la spec demande
//     "missing"                      « ne rien afficher si pas généré »).

import React, { useState } from "react";
import { motion } from "framer-motion";
import DoodleIcon from "../doodles/DoodleIcon";
import type { TutorConceptItem } from "../../types/conceptImage";

export interface ConceptCardProps {
  concept: TutorConceptItem;
  onClick?: (concept: TutorConceptItem) => void;
}

const ConceptCard: React.FC<ConceptCardProps> = ({ concept, onClick }) => {
  const [hasError, setHasError] = useState(false);

  // Filtres durs : statuts non rendus retournent null (carte invisible).
  if (
    concept.status === "failed" ||
    concept.status === "throttled" ||
    concept.status === "missing"
  ) {
    return null;
  }

  // Image failed à charger côté <img> → null (pas de fallback texte demandé).
  if (concept.status === "ready" && (!concept.image_url || hasError)) {
    return null;
  }

  const handleActivate = () => {
    onClick?.(concept);
  };

  const displayLabel =
    concept.term.length > 20
      ? `${concept.term.slice(0, 18)}…`
      : concept.term;

  return (
    <motion.li
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="snap-start shrink-0 w-24 flex flex-col items-center cursor-pointer group"
      onClick={handleActivate}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleActivate();
        }
      }}
      aria-label={concept.term}
      data-testid={`concept-card-${concept.term_hash}`}
      data-status={concept.status}
    >
      <div className="w-24 h-24 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center overflow-hidden group-hover:bg-white/[0.06] group-hover:border-white/10 transition-all">
        {concept.status === "ready" && concept.image_url ? (
          <img
            src={concept.image_url}
            alt={concept.term}
            loading="lazy"
            onError={() => setHasError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          // status === "pending" → placeholder doodle discret animé.
          <DoodleIcon
            name="sparkles"
            size={32}
            className="opacity-40 animate-pulse"
          />
        )}
      </div>
      <span className="mt-1.5 text-[11px] text-text-secondary text-center truncate max-w-full px-1">
        {displayLabel}
      </span>
    </motion.li>
  );
};

export default ConceptCard;
