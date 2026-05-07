// extension/e2e/voice-leak-utils/conversation-builder.ts
//
// Builds the chat-completion history fed to the live LLM, mimicking the
// exact sequence the side panel pushes during a real Quick Voice Call :
//
//   1. system  : EXPLORER_STREAMING_PROMPT_FR or _EN (verbatim from the
//                Python SSOT) prefixed by a short ``VIDÉO ÉCOUTÉE`` /
//                ``VIDEO BEING WATCHED`` block carrying title + channel.
//   2. user    : ``[PHASE TRANSITION] from: startup to: streaming`` (after
//                the first synthetic [CTX UPDATE] arrives, see
//                ``streaming_orchestrator.py``).
//   3. user    : 1-3 ``[CTX UPDATE]`` envelopes carrying transcript chunks
//                / analysis sections (depending on phase reached at this
//                turn).
//   4. user    : ``[CTX COMPLETE]`` if the turn happens after streaming
//                ends, OR ``[CTX FAILED]`` for the failed-pipeline scenarios.
//   5. user    : the actual voice question from the simulated user.
//
// The agent's reply at this point is what we capture and feed to the
// leak detector. For multi-turn scenarios the assistant's previous
// replies are kept in the history so the agent has the full
// conversational context, exactly as the production SDK would.

import type { LlmMessage } from "./llm-client";
import type { Scenario, UserTurn } from "../voice-leak-fixtures/scenarios";
import { loadStreamingPrompts } from "./load-streaming-prompts";

const VIDEO_HEADER_FR = (s: Scenario): string =>
  `VIDÉO ÉCOUTÉE\n` +
  `Titre : ${s.title}\n` +
  `Chaîne : ${s.channel}\n` +
  `Plateforme : YouTube\n` +
  `Durée : ${s.duration === "short" ? "courte (< 10 min)" : "longue (~30 min)"}\n`;

const VIDEO_HEADER_EN = (s: Scenario): string =>
  `VIDEO BEING WATCHED\n` +
  `Title: ${s.title}\n` +
  `Channel: ${s.channel}\n` +
  `Platform: YouTube\n` +
  `Duration: ${s.duration === "short" ? "short (< 10 min)" : "long (~30 min)"}\n`;

function syntheticCtxForTurn(
  scenario: Scenario,
  turnIndex: number,
  turn: UserTurn,
): LlmMessage[] {
  const out: LlmMessage[] = [];

  // First user-driven turn implies we just received some transcript so
  // a phase transition has fired (unless we're still in startup).
  const lang = scenario.language;
  const transcriptSample = scenario.title
    .split(" ")
    .slice(0, 5)
    .join(" ");

  if (turn.phase === "streaming" || turn.phase === "complete") {
    if (turnIndex === 0 || true) {
      // Always (re)emit on the first turn of each sub-phase. The
      // production side panel only emits this once per pipeline ; sending
      // it more often is harmless because the agent was told these are
      // silent envelopes — perfect noise to test against.
      out.push({
        role: "user",
        content:
          lang === "fr"
            ? `[PHASE TRANSITION]\nfrom: startup\nto: streaming`
            : `[PHASE TRANSITION]\nfrom: startup\nto: streaming`,
      });
      out.push({
        role: "user",
        content:
          `[CTX UPDATE]\n` +
          `type: transcript_chunk\n` +
          `meta: {"index": 0, "total": 3, "t_start": 0, "t_end": 90, "pct": 33}\n` +
          `content: ${transcriptSample}…`,
      });
    }
  }

  if (turn.phase === "complete") {
    out.push({
      role: "user",
      content:
        `[PHASE TRANSITION]\nfrom: streaming\nto: complete`,
    });
    out.push({
      role: "user",
      content:
        `[CTX COMPLETE]\n` +
        `final_digest: A short synthesis of "${scenario.title}".\n` +
        `transcript_total_chars: 12345\n` +
        `analysis_sections: [summary, key_points]`,
    });
  }

  if (turn.phase === "failed") {
    out.push({
      role: "user",
      content:
        `[CTX FAILED]\n` +
        `reason: transcript_unavailable\n` +
        `fallback_strategy: use_pretrained_and_web_search`,
    });
  }

  return out;
}

/**
 * Build the message history for ``Scenario.turns[turnIndex]`` ready to
 * be sent to ``LlmClient.ask``. Includes the agent's prior assistant
 * replies (if any) so multi-turn scenarios behave like a real call.
 */
export function buildHistoryForTurn(
  scenario: Scenario,
  turnIndex: number,
  priorAssistantReplies: string[],
): LlmMessage[] {
  const prompts = loadStreamingPrompts();
  const systemBody = scenario.language === "fr" ? prompts.fr : prompts.en;
  const header =
    scenario.language === "fr"
      ? VIDEO_HEADER_FR(scenario)
      : VIDEO_HEADER_EN(scenario);

  const messages: LlmMessage[] = [
    { role: "system", content: `${header}\n\n${systemBody}` },
  ];

  // Replay all prior turns so the model has full conversational state.
  for (let i = 0; i <= turnIndex; i++) {
    const turn = scenario.turns[i];
    messages.push(...syntheticCtxForTurn(scenario, i, turn));
    messages.push({ role: "user", content: turn.user });
    if (i < turnIndex) {
      const prior = priorAssistantReplies[i];
      if (prior !== undefined) {
        messages.push({ role: "assistant", content: prior });
      }
    }
  }

  return messages;
}
