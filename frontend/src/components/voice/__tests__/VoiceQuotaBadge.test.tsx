/**
 * VoiceQuotaBadge.test.tsx — Tests pour le composant VoiceQuotaBadge
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VoiceQuotaBadge } from "../VoiceQuotaBadge";

describe("VoiceQuotaBadge", () => {
  it("affiche le temps utilisé et total", () => {
    render(<VoiceQuotaBadge minutesUsed={2} minutesTotal={15} />);
    // 2:00 / 15:00
    expect(screen.getByText(/2:00/)).toBeDefined();
    expect(screen.getByText(/15:00/)).toBeDefined();
  });

  it("formate correctement les minutes fractionnaires", () => {
    render(<VoiceQuotaBadge minutesUsed={2.5} minutesTotal={10} />);
    // 2:30 / 10:00
    expect(screen.getByText(/2:30/)).toBeDefined();
  });

  it("affiche 0:00 quand rien n'est utilisé", () => {
    render(<VoiceQuotaBadge minutesUsed={0} minutesTotal={5} />);
    expect(screen.getByText(/0:00/)).toBeDefined();
  });

  it("utilise la couleur par défaut (text-white/60) sans warning", () => {
    const { container } = render(
      <VoiceQuotaBadge minutesUsed={1} minutesTotal={15} />,
    );
    const badge = container.firstElementChild;
    expect(badge?.className).toContain("text-white/60");
  });

  it("utilise text-yellow-400 pour warningLevel=80", () => {
    const { container } = render(
      <VoiceQuotaBadge minutesUsed={12} minutesTotal={15} warningLevel={80} />,
    );
    const badge = container.firstElementChild;
    expect(badge?.className).toContain("text-yellow-400");
  });

  it("utilise text-orange-400 pour warningLevel=95", () => {
    const { container } = render(
      <VoiceQuotaBadge minutesUsed={14} minutesTotal={15} warningLevel={95} />,
    );
    const badge = container.firstElementChild;
    expect(badge?.className).toContain("text-orange-400");
  });

  it("utilise text-red-400 animate-pulse pour warningLevel=100", () => {
    const { container } = render(
      <VoiceQuotaBadge minutesUsed={15} minutesTotal={15} warningLevel={100} />,
    );
    const badge = container.firstElementChild;
    expect(badge?.className).toContain("text-red-400");
    expect(badge?.className).toContain("animate-pulse");
  });

  it("contient une icône horloge SVG", () => {
    const { container } = render(
      <VoiceQuotaBadge minutesUsed={5} minutesTotal={15} />,
    );
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("utilise font-mono pour les chiffres", () => {
    const { container } = render(
      <VoiceQuotaBadge minutesUsed={3} minutesTotal={10} />,
    );
    const span = container.querySelector("span.font-mono");
    expect(span).not.toBeNull();
  });
});
