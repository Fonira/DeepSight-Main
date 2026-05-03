// frontend/src/components/Tutor/useTutor.ts

import { useReducer, useCallback } from "react";
import { tutorApi } from "../../services/api";
import type {
  TutorPhase,
  TutorMode,
  TutorLang,
  TutorTurn,
} from "../../types/tutor";

interface TutorState {
  phase: TutorPhase;
  sessionId: string | null;
  messages: TutorTurn[];
  conceptTerm: string | null;
  conceptDef: string | null;
  summaryId: number | null;
  sourceVideoTitle: string | null;
  mode: TutorMode;
  lang: TutorLang;
  loading: boolean;
  error: string | null;
  currentAudioUrl: string | null;
}

type Action =
  | { type: "OPEN_PROMPTING" }
  | { type: "CANCEL_PROMPTING" }
  | { type: "SESSION_STARTING"; mode: TutorMode; lang: TutorLang }
  | {
      type: "SESSION_STARTED";
      session_id: string;
      first_prompt: string;
      concept_term: string;
      concept_def: string;
      summary_id: number | null;
      source_video_title: string | null;
      audio_url: string | null;
    }
  | { type: "TURN_PENDING"; user_input: string }
  | { type: "TURN_DONE"; ai_response: string; audio_url: string | null }
  | { type: "DEEPEN" }
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
  mode: "text",
  lang: "fr",
  loading: false,
  error: null,
  currentAudioUrl: null,
};

function reducer(state: TutorState, action: Action): TutorState {
  switch (action.type) {
    case "OPEN_PROMPTING":
      return { ...state, phase: "prompting", error: null };
    case "CANCEL_PROMPTING":
      return { ...state, phase: "idle" };
    case "SESSION_STARTING":
      return {
        ...state,
        mode: action.mode,
        lang: action.lang,
        loading: true,
        error: null,
      };
    case "SESSION_STARTED":
      return {
        ...state,
        phase: state.mode === "voice" ? "deep-session" : "mini-chat",
        sessionId: action.session_id,
        conceptTerm: action.concept_term,
        conceptDef: action.concept_def,
        summaryId: action.summary_id,
        sourceVideoTitle: action.source_video_title,
        currentAudioUrl: action.audio_url,
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
        currentAudioUrl: action.audio_url,
        loading: false,
      };
    case "DEEPEN":
      return { ...state, phase: "deep-session" };
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
  mode: TutorMode;
  lang?: TutorLang;
}

export function useTutor() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const openPrompting = useCallback(
    () => dispatch({ type: "OPEN_PROMPTING" }),
    [],
  );
  const cancelPrompting = useCallback(
    () => dispatch({ type: "CANCEL_PROMPTING" }),
    [],
  );

  const startSession = useCallback(async (params: StartSessionParams) => {
    const lang = params.lang ?? "fr";
    dispatch({ type: "SESSION_STARTING", mode: params.mode, lang });
    try {
      const resp = await tutorApi.sessionStart({
        concept_term: params.concept_term,
        concept_def: params.concept_def,
        summary_id: params.summary_id,
        source_video_title: params.source_video_title,
        mode: params.mode,
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
        audio_url: resp.audio_url,
      });
    } catch (err) {
      dispatch({ type: "ERROR", message: (err as Error).message });
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
          audio_url: resp.audio_url,
        });
      } catch (err) {
        dispatch({ type: "ERROR", message: (err as Error).message });
      }
    },
    [state.sessionId],
  );

  const deepen = useCallback(() => dispatch({ type: "DEEPEN" }), []);

  const endSession = useCallback(async () => {
    if (state.sessionId) {
      try {
        await tutorApi.sessionEnd(state.sessionId);
      } catch (err) {
        // Best effort — logger mais ne pas bloquer
        console.error("[useTutor] endSession failed", err);
      }
    }
    dispatch({ type: "SESSION_ENDED" });
  }, [state.sessionId]);

  return {
    ...state,
    openPrompting,
    cancelPrompting,
    startSession,
    submitTextTurn,
    deepen,
    endSession,
  };
}
