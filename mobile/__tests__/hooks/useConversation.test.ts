/**
 * Tests for useConversation hook (Task 3 — PR1 Quick Chat + Quick Call unified).
 *
 * Covers the 9 scenarios listed in spec §11.2 :
 * 1. unifies chat + voice agent messages in chronological order
 * 2. excludes voice user messages (audio user invisible rule)
 * 3. routes sendMessage to chat.sendMessage when voiceMode='off'
 * 4. routes sendMessage to voice.sendUserMessage when voiceMode='live'
 * 5. auto-starts voice when initialMode='call'
 * 6. does NOT auto-start voice when initialMode='chat'
 * 7. transitions voiceMode 'live' → 'ended' → 'off' on hangup with 3s toast
 * 8. requestStartCall opens Alert.alert with quota info
 * 9. loadHistory called once on resolvedSummaryId resolution
 */
import React from "react";
import { renderHook, act } from "@testing-library/react-native";
import { Alert } from "react-native";

// ───── Mocks ─────
const mockSendMessage = jest.fn();
const mockLoadHistory = jest.fn();
const mockVoiceStart = jest.fn();
const mockVoiceStop = jest.fn();
const mockVoiceToggleMute = jest.fn();
const mockVoiceSendUserMessage = jest.fn();
const mockUseChat = jest.fn();
const mockUseVoiceChat = jest.fn();
const mockUseStreamingVideoContext = jest.fn();

jest.mock("../../src/hooks/useChat", () => ({
  useChat: (...args: any[]) => mockUseChat(...args),
}));

jest.mock("../../src/components/voice/useVoiceChat", () => ({
  useVoiceChat: (...args: any[]) => mockUseVoiceChat(...args),
}));

jest.mock("../../src/components/voice/useStreamingVideoContext", () => ({
  useStreamingVideoContext: (...args: any[]) =>
    mockUseStreamingVideoContext(...args),
}));

// Spy on Alert.alert (don't replace whole RN module — we need other exports)
jest.spyOn(Alert, "alert").mockImplementation(() => {});

// Default mock returns (overridable per-test via mockReturnValueOnce)
const defaultChatReturn = () => ({
  messages: [],
  isLoading: false,
  sendMessage: mockSendMessage,
  loadHistory: mockLoadHistory,
});

const defaultVoiceReturn = () => ({
  start: mockVoiceStart,
  stop: mockVoiceStop,
  toggleMute: mockVoiceToggleMute,
  sendUserMessage: mockVoiceSendUserMessage,
  isMuted: false,
  status: "idle" as const,
  isSpeaking: false,
  elapsedSeconds: 0,
  remainingMinutes: 30,
  error: null,
  sessionId: null,
  summaryId: null,
  conversation: {} as any,
  messages: [],
});

const defaultCtxReturn = () => ({
  contextProgress: 0,
  contextComplete: false,
});

import { useConversation } from "../../src/hooks/useConversation";

describe("useConversation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseChat.mockImplementation(defaultChatReturn);
    mockUseVoiceChat.mockImplementation(defaultVoiceReturn);
    mockUseStreamingVideoContext.mockImplementation(defaultCtxReturn);
  });

  it("unifies chat + voice agent messages in chronological order", () => {
    mockUseChat.mockImplementation(() => ({
      ...defaultChatReturn(),
      messages: [
        {
          id: "2",
          role: "assistant",
          content: "voiced reply",
          timestamp: "2026-05-02T10:01:00Z",
          source: "voice",
          voice_speaker: "agent",
        },
        {
          id: "1",
          role: "user",
          content: "hi",
          timestamp: "2026-05-02T10:00:00Z",
          source: "text",
        },
      ],
    }));

    const { result } = renderHook(() =>
      useConversation({ summaryId: "1", initialMode: "chat" }),
    );

    expect(result.current.messages).toHaveLength(2);
    // Sorted by timestamp ascending
    expect(result.current.messages[0].id).toBe("1");
    expect(result.current.messages[1].id).toBe("2");
    expect(result.current.messages[1].source).toBe("voice");
  });

  it("excludes voice user messages (audio user invisible rule)", () => {
    mockUseChat.mockImplementation(() => ({
      ...defaultChatReturn(),
      messages: [
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
      ],
    }));

    const { result } = renderHook(() =>
      useConversation({ summaryId: "1", initialMode: "chat" }),
    );

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].id).toBe("a1");
  });

  it("routes sendMessage to chat.sendMessage when voiceMode='off'", () => {
    const { result } = renderHook(() =>
      useConversation({ summaryId: "1", initialMode: "chat" }),
    );

    act(() => {
      result.current.sendMessage("hello world");
    });

    expect(mockSendMessage).toHaveBeenCalledWith("hello world");
    expect(mockVoiceSendUserMessage).not.toHaveBeenCalled();
  });

  it("routes sendMessage to voice.sendUserMessage when voiceMode='live'", () => {
    // Voice in 'listening' state → voiceMode becomes 'live'
    mockUseVoiceChat.mockImplementation(() => ({
      ...defaultVoiceReturn(),
      status: "listening",
    }));

    const { result } = renderHook(() =>
      useConversation({ summaryId: "1", initialMode: "chat" }),
    );

    act(() => {
      result.current.sendMessage("during call");
    });

    expect(mockVoiceSendUserMessage).toHaveBeenCalledWith("during call");
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("auto-starts voice when initialMode='call'", () => {
    renderHook(() =>
      useConversation({
        summaryId: "1",
        videoUrl: "https://youtu.be/abc",
        initialMode: "call",
      }),
    );

    expect(mockVoiceStart).toHaveBeenCalledTimes(1);
    expect(mockVoiceStart).toHaveBeenCalledWith({
      videoUrl: "https://youtu.be/abc",
    });
  });

  it("does NOT auto-start voice when initialMode='chat'", () => {
    renderHook(() =>
      useConversation({ summaryId: "1", initialMode: "chat" }),
    );

    expect(mockVoiceStart).not.toHaveBeenCalled();
  });

  it("transitions voiceMode 'live' → 'ended' → 'off' on hangup with 3s toast", () => {
    jest.useFakeTimers();

    let voiceStatus: string = "listening";
    mockUseVoiceChat.mockImplementation(() => ({
      ...defaultVoiceReturn(),
      status: voiceStatus,
    }));

    const { result, rerender } = renderHook(() =>
      useConversation({ summaryId: "1", initialMode: "chat" }),
    );

    expect(result.current.voiceMode).toBe("live");

    // Simulate hangup → status=idle
    voiceStatus = "idle";
    act(() => {
      rerender({});
    });

    expect(result.current.voiceMode).toBe("ended");
    expect(result.current.endedToastVisible).toBe(true);

    // Advance 3s → 'off'
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.voiceMode).toBe("off");
    expect(result.current.endedToastVisible).toBe(false);

    jest.useRealTimers();
  });

  it("requestStartCall opens Alert.alert with quota info", () => {
    mockUseVoiceChat.mockImplementation(() => ({
      ...defaultVoiceReturn(),
      remainingMinutes: 28,
    }));

    const { result } = renderHook(() =>
      useConversation({ summaryId: "1", initialMode: "chat" }),
    );

    act(() => {
      result.current.requestStartCall();
    });

    expect(Alert.alert).toHaveBeenCalled();
    const [title, message, buttons] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(title).toMatch(/appel/i);
    expect(message).toContain("28");
    expect(buttons).toHaveLength(2);
    expect(buttons[0].text).toMatch(/annuler/i);
    expect(buttons[1].text).toMatch(/démarrer/i);
  });

  it("loadHistory called once on resolvedSummaryId resolution", () => {
    renderHook(() =>
      useConversation({ summaryId: "42", initialMode: "chat" }),
    );

    expect(mockLoadHistory).toHaveBeenCalledTimes(1);
  });
});
