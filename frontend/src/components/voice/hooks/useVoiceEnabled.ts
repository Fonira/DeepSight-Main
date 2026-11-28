/**
 * useVoiceEnabled — l'utilisateur peut-il lancer un appel vocal ?
 *
 * Deux conditions, comme dans l'extension (utils/features.ts) :
 *  - l'API a la voix branchée : `voice_available` de /api/auth/me (clé
 *    ElevenLabs présente, interrupteur VOICE_CALL_DISABLED coupé ou admin) ;
 *  - le plan inclut la voix (PLAN_LIMITS[plan].voiceChatEnabled), ou c'est
 *    l'admin — même règle que POST /api/voice/session.
 */

import { useMemo } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { normalizePlanId, PLAN_LIMITS } from "../../../config/planPrivileges";

const ADMIN_EMAIL_VOICE = "maximeleparc3@gmail.com";

export interface UseVoiceEnabledReturn {
  /** Appel possible : voix branchée côté API et plan éligible (ou admin). */
  voiceEnabled: boolean;
  /** Voix branchée côté API, quel que soit le plan. Faux : ne rien proposer. */
  voiceAvailable: boolean;
  isAdmin: boolean;
  plan: ReturnType<typeof normalizePlanId>;
}

export function useVoiceEnabled(): UseVoiceEnabledReturn {
  const { user } = useAuth();

  return useMemo(() => {
    const plan = normalizePlanId(user?.plan);
    const isAdmin =
      Boolean(user?.is_admin) ||
      user?.email?.toLowerCase() === ADMIN_EMAIL_VOICE.toLowerCase();
    const voiceAvailable = user?.voice_available === true;
    const voiceEnabled =
      voiceAvailable && (isAdmin || PLAN_LIMITS[plan].voiceChatEnabled);
    return { voiceEnabled, voiceAvailable, isAdmin, plan };
  }, [user]);
}

export default useVoiceEnabled;
