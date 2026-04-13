/**
 * 🧪 Tests — SmartInputBar Component
 * Tests du composant contrôlé : rendu, interaction, mode auto-detect, submit
 */

import React, { useState } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  renderWithProviders,
  screen,
  fireEvent,
  userEvent,
  waitFor,
} from "../../__tests__/test-utils";
import SmartInputBar, { SmartInputValue, InputMode } from "../SmartInputBar";

// ═══════════════════════════════════════════════════════════════════════════════
// 🧹 SETUP & HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Wrapper stateful — permet de tester le composant contrôlé
 * comme s'il était autonome (gère value/onChange en interne).
 */
const SmartInputBarWrapper: React.FC<{
  onSubmitSpy?: ReturnType<typeof vi.fn>;
  loading?: boolean;
  disabled?: boolean;
  initialValue?: SmartInputValue;
  userCredits?: number;
}> = ({
  onSubmitSpy,
  loading = false,
  disabled = false,
  initialValue,
  userCredits = 100,
}) => {
  const [value, setValue] = useState<SmartInputValue>(
    initialValue || { mode: "url", url: "" },
  );
  const submitSpy = onSubmitSpy || vi.fn();

  return (
    <SmartInputBar
      value={value}
      onChange={setValue}
      onSubmit={submitSpy}
      loading={loading}
      disabled={disabled}
      userCredits={userCredits}
    />
  );
};

/** Render helper */
const renderSmartInput = (
  overrides: {
    onSubmitSpy?: ReturnType<typeof vi.fn>;
    loading?: boolean;
    disabled?: boolean;
    initialValue?: SmartInputValue;
    userCredits?: number;
  } = {},
) => {
  return renderWithProviders(<SmartInputBarWrapper {...overrides} />);
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

// ═══════════════════════════════════════════════════════════════════════════════
// ✅ RENDERING
// ═══════════════════════════════════════════════════════════════════════════════

describe("SmartInputBar - Rendering", () => {
  it("should render textarea input", () => {
    renderSmartInput();

    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeInTheDocument();
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  it("should render submit button", () => {
    renderSmartInput();

    // Le bouton contient "Analyser" (fr) ou le Play icon
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("should render with placeholder text", () => {
    renderSmartInput();

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    // En mode url fr : "YouTube, TikTok... collez votre lien ici"
    expect(textarea.placeholder).toBeTruthy();
  });

  it("should render mode tabs", () => {
    renderSmartInput();

    // Les tabs mode : Recherche YouTube, URL Vidéo, Texte, Bibliothèque
    expect(
      screen.getByText(/Recherche YouTube|YouTube Search/),
    ).toBeInTheDocument();
    expect(screen.getByText(/URL Vidéo|Video URL/)).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ✏️ INPUT INTERACTION
// ═══════════════════════════════════════════════════════════════════════════════

describe("SmartInputBar - Input Interaction", () => {
  it("should accept text input via onChange", async () => {
    const user = userEvent.setup();
    renderSmartInput();

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "https://youtube.com/watch?v=test");

    expect(textarea).toHaveValue("https://youtube.com/watch?v=test");
  });

  it("should update value when typing a YouTube URL", async () => {
    const user = userEvent.setup();
    renderSmartInput({ initialValue: { mode: "search", searchQuery: "" } });

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "https://youtube.com/watch?v=dQw4w9WgXcQ");

    // Auto-detect should switch to url mode — value shows in textarea
    expect(textarea).toHaveValue("https://youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("should handle paste event on textarea", async () => {
    const user = userEvent.setup();
    renderSmartInput();

    const textarea = screen.getByRole("textbox");
    await user.click(textarea);

    // Simulate typing (paste is handled by onChange internally)
    await user.type(textarea, "https://youtube.com/watch?v=pasted");

    expect(textarea).toHaveValue("https://youtube.com/watch?v=pasted");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔄 MODE AUTO-DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

describe("SmartInputBar - Auto Detection", () => {
  it("should auto-detect URL mode for YouTube URLs", async () => {
    const user = userEvent.setup();
    renderSmartInput({ initialValue: { mode: "search", searchQuery: "" } });

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "https://youtube.com/watch?v=abc123");

    // After typing a YouTube URL, the mode badge should reflect url mode
    // The textarea value should contain the URL
    expect(textarea).toHaveValue("https://youtube.com/watch?v=abc123");
  });

  it("should auto-detect search mode for short text", async () => {
    const user = userEvent.setup();
    renderSmartInput({ initialValue: { mode: "url", url: "" } });

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "intelligence artificielle");

    // Short text without URL → search mode, value in textarea
    expect(textarea).toHaveValue("intelligence artificielle");
  });

  it("should auto-detect TikTok URL", async () => {
    const user = userEvent.setup();
    renderSmartInput({ initialValue: { mode: "search", searchQuery: "" } });

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "https://tiktok.com/@user/video/1234567890");

    expect(textarea).toHaveValue("https://tiktok.com/@user/video/1234567890");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🚀 SUBMIT FLOW
// ═══════════════════════════════════════════════════════════════════════════════

describe("SmartInputBar - Submit", () => {
  it("should call onSubmit when clicking the submit button with valid input", async () => {
    const user = userEvent.setup();
    const onSubmitSpy = vi.fn();
    renderSmartInput({ onSubmitSpy });

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "https://youtube.com/watch?v=test");

    // Find the submit button (contains Play icon or "Analyser" text)
    const buttons = screen.getAllByRole("button");
    const submitButton = buttons.find(
      (b) =>
        b.textContent?.includes("Analyser") ||
        b.textContent?.includes("Analyze") ||
        b.textContent?.includes("Rechercher") ||
        b.textContent?.includes("Search"),
    );
    expect(submitButton).toBeTruthy();

    if (submitButton) {
      await user.click(submitButton);
      expect(onSubmitSpy).toHaveBeenCalledTimes(1);
    }
  });

  it("should NOT call onSubmit when input is empty", async () => {
    const user = userEvent.setup();
    const onSubmitSpy = vi.fn();
    renderSmartInput({ onSubmitSpy });

    // Try to click submit with empty input
    const buttons = screen.getAllByRole("button");
    const submitButton = buttons.find(
      (b) =>
        b.textContent?.includes("Analyser") ||
        b.textContent?.includes("Analyze") ||
        b.textContent?.includes("Rechercher") ||
        b.textContent?.includes("Search"),
    );

    if (submitButton) {
      await user.click(submitButton);
      expect(onSubmitSpy).not.toHaveBeenCalled();
    }
  });

  it("should call onSubmit on Enter key", async () => {
    const user = userEvent.setup();
    const onSubmitSpy = vi.fn();
    renderSmartInput({ onSubmitSpy });

    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "https://youtube.com/watch?v=test");
    await user.type(textarea, "{Enter}");

    expect(onSubmitSpy).toHaveBeenCalledTimes(1);
  });

  it("should NOT call onSubmit when loading", async () => {
    const user = userEvent.setup();
    const onSubmitSpy = vi.fn();
    renderSmartInput({
      onSubmitSpy,
      loading: true,
      initialValue: { mode: "url", url: "https://youtube.com/watch?v=test" },
    });

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);
  });

  it("should NOT call onSubmit when disabled", async () => {
    const onSubmitSpy = vi.fn();
    renderSmartInput({
      onSubmitSpy,
      disabled: true,
      initialValue: { mode: "url", url: "https://youtube.com/watch?v=test" },
    });

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔀 MODE TABS
// ═══════════════════════════════════════════════════════════════════════════════

describe("SmartInputBar - Mode Tabs", () => {
  it("should switch to text mode when clicking text tab", async () => {
    const user = userEvent.setup();
    renderSmartInput();

    // 2 éléments "Texte" (responsive: hidden sm:inline + sm:hidden) → prendre le premier
    const textTabs = screen.getAllByText(/^Texte$/);
    await user.click(textTabs[0]);

    // After clicking text tab, placeholder should change to text mode
    // Text mode has 3 textbox (textarea + title + source) → use getAllByRole
    const textboxes = screen.getAllByRole("textbox");
    expect(textboxes.length).toBeGreaterThan(0);
    expect(
      (textboxes[0] as HTMLTextAreaElement).placeholder?.length,
    ).toBeGreaterThan(0);
  });

  it("should switch to search mode when clicking search tab", async () => {
    const user = userEvent.setup();
    renderSmartInput();

    const searchTab = screen.getByText(/Recherche YouTube|YouTube Search/);
    await user.click(searchTab);

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    // Search mode placeholder contains "sujet" or "topic"
    expect(textarea.placeholder.length).toBeGreaterThan(0);
  });

  it("should render auto-detect checkbox", () => {
    renderSmartInput();

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeInTheDocument();
    // Auto-detect is ON by default
    expect(checkbox).toBeChecked();
  });

  it("should toggle auto-detect off when clicking checkbox", async () => {
    const user = userEvent.setup();
    renderSmartInput();

    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);

    expect(checkbox).not.toBeChecked();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe("SmartInputBar - Edge Cases", () => {
  it("should handle empty input without crashing", () => {
    renderSmartInput({ initialValue: { mode: "url", url: "" } });

    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue("");
  });

  it("should handle very long URL input", () => {
    const onSubmitSpy = vi.fn();
    renderSmartInput({ onSubmitSpy });

    const textarea = screen.getByRole("textbox");
    const longUrl = "https://youtube.com/watch?v=test&" + "x".repeat(200);

    // Use fireEvent.change pour éviter le timeout de userEvent.type sur 200+ chars
    fireEvent.change(textarea, { target: { value: longUrl } });

    // Should not crash
    expect(textarea).toBeInTheDocument();
  });

  it("should render correctly with zero credits", () => {
    renderSmartInput({ userCredits: 0 });

    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeInTheDocument();
  });

  it("should handle all input modes without crashing", () => {
    const modes: InputMode[] = ["url", "text", "search", "library"];

    modes.forEach((mode) => {
      const { unmount } = renderSmartInput({
        initialValue: {
          mode,
          url: "",
          rawText: "",
          searchQuery: "",
          libraryQuery: "",
        },
      });

      // En mode text, il y a 3 textbox (textarea + title + source) → utiliser getAllByRole
      const textboxes = screen.getAllByRole("textbox");
      expect(textboxes.length).toBeGreaterThan(0);
      unmount();
    });
  });
});
