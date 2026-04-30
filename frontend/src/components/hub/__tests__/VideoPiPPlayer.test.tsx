// frontend/src/components/hub/__tests__/VideoPiPPlayer.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VideoPiPPlayer } from "../VideoPiPPlayer";

describe("VideoPiPPlayer", () => {
  it("renders thumbnail or fallback gradient when no url", () => {
    const { container } = render(
      <VideoPiPPlayer
        thumbnailUrl={null}
        title="test"
        durationSecs={1112}
        expanded={false}
        onExpand={() => {}}
        onShrink={() => {}}
      />,
    );
    expect(
      container.querySelector("[data-testid='hub-pip']"),
    ).toBeInTheDocument();
  });

  it("calls onExpand when expand button clicked", () => {
    const onExpand = vi.fn();
    render(
      <VideoPiPPlayer
        thumbnailUrl={null}
        title="test"
        durationSecs={1112}
        expanded={false}
        onExpand={onExpand}
        onShrink={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /agrandir/i }));
    expect(onExpand).toHaveBeenCalled();
  });

  it("renders shrink button when expanded", () => {
    render(
      <VideoPiPPlayer
        thumbnailUrl={null}
        title="test"
        durationSecs={1112}
        expanded={true}
        onExpand={() => {}}
        onShrink={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: /réduire/i }),
    ).toBeInTheDocument();
  });
});
