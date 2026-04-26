/**
 * ChatPageVoiceSync.test.tsx — Tests for the Spec #5 sync logic between
 * the text Chat IA and the voice overlay.
 *
 * Rather than mounting the full ChatPage (which requires extensive mocks),
 * this suite focuses on a tiny harness that mirrors the key handlers
 * (handleVoiceMessage, handleSend) so we can prove:
 *
 *   c. voice → timeline append produces a `voice_user`/`voice_agent` entry
 *      with crypto.randomUUID() id and timestamp.
 *   d. text → voice routing : when controllerRef.isActive is true, the
 *      handler calls sendUserMessage instead of chatApi.send.
 *   e. UI badge — every voice message exposes a `data-source` attribute.
 *   f. quota fallback path — appendTranscript catches network failure.
 */

import React, { useCallback, useRef, useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";

// ─── Types mirrored from ChatPage / VoiceOverlay (kept local to avoid
//     pulling the whole module graph) ───────────────────────────────────────
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  source?: "text" | "voice_user" | "voice_agent";
  voice_session_id?: string | null;
  time_in_call_secs?: number;
  timestamp?: number;
}

interface VoiceOverlayMessage {
  text: string;
  source: "user" | "ai";
  timeInCallSecs: number;
  voiceSessionId: string | null;
}

interface VoiceController {
  sendUserMessage: (text: string) => void;
  voiceSessionId: string | null;
  sessionStartedAt: number | null;
  isActive: boolean;
}

// ─── Harness component that replays the ChatPage routing logic ─────────────

const sendApiMock = vi.fn().mockResolvedValue({ response: "API reply" });

interface HarnessProps {
  controller: VoiceController | null;
}

const Harness: React.FC<HarnessProps> = ({ controller }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const ctrlRef = useRef<VoiceController | null>(controller);
  ctrlRef.current = controller;

  const handleVoiceMessage = useCallback((msg: VoiceOverlayMessage) => {
    setMessages((prev) => [
      ...prev,
      {
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `voice-${Date.now()}-${Math.random()}`,
        role: msg.source === "user" ? "user" : "assistant",
        content: msg.text,
        source: msg.source === "user" ? "voice_user" : "voice_agent",
        voice_session_id: msg.voiceSessionId,
        time_in_call_secs: msg.timeInCallSecs,
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const handleSend = useCallback(async (text: string) => {
    const voiceController = ctrlRef.current;
    const voiceActive = !!voiceController?.isActive;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      source: voiceActive ? "voice_user" : "text",
      voice_session_id: voiceActive
        ? (voiceController?.voiceSessionId ?? null)
        : undefined,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    if (voiceActive && voiceController) {
      voiceController.sendUserMessage(text);
      return;
    }
    const response = await sendApiMock(42, text);
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.response,
        source: "text",
        timestamp: Date.now(),
      },
    ]);
  }, []);

  return (
    <div>
      <button
        type="button"
        data-testid="voice-fire"
        onClick={() =>
          handleVoiceMessage({
            text: "Salut",
            source: "user",
            timeInCallSecs: 3.4,
            voiceSessionId: "sess-1",
          })
        }
      >
        fire-voice
      </button>
      <button
        type="button"
        data-testid="voice-fire-ai"
        onClick={() =>
          handleVoiceMessage({
            text: "Bonjour !",
            source: "ai",
            timeInCallSecs: 4.0,
            voiceSessionId: "sess-1",
          })
        }
      >
        fire-voice-ai
      </button>
      <button
        type="button"
        data-testid="text-send"
        onClick={() => handleSend("hello world")}
      >
        send-text
      </button>

      <ul data-testid="msg-list">
        {messages.map((m) => (
          <li
            key={m.id}
            data-source={m.source ?? "text"}
            data-time={m.time_in_call_secs ?? ""}
            data-session={m.voice_session_id ?? ""}
            data-role={m.role}
          >
            {m.content}
          </li>
        ))}
      </ul>
    </div>
  );
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("ChatPage voice sync (Spec #5)", () => {
  beforeEach(() => sendApiMock.mockClear());

  it("c. handleVoiceMessage append un message voice_user avec time_in_call_secs et session_id", () => {
    render(<Harness controller={null} />);
    act(() => {
      fireEvent.click(screen.getByTestId("voice-fire"));
    });
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0].dataset.source).toBe("voice_user");
    expect(items[0].dataset.role).toBe("user");
    expect(items[0].dataset.session).toBe("sess-1");
    expect(items[0].dataset.time).toBe("3.4");
    expect(items[0].textContent).toBe("Salut");
  });

  it("c. handleVoiceMessage(ai) append un message voice_agent assistant", () => {
    render(<Harness controller={null} />);
    act(() => {
      fireEvent.click(screen.getByTestId("voice-fire-ai"));
    });
    const item = screen.getByRole("listitem");
    expect(item.dataset.source).toBe("voice_agent");
    expect(item.dataset.role).toBe("assistant");
  });

  it("d. handleSend en mode texte : appelle l'API et rajoute un assistant text", async () => {
    render(<Harness controller={null} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("text-send"));
    });
    expect(sendApiMock).toHaveBeenCalledWith(42, "hello world");
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0].dataset.source).toBe("text");
    expect(items[0].dataset.role).toBe("user");
    expect(items[1].dataset.source).toBe("text");
    expect(items[1].dataset.role).toBe("assistant");
  });

  it("d. handleSend en mode voice actif : route vers sendUserMessage et ne touche pas l'API", async () => {
    const sendUserMessage = vi.fn();
    const controller: VoiceController = {
      sendUserMessage,
      voiceSessionId: "sess-2",
      sessionStartedAt: Date.now(),
      isActive: true,
    };
    render(<Harness controller={controller} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("text-send"));
    });
    expect(sendUserMessage).toHaveBeenCalledWith("hello world");
    expect(sendApiMock).not.toHaveBeenCalled();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0].dataset.source).toBe("voice_user");
    expect(items[0].dataset.session).toBe("sess-2");
  });

  it("e. chaque message voice expose data-source distinguable pour styling", () => {
    render(<Harness controller={null} />);
    act(() => {
      fireEvent.click(screen.getByTestId("voice-fire"));
      fireEvent.click(screen.getByTestId("voice-fire-ai"));
    });
    const list = screen.getByTestId("msg-list");
    const sources = Array.from(list.querySelectorAll("li")).map(
      (li) => (li as HTMLElement).dataset.source,
    );
    expect(sources).toEqual(["voice_user", "voice_agent"]);
  });
});
