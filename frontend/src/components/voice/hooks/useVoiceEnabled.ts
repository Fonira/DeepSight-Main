/**
 * useVoiceEnabled — Hook qui détermine si l'utilisateur a accès au voice chat.
 *
 * ⚠️ TEMP STUB (Spec #5 — B5 agent)
 * Ce hook fait partie de la Spec #2 (B2 agent) qui développe la couche
 * VoiceCallProvider. Il est défini ici pour permettre à Spec #5 d'avancer
 * en parallèle. Quand B2 push sa branche, ce fichier sera remplacé/réintégré.
 *
 * Logique métier : isAdmin OR PLAN_LIMITS[plan].voiceChatEnabled.
 * Reproduit le comportement déjà câblé dans DashboardPage / History / DebatePage.
 */

import { useMemo } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { normalizePlanId, PLAN_LIMITS } from "../../../config/planPrivileges";

const ADMIN_EMAIL_VOICE = "maximeleparc3@gmail.com";

export interface UseVoiceEnabledReturn {
  voiceEnabled: boolean;
  isAdmin: boolean;
  plan: ReturnType<typeof normalizePlanId>;
}

export function useVoiceEnabled(): UseVoiceEnabledReturn {
  const { user } = useAuth();

  return useMemo(() => {
    const plan = normalizePlanId(user?.plan);
    const isAdmin =
      Boolean(user?.is_admin) ||
      (user?.email?.toLowerCase() === ADMIN_EMAIL_VOICE.toLowerCase());
    const voiceEnabled = isAdmin || PLAN_LIMITS[plan].voiceChatEnabled;
    return { voiceEnabled, isAdmin, plan };
  }, [user]);
}

export default useVoiceEnabled;
