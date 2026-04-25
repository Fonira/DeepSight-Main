/**
 * VoiceCallProvider.test.tsx — Tests pour le provider voice unifié.
 *
 * VoiceCallProvider encapsule le boilerplate dupliqué de
 * DashboardPage/History/DebatePage : useVoiceChat + useMicLevel +
 * useVoiceEnabled + isVoiceModalOpen + rendu de <VoiceModal />.
 * Spec ElevenLabs ecosystem #2 §a.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, renderHook, act, screen } from "@testing-library/react";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockUseVoiceChat = vi.fn();
vi.mock("../useVoiceChat", () => ({
  useVoiceChat: (opts: unknown) => mockUseVoiceChat(opts),
}));

const mockUseMicLevel = vi.fn();
vi.mock("../hooks/useMicLevel", () => ({
  useMicLevel: (...args: unknown[]) => mockUseMicLevel(...args),
}));

const mockUseVoiceEnabled = vi.fn();
vi.mock("../hooks/useVoiceEnabled", () => ({
  useVoiceEnabled: () => mockUseVoiceEnabled(),
  default: () => mockUseVoiceEnabled(),
}));

// VoiceModal renders inside React Portal to document.body — capture props for assertions.
const modalRenderSpy = vi.fn();
vi.mock("../VoiceModal", () => ({
  VoiceModal: (props: Record<string, unknown>) => {
    modalRenderSpy(props);
    return props.isOpen ? (
      <div
        data-testid="mock-voice-modal"
        data-compact={String(props.compact ?? false)}
      >
        modal
      </div>
    ) : null;
  },
  default: (props: Record<string, unknown>) => {
    modalRenderSpy(props);
    return props.isOpen ? (
      <div
        data-testid="mock-voice-modal"
        data-compact={String(props.compact ?? false)}
      >
        modal
      </div>
    ) : null;
  },
}));

import { VoiceCallProvider, useVoiceCall } from "../VoiceCallProvider";

// ─── Helpers ────────────────────────────────────────────────────────────────

const baseVoiceChatStub = {
  start: vi.fn(),
  prewarm: vi.fn(),
  stop: vi.fn(),
  restart: vi.fn(),
  toggleMute: vi.fn(),
  startTalking: vi.fn(),
  stopTalking: vi.fn(),
  status: "idle" as const,
  isSpeaking: false,
  isMuted: false,
  isTalking: false,
  inputMode: "ptt" as const,
  pttKey: " ",
  activeTool: null,
  messages: [],
  elapsedSeconds: 0,
  remainingMinutes: 10,
  error: null,
  playbackRate: 1.0,
  micStream: { current: null },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseVoiceChat.mockReturnValue(baseVoiceChatStub);
  mockUseMicLevel.mockReturnValue(0);
  mockUseVoiceEnabled.mockReturnValue(true);
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("VoiceCallProvider", () => {
  it("rend les enfants", () => {
    render(
      <VoiceCallProvider summaryId={42} videoTitle="Hello">
        <div data-testid="child">child</div>
      </VoiceCallProvider>,
    );
    expect(screen.getByTestId("child")).toBeDefined();
  });

  it("expose isOpen=false par défaut (modal fermée)", () => {
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <VoiceCallProvider summaryId={42} videoTitle="t">
        {children}
      </VoiceCallProvider>
    );
    const { result } = renderHook(() => useVoiceCall(), { wrapper });
    expect(result.current.isOpen).toBe(false);
  });

  it("openModal() ouvre la modal", () => {
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <VoiceCallProvider summaryId={42} videoTitle="t">
        {children}
      </VoiceCallProvider>
    );
    const { result } = renderHook(() => useVoiceCall(), { wrapper });

    expect(result.current.isOpen).toBe(false);
    act(() => result.current.openModal());
    expect(result.current.isOpen).toBe(true);
  });

  it("closeModal() ferme la modal ET appelle voiceChat.stop()", () => {
    const stop = vi.fn();
    mockUseVoiceChat.mockReturnValue({ ...baseVoiceChatStub, stop });

    const wrapper = ({ children }: React.PropsWithChildren) => (
      <VoiceCallProvider summaryId={42} videoTitle="t">
        {children}
      </VoiceCallProvider>
    );
    const { result } = renderHook(() => useVoiceCall(), { wrapper });

    act(() => result.current.openModal());
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.closeModal());
    expect(result.current.isOpen).toBe(false);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("expose voiceEnabled depuis useVoiceEnabled", () => {
    mockUseVoiceEnabled.mockReturnValue(false);

    const wrapper = ({ children }: React.PropsWithChildren) => (
      <VoiceCallProvider summaryId={42} videoTitle="t">
        {children}
      </VoiceCallProvider>
    );
    const { result } = renderHook(() => useVoiceCall(), { wrapper });

    expect(result.current.voiceEnabled).toBe(false);
  });

  it("openModal() est ignoré si voiceEnabled=false", () => {
    mockUseVoiceEnabled.mockReturnValue(false);

    const wrapper = ({ children }: React.PropsWithChildren) => (
      <VoiceCallProvider summaryId={42} videoTitle="t">
        {children}
      </VoiceCallProvider>
    );
    const { result } = renderHook(() => useVoiceCall(), { wrapper });

    act(() => result.current.openModal());
    expect(result.current.isOpen).toBe(false);
  });

  it("expose prewarm et le forward au hook useVoiceChat", () => {
    const prewarm = vi.fn();
    mockUseVoiceChat.mockReturnValue({ ...baseVoiceChatStub, prewarm });

    const wrapper = ({ children }: React.PropsWithChildren) => (
      <VoiceCallProvider summaryId={42} videoTitle="t">
        {children}
      </VoiceCallProvider>
    );
    const { result } = renderHook(() => useVoiceCall(), { wrapper });

    act(() => result.current.prewarm());
    expect(prewarm).toHaveBeenCalledTimes(1);
  });

  it("forward summaryId, agentType, language à useVoiceChat", () => {
    render(
      <VoiceCallProvider
        summaryId={123}
        agentType="explorer"
        videoTitle="t"
        language="en"
      >
        <div />
      </VoiceCallProvider>,
    );
    expect(mockUseVoiceChat).toHaveBeenCalledWith(
      expect.objectContaining({
        summaryId: 123,
        agentType: "explorer",
        language: "en",
      }),
    );
  });

  it("forward debateId à useVoiceChat (mode débat)", () => {
    render(
      <VoiceCallProvider
        debateId={77}
        agentType="debate_moderator"
        videoTitle="Débat"
      >
        <div />
      </VoiceCallProvider>,
    );
    expect(mockUseVoiceChat).toHaveBeenCalledWith(
      expect.objectContaining({
        debateId: 77,
        agentType: "debate_moderator",
      }),
    );
  });

  it("rend VoiceModal avec compact=true quand prop fournie", () => {
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <VoiceCallProvider summaryId={42} videoTitle="t" compact>
        {children}
      </VoiceCallProvider>
    );
    const { result } = renderHook(() => useVoiceCall(), { wrapper });

    act(() => result.current.openModal());

    // VoiceModal received compact=true
    const lastCall = modalRenderSpy.mock.calls.at(-1)?.[0];
    expect(lastCall?.compact).toBe(true);
  });

  it("rend VoiceModal avec compact=false par défaut", () => {
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <VoiceCallProvider summaryId={42} videoTitle="t">
        {children}
      </VoiceCallProvider>
    );
    const { result } = renderHook(() => useVoiceCall(), { wrapper });

    act(() => result.current.openModal());

    const lastCall = modalRenderSpy.mock.calls.at(-1)?.[0];
    expect(lastCall?.compact ?? false).toBe(false);
  });

  it("propage videoTitle, channelName, summaryId, thumbnailUrl à VoiceModal", () => {
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <VoiceCallProvider
        summaryId={42}
        videoTitle="Mon titre"
        channelName="Ma chaîne"
        thumbnailUrl="https://thumb"
      >
        {children}
      </VoiceCallProvider>
    );
    const { result } = renderHook(() => useVoiceCall(), { wrapper });
    act(() => result.current.openModal());

    const lastCall = modalRenderSpy.mock.calls.at(-1)?.[0];
    expect(lastCall?.videoTitle).toBe("Mon titre");
    expect(lastCall?.channelName).toBe("Ma chaîne");
    expect(lastCall?.summaryId).toBe(42);
    expect(lastCall?.videoThumbnailUrl).toBe("https://thumb");
  });

  it("useVoiceCall() throw si utilisé hors provider", () => {
    // suppress error log noise from React for this expected throw
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    expect(() => renderHook(() => useVoiceCall())).toThrow(
      /VoiceCallProvider/,
    );
    consoleError.mockRestore();
  });
});
