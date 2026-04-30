// frontend/src/components/hub/__tests__/Timeline.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Timeline } from "../Timeline";
import type { HubMessage } from "../types";

const msgs: HubMessage[] = [
  { id: "m1", role: "user", content: "Q1", source: "text", timestamp: 1 },
  { id: "m2", role: "assistant", content: "A1", source: "text", timestamp: 2 },
  // No audio_duration_secs → MessageBubble falls back to text bubble (renders <p>),
  // so the chronological-order test below can assert on querySelectorAll("p").
  {
    id: "m3",
    role: "user",
    content: "transcript",
    source: "voice_user",
    timestamp: 3,
  },
];

describe("Timeline", () => {
  it("renders one bubble per message", () => {
    render(<Timeline messages={msgs} />);
    expect(screen.getByText("Q1")).toBeInTheDocument();
    expect(screen.getByText("A1")).toBeInTheDocument();
  });

  it("renders empty state when no messages", () => {
    render(<Timeline messages={[]} />);
    expect(
      screen.getByText(/posez votre première question/i),
    ).toBeInTheDocument();
  });

  it("orders messages chronologically by timestamp", () => {
    const reordered: HubMessage[] = [...msgs].reverse();
    const { container } = render(<Timeline messages={reordered} />);
    const texts = Array.from(container.querySelectorAll("p"))
      .map((p) => p.textContent)
      .filter((t) => ["Q1", "A1", "transcript"].includes(t || ""));
    expect(texts).toEqual(["Q1", "A1", "transcript"]);
  });
});
