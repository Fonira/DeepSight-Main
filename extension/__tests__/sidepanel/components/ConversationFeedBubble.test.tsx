/**
 * Tests — ConversationFeedBubble (extension)
 *
 * Trois variantes :
 *   - user text bubble       (right aligned, plain text)
 *   - assistant text bubble  (left aligned, markdown)
 *   - assistant voice bubble (left aligned, markdown, mic badge)
 */

import React from "react";
import { render } from "@testing-library/react";
import { ConversationFeedBubble } from "../../../src/sidepanel/components/ConversationFeedBubble";
import type { UnifiedMessage } from "../../../src/sidepanel/hooks/useConversation";

// Mock i18n hook (dependency of nested components — ConversationFeedBubble
// itself doesn't use it, but we keep the mock for safety).
jest.mock("../../../src/i18n/useTranslation", () => ({
  __esModule: true,
  useTranslation: () => ({
    t: { chat: { webEnriched: "Web enriched" } },
    language: "fr",
  }),
}));

const baseMessage: UnifiedMessage = {
  id: "1",
  role: "user",
  content: "hello world",
  source: "text",
  timestamp: Date.now(),
};

describe("ConversationFeedBubble", () => {
  it("renders user text bubble (right-aligned class)", () => {
    const { container, getByText } = render(
      <ConversationFeedBubble message={baseMessage} />,
    );
    expect(getByText("hello world")).toBeTruthy();
    const bubble = container.querySelector(".chat-msg-user");
    expect(bubble).toBeTruthy();
  });

  it("renders assistant text bubble with markdown rendering", () => {
    const m: UnifiedMessage = {
      id: "2",
      role: "assistant",
      content: "this is **bold**",
      source: "text",
      timestamp: Date.now(),
    };
    const { container } = render(<ConversationFeedBubble message={m} />);
    const bubble = container.querySelector(".chat-msg-assistant");
    expect(bubble).toBeTruthy();
    // markdown renderer wraps content in chat-md-content
    const md = container.querySelector(".chat-md-content");
    expect(md).toBeTruthy();
  });

  it("renders assistant voice bubble with mic badge (testid voice-badge-mic)", () => {
    const m: UnifiedMessage = {
      id: "3",
      role: "assistant",
      content: "voiced reply",
      source: "voice",
      voiceSpeaker: "agent",
      timestamp: Date.now(),
    };
    const { getByTestId, container } = render(
      <ConversationFeedBubble message={m} />,
    );
    expect(getByTestId("voice-badge-mic")).toBeTruthy();
    const bubble = container.querySelector(".chat-msg-voice");
    expect(bubble).toBeTruthy();
  });

  it("does NOT render mic badge for text bubbles", () => {
    const { queryByTestId } = render(
      <ConversationFeedBubble message={baseMessage} />,
    );
    expect(queryByTestId("voice-badge-mic")).toBeNull();
  });

  it("renders web enriched badge when webSearchUsed=true", () => {
    const m: UnifiedMessage = {
      id: "4",
      role: "assistant",
      content: "enriched answer",
      source: "text",
      timestamp: Date.now(),
      webSearchUsed: true,
    };
    const { container } = render(<ConversationFeedBubble message={m} />);
    expect(container.querySelector(".chat-web-badge")).toBeTruthy();
  });
});
