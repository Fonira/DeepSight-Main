/**
 * useVoiceEnabled — Hook de gating premium voice chat
 *
 * Encapsule la logique admin email + PLAN_LIMITS dupliquée dans 3 pages
 * (DashboardPage, History, DebatePage) :
 *
 * ```ts
 * const ADMIN_EMAIL_VOICE = "maximeleparc3@gmail.com";
 * const isAdminVoice =
 *   user?.is_admin ||
 *   user?.email?.toLowerCase() === ADMIN_EMAIL_VOICE.toLowerCase();
 * const voiceEnabled =
 *   isAdminVoice || PLAN_LIMITS[normalizePlanId(user?.plan)].voiceChatEnabled;
 * ```
 *
 * Spec ElevenLabs ecosystem #2 §c.
 */

import { useAuth } from "../../../hooks/useAuth";
import { PLAN_LIMITS, normalizePlanId } from "../../../config/planPrivileges";

/** Email admin canonique avec accès voice illimité, peu importe le plan. */
const ADMIN_EMAIL_VOICE = "maximeleparc3@gmail.com";

/**
 * Retourne `true` si l'utilisateur courant a accès au voice chat — soit via
 * son plan (PLAN_LIMITS.voiceChatEnabled), soit en tant qu'admin
 * (`is_admin` ou email canonique). Les pages utilisent cette valeur pour
 * gater l'ouverture de la modal et afficher l'état "locked" sur les CTA.
 */
export function useVoiceEnabled(): boolean {
  const { user } = useAuth();

  if (!user) return false;

  const isAdminVoice =
    user.is_admin === true ||
    user.email?.toLowerCase() === ADMIN_EMAIL_VOICE.toLowerCase();

  if (isAdminVoice) return true;

  const plan = normalizePlanId(user.plan);
  return PLAN_LIMITS[plan]?.voiceChatEnabled ?? false;
}

export default useVoiceEnabled;
