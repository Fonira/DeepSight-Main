/**
 * useResolvedSummaryId — Helper hook pour ConversationScreen / Quick Voice Call V3.
 *
 * Retourne le `summaryId` (string) à utiliser pour les hooks downstream
 * (`useChat`). Convertit number → string puisque `useChat` attend un `string`
 * (typé comme tel via expo-router params).
 *
 * Trois cas :
 * - `input.summaryId` fourni → retour direct (mode "analyse existante").
 * - `input.videoUrl` fourni → null tant que `voice.summaryId` n'est pas ack
 *   par le backend (mode `explorer_streaming`). Une fois ack, retourne
 *   `String(voiceSummaryId)`.
 * - Ni l'un ni l'autre → null (useChat no-op, pas de chargement d'historique).
 *
 * Aligné avec spec §4.2 (`docs/superpowers/specs/2026-05-02-quick-chat-call-unified-design.md`).
 */

interface ResolveInput {
  /** ID d'une analyse existante (priorité absolue). */
  summaryId?: string;
  /** URL vidéo fraîche → backend crée un Summary placeholder via voice session. */
  videoUrl?: string;
  /** ID Summary exposé par useVoiceChat après ack du backend (mode explorer_streaming). */
  voiceSummaryId?: number | null;
}

export function useResolvedSummaryId(input: ResolveInput): string | null {
  if (input.summaryId) return input.summaryId;
  if (input.voiceSummaryId != null) return String(input.voiceSummaryId);
  return null;
}
