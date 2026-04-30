import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { CallModeFullBleed } from "../CallModeFullBleed";

vi.mock("../../voice/VoiceOverlay", () => ({
  VoiceOverlay: ({ isOpen, presentationMode }: any) => (
    <div
      data-testid="voice-overlay-mock"
      data-open={isOpen}
      data-mode={presentationMode}
    />
  ),
}));

describe("CallModeFullBleed", () => {
  it("does not render VoiceOverlay when closed", () => {
    const { queryByTestId } = render(
      <CallModeFullBleed
        open={false}
        onClose={() => {}}
        summaryId={null}
        title={null}
        subtitle={null}
        onVoiceMessage={() => {}}
      />,
    );
    expect(queryByTestId("voice-overlay-mock")).toBeNull();
  });

  it("passes presentationMode='fullbleed' to VoiceOverlay when open", () => {
    const { getByTestId } = render(
      <CallModeFullBleed
        open={true}
        onClose={() => {}}
        summaryId={42}
        title="t"
        subtitle="s"
        onVoiceMessage={() => {}}
      />,
    );
    const ov = getByTestId("voice-overlay-mock");
    expect(ov.dataset.mode).toBe("fullbleed");
    expect(ov.dataset.open).toBe("true");
  });
});
