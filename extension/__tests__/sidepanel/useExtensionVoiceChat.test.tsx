/** @jest-environment jsdom */

import React from "react";
import { act, render } from "@testing-library/react";
import {
  useExtensionVoiceChat,
  __setElevenLabsSdkForTests,
} from "../../src/sidepanel/useExtensionVoiceChat";
import type { VoicePanelContext } from "../../src/sidepanel/types";

interface ProbeRef {
  current: ReturnType<typeof useExtensionVoiceChat> | null;
}

function Probe({
  context,
  sendMessage,
  probe,
}: {
  context: VoicePanelContext | null;
  sendMessage: <T>(msg: unknown) => Promise<{
    success?: boolean;
    error?: string;
    result?: T;
  }>;
  probe: ProbeRef;
}): JSX.Element {
  const result = useExtensionVoiceChat({ context, sendMessage });
  probe.current = result;
  return <div data-testid="status">{result.status}</div>;
}

describe("useExtensionVoiceChat", () => {
  beforeEach(() => {
    __setElevenLabsSdkForTests({
      connect: jest.fn(() => Promise.resolve()),
      disconnect: jest.fn(() => Promise.resolve()),
    });
  });

  afterEach(() => {
    __setElevenLabsSdkForTests(null);
  });

  it("calls VOICE_CREATE_SESSION with summary_id + agent_type=explorer when summaryId present", async () => {
    const sendMessage = jest.fn().mockResolvedValue({
      success: true,
      result: {
        voice_session_id: "sess_123",
        signed_url: "wss://api.elevenlabs.io/test",
      },
    });
    const probe: ProbeRef = { current: null };

    render(
      <Probe
        context={{ summaryId: 7, videoId: "abc", videoTitle: "x" }}
        sendMessage={sendMessage}
        probe={probe}
      />,
    );

    await act(async () => {
      await probe.current!.start();
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    const payload = sendMessage.mock.calls[0][0] as {
      action: string;
      data: Record<string, unknown>;
    };
    expect(payload.action).toBe("VOICE_CREATE_SESSION");
    expect(payload.data.agent_type).toBe("explorer");
    expect(payload.data.summary_id).toBe(7);
    expect(probe.current!.sessionId).toBe("sess_123");
    expect(probe.current!.status).toBe("listening");
  });

  it("calls VOICE_CREATE_SESSION with agent_type=companion when no summaryId", async () => {
    const sendMessage = jest.fn().mockResolvedValue({
      success: true,
      result: { voice_session_id: "sess_xx" },
    });
    const probe: ProbeRef = { current: null };

    render(<Probe context={null} sendMessage={sendMessage} probe={probe} />);

    await act(async () => {
      await probe.current!.start();
    });

    const payload = sendMessage.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(payload.data.agent_type).toBe("companion");
    expect(payload.data.summary_id).toBeUndefined();
  });

  it("transitions to error if backend returns success=false", async () => {
    const sendMessage = jest.fn().mockResolvedValue({
      success: false,
      error: "QUOTA_EXCEEDED",
    });
    const probe: ProbeRef = { current: null };

    render(<Probe context={null} sendMessage={sendMessage} probe={probe} />);

    await act(async () => {
      await probe.current!.start();
    });

    expect(probe.current!.status).toBe("error");
    expect(probe.current!.error).toBe("QUOTA_EXCEEDED");
  });

  it("appendTranscript pushes transcript locally + forwards to background", async () => {
    const sendMessage = jest
      .fn()
      .mockResolvedValueOnce({
        success: true,
        result: { voice_session_id: "sess_42" },
      })
      .mockResolvedValue({ success: true });
    const probe: ProbeRef = { current: null };

    render(<Probe context={null} sendMessage={sendMessage} probe={probe} />);

    await act(async () => {
      await probe.current!.start();
    });
    await act(async () => {
      await probe.current!.appendTranscript("user", "Bonjour Claude");
    });

    expect(probe.current!.transcripts).toHaveLength(1);
    expect(probe.current!.transcripts[0].speaker).toBe("user");
    expect(probe.current!.transcripts[0].content).toBe("Bonjour Claude");

    const calls = sendMessage.mock.calls;
    expect(calls[1][0]).toEqual(
      expect.objectContaining({
        action: "VOICE_APPEND_TRANSCRIPT",
        data: expect.objectContaining({
          voice_session_id: "sess_42",
          speaker: "user",
          content: "Bonjour Claude",
        }),
      }),
    );
  });

  it("appendTranscript ignores empty/whitespace messages", async () => {
    const sendMessage = jest.fn().mockResolvedValue({ success: true });
    const probe: ProbeRef = { current: null };

    render(<Probe context={null} sendMessage={sendMessage} probe={probe} />);

    await act(async () => {
      await probe.current!.appendTranscript("user", "   ");
    });

    expect(probe.current!.transcripts).toHaveLength(0);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("stop() flips status to ended and clears sessionId", async () => {
    const sendMessage = jest.fn().mockResolvedValue({
      success: true,
      result: { voice_session_id: "sess_x" },
    });
    const probe: ProbeRef = { current: null };

    render(<Probe context={null} sendMessage={sendMessage} probe={probe} />);

    await act(async () => {
      await probe.current!.start();
    });
    await act(async () => {
      await probe.current!.stop();
    });

    expect(probe.current!.status).toBe("ended");
    expect(probe.current!.sessionId).toBeNull();
  });
});
