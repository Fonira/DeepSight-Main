// mobile/src/components/tutor/useTutor.ts
//
// Hook V2 mobile lite — pattern simplifié vs frontend/src/components/Tutor/useTutor.ts.
// Phase réduite à "idle" | "active" : text-only, pas de prompting/deep-session.
// Mode forcé à "text" sur mobile V2 lite (pas de voice côté mobile pour l'instant).

import { useReducer, useCallback } from "react";
import { tutorApi } from "../../services/api";
import type { TutorPhase, TutorLang, TutorTurn } from "../../types/tutor";

interface TutorState {
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
}

type Action =
  | { type: "SESSION_STARTING"; lang: TutorLang }
  | {
      type: "SESSION_STARTED";
      session_id: string;
      first_prompt: string;
      concept_term: string;
      concept_def: string;
      summary_id: number | null;
      source_video_title: string | null;
    }
  | { type: "TURN_PENDING"; user_input: string }
  | { type: "TURN_DONE"; ai_response: string }
  | { type: "SESSION_ENDED" }
  | { type: "ERROR"; message: string };

const initialState: TutorState = {
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
};

function reducer(state: TutorState, action: Action): TutorState {
  switch (action.type) {
    case "SESSION_STARTING":
      return {
        ...state,
        lang: action.lang,
        loading: true,
        error: null,
      };
    case "SESSION_STARTED":
      return {
        ...state,
        phase: "active",
        sessionId: action.session_id,
        conceptTerm: action.concept_term,
        conceptDef: action.concept_def,
        summaryId: action.summary_id,
        sourceVideoTitle: action.source_video_title,
        messages: [
          {
            role: "assistant",
            content: action.first_prompt,
            timestamp_ms: Date.now(),
          },
        ],
        loading: false,
      };
    case "TURN_PENDING":
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            role: "user",
            content: action.user_input,
            timestamp_ms: Date.now(),
          },
        ],
        loading: true,
      };
    case "TURN_DONE":
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            role: "assistant",
            content: action.ai_response,
            timestamp_ms: Date.now(),
          },
        ],
        loading: false,
      };
    case "SESSION_ENDED":
      return initialState;
    case "ERROR":
      return { ...state, error: action.message, loading: false };
    default:
      return state;
  }
}

interface StartSessionParams {
  concept_term: string;
  concept_def: string;
  summary_id?: number;
  source_video_title?: string;
  lang?: TutorLang;
}

export function useTutor() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const startSession = useCallback(async (params: StartSessionParams) => {
    const lang = params.lang ?? "fr";
    dispatch({ type: "SESSION_STARTING", lang });
    try {
      const resp = await tutorApi.sessionStart({
        concept_term: params.concept_term,
        concept_def: params.concept_def,
        summary_id: params.summary_id,
        source_video_title: params.source_video_title,
        // V2 mobile lite : text-only forcé
        mode: "text",
        lang,
      });
      dispatch({
        type: "SESSION_STARTED",
        session_id: resp.session_id,
        first_prompt: resp.first_prompt,
        concept_term: params.concept_term,
        concept_def: params.concept_def,
        summary_id: params.summary_id ?? null,
        source_video_title: params.source_video_title ?? null,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erreur de démarrage";
      dispatch({ type: "ERROR", message });
    }
  }, []);

  const submitTextTurn = useCallback(
    async (user_input: string) => {
      if (!state.sessionId) return;
      dispatch({ type: "TURN_PENDING", user_input });
      try {
        const resp = await tutorApi.sessionTurn(state.sessionId, {
          user_input,
        });
        dispatch({
          type: "TURN_DONE",
          ai_response: resp.ai_response,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erreur réseau";
        dispatch({ type: "ERROR", message });
      }
    },
    [state.sessionId],
  );

  const endSession = useCallback(async () => {
    if (state.sessionId) {
      try {
        await tutorApi.sessionEnd(state.sessionId);
      } catch (err) {
        // Best effort — logger mais ne pas bloquer la fermeture UI
        // eslint-disable-next-line no-console
        console.warn("[useTutor] endSession failed", err);
      }
    }
    dispatch({ type: "SESSION_ENDED" });
  }, [state.sessionId]);

  return {
    ...state,
    startSession,
    submitTextTurn,
    endSession,
  };
}
