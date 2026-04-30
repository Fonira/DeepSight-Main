// frontend/src/components/hub/__tests__/MessageBubble.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MessageBubble } from "../MessageBubble";
import type { HubMessage } from "../types";

const baseMsg: HubMessage = {
  id: "m1",
  role: "user",
  content: "Hello",
  source: "text",
  timestamp: 1,
};

describe("MessageBubble", () => {
  it("renders user text bubble on the right", () => {
    const { container } = render(<MessageBubble msg={baseMsg} />);
    const bubble = container.firstChild as HTMLElement;
    expect(bubble.className).toMatch(/justify-end|self-end/);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders AI text bubble on the left", () => {
    const { container } = render(
      <MessageBubble msg={{ ...baseMsg, role: "assistant", content: "Hi" }} />,
    );
    const bubble = container.firstChild as HTMLElement;
    expect(bubble.className).not.toMatch(/justify-end/);
    expect(screen.getByText("Hi")).toBeInTheDocument();
  });

  it("renders voice bubble when source is voice_user with audio_duration_secs", () => {
    const { container } = render(
      <MessageBubble
        msg={{
          ...baseMsg,
          source: "voice_user",
          audio_duration_secs: 8,
          content: "transcript text",
        }}
      />,
    );
    expect(container.querySelectorAll("i").length).toBeGreaterThan(0);
  });

  it("falls back to text rendering for voice_user without audio_duration_secs", () => {
    const { container } = render(
      <MessageBubble
        msg={{ ...baseMsg, source: "voice_user", content: "fallback text" }}
      />,
    );
    expect(screen.getByText("fallback text")).toBeInTheDocument();
    expect(container.querySelectorAll("i").length).toBe(0);
  });
});
