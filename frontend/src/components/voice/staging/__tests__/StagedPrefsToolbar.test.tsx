import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StagedPrefsToolbar } from "../StagedPrefsToolbar";
import { VoicePrefsStagingProvider } from "../VoicePrefsStagingProvider";
import type { VoicePrefsStagingContextValue } from "../VoicePrefsStagingProvider";
import * as ProviderModule from "../VoicePrefsStagingProvider";

function renderWithStaging(
  override: Partial<VoicePrefsStagingContextValue>,
) {
  const value: VoicePrefsStagingContextValue = {
    applied: null,
    catalog: null,
    staged: {},
    hasChanges: false,
    hasRestartRequired: false,
    callActive: false,
    applying: false,
    applyError: null,
    stage: vi.fn(),
    cancel: vi.fn(),
    apply: vi.fn(),
    ...override,
  };
  vi.spyOn(ProviderModule, "useVoicePrefsStaging").mockReturnValue(value);
  return { value, ...render(<StagedPrefsToolbar />) };
}

describe("StagedPrefsToolbar", () => {
  it("renders nothing when hasChanges is false", () => {
    renderWithStaging({ hasChanges: false });
    expect(screen.queryByTestId("staged-prefs-toolbar")).toBeNull();
  });

  it("shows count and Apply / Cancel when hasChanges", () => {
    renderWithStaging({
      hasChanges: true,
      staged: { voice_id: "v2", language: "en" },
    });
    const bar = screen.getByTestId("staged-prefs-toolbar");
    expect(bar).toBeTruthy();
    expect(screen.getByTestId("staged-count").textContent).toContain("2");
    expect(screen.getByTestId("staged-apply")).toBeTruthy();
    expect(screen.getByTestId("staged-cancel")).toBeTruthy();
  });

  it("uses 'Appliquer & redémarrer' label when callActive and restart required", () => {
    renderWithStaging({
      hasChanges: true,
      hasRestartRequired: true,
      callActive: true,
      staged: { voice_id: "v2" },
    });
    expect(screen.getByTestId("staged-apply").textContent).toMatch(
      /redémarrer/i,
    );
  });

  it("uses 'Appliquer' label otherwise", () => {
    renderWithStaging({
      hasChanges: true,
      hasRestartRequired: false,
      callActive: false,
      staged: { ptt_key: "Shift" },
    });
    expect(screen.getByTestId("staged-apply").textContent).toMatch(/appliquer/i);
    expect(screen.getByTestId("staged-apply").textContent).not.toMatch(
      /redémarrer/i,
    );
  });

  it("clicking Apply calls apply()", () => {
    const apply = vi.fn();
    renderWithStaging({ hasChanges: true, staged: { voice_id: "v2" }, apply });
    fireEvent.click(screen.getByTestId("staged-apply"));
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("clicking Cancel calls cancel()", () => {
    const cancel = vi.fn();
    renderWithStaging({
      hasChanges: true,
      staged: { voice_id: "v2" },
      cancel,
    });
    fireEvent.click(screen.getByTestId("staged-cancel"));
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons while applying", () => {
    renderWithStaging({
      hasChanges: true,
      staged: { voice_id: "v2" },
      applying: true,
    });
    expect(
      (screen.getByTestId("staged-apply") as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByTestId("staged-cancel") as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("shows applyError when set", () => {
    renderWithStaging({
      hasChanges: true,
      staged: { voice_id: "v2" },
      applyError: "Erreur réseau",
    });
    expect(screen.getByTestId("staged-error").textContent).toContain(
      "Erreur réseau",
    );
  });

  it("count container has aria-live=polite", () => {
    renderWithStaging({
      hasChanges: true,
      staged: { voice_id: "v2" },
    });
    expect(screen.getByTestId("staged-count").getAttribute("aria-live")).toBe(
      "polite",
    );
  });
});
