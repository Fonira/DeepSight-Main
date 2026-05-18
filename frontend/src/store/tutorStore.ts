// frontend/src/store/tutorStore.ts
//
// Store Zustand pour Le Tuteur (Phase 2 V2 — mai 2026).
//
// Promotion du `useReducer` local (frontend/src/components/Tutor/useTutor.ts)
// en store global. Raison : la conversation doit être partagée entre la popup
// flottante (sidebar + concept primer) et la vue plein écran dans le Hub
// (`/hub?fsChat=tutor`).
//
// Le hook `useTutor` reste exposé comme wrapper minimal autour de ce store
// pour préserver l'API existante des composants Tutor (signature inchangée).

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { tutorApi } from "../services/api";
import type { TutorLang, TutorPhase, TutorTurn } from "../types/tutor";
import type { TutorConceptItem } from "../types/conceptImage";

export interface StartSessionOpts {
  concept_term: string;
  concept_def: string;
  summary_id?: number;
  source_video_title?: string;
  mode: "text";
  lang?: TutorLang;
}

export interface TutorState {
  phase: TutorPhase;
  sessionId: string | null;
  messages: TutorTurn[];
  conceptTerm: string | null;
  conceptDef: string | null;
  summaryId: number | null;
  sourceVideoTitle: string | null;
  lang: TutorLang;
  loading: boolean;
  error: string | null;
  /** True quand la conv est rendue en vue Hub fullscreen (/hub?fsChat=tutor). */
  fullscreen: boolean;

  // ── Concept illustrations (sprint 2026-05-18 — Expert only) ────────────
  concepts: TutorConceptItem[];
  conceptsLoading: boolean;
  conceptsError: string | null;
  conceptsLastFetch: number | null;
  conceptsPollingActive: boolean;

  openPrompting: () => void;
  cancelPrompting: () => void;
  startSession: (opts: StartSessionOpts) => Promise<void>;
  submitTextTurn: (input: string) => Promise<void>;
  /**
   * End the backend Redis session.
   *
   * - `{ keepMessages: true }` keeps the local transcript visible (used when
   *   toggling text → voice inside the unified TutorHub timeline — Redis is
   *   torn down but the user still sees their text history).
   * - Default (`undefined` / `{ keepMessages: false }`) wipes the whole store
   *   back to INITIAL (used on hub close / explicit reset).
   */
  endSession: (opts?: { keepMessages?: boolean }) => Promise<void>;
  setFullscreen: (v: boolean) => void;
  reset: () => void;

  fetchConcepts: (limit?: number) => Promise<void>;
  generateConcept: (
    term: string,
    definition?: string,
    category?: string | null,
  ) => Promise<void>;
  startConceptsPolling: () => void;
  stopConceptsPolling: () => void;
  clearConcepts: () => void;
}

const INITIAL: Pick<
  TutorState,
  | "phase"
  | "sessionId"
  | "messages"
  | "conceptTerm"
  | "conceptDef"
  | "summaryId"
  | "sourceVideoTitle"
  | "lang"
  | "loading"
  | "error"
  | "fullscreen"
  | "concepts"
  | "conceptsLoading"
  | "conceptsError"
  | "conceptsLastFetch"
  | "conceptsPollingActive"
> = {
  phase: "idle",
  sessionId: null,
  messages: [],
  conceptTerm: null,
  conceptDef: null,
  summaryId: null,
  sourceVideoTitle: null,
  lang: "fr",
  loading: false,
  error: null,
  fullscreen: false,
  concepts: [],
  conceptsLoading: false,
  conceptsError: null,
  conceptsLastFetch: null,
  conceptsPollingActive: false,
};

// ── Polling concepts illustrés (back-off 5s → 10s → 30s) ──────────────────
// Module-level guard pour éviter les doubles timers : `startConceptsPolling`
// est idempotent. Quand plus aucun concept n'est `pending` pendant 60s, on
// stoppe automatiquement le polling (le composant peut le relancer au mount
// suivant si nécessaire).
let _pollTimerId: ReturnType<typeof setTimeout> | null = null;
let _pollAttempt = 0;
let _lastPendingSeenAt: number | null = null;
const POLL_INTERVALS_MS = [5_000, 10_000, 30_000];
const POLL_NO_PENDING_TIMEOUT_MS = 60_000;

function _computeNextDelay(): number {
  const idx = Math.min(_pollAttempt, POLL_INTERVALS_MS.length - 1);
  return POLL_INTERVALS_MS[idx];
}

function _resetPollGuards(): void {
  if (_pollTimerId !== null) {
    clearTimeout(_pollTimerId);
    _pollTimerId = null;
  }
  _pollAttempt = 0;
  _lastPendingSeenAt = null;
}

export const useTutorStore = create<TutorState>()(
  immer((set, get) => ({
    ...INITIAL,

    openPrompting: () =>
      set((s) => {
        s.phase = "prompting";
        s.error = null;
      }),

    cancelPrompting: () =>
      set((s) => {
        s.phase = "idle";
      }),

    startSession: async (opts) => {
      const lang: TutorLang = opts.lang ?? "fr";
      // Optimistically push the user's input (concept_term) as the first
      // visible turn. Without this, the transcript only shows the agent's
      // first_prompt and the user can't tell what they just submitted.
      const userTurnTs = Date.now();
      set((s) => {
        s.lang = lang;
        s.loading = true;
        s.error = null;
        s.messages = [
          {
            role: "user",
            content: opts.concept_term,
            timestamp_ms: userTurnTs,
          },
        ];
      });
      try {
        const resp = await tutorApi.sessionStart({
          concept_term: opts.concept_term,
          concept_def: opts.concept_def,
          summary_id: opts.summary_id,
          source_video_title: opts.source_video_title,
          mode: "text",
          lang,
        });
        set((s) => {
          s.phase = "mini-chat";
          s.sessionId = resp.session_id;
          s.conceptTerm = opts.concept_term;
          s.conceptDef = opts.concept_def;
          s.summaryId = opts.summary_id ?? null;
          s.sourceVideoTitle = opts.source_video_title ?? null;
          s.messages.push({
            role: "assistant",
            content: resp.first_prompt,
            timestamp_ms: Date.now(),
          });
          s.loading = false;
        });
      } catch (err) {
        set((s) => {
          // Roll back the optimistic user turn so the empty-state UI returns.
          s.messages = [];
          s.error = (err as Error).message;
          s.loading = false;
        });
      }
    },

    submitTextTurn: async (input) => {
      const sessionId = get().sessionId;
      if (!sessionId) return;
      set((s) => {
        s.messages.push({
          role: "user",
          content: input,
          timestamp_ms: Date.now(),
        });
        s.loading = true;
      });
      try {
        const resp = await tutorApi.sessionTurn(sessionId, {
          user_input: input,
        });
        set((s) => {
          s.messages.push({
            role: "assistant",
            content: resp.ai_response,
            timestamp_ms: Date.now(),
          });
          s.loading = false;
        });
      } catch (err) {
        set((s) => {
          s.error = (err as Error).message;
          s.loading = false;
        });
      }
    },

    endSession: async (opts) => {
      const sessionId = get().sessionId;
      if (sessionId) {
        try {
          await tutorApi.sessionEnd(sessionId);
        } catch (err) {
          // Best-effort — logger mais ne pas bloquer
          console.error("[tutorStore] endSession failed", err);
        }
      }
      set((s) => {
        if (opts?.keepMessages) {
          const savedMessages = s.messages;
          Object.assign(s, INITIAL);
          s.messages = savedMessages;
        } else {
          Object.assign(s, INITIAL);
        }
      });
    },

    setFullscreen: (v) =>
      set((s) => {
        s.fullscreen = v;
      }),

    reset: () =>
      set((s) => {
        Object.assign(s, INITIAL);
      }),

    // ── Concept illustrations actions ──────────────────────────────────────
    // NOTE : mutations en place via immer pour préserver les selectors leaf
    // (cf. TutorHub.tsx l.203-213 — éviter React #300/#310 re-render storm).

    fetchConcepts: async (limit = 20) => {
      set((s) => {
        s.conceptsLoading = true;
        s.conceptsError = null;
      });
      try {
        const resp = await tutorApi.listConcepts(limit);
        set((s) => {
          s.concepts = resp.concepts;
          s.conceptsLoading = false;
          s.conceptsLastFetch = Date.now();
        });
      } catch (err) {
        set((s) => {
          s.conceptsError = (err as Error).message;
          s.conceptsLoading = false;
        });
      }
    },

    generateConcept: async (term, definition, category) => {
      try {
        const resp = await tutorApi.generateConcept({
          term,
          definition,
          category,
        });
        set((s) => {
          // Upsert le concept retourné dans la liste (par term_hash).
          const idx = s.concepts.findIndex(
            (c) => c.term_hash === resp.term_hash,
          );
          const next: TutorConceptItem = {
            term: resp.term,
            term_hash: resp.term_hash,
            category: category ?? null,
            image_url: resp.image_url ?? null,
            status: resp.status,
          };
          if (idx >= 0) {
            s.concepts[idx] = next;
          } else {
            s.concepts.push(next);
          }
        });
      } catch (err) {
        // Silent log — pas de UX bloquant côté carrousel (le statut "failed"
        // est déjà géré par la liste retournée par fetchConcepts).
        console.warn("[tutorStore] generateConcept failed", err);
      }
    },

    startConceptsPolling: () => {
      // Idempotent : si polling déjà actif, no-op (évite doubles timers).
      if (get().conceptsPollingActive) return;

      set((s) => {
        s.conceptsPollingActive = true;
      });
      _pollAttempt = 0;
      _lastPendingSeenAt = null;

      const tick = async () => {
        // Si le polling a été stoppé entre deux ticks, sortir proprement.
        if (!get().conceptsPollingActive) return;

        await get().fetchConcepts();

        if (!get().conceptsPollingActive) return;

        const concepts = get().concepts;
        const pendingCount = concepts.filter(
          (c) => c.status === "pending",
        ).length;
        const now = Date.now();

        if (pendingCount > 0) {
          // Pending détecté → on continue à poller, on enregistre l'horodatage.
          _lastPendingSeenAt = now;
        } else if (_lastPendingSeenAt !== null) {
          // Pending vu auparavant, plus rien maintenant → stop si >60s écoulé.
          if (now - _lastPendingSeenAt >= POLL_NO_PENDING_TIMEOUT_MS) {
            get().stopConceptsPolling();
            return;
          }
        } else {
          // Aucun pending depuis le début. On donne 3 attempts pour laisser
          // une chance au backend de pre-gen, puis on coupe.
          if (_pollAttempt >= 3) {
            get().stopConceptsPolling();
            return;
          }
        }

        // Calcule le delay AVANT incrément pour respecter le back-off
        // documenté : 1er reschedule à 5s, 2e à 10s, 3e+ à 30s.
        const delay = _computeNextDelay();
        _pollAttempt += 1;
        _pollTimerId = setTimeout(() => {
          void tick();
        }, delay);
      };

      // Premier fetch immédiat puis enchaînement back-off.
      void tick();
    },

    stopConceptsPolling: () => {
      _resetPollGuards();
      set((s) => {
        s.conceptsPollingActive = false;
      });
    },

    clearConcepts: () => {
      _resetPollGuards();
      set((s) => {
        s.concepts = [];
        s.conceptsLoading = false;
        s.conceptsError = null;
        s.conceptsLastFetch = null;
        s.conceptsPollingActive = false;
      });
    },
  })),
);
