/**
 * VoiceButton.test.tsx — Tests pour le composant VoiceButton (web)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// ─── Mocks ──────────────────────────────────────────────────────────────────

// Mock useAuth
const mockUseAuth = vi.fn();
vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock planPrivileges
vi.mock("../../../config/planPrivileges", () => ({
  normalizePlanId: (plan: string | undefined) => plan || "free",
  PLAN_LIMITS: {
    free: { voiceChatEnabled: false },
    etudiant: { voiceChatEnabled: true },
    starter: { voiceChatEnabled: true },
    pro: { voiceChatEnabled: true },
  },
}));

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: React.forwardRef(
      (
        {
          children,
          ...props
        }: React.PropsWithChildren<Record<string, unknown>>,
        ref: React.Ref<HTMLDivElement>,
      ) => (
        <div ref={ref} {...props}>
          {children}
        </div>
      ),
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

import VoiceButton from "../VoiceButton";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("VoiceButton", () => {
  const onOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le bouton micro quand voice est activé", () => {
    mockUseAuth.mockReturnValue({ user: { plan: "pro" } });
    render(<VoiceButton summaryId={42} onOpen={onOpen} />);

    const button = screen.getByRole("button");
    expect(button).toBeDefined();
    expect(button.getAttribute("aria-label")).toBe("Ouvrir le chat vocal");
  });

  it("affiche le cadenas quand le plan est free", () => {
    mockUseAuth.mockReturnValue({ user: { plan: "free" } });
    render(<VoiceButton summaryId={42} onOpen={onOpen} />);

    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-label")).toContain("plan Étudiant");
    expect(button.getAttribute("aria-disabled")).toBe("true");
  });

  it("appelle onOpen quand cliqué et voice enabled", () => {
    mockUseAuth.mockReturnValue({ user: { plan: "pro" } });
    render(<VoiceButton summaryId={42} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("n'appelle PAS onOpen quand le plan est free (locked)", () => {
    mockUseAuth.mockReturnValue({ user: { plan: "free" } });
    render(<VoiceButton summaryId={42} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("n'appelle PAS onOpen quand disabled=true", () => {
    mockUseAuth.mockReturnValue({ user: { plan: "pro" } });
    render(<VoiceButton summaryId={42} onOpen={onOpen} disabled />);

    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("réagit au clavier (Enter)", () => {
    mockUseAuth.mockReturnValue({ user: { plan: "starter" } });
    render(<VoiceButton summaryId={42} onOpen={onOpen} />);

    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("réagit au clavier (Space)", () => {
    mockUseAuth.mockReturnValue({ user: { plan: "starter" } });
    render(<VoiceButton summaryId={42} onOpen={onOpen} />);

    fireEvent.keyDown(screen.getByRole("button"), { key: " " });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("a le tabIndex 0 pour l'accessibilité", () => {
    mockUseAuth.mockReturnValue({ user: { plan: "pro" } });
    render(<VoiceButton summaryId={42} onOpen={onOpen} />);

    expect(screen.getByRole("button").getAttribute("tabindex")).toBe("0");
  });
});
