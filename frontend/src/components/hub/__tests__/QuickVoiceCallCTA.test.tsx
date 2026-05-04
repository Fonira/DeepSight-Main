import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuickVoiceCallCTA } from "../QuickVoiceCallCTA";

describe("QuickVoiceCallCTA", () => {
  it("renders the dominant label and triggers onStart on click", () => {
    const onStart = vi.fn();
    render(<QuickVoiceCallCTA onStart={onStart} />);
    const btn = screen.getByRole("button", {
      name: /démarrer un appel vocal/i,
    });
    expect(btn).toBeInTheDocument();
    expect(screen.getByText(/Démarrer un appel vocal/i)).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("does not call onStart when disabled", () => {
    const onStart = vi.fn();
    render(<QuickVoiceCallCTA onStart={onStart} disabled />);
    const btn = screen.getByRole("button", {
      name: /démarrer un appel vocal/i,
    });
    fireEvent.click(btn);
    expect(onStart).not.toHaveBeenCalled();
    expect(btn).toBeDisabled();
  });
});
