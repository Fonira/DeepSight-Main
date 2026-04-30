// frontend/src/components/hub/__tests__/VoiceBubble.test.tsx
import { describe, it, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { VoiceBubble } from "../VoiceBubble";

describe("VoiceBubble", () => {
  it("renders play button and waveform", () => {
    const { container } = render(
      <VoiceBubble
        durationSecs={8}
        bars={[6, 14, 9, 20]}
        transcript="hello world"
      />,
    );
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
    expect(container.querySelectorAll("i").length).toBeGreaterThan(0);
  });

  it("toggles transcript visibility on toggle click", () => {
    render(
      <VoiceBubble
        durationSecs={8}
        bars={[6, 14, 9, 20]}
        transcript="hello world"
      />,
    );
    expect(screen.queryByTestId("voice-transcript")).toBeNull();
    const toggle = screen.getByText(/afficher le transcript/i);
    fireEvent.click(toggle);
    const transcript = screen.getByTestId("voice-transcript");
    expect(transcript.textContent?.replace(/\s+/g, " ").trim()).toMatch(
      /hello world/i,
    );
  });

  it("does not render transcript toggle if no transcript", () => {
    render(<VoiceBubble durationSecs={8} bars={[6, 14, 9, 20]} />);
    expect(screen.queryByText(/transcript/i)).toBeNull();
  });
});
