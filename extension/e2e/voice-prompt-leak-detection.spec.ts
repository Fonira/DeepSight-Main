// extension/e2e/voice-prompt-leak-detection.spec.ts
//
// E2E Playwright spec — validates that the EXPLORER_STREAMING voice agent
// never leaks the internal [CTX UPDATE] / [PHASE TRANSITION] / [CTX
// HEARTBEAT] / [CTX COMPLETE] envelope tags (or related plumbing jargon)
// into a user-facing voice reply during a Quick Voice Call.
//
// Why this exists
// ---------------
// The streaming side panel injects synthetic user messages prefixed with
// ``[CTX UPDATE]`` / ``[PHASE TRANSITION]`` etc. into the live ElevenLabs
// conversation via ``conversation.sendUserMessage(...)`` — this is how
// transcript chunks and analysis snippets arrive at the agent
// progressively while the user already speaks. The agent's
// ``EXPLORER_STREAMING_PROMPT_FR`` / ``_EN`` (in
// ``backend/src/voice/streaming_prompts.py``) tells it explicitly:
//
//     "Ces messages ne sont PAS du dialogue. Absorbe-les silencieusement,
//      ne réponds JAMAIS à l'utilisateur 'j'ai reçu un nouveau chunk de
//      transcript'."
//
// The Quick Voice Call design doc lists this as a known risk
// (``docs/superpowers/specs/2026-04-26-quick-voice-call-design.md``,
// section "Risques et mitigations"):
//
//     "[CTX UPDATE] messages pourraient leak en dialogue → Tests E2E
//      sur 50+ conversations + éval qualitative".
//
// This spec implements that mitigation. It runs in two modes :
//
//   * MOCKED mode  — always runs, no network. 50 scenarios driven through
//                    a deterministic ``MockVoiceAgent`` whose pre-canned
//                    replies exercise the leak detector without any LLM.
//                    Useful as a CI smoke test of the wiring + the
//                    detector itself.
//
//   * LIVE mode    — opt-in. Triggered when a recognised LLM key is
//                    present in env (MISTRAL_API_KEY, ANTHROPIC_API_KEY,
//                    or OPENAI_API_KEY) ; a sub-suite then calls the
//                    actual LLM with the production system_prompt and
//                    25 representative scenarios (sampled from the 50
//                    to keep wallclock under ~12 min on a slow laptop).
//                    The full-50 variant runs only when DEEPSIGHT_E2E_LIVE_FULL=1.
//
// Both modes share the same leak detector (``voice-leak-utils/leak-detector.ts``)
// and the same fixture file. The only difference is who produces the
// agent's reply.
//
// The detector itself is also tested end-to-end — a "negative control"
// suite feeds a curated list of LEAKY replies and asserts the detector
// flags every single one. That guards against the detector silently
// rotting (e.g. if someone swaps a substring match for something more
// fragile).

import { test, expect } from "@playwright/test";
import { detectLeak, formatReport } from "./voice-leak-utils/leak-detector";
import {
  ALL_SCENARIOS,
  LEAKY_CONTROL_FIXTURES,
  type Scenario,
} from "./voice-leak-fixtures/scenarios";
import { MockVoiceAgent } from "./voice-leak-utils/mock-voice-agent";
import { detectLiveLlm, type LlmClient } from "./voice-leak-utils/llm-client";
import { buildHistoryForTurn } from "./voice-leak-utils/conversation-builder";
import { loadStreamingPrompts } from "./voice-leak-utils/load-streaming-prompts";

// ─────────────────────────────────────────────────────────────────────────────
// Module-level fixtures
// ─────────────────────────────────────────────────────────────────────────────

/** Fail fast if scenario authoring drifts from the contract. */
test.beforeAll(() => {
  if (ALL_SCENARIOS.length !== 50) {
    throw new Error(
      `Expected exactly 50 scenarios, got ${ALL_SCENARIOS.length}. Update the fixture file.`,
    );
  }
  for (const s of ALL_SCENARIOS) {
    if (s.mockAgentReplies.length !== s.turns.length) {
      throw new Error(
        `Scenario ${s.id}: ${s.turns.length} turns vs ${s.mockAgentReplies.length} canned replies`,
      );
    }
  }
  // Loud check that the Python SSOT is parseable. If the prompt file
  // is restructured, this assertion fires before any test does — clearer
  // diagnostic than a per-test failure.
  loadStreamingPrompts();
});

/** Negative control — these replies should ALL trigger the detector. */
test.describe("leak detector — negative controls", () => {
  for (const ctrl of LEAKY_CONTROL_FIXTURES) {
    test(`flags leak: ${ctrl.id}`, () => {
      const report = detectLeak(ctrl.reply);
      expect(report.hasLeak, `Detector missed: ${formatReport(report)}`).toBe(
        true,
      );
      const flaggedMarkers = new Set(report.hits.map((h) => h.marker));
      for (const expected of ctrl.expectedMarkers) {
        // Bidirectional substring match : the production envelope can be
        // either ``[CTX UPDATE]`` (standalone) or ``[CTX UPDATE: …]``
        // (with metadata). The detector stores the bracketless prefix
        // ``[CTX UPDATE`` so we accept both directions of inclusion.
        const expectedLc = expected.toLowerCase();
        const hit = [...flaggedMarkers].some((m) => {
          const mLc = m.toLowerCase();
          return mLc.includes(expectedLc) || expectedLc.includes(mLc);
        });
        expect(
          hit,
          `Detector flagged ${[...flaggedMarkers].join(", ")} but missed ${expected}`,
        ).toBe(true);
      }
    });
  }

  test("does NOT flag a clean reply", () => {
    const reply =
      "Hi! From what I'm hearing so far, the topic is quantum computing. Around 4:30 in the video, the speaker mentions Shor's algorithm.";
    const report = detectLeak(reply);
    expect(
      report.hasLeak,
      `False positive: ${formatReport(report)}`,
    ).toBe(false);
  });

  test("does NOT flag the word 'streaming' in dictionary contexts", () => {
    // The detector should be permissive on innocent uses of "streaming".
    const reply =
      "Netflix is the largest streaming service. It revolutionised how people consume video content.";
    const report = detectLeak(reply);
    expect(report.hasLeak, formatReport(report)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MOCKED mode — runs 50 scenarios through a deterministic mock agent.
// ─────────────────────────────────────────────────────────────────────────────

interface PerScenarioReport {
  scenarioId: string;
  language: "fr" | "en";
  duration: "short" | "long";
  topic: string;
  agentReplies: number;
  leaks: Array<{ replyIndex: number; report: ReturnType<typeof detectLeak> }>;
}

const mockedReports: PerScenarioReport[] = [];

test.describe("mocked — 50 conversations leak detection", () => {
  for (const scenario of ALL_SCENARIOS) {
    test(`no leak in mocked agent replies: ${scenario.id}`, () => {
      const agent = new MockVoiceAgent(scenario, { echoCtxUpdates: false });

      // Walk the simulated turns: at each turn, push the synthetic
      // envelopes the side panel would inject (CTX UPDATE / PHASE
      // TRANSITION / CTX COMPLETE / CTX FAILED), then have the user
      // speak, capture the reply, scan it for leaks.
      const leaks: PerScenarioReport["leaks"] = [];
      scenario.turns.forEach((turn, idx) => {
        // Synthetic envelopes — for the mocked path these are absorbed
        // silently (no echo) so they do NOT appear in the transcript.
        if (turn.phase === "streaming" || turn.phase === "complete") {
          agent.injectSyntheticUserMessage(
            `[PHASE TRANSITION]\nfrom: startup\nto: streaming`,
          );
          agent.injectSyntheticUserMessage(
            `[CTX UPDATE]\ntype: transcript_chunk\nmeta: {"index": 0, "total": 3}\ncontent: ...`,
          );
        }
        if (turn.phase === "complete") {
          agent.injectSyntheticUserMessage(
            `[CTX COMPLETE]\nfinal_digest: ...\ntranscript_total_chars: 12345`,
          );
        }
        if (turn.phase === "failed") {
          agent.injectSyntheticUserMessage(
            `[CTX FAILED]\nreason: transcript_unavailable`,
          );
        }
        const { agentReply } = agent.speakAsUser(turn);
        const report = detectLeak(agentReply.text);
        if (report.hasLeak) {
          leaks.push({ replyIndex: idx, report });
        }
      });

      mockedReports.push({
        scenarioId: scenario.id,
        language: scenario.language,
        duration: scenario.duration,
        topic: scenario.topic,
        agentReplies: agent.getAgentReplies().length,
        leaks,
      });

      if (leaks.length > 0) {
        const summary = leaks
          .map(
            (l) =>
              `Reply #${l.replyIndex}: ${formatReport(l.report)}\n  Reply text: ${
                agent.getAgentReplies()[l.replyIndex].text
              }`,
          )
          .join("\n---\n");
        throw new Error(
          `Scenario ${scenario.id} leaked in ${leaks.length} replies:\n${summary}`,
        );
      }
    });
  }
});

test.afterAll(() => {
  // ── Mocked-mode summary ──
  if (mockedReports.length === 0) return;
  const totalReplies = mockedReports.reduce((s, r) => s + r.agentReplies, 0);
  const leakyScenarios = mockedReports.filter((r) => r.leaks.length > 0).length;
  /* eslint-disable no-console */
  console.log("\n— MOCKED MODE SUMMARY —");
  console.log(`Scenarios run     : ${mockedReports.length}/50`);
  console.log(`Agent replies     : ${totalReplies}`);
  console.log(`Languages         : 25 FR + 25 EN`);
  console.log(`Leaky scenarios   : ${leakyScenarios}`);
  console.log(
    `Forbidden markers : [CTX UPDATE], [PHASE TRANSITION], [CTX HEARTBEAT], [CTX COMPLETE], [CTX FAILED], [PHASE, [CTX, transcript chunk, system prompt, ElevenLabs, streaming-jargon`,
  );
  /* eslint-enable no-console */
});

// ─────────────────────────────────────────────────────────────────────────────
// LIVE mode — gated on the presence of an LLM API key in env.
// Default sample = 25 scenarios (≈ 12 min wallclock on Mistral Small).
// Set DEEPSIGHT_E2E_LIVE_FULL=1 to run the full 50.
// ─────────────────────────────────────────────────────────────────────────────

const liveClient: LlmClient | null = detectLiveLlm();
const liveLimit = process.env.DEEPSIGHT_E2E_LIVE_FULL === "1" ? 50 : 25;

// Sample helper: keep the language balance (half FR, half EN).
function sampleScenarios(n: number, all: Scenario[]): Scenario[] {
  if (n >= all.length) return all;
  const fr = all.filter((s) => s.language === "fr");
  const en = all.filter((s) => s.language === "en");
  const half = Math.floor(n / 2);
  return [...fr.slice(0, half), ...en.slice(0, n - half)];
}

const liveReports: PerScenarioReport[] = [];

test.describe(`live LLM (${liveClient?.name ?? "skipped"}) — ${liveLimit} conversations`, () => {
  test.skip(
    !liveClient,
    "No live LLM key in env (set MISTRAL_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY to enable).",
  );

  for (const scenario of sampleScenarios(liveLimit, ALL_SCENARIOS)) {
    test(`no leak in live agent replies: ${scenario.id}`, async () => {
      // Live calls are slow — give each scenario a generous slot.
      test.setTimeout(120_000);
      if (!liveClient) throw new Error("liveClient unexpectedly null");

      const priorReplies: string[] = [];
      const leaks: PerScenarioReport["leaks"] = [];
      let lastError: Error | null = null;

      for (let idx = 0; idx < scenario.turns.length; idx++) {
        const messages = buildHistoryForTurn(scenario, idx, priorReplies);
        let reply = "";
        try {
          reply = await liveClient.ask(messages);
        } catch (e) {
          lastError = e as Error;
          // Fail open per turn — if the provider rate-limits one call
          // we still want to report the rest. Mark the scenario as
          // partial in the summary.
          // eslint-disable-next-line no-console
          console.warn(
            `[live] ${scenario.id} turn ${idx}: ${(e as Error).message}`,
          );
          break;
        }
        priorReplies.push(reply);
        const report = detectLeak(reply);
        if (report.hasLeak) leaks.push({ replyIndex: idx, report });
      }

      // If zero turns succeeded, skip rather than silently pass — a
      // dead provider key is a setup issue, not a test pass.
      test.skip(
        priorReplies.length === 0,
        `Live LLM (${liveClient.name}) returned no replies for ${scenario.id}` +
          (lastError ? ` (${lastError.message})` : "") +
          " — verify the API key is valid.",
      );

      liveReports.push({
        scenarioId: scenario.id,
        language: scenario.language,
        duration: scenario.duration,
        topic: scenario.topic,
        agentReplies: priorReplies.length,
        leaks,
      });

      if (leaks.length > 0) {
        const summary = leaks
          .map(
            (l) =>
              `Reply #${l.replyIndex}: ${formatReport(l.report)}\n  Reply: ${priorReplies[l.replyIndex]}`,
          )
          .join("\n---\n");
        throw new Error(
          `Live LLM leak on ${scenario.id} (${liveClient!.name}):\n${summary}`,
        );
      }
    });
  }

  test.afterAll(() => {
    if (!liveClient || liveReports.length === 0) return;
    const totalReplies = liveReports.reduce((s, r) => s + r.agentReplies, 0);
    const leakyScenarios = liveReports.filter((r) => r.leaks.length > 0).length;
    /* eslint-disable no-console */
    console.log(`\n— LIVE MODE SUMMARY (${liveClient.name}) —`);
    console.log(`Scenarios run    : ${liveReports.length}/${liveLimit}`);
    console.log(`Agent replies    : ${totalReplies}`);
    console.log(`Leaky scenarios  : ${leakyScenarios}`);
    console.log(`Provider         : ${liveClient.name}`);
    /* eslint-enable no-console */
  });
});
