// extension/e2e/voice-leak-utils/mock-voice-agent.ts
//
// Tiny in-memory simulator of the ElevenLabs Conversational AI agent
// configured with the EXPLORER_STREAMING system_prompt. The mocked
// variant of the leak-detection spec uses this when no live LLM is
// available — it replays the canned ``mockAgentReplies`` declared next
// to each scenario.
//
// Scope: this is intentionally NOT a model. It is the test harness
// that *would* be the agent in a real call. It does two things :
//
//   1. Records every "user message" sent to it (real user voice turns
//      AND the synthetic ``[CTX UPDATE]`` envelopes injected by the side
//      panel). This mirrors the real ElevenLabs SDK transcription
//      pipeline.
//
//   2. Returns the next pre-canned reply on each user turn — letting the
//      caller assert that the captured replies do not contain forbidden
//      protocol markers.
//
// The mock also exposes a ``echoCtxUpdates`` knob that simulates the
// pathological behaviour where the SDK echoes the synthetic user
// message back as a transcript line. Toggling this on validates the
// side panel UI filter (or, in our case today, surfaces the absence
// of such a filter — see PR body for the documented finding).

import type { Scenario, UserTurn } from "../voice-leak-fixtures/scenarios";

export interface AgentMessage {
  /** Speaker label that the side panel would render. */
  speaker: "user" | "agent";
  /** Visible text content of the line. */
  text: string;
  /** True for synthetic envelopes injected by the side panel. */
  isSynthetic?: boolean;
}

export interface MockAgentOptions {
  /**
   * If true, the mock simulates an SDK that echoes the synthetic
   * ``[CTX UPDATE]`` user messages back as transcript lines. Default
   * false — most production behaviours discard them.
   */
  echoCtxUpdates?: boolean;
}

export class MockVoiceAgent {
  private replyIndex = 0;
  private readonly transcript: AgentMessage[] = [];
  private readonly options: Required<MockAgentOptions>;

  constructor(
    private readonly scenario: Scenario,
    options: MockAgentOptions = {},
  ) {
    this.options = {
      echoCtxUpdates: options.echoCtxUpdates ?? false,
    };
  }

  /**
   * Forward a side-panel synthetic envelope (CTX UPDATE / PHASE
   * TRANSITION / CTX HEARTBEAT / CTX COMPLETE) to the agent. Called
   * by the test harness once per simulated SSE event.
   *
   * Returns ``null`` if the envelope is silently absorbed (correct
   * behaviour) or the echoed transcript line if the SDK echoes it back
   * (pathological behaviour, opt-in via ``echoCtxUpdates``).
   */
  injectSyntheticUserMessage(envelope: string): AgentMessage | null {
    if (this.options.echoCtxUpdates) {
      const echo: AgentMessage = {
        speaker: "user",
        text: envelope,
        isSynthetic: true,
      };
      this.transcript.push(echo);
      return echo;
    }
    return null;
  }

  /**
   * Simulate the user speaking. The agent records the user line and
   * returns the next canned reply. Throws if the scenario has fewer
   * canned replies than user turns.
   */
  speakAsUser(turn: UserTurn): { agentReply: AgentMessage } {
    this.transcript.push({ speaker: "user", text: turn.user });
    const reply = this.scenario.mockAgentReplies[this.replyIndex];
    if (reply === undefined) {
      throw new Error(
        `MockVoiceAgent: scenario ${this.scenario.id} ran out of canned replies at turn ${this.replyIndex}`,
      );
    }
    this.replyIndex += 1;
    const agentReply: AgentMessage = { speaker: "agent", text: reply };
    this.transcript.push(agentReply);
    return { agentReply };
  }

  /** Return all messages, in order. */
  getTranscript(): readonly AgentMessage[] {
    return this.transcript;
  }

  /** Return only agent replies — the surface tested for leaks. */
  getAgentReplies(): readonly AgentMessage[] {
    return this.transcript.filter((m) => m.speaker === "agent");
  }
}
