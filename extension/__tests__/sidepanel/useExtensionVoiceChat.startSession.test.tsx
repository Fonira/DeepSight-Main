/** @jest-environment jsdom */
//
// startSession() — démarrage d'un appel depuis le side panel :
//  1. accès micro vérifié avant de créer la session (pas d'agent inutile) ;
//  2. erreur de l'API traduite, avec la raison ElevenLabs pour un admin ;
//  3. échec du SDK expliqué au lieu d'un appel « en cours » muet.

import React from "react";
import { act, render } from "@testing-library/react";
import {
  useExtensionVoiceChat,
  __setElevenLabsSdkForTests,
} from "../../src/sidepanel/useExtensionVoiceChat";
import type { MicPermissionOutcome } from "../../src/sidepanel/micPermission";
import fr from "../../src/i18n/fr.json";

type Send = <T>(msg: unknown) => Promise<{
  success?: boolean;
  error?: string;
  errorCode?: string;
  httpStatus?: number;
  errorDetail?: Record<string, unknown>;
  result?: T;
}>;

interface ProbeRef {
  current: ReturnType<typeof useExtensionVoiceChat> | null;
}

function Probe({
  sendMessage,
  ensureMic,
  probe,
}: {
  sendMessage: Send;
  ensureMic: () => Promise<MicPermissionOutcome>;
  probe: ProbeRef;
}): JSX.Element {
  probe.current = useExtensionVoiceChat({
    context: null,
    sendMessage,
    ensureMic,
  });
  return <div />;
}

const OPTS = {
  videoId: "dQw4w9WgXcQ",
  agentType: "explorer_streaming" as const,
  isStreaming: true,
};

function setup(send: Send, mic: MicPermissionOutcome = "granted") {
  const probe: ProbeRef = { current: null };
  const ensureMic = jest.fn(() => Promise.resolve(mic));
  render(<Probe sendMessage={send} ensureMic={ensureMic} probe={probe} />);
  return { probe, ensureMic };
}

async function start(probe: ProbeRef): Promise<unknown> {
  let failure: unknown = null;
  await act(async () => {
    await probe.current!.startSession(OPTS).catch((e: unknown) => {
      failure = e;
    });
  });
  return failure;
}

const session = { session_id: "sess-1", signed_url: "wss://signed.test" };

describe("useExtensionVoiceChat.startSession", () => {
  let connect: jest.Mock;

  beforeEach(() => {
    connect = jest.fn(() => Promise.resolve());
    __setElevenLabsSdkForTests({ connect });
  });

  afterEach(() => {
    __setElevenLabsSdkForTests(null);
  });

  it("checks the microphone, creates the session, then connects", async () => {
    const send = jest.fn(() =>
      Promise.resolve({ success: true, result: session }),
    ) as unknown as Send;
    const { probe, ensureMic } = setup(send);

    expect(await start(probe)).toBeNull();

    expect(ensureMic).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ action: "VOICE_CREATE_SESSION" }),
    );
    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({ signedUrl: "wss://signed.test" }),
    );
    expect(probe.current!.status).toBe("listening");
  });

  it.each([
    ["denied", fr.errors.micDenied],
    ["dismissed", fr.errors.micDismissed],
  ] as const)(
    "microphone %s: no session is created",
    async (outcome, message) => {
      const send = jest.fn() as unknown as Send;
      const { probe } = setup(send, outcome);

      const failure = await start(probe);

      expect((failure as Error).message).toBe(message);
      expect(send).not.toHaveBeenCalled();
      expect(probe.current!.status).toBe("error");
      expect(probe.current!.error).toBe(message);
    },
  );

  it("shows the ElevenLabs reason the API gives an admin", async () => {
    const send = jest.fn(() =>
      Promise.resolve({
        success: false,
        error: "Voice service is not configured properly.",
        errorCode: "voice_service_unavailable",
        httpStatus: 503,
        errorDetail: {
          code: "voice_service_unavailable",
          provider_error: {
            operation: "create_agent",
            status: 401,
            code: "missing_permissions",
            message: "missing the permission convai_write",
          },
        },
      }),
    ) as unknown as Send;
    const { probe } = setup(send);

    const failure = await start(probe);

    const expected = `${fr.errors.voiceUnavailable} (ElevenLabs : 401 missing_permissions - missing the permission convai_write)`;
    expect((failure as Error).message).toBe(expected);
    expect(probe.current!.error).toBe(expected);
    expect(connect).not.toHaveBeenCalled();
  });

  it("translates a temporary voice service error", async () => {
    const send = jest.fn(() =>
      Promise.resolve({
        success: false,
        error: "Voice service is temporarily unavailable.",
        errorCode: "voice_service_error",
        httpStatus: 503,
      }),
    ) as unknown as Send;
    const { probe } = setup(send);

    await start(probe);

    expect(probe.current!.error).toBe(fr.errors.voiceServiceError);
  });

  it("explains a microphone refused by the SDK", async () => {
    connect.mockRejectedValue(
      Object.assign(new Error("Permission dismissed"), {
        name: "NotAllowedError",
      }),
    );
    const send = jest.fn(() =>
      Promise.resolve({ success: true, result: session }),
    ) as unknown as Send;
    const { probe } = setup(send);

    await start(probe);

    expect(probe.current!.error).toBe(fr.errors.micDenied);
    expect(probe.current!.status).toBe("error");
  });

  it("never pretends to be live without a signed URL", async () => {
    const send = jest.fn(() =>
      Promise.resolve({ success: true, result: { session_id: "sess-2" } }),
    ) as unknown as Send;
    const { probe } = setup(send);

    await start(probe);

    expect(probe.current!.status).toBe("error");
    expect(probe.current!.error).toBe(
      `${fr.errors.voiceConnectionFailed} (no signed_url in session)`,
    );
  });
});
