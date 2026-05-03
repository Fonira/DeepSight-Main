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

  it("renders markdown bold (**text**) as <strong> (F5)", () => {
    const msg: HubMessage = {
      ...baseMsg,
      role: "assistant",
      content: "Hello **world**",
    };
    const { container } = render(<MessageBubble msg={msg} />);
    expect(container.querySelector("strong")?.textContent).toBe("world");
    expect(container.textContent).not.toContain("**");
  });

  it("renders markdown links as <a target=_blank rel> (F5)", () => {
    const msg: HubMessage = {
      ...baseMsg,
      role: "assistant",
      content: "See [GitHub](https://github.com)",
    };
    const { container } = render(<MessageBubble msg={msg} />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://github.com");
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toContain("noopener");
    expect(link?.textContent).toBe("GitHub");
    expect(container.textContent).not.toContain("](");
  });

  it("renders ordered lists (F5)", () => {
    const msg: HubMessage = {
      ...baseMsg,
      role: "assistant",
      content: "1. premier\n2. second",
    };
    const { container } = render(<MessageBubble msg={msg} />);
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
  });

  it("renders ### headings as <h3> (F5)", () => {
    const msg: HubMessage = {
      ...baseMsg,
      role: "assistant",
      content: "### Sources",
    };
    const { container } = render(<MessageBubble msg={msg} />);
    expect(container.querySelector("h3")?.textContent).toBe("Sources");
    expect(container.textContent).not.toContain("###");
  });
});
