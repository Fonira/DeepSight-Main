/**
 * Tests — useConversation (extension)
 *
 * Mirror minimal des tests mobile §11.2 :
 *  - unifies chat + voice agent messages in chronological order
 *  - excludes voice user messages (audio user invisible rule)
 *  - routes sendMessage to chat when voiceMode='off'
 *  - routes sendMessage to voice agent when voiceMode='live'
 *  - requestStartCall opens window.confirm + start session
 *
 * On mock chrome.runtime.sendMessage (chat history + ask) et
 * useExtensionVoiceChat (status, conversation, transcripts).
 */

import React from "react";
import { render, act, waitFor } from "@testing-library/react";
import { useConversation } from "../../../src/sidepanel/hooks/useConversation";
import type { UnifiedMessage } from "../../../src/sidepanel/hooks/useConversation";

// ── Mocks ────────────────────────────────────────────────────────────

// Module-scope state injected into mocks below.
let mockChatHistory: unknown[] = [];
let mockSendMessageImpl: jest.Mock = jest.fn();

jest.mock("../../../src/utils/browser-polyfill", () => {
  return {
    __esModule: true,
    default: {
      runtime: {
        sendMessage: jest.fn((msg: { action: string }) => {
          if (msg.action === "GET_CHAT_HISTORY") {
            return Promise.resolve({ success: true, result: mockChatHistory });
          }
          if (msg.action === "ASK_QUESTION") {
            return mockSendMessageImpl(msg);
          }
          if (msg.action === "CLEAR_CHAT_HISTORY") {
            return Promise.resolve({ success: true });
          }
          if (msg.action === "VOICE_APPEND_TRANSCRIPT") {
            return Promise.resolve({ success: true });
          }
          return Promise.resolve({ success: true });
        }),
      },
    },
  };
});

// useExtensionVoiceChat — controllable mock.
let mockVoiceState: {
  status: string;
  transcripts: { speaker: string; content: string; ts: number }[];
  sessionId: string | null;
  conversation: unknown;
  isMuted: boolean;
  error: string | null;
  startSession: jest.Mock;
  endSession: jest.Mock;
  toggleMute: jest.Mock;
  appendTranscript: jest.Mock;
  isActive: boolean;
};

const makeDefaultVoiceState = () => ({
  status: "idle" as const,
  transcripts: [] as { speaker: string; content: string; ts: number }[],
  sessionId: null as string | null,
  conversation: null as unknown,
  isMuted: false,
  error: null as string | null,
  startSession: jest.fn().mockResolvedValue({ session_id: "sess-1" }),
  endSession: jest.fn().mockResolvedValue(undefined),
  toggleMute: jest.fn(),
  appendTranscript: jest.fn().mockResolvedValue(undefined),
  isActive: false,
});

jest.mock("../../../src/sidepanel/useExtensionVoiceChat", () => {
  return {
    __esModule: true,
    useExtensionVoiceChat: () => mockVoiceState,
    VoiceQuotaError: class VoiceQuotaError extends Error {
      status = 402;
      detail = {};
    },
  };
});

jest.mock("../../../src/sidepanel/hooks/useStreamingVideoContext", () => ({
  __esModule: true,
  useStreamingVideoContext: () => ({
    contextProgress: 0,
    contextComplete: false,
    contextPhase: "searching",
    transcriptChunksReceived: 0,
    transcriptChunksTotal: 0,
  }),
}));

// ── Test harness — appelle le hook et expose son retour ─────────────

interface HarnessProps {
  initialMode: "chat" | "call";
  onResult: (r: ReturnType<typeof useConversation>) => void;
}

const Harness: React.FC<HarnessProps> = ({ initialMode, onResult }) => {
  const result = useConversation({
    summaryId: 42,
    videoTitle: "Test Video",
    videoId: "vid-abc",
    initialMode,
  });
  onResult(result);
  return null;
};

// ── Tests ────────────────────────────────────────────────────────────

beforeEach(() => {
  mockChatHistory = [];
  mockSendMessageImpl = jest.fn();
  mockVoiceState = makeDefaultVoiceState();
});

describe("useConversation — fil unifié", () => {
  it("unifies chat + voice agent messages in chronological order", async () => {
    mockChatHistory = [
      {
        id: "1",
        role: "user",
        content: "hi typed",
        timestamp: "2026-05-02T10:00:00Z",
        source: "text",
      },
      {
        id: "2",
        role: "assistant",
        content: "voiced reply",
        timestamp: "2026-05-02T10:01:00Z",
        source: "voice",
        voice_speaker: "agent",
      },
    ];

    let captured: ReturnType<typeof useConversation> | null = null;
    render(
      <Harness
        initialMode="chat"
        onResult={(r) => {
          captured = r;
        }}
      />,
    );

    await waitFor(() => {
      expect(captured?.loadingHistory).toBe(false);
    });
    expect(captured?.messages).toHaveLength(2);
    expect(captured?.messages[0].id).toBe("1");
    expect(captured?.messages[1].source).toBe("voice");
    expect(captured?.messages[1].voiceSpeaker).toBe("agent");
  });

  it("excludes voice user messages (audio user invisible rule)", async () => {
    mockChatHistory = [
      {
        id: "u1",
        role: "user",
        content: "asked aloud",
        timestamp: "2026-05-02T10:00:00Z",
        source: "voice",
        voice_speaker: "user",
      },
      {
        id: "a1",
        role: "assistant",
        content: "answer",
        timestamp: "2026-05-02T10:01:00Z",
        source: "voice",
        voice_speaker: "agent",
      },
    ];

    let captured: ReturnType<typeof useConversation> | null = null;
    render(
      <Harness
        initialMode="chat"
        onResult={(r) => {
          captured = r;
        }}
      />,
    );

    await waitFor(() => {
      expect(captured?.loadingHistory).toBe(false);
    });
    expect(captured?.messages).toHaveLength(1);
    expect(captured?.messages[0].id).toBe("a1");
    expect(captured?.messages[0].voiceSpeaker).toBe("agent");
  });
});

describe("useConversation — sendMessage routing", () => {
  it("routes to chat (ASK_QUESTION) when voiceMode='off'", async () => {
    mockSendMessageImpl = jest.fn().mockResolvedValue({
      success: true,
      result: { response: "ai reply", web_search_used: false },
    });

    let captured: ReturnType<typeof useConversation> | null = null;
    render(
      <Harness
        initialMode="chat"
        onResult={(r) => {
          captured = r;
        }}
      />,
    );

    await waitFor(() => expect(captured?.loadingHistory).toBe(false));
    await act(async () => {
      await captured?.sendMessage("hello");
    });

    expect(mockSendMessageImpl).toHaveBeenCalledWith(
      expect.objectContaining({ action: "ASK_QUESTION" }),
    );
    expect(mockVoiceState.appendTranscript).not.toHaveBeenCalled();
  });

  it("routes to voice.conversation.sendUserMessage when voiceMode='live'", async () => {
    const sendUserMessage = jest.fn();
    mockVoiceState = {
      ...makeDefaultVoiceState(),
      status: "listening",
      conversation: {
        sendUserMessage,
      },
    };

    let captured: ReturnType<typeof useConversation> | null = null;
    render(
      <Harness
        initialMode="call"
        onResult={(r) => {
          captured = r;
        }}
      />,
    );

    // Wait for voiceMode to flip to 'live'
    await waitFor(() => expect(captured?.voiceMode).toBe("live"));
    await act(async () => {
      await captured?.sendMessage("typed during call");
    });

    expect(sendUserMessage).toHaveBeenCalledWith("typed during call");
    expect(mockVoiceState.appendTranscript).toHaveBeenCalledWith(
      "user",
      "typed during call",
    );
  });
});

describe("useConversation — call lifecycle", () => {
  it("auto-starts voice when initialMode='call'", async () => {
    let captured: ReturnType<typeof useConversation> | null = null;
    render(
      <Harness
        initialMode="call"
        onResult={(r) => {
          captured = r;
        }}
      />,
    );

    await waitFor(() => {
      expect(mockVoiceState.startSession).toHaveBeenCalledWith(
        expect.objectContaining({
          videoId: "vid-abc",
          agentType: "explorer_streaming",
          isStreaming: true,
        }),
      );
    });
    expect(captured).not.toBeNull();
  });

  it("does NOT auto-start voice when initialMode='chat'", async () => {
    let captured: ReturnType<typeof useConversation> | null = null;
    render(
      <Harness
        initialMode="chat"
        onResult={(r) => {
          captured = r;
        }}
      />,
    );

    await waitFor(() => expect(captured?.loadingHistory).toBe(false));
    expect(mockVoiceState.startSession).not.toHaveBeenCalled();
    expect(captured?.voiceMode).toBe("off");
  });

  it("requestStartCall opens window.confirm and starts session on confirm", async () => {
    const confirmSpy = jest
      .spyOn(window, "confirm")
      .mockImplementation(() => true);

    let captured: ReturnType<typeof useConversation> | null = null;
    render(
      <Harness
        initialMode="chat"
        onResult={(r) => {
          captured = r;
        }}
      />,
    );

    await waitFor(() => expect(captured?.loadingHistory).toBe(false));
    act(() => {
      captured?.requestStartCall();
    });

    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockVoiceState.startSession).toHaveBeenCalled();
    });

    confirmSpy.mockRestore();
  });

  it("requestStartCall cancels gracefully when user clicks Cancel", async () => {
    const confirmSpy = jest
      .spyOn(window, "confirm")
      .mockImplementation(() => false);

    let captured: ReturnType<typeof useConversation> | null = null;
    render(
      <Harness
        initialMode="chat"
        onResult={(r) => {
          captured = r;
        }}
      />,
    );

    await waitFor(() => expect(captured?.loadingHistory).toBe(false));
    act(() => {
      captured?.requestStartCall();
    });

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockVoiceState.startSession).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });
});

describe("useConversation — type sanity", () => {
  it("UnifiedMessage shape carries voice metadata", () => {
    const m: UnifiedMessage = {
      id: "x",
      role: "assistant",
      content: "test",
      source: "voice",
      timestamp: 1234,
      voiceSpeaker: "agent",
      voiceSessionId: "vs-1",
    };
    expect(m.source).toBe("voice");
    expect(m.voiceSpeaker).toBe("agent");
  });
});
