/**
 * useSemanticSearchEnabled — Hook gating UI Semantic Search V1.
 *
 * Optimistic par défaut (true). Fetch /api/features au mount, met à jour l'état
 * si le flag est explicitement OFF. Permet de cacher le tab Search sans rebuild
 * mobile quand `FEATURE_SEMANTIC_SEARCH_V1=false` côté backend.
 */

import { useEffect, useState } from "react";
import { isSemanticSearchV1Enabled } from "../services/featureFlags";

export function useSemanticSearchEnabled(): boolean {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let active = true;
    isSemanticSearchV1Enabled()
      .then((v) => {
        if (active) setEnabled(v);
      })
      .catch(() => {
        // Optimistic — on garde true si erreur.
      });
    return () => {
      active = false;
    };
  }, []);

  return enabled;
}
