/**
 * VoiceCallButton.test.tsx — Tests pour le bouton réutilisable voice.
 *
 * VoiceCallButton consomme le VoiceCallProvider via useVoiceCall() et expose
 * 4 variantes visuelles : hero | header | fab | inline. Spec ElevenLabs
 * ecosystem #2 §b.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockUseVoiceCall = vi.fn();
vi.mock("../VoiceCallProvider", () => ({
  useVoiceCall: () => mockUseVoiceCall(),
}));

// Stub framer-motion : `motion.<tag>` retourne le tag DOM correspondant pour
// préserver la sémantique role/aria pendant les tests (ex: motion.button → <button>).
vi.mock("framer-motion", () => {
  const MOTION_PROPS = new Set([
    "initial",
    "animate",
    "exit",
    "transition",
    "whileHover",
    "whileTap",
    "variants",
    "layout",
    "drag",
  ]);
  return {
    motion: new Proxy(
      {},
      {
        get: (_target, tag: string) => {
          const Tag = tag as keyof JSX.IntrinsicElements;
          return React.forwardRef(
            (
              {
                children,
                ...props
              }: React.PropsWithChildren<Record<string, unknown>>,
              ref: React.Ref<HTMLElement>,
            ) => {
              // Strip framer-only props to keep the DOM clean.
              const cleaned: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(props)) {
                if (!MOTION_PROPS.has(k)) cleaned[k] = v;
              }
              return React.createElement(Tag, { ref, ...cleaned }, children);
            },
          );
        },
      },
    ),
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  };
});

import { VoiceCallButton } from "../VoiceCallButton";

// ─── Helpers ────────────────────────────────────────────────────────────────

const makeContext = (overrides: Partial<Record<string, unknown>> = {}) => ({
  isOpen: false,
  openModal: vi.fn(),
  closeModal: vi.fn(),
  prewarm: vi.fn(),
  voiceEnabled: true,
  videoTitle: "",
  thumbnailUrl: null,
  videoId: null,
  platform: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("VoiceCallButton", () => {
  describe("variant=header", () => {
    it("rend un bouton 40x40 avec label 'Appeler'", () => {
      mockUseVoiceCall.mockReturnValue(makeContext());
      render(<VoiceCallButton variant="header" />);
      const btn = screen.getByRole("button");
      expect(btn).toBeDefined();
      expect(btn.textContent).toMatch(/Appeler/i);
    });

    it("appelle openModal au clic quand voice est activé", () => {
      const ctx = makeContext();
      mockUseVoiceCall.mockReturnValue(ctx);
      render(<VoiceCallButton variant="header" />);

      fireEvent.click(screen.getByRole("button"));
      expect(ctx.openModal).toHaveBeenCalledTimes(1);
    });

    it("affiche un cadenas + n'appelle pas openModal si voiceEnabled=false", () => {
      const ctx = makeContext({ voiceEnabled: false });
      mockUseVoiceCall.mockReturnValue(ctx);
      render(<VoiceCallButton variant="header" />);

      const btn = screen.getByRole("button");
      expect(btn.getAttribute("aria-disabled")).toBe("true");

      fireEvent.click(btn);
      expect(ctx.openModal).not.toHaveBeenCalled();
    });
  });

  describe("variant=fab", () => {
    it("rend un FAB avec aria-label dédié", () => {
      mockUseVoiceCall.mockReturnValue(makeContext());
      render(<VoiceCallButton variant="fab" />);
      const btn = screen.getByRole("button");
      expect(btn.getAttribute("aria-label")).toMatch(
        /chat vocal|voice|appel/i,
      );
    });

    it("appelle openModal au clic", () => {
      const ctx = makeContext();
      mockUseVoiceCall.mockReturnValue(ctx);
      render(<VoiceCallButton variant="fab" />);
      fireEvent.click(screen.getByRole("button"));
      expect(ctx.openModal).toHaveBeenCalled();
    });
  });

  describe("variant=inline", () => {
    it("rend un bouton inline cliquable", () => {
      const ctx = makeContext();
      mockUseVoiceCall.mockReturnValue(ctx);
      render(<VoiceCallButton variant="inline" label="Parler" />);
      const btn = screen.getByRole("button");
      expect(btn.textContent).toMatch(/Parler/);
      fireEvent.click(btn);
      expect(ctx.openModal).toHaveBeenCalled();
    });
  });

  describe("variant=hero", () => {
    it("rend la grande carte hero avec CTA", () => {
      mockUseVoiceCall.mockReturnValue(
        makeContext({ videoTitle: "Ma vidéo" }),
      );
      render(<VoiceCallButton variant="hero" />);
      // hero est un role=button click target (motion.div)
      const region = screen.getByRole("button");
      expect(region.textContent).toMatch(/Discute|Parler|Verrouill/);
    });

    it("appelle prewarm dès le mount quand voice est activé", () => {
      const ctx = makeContext();
      mockUseVoiceCall.mockReturnValue(ctx);
      render(<VoiceCallButton variant="hero" />);
      expect(ctx.prewarm).toHaveBeenCalled();
    });

    it("n'appelle PAS prewarm quand voiceEnabled=false", () => {
      const ctx = makeContext({ voiceEnabled: false });
      mockUseVoiceCall.mockReturnValue(ctx);
      render(<VoiceCallButton variant="hero" />);
      expect(ctx.prewarm).not.toHaveBeenCalled();
    });
  });

  describe("clavier", () => {
    it("réagit à Enter", () => {
      const ctx = makeContext();
      mockUseVoiceCall.mockReturnValue(ctx);
      render(<VoiceCallButton variant="header" />);
      fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
      expect(ctx.openModal).toHaveBeenCalled();
    });

    it("réagit à Space", () => {
      const ctx = makeContext();
      mockUseVoiceCall.mockReturnValue(ctx);
      render(<VoiceCallButton variant="header" />);
      fireEvent.keyDown(screen.getByRole("button"), { key: " " });
      expect(ctx.openModal).toHaveBeenCalled();
    });

    it("ignore Enter si voice désactivé", () => {
      const ctx = makeContext({ voiceEnabled: false });
      mockUseVoiceCall.mockReturnValue(ctx);
      render(<VoiceCallButton variant="header" />);
      fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
      expect(ctx.openModal).not.toHaveBeenCalled();
    });
  });
});
