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

  openPrompting: () => void;
  cancelPrompting: () => void;
  startSession: (opts: StartSessionOpts) => Promise<void>;
  submitTextTurn: (input: string) => Promise<void>;
  endSession: () => Promise<void>;
  setFullscreen: (v: boolean) => void;
  reset: () => void;
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
};

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
      set((s) => {
        s.lang = lang;
        s.loading = true;
        s.error = null;
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
          s.messages = [
            {
              role: "assistant",
              content: resp.first_prompt,
              timestamp_ms: Date.now(),
            },
          ];
          s.loading = false;
        });
      } catch (err) {
        set((s) => {
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

    endSession: async () => {
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
        Object.assign(s, INITIAL);
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
  })),
);
