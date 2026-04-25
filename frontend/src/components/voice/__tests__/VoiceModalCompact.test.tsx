/**
 * VoiceModalCompact.test.tsx — Tests pour la prop `compact` ajoutée à VoiceModal.
 *
 * Spec ElevenLabs ecosystem #2 §d :
 *  - compact=true → overlay flottant 380×600 (vs full screen)
 *  - compact=true → ESC ne ferme PAS (l'utilisateur peut taper dans le chat
 *    derrière sans interrompre la session vocale)
 *  - compact=false (défaut) → comportement legacy (full screen + ESC ferme)
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";

// ─── Mocks ──────────────────────────────────────────────────────────────────

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
        get: (_t, tag: string) => {
          const Tag = tag as keyof JSX.IntrinsicElements;
          return React.forwardRef(
            (
              {
                children,
                ...props
              }: React.PropsWithChildren<Record<string, unknown>>,
              ref: React.Ref<HTMLElement>,
            ) => {
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

// Mock useTranslation
vi.mock("../../../hooks/useTranslation", () => ({
  useTranslation: () => ({ language: "fr", t: (s: string) => s }),
}));

// Mock thumbnail backend fetch (no-op).
vi.mock("../../../services/api", () => ({
  voiceApi: { getSessionThumbnail: vi.fn(() => Promise.reject(new Error("no"))) },
  API_URL: "http://localhost",
  getAccessToken: () => null,
}));

// Mock voicePrefsBus.
vi.mock("../voicePrefsBus", () => ({
  subscribeVoicePrefsEvents: () => () => {},
}));

// Mock VoiceTranscript (lourd).
vi.mock("../VoiceTranscript", () => ({
  VoiceTranscript: () => <div data-testid="transcript" />,
}));

// Mock VoiceWaveform.
vi.mock("../VoiceWaveform", () => ({
  VoiceWaveform: () => <div data-testid="waveform" />,
}));

// Mock VoiceToolIndicator.
vi.mock("../VoiceToolIndicator", () => ({
  VoiceToolIndicator: () => null,
}));

// Mock VoicePTTButton.
vi.mock("../VoicePTTButton", () => ({
  VoicePTTButton: () => <div data-testid="ptt-button" />,
}));

// Mock DeepSightSpinner.
vi.mock("../../ui/DeepSightSpinner", () => ({
  DeepSightSpinner: () => <div data-testid="spinner" />,
}));

// Mock DoodleBackground.
vi.mock("../../DoodleBackground", () => ({
  default: () => <div data-testid="doodle" />,
}));

// Mock ThumbnailImage.
vi.mock("../utils/ThumbnailImage", () => ({
  ThumbnailImage: ({ fallback }: { fallback?: React.ReactNode }) => (
    <>{fallback ?? null}</>
  ),
}));

// Mock VoiceSettings (lazy).
vi.mock("../VoiceSettings", () => ({
  default: () => <div data-testid="voice-settings" />,
}));

import { VoiceModal } from "../VoiceModal";

// ─── Helpers ────────────────────────────────────────────────────────────────

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  videoTitle: "Test",
  voiceStatus: "idle" as const,
  isSpeaking: false,
  messages: [],
  elapsedSeconds: 0,
  remainingMinutes: 10,
  onStart: vi.fn(),
  onStop: vi.fn(),
  onMuteToggle: vi.fn(),
  isMuted: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("VoiceModal compact prop", () => {
  it("rend le dialog avec aria-modal=true par défaut (full screen)", () => {
    render(<VoiceModal {...baseProps} />);
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog).toBeDefined();
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
  });

  it("rend le dialog avec aria-modal=false en mode compact", () => {
    render(<VoiceModal {...baseProps} compact />);
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute("aria-modal")).toBe("false");
  });

  it("dialog en mode compact a une largeur fixée à 380px (w-[380px])", () => {
    render(<VoiceModal {...baseProps} compact />);
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog?.className).toMatch(/w-\[380px\]/);
    expect(dialog?.className).toMatch(/h-\[600px\]/);
  });

  it("dialog en mode full screen n'a PAS la largeur 380px", () => {
    render(<VoiceModal {...baseProps} />);
    const dialog = document.body.querySelector('[role="dialog"]');
    expect(dialog?.className).not.toMatch(/w-\[380px\]/);
  });

  it("ESC ferme la modal en mode full screen", () => {
    const onClose = vi.fn();
    render(<VoiceModal {...baseProps} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ESC ne ferme PAS la modal en mode compact", () => {
    const onClose = vi.fn();
    render(<VoiceModal {...baseProps} onClose={onClose} compact />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("le bouton X (close) reste fonctionnel en mode compact", () => {
    const onClose = vi.fn();
    render(<VoiceModal {...baseProps} onClose={onClose} compact />);
    // The close button uses aria-label "Fermer". Modal renders into a portal
    // attached to document.body, so query the document directly.
    const closeBtn = document.body.querySelector('[aria-label="Fermer"]');
    expect(closeBtn).not.toBeNull();
    fireEvent.click(closeBtn as Element);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
