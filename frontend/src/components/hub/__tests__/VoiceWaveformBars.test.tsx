// frontend/src/components/hub/__tests__/VoiceWaveformBars.test.tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { VoiceWaveformBars } from "../VoiceWaveformBars";

describe("VoiceWaveformBars", () => {
  it("renders one i element per bar height", () => {
    const { container } = render(
      <VoiceWaveformBars bars={[6, 14, 9]} progress={0} playing={false} />,
    );
    expect(container.querySelectorAll("i")).toHaveLength(3);
  });

  it("marks bars at index <= progress*bars.length as played", () => {
    const { container } = render(
      <VoiceWaveformBars bars={[6, 14, 9, 20]} progress={0.5} playing />,
    );
    const bars = container.querySelectorAll("i");
    expect(bars[0].getAttribute("data-played")).toBe("true");
    expect(bars[1].getAttribute("data-played")).toBe("true");
    expect(bars[3].getAttribute("data-played")).toBe("false");
  });
});
