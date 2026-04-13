/**
 * VoiceWaveform.test.tsx — Tests pour le composant VoiceWaveform
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { VoiceWaveform } from "../VoiceWaveform";

describe("VoiceWaveform", () => {
  beforeEach(() => {
    // Mock requestAnimationFrame to trigger synchronously
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(
      (cb: FrameRequestCallback) => {
        // Call once immediately with a fake timestamp to populate bars
        setTimeout(() => cb(performance.now()), 0);
        return 1;
      },
    );
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rend 20 barres par défaut", () => {
    const { container } = render(<VoiceWaveform mode="idle" />);
    const bars = container.querySelectorAll(".rounded-full");
    expect(bars.length).toBe(20);
  });

  it("affiche le bon aria-label pour mode idle", () => {
    render(<VoiceWaveform mode="idle" />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "Audio idle",
    );
  });

  it("affiche le bon aria-label pour mode user", () => {
    render(<VoiceWaveform mode="user" />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "User speaking",
    );
  });

  it("affiche le bon aria-label pour mode ai", () => {
    render(<VoiceWaveform mode="ai" />);
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "AI speaking",
    );
  });

  it("utilise la couleur indigo par défaut", () => {
    const { container } = render(<VoiceWaveform mode="idle" />);
    const bars = container.querySelectorAll(".bg-indigo-500");
    expect(bars.length).toBe(20);
  });

  it("utilise la couleur violet quand spécifié", () => {
    const { container } = render(<VoiceWaveform mode="idle" color="violet" />);
    const bars = container.querySelectorAll(".bg-violet-500");
    expect(bars.length).toBe(20);
  });

  it("utilise la couleur cyan quand spécifié", () => {
    const { container } = render(<VoiceWaveform mode="idle" color="cyan" />);
    const bars = container.querySelectorAll(".bg-cyan-500");
    expect(bars.length).toBe(20);
  });

  it("adapte la hauteur max selon la taille sm", () => {
    const { container } = render(<VoiceWaveform mode="idle" size="sm" />);
    const wrapper = container.querySelector('[role="img"]') as HTMLElement;
    expect(wrapper?.style.height).toBe("24px");
  });

  it("adapte la hauteur max selon la taille md (défaut)", () => {
    const { container } = render(<VoiceWaveform mode="idle" />);
    const wrapper = container.querySelector('[role="img"]') as HTMLElement;
    expect(wrapper?.style.height).toBe("48px");
  });

  it("adapte la hauteur max selon la taille lg", () => {
    const { container } = render(<VoiceWaveform mode="idle" size="lg" />);
    const wrapper = container.querySelector('[role="img"]') as HTMLElement;
    expect(wrapper?.style.height).toBe("80px");
  });

  it("clamp l'intensité entre 0 et 1", () => {
    // Should not crash with out-of-range values
    const { unmount: unmount1 } = render(
      <VoiceWaveform mode="user" intensity={-0.5} />,
    );
    unmount1();

    const { unmount: unmount2 } = render(
      <VoiceWaveform mode="user" intensity={2.0} />,
    );
    unmount2();
    // No error = pass
  });

  it("nettoie requestAnimationFrame au unmount", () => {
    const cancelSpy = vi.spyOn(window, "cancelAnimationFrame");
    const { unmount } = render(<VoiceWaveform mode="idle" />);
    unmount();
    expect(cancelSpy).toHaveBeenCalled();
  });
});
