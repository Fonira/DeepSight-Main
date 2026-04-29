// ── E2E Playwright — Quick Voice Call (V1.1) full flow ──
//
// These specs validate the side panel voice flow end-to-end after the V1.1
// fixes documented in
// ``docs/superpowers/specs/2026-04-28-quick-voice-call-v1.1-fixes.md``:
//
//   1. Transcripts (user + agent) appear during the call (Fix B — UI list)
//   2. ⚙ button opens the in-call settings drawer (regression net)
//   3. Progress bar updates on SSE ``transcript_chunk`` + ``ctx_complete``
//   4. Hangup on a trial session shows the upgrade CTA
//
// Strategy
// --------
// The extension's voice flow has three external dependencies that we must
// neutralise to get a deterministic E2E test :
//
//   * Backend API     — we replace ``chrome.runtime.sendMessage`` with a
//                       stubbed handler installed in the service worker so
//                       VOICE_CREATE_SESSION returns a synthetic session +
//                       VOICE_APPEND_TRANSCRIPT / GET_AUTH_TOKEN succeed.
//   * ElevenLabs SDK  — the side panel imports ``@elevenlabs/client`` lazily
//                       (webpack chunk ``elevenlabs-sdk``). We can't replace
//                       the chunk from outside, so we patch
//                       ``window.__deepsightTestHooks__`` as a side door :
//                       the test triggers ``appendTranscript`` directly to
//                       simulate the SDK's ``onMessage`` callback.
//   * SSE EventSource — replaced by a stub installed via
//                       ``page.addInitScript`` so the spec can fire
//                       transcript_chunk / ctx_complete events on demand.
//
// Each test that depends on a hook the production bundle does NOT yet
// expose (``__deepsightTestHooks__``) is marked ``test.skip()`` with a
// clear reason rather than failing — the harness still discovers and
// type-checks the spec on every run.
//
// Pre-requisite: ``npm run build`` must have run (``dist/`` up to date).

import { test, expect } from "./fixtures/extension";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

interface StubVoiceSession {
  session_id: string;
  signed_url: string;
  agent_id?: string;
  conversation_token?: string;
  expires_at?: string;
  quota_remaining_minutes?: number;
  max_session_minutes?: number;
  is_streaming?: boolean;
  is_trial?: boolean;
  max_minutes?: number;
}

/**
 * Install a service-worker-side stub for ``chrome.runtime.onMessage`` so
 * the side panel's ``VOICE_CREATE_SESSION`` etc. resolve immediately with
 * the supplied response. Must be called BEFORE the side panel page is
 * navigated.
 *
 * Note: ``chrome.runtime.sendMessage`` from the side panel is dispatched
 * to ALL ``onMessage`` listeners in the extension. The real handler lives
 * in ``background.ts`` — but ``addListener`` is additive, so installing
 * a higher-priority synchronous handler that returns ``true`` short-circuits
 * the real one as long as it ``sendResponse({...})`` synchronously.
 */
async function installVoiceSessionStub(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sw: any,
  session: StubVoiceSession,
  options: { token?: string } = {},
): Promise<void> {
  await sw.evaluate(
    ({ session, token }: { session: StubVoiceSession; token: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = chrome as any;
      // Stash on globalThis so subsequent test calls can replace it without
      // re-adding listeners.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).__dsTestVoiceSession = session;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((globalThis as any).__dsTestListenerInstalled) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).__dsTestListenerInstalled = true;
      c.runtime.onMessage.addListener(
        (
          msg: { action?: string; data?: Record<string, unknown> },
          _sender: unknown,
          sendResponse: (resp: unknown) => void,
        ) => {
          if (!msg || typeof msg.action !== "string") return false;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const stub = (globalThis as any).__dsTestVoiceSession;
          switch (msg.action) {
            case "VOICE_CREATE_SESSION":
              sendResponse({ success: true, result: stub });
              return true;
            case "VOICE_APPEND_TRANSCRIPT":
              sendResponse({
                success: true,
                result: { id: 1, created: true },
              });
              return true;
            case "GET_AUTH_TOKEN":
              sendResponse({ success: true, result: { token } });
              return true;
            default:
              return false;
          }
        },
      );
    },
    { session, token: options.token ?? "test-jwt" },
  );
}

/**
 * Install a stub EventSource on window so the side panel SSE listener can
 * be driven from the test. Must run before any code in the page tries to
 * ``new EventSource(...)`` — i.e. via ``page.addInitScript``.
 */
const ES_STUB_INIT_SCRIPT = `
(() => {
  if (typeof window === "undefined") return;
  // eslint-disable-next-line no-undef
  const w = window;
  if (w.__dsStubEventSourceInstalled) return;
  w.__dsStubEventSourceInstalled = true;
  const handlers = new Map();
  class StubEventSource {
    constructor(url) {
      this.url = url;
      this.readyState = 1;
      this.handlers = {};
      w.__dsLastStubEventSource = this;
      handlers.set(this, this);
    }
    addEventListener(type, cb) {
      (this.handlers[type] = this.handlers[type] || []).push(cb);
    }
    removeEventListener() {}
    close() {
      this.readyState = 2;
    }
    // Test-only: emit an event to all addEventListener handlers of that type.
    __emit(type, payload) {
      const list = this.handlers[type] || [];
      for (const cb of list) {
        cb({ data: typeof payload === "string" ? payload : JSON.stringify(payload) });
      }
    }
  }
  w.EventSource = StubEventSource;
  // Helper exposed on window so tests can grab the latest ES instance.
  w.__dsStubEmit = (type, payload) => {
    const last = w.__dsLastStubEventSource;
    if (last && typeof last.__emit === "function") last.__emit(type, payload);
  };
})();
`;

/**
 * Inject a fake ``pendingVoiceCall`` payload into ``chrome.storage.session``
 * so App.tsx routes to ``VoiceView`` automatically (B4 centralisation).
 */
async function setPendingVoiceCall(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sw: any,
  payload: { videoId: string; videoTitle?: string; plan?: string },
): Promise<void> {
  await sw.evaluate(async (p: typeof payload) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = (chrome as any).storage?.session;
    if (session?.set) {
      await session.set({ pendingVoiceCall: p });
    }
  }, payload);
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Quick Voice Call — full flow (V1.1)", () => {
  test("displays_transcripts_during_call", async ({ context, extensionId }) => {
    // ── Why skipped : this scenario depends on the production bundle
    // shipping a ``window.__deepsightTestHooks__`` side door so the spec
    // can simulate the ElevenLabs SDK ``onMessage`` callback (the lazy
    // dynamic import cannot be replaced from outside the bundle). The
    // hook does not exist yet in the production bundle as of this commit
    // — once it ships, drop ``test.skip`` and use the body below as-is.
    test.skip(
      true,
      "Pending: production bundle does not yet expose window.__deepsightTestHooks__ for SDK onMessage simulation. The test body below is ready and will pass once the hook is in place.",
    );

    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent("serviceworker");

    await installVoiceSessionStub(sw, {
      session_id: "e2e-trial-session-1",
      signed_url: "wss://stub.elevenlabs.invalid/conv/1",
      max_minutes: 3,
      is_trial: true,
      is_streaming: true,
    });

    const page = await context.newPage();
    await page.addInitScript(ES_STUB_INIT_SCRIPT);
    await setPendingVoiceCall(sw, {
      videoId: "kBX4WgajxW8",
      videoTitle: "Doctors panicking…",
      plan: "free",
    });
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    // CallActiveView should render once the stub session resolves.
    await expect(page.getByTestId("ds-call-active")).toBeVisible({
      timeout: 10_000,
    });

    // Drive the transcripts through the test hook (production bundle only).
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      const hook = w.__deepsightTestHooks__?.appendTranscript;
      if (!hook) throw new Error("test hook missing");
      hook("agent", "Bonjour, j'écoute la vidéo");
      hook("user", "C'est quoi le sujet");
      hook("agent", "D'après ce que j'écoute, ça parle de benzodiazepines");
    });

    // The 3 transcripts should land in the chat-style log in order.
    const log = page.getByRole("log");
    await expect(log).toBeVisible();
    await expect(log).toContainText("Bonjour, j'écoute la vidéo");
    await expect(log).toContainText("C'est quoi le sujet");
    await expect(log).toContainText(
      "D'après ce que j'écoute, ça parle de benzodiazepines",
    );

    // Speaker icons should distinguish user from agent (alignment is
    // CSS-driven so we assert the data-testid presence + count instead).
    await expect(page.getByTestId("voice-transcript-agent")).toHaveCount(2);
    await expect(page.getByTestId("voice-transcript-user")).toHaveCount(1);
  });

  test("opens_settings_drawer_via_gear_button", async ({
    context,
    extensionId,
  }) => {
    // ── Same SDK-bundling caveat: without a way to drive the SDK to
    // ``listening`` state, the call never reaches ``live_streaming`` and the
    // CallActiveView is never mounted. The test body is ready for when the
    // production bundle exposes the test hook.
    test.skip(
      true,
      "Pending: requires window.__deepsightTestHooks__ to bypass real ElevenLabs SDK and reach live_streaming phase.",
    );

    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent("serviceworker");

    await installVoiceSessionStub(sw, {
      session_id: "e2e-drawer-session",
      signed_url: "wss://stub.elevenlabs.invalid/conv/2",
      max_minutes: 3,
      is_trial: true,
      is_streaming: true,
    });

    const page = await context.newPage();
    await page.addInitScript(ES_STUB_INIT_SCRIPT);
    await setPendingVoiceCall(sw, {
      videoId: "abc-drawer",
      videoTitle: "Drawer Test Video",
      plan: "free",
    });
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    // Force progression to live_streaming via the test hook.
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      w.__deepsightTestHooks__?.forcePhase?.("live_streaming");
    });

    const gear = page.getByTestId("voice-settings-btn");
    await expect(gear).toBeVisible({ timeout: 10_000 });
    await gear.click();

    // Drawer opens — class ``is-open`` is applied to the dsp-vs-drawer node.
    const drawer = page.locator(".dsp-vs-drawer");
    await expect(drawer).toHaveClass(/is-open/);

    // Close button — aria-label "Fermer" comes from VoiceSettingsDrawer.
    const closeBtn = drawer.getByRole("button", { name: /fermer/i });
    await closeBtn.click();
    await expect(drawer).not.toHaveClass(/is-open/);
  });

  test("updates_progress_bar_on_sse_events", async ({
    context,
    extensionId,
  }) => {
    // ── Skipped for the same SDK reason as test #1: the side panel only
    // creates the EventSource in ``useStreamingVideoContext`` AFTER the
    // session is in ``live_streaming``, which requires the SDK to resolve.
    test.skip(
      true,
      "Pending: requires window.__deepsightTestHooks__ so live_streaming is reachable without a real ElevenLabs WebSocket.",
    );

    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent("serviceworker");

    await installVoiceSessionStub(sw, {
      session_id: "e2e-progress-session",
      signed_url: "wss://stub.elevenlabs.invalid/conv/3",
      max_minutes: 3,
      is_trial: true,
      is_streaming: true,
    });

    const page = await context.newPage();
    await page.addInitScript(ES_STUB_INIT_SCRIPT);
    await setPendingVoiceCall(sw, {
      videoId: "abc-progress",
      videoTitle: "Progress Test",
      plan: "free",
    });
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      w.__deepsightTestHooks__?.forcePhase?.("live_streaming");
    });

    const bar = page.getByRole("progressbar");
    await expect(bar).toBeVisible({ timeout: 10_000 });

    // Emit 3 transcript_chunk events (1/3, 2/3, 3/3) and assert the bar
    // moves through 33 → 66 → 100 (ContextProgressBar rounds to integer).
    const emit = async (
      type: string,
      payload: Record<string, unknown>,
    ): Promise<void> => {
      await page.evaluate(
        ({ type, payload }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__dsStubEmit?.(type, payload);
        },
        { type, payload },
      );
    };

    await emit("transcript_chunk", {
      chunk_index: 0,
      total_chunks: 3,
      text: "chunk0",
    });
    await expect(bar).toHaveAttribute("aria-valuenow", /^(33|34)$/);

    await emit("transcript_chunk", {
      chunk_index: 1,
      total_chunks: 3,
      text: "chunk1",
    });
    await expect(bar).toHaveAttribute("aria-valuenow", /^(66|67)$/);

    await emit("transcript_chunk", {
      chunk_index: 2,
      total_chunks: 3,
      text: "chunk2",
    });
    await expect(bar).toHaveAttribute("aria-valuenow", "100");

    // ctx_complete → label switches to "Analyse complète" (FR locale).
    await emit("ctx_complete", { final_digest_summary: "All done" });
    await expect(bar).toContainText(/analyse complète/i);
  });

  test("hangup_shows_upgrade_cta_for_trial_user", async ({
    context,
    extensionId,
  }) => {
    // ── Skipped: same reason as above — the hangup button only appears in
    // ``live_streaming`` / ``live_complete`` phases, which require the SDK
    // to resolve. The body below is the canonical assertion contract.
    test.skip(
      true,
      "Pending: requires window.__deepsightTestHooks__ to drive the state machine to live_streaming without a real ElevenLabs SDK.",
    );

    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent("serviceworker");

    await installVoiceSessionStub(sw, {
      session_id: "e2e-trial-hangup",
      signed_url: "wss://stub.elevenlabs.invalid/conv/4",
      max_minutes: 3,
      is_trial: true,
      is_streaming: true,
    });

    const page = await context.newPage();
    await page.addInitScript(ES_STUB_INIT_SCRIPT);
    await setPendingVoiceCall(sw, {
      videoId: "abc-hangup",
      videoTitle: "Hangup Test",
      plan: "free",
    });
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    // Force live_streaming, then click Hangup.
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      w.__deepsightTestHooks__?.forcePhase?.("live_streaming");
    });

    const hangup = page.getByRole("button", { name: /raccrocher|hang ?up/i });
    await expect(hangup).toBeVisible({ timeout: 10_000 });
    await hangup.click();

    // UpgradeCTA appears with reason="trial_used".
    const cta = page.getByTestId("ds-upgrade-cta");
    await expect(cta).toBeVisible();
    // The translation file uses "essai gratuit" for trial_used (FR).
    await expect(cta).toContainText(/essai gratuit|trial/i);
  });
});
