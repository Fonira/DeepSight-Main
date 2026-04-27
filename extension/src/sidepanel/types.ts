// ── Side Panel — types partagés ──

/**
 * Contexte injecté par le content script (widget) au moment de l'ouverture
 * du side panel. Stocké dans `chrome.storage.session` sous la clé
 * `voicePanelContext`.
 */
export interface VoicePanelContext {
  /** ID interne du Summary DeepSight si une analyse existe pour la vidéo. */
  summaryId?: number | null;
  /** ID YouTube/TikTok extrait de l'URL courante. */
  videoId?: string | null;
  /** Titre de la page (document.title) — fallback display. */
  videoTitle?: string | null;
  /** Plateforme de la vidéo (info pour le backend). */
  platform?: "youtube" | "tiktok" | null;
}

/**
 * Quick Voice Call (B4) — payload `pendingVoiceCall` consommé par App.tsx.
 *
 * Mis en `chrome.storage.session` par le service worker quand l'utilisateur
 * clique le bouton 🎙️ depuis YouTube. App.tsx lit + supprime + passe en
 * prop à VoiceView (centralisation pour éviter race condition StrictMode
 * et re-mount qui perdrait la clé déjà consommée).
 */
export interface PendingVoiceCall {
  videoId: string;
  videoTitle?: string;
}

/**
 * Décide du `agent_type` ElevenLabs selon le contexte vidéo :
 * - `explorer` : on a un summary → l'agent peut creuser le contenu analysé
 * - `companion` : pas de summary → l'agent fait du compagnonnage générique
 */
export function pickAgentType(
  ctx: VoicePanelContext | null | undefined,
): "companion" | "explorer" {
  return ctx && typeof ctx.summaryId === "number" ? "explorer" : "companion";
}

/**
 * Speaker d'un message transcript. Aligné avec le schéma backend
 * `/api/voice/transcripts/append`.
 */
export type TranscriptSpeaker = "user" | "agent";

export interface VoiceTranscript {
  speaker: TranscriptSpeaker;
  content: string;
  ts: number;
}

/** Statuts cycle de vie d'une session voice. */
export type VoiceSessionStatus =
  | "idle"
  | "requesting"
  | "connecting"
  | "listening"
  | "ending"
  | "ended"
  | "error";

// ── Quick Voice Call (Task 16) — phase machine ──
//
// State machine de la VoiceView pour le flow Quick Voice Call (V1).
// Toutes les transitions sont gérées dans `VoiceView.tsx`.
export type VoiceCallState =
  | { phase: "idle" }
  | { phase: "connecting"; videoId: string; videoTitle: string }
  | {
      phase: "live_streaming";
      videoId: string;
      sessionId: string;
      startedAt: number;
    }
  | {
      phase: "live_complete";
      videoId: string;
      sessionId: string;
      startedAt: number;
    }
  | { phase: "ended_free_cta"; reason: "trial_used" }
  | { phase: "ended_expert" }
  | {
      phase: "error_quota";
      reason: "trial_used" | "pro_no_voice" | "monthly_quota";
    }
  | { phase: "error_mic_permission" }
  | { phase: "error_generic"; message: string };
