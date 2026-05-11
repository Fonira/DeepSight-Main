// frontend/src/components/Tutor/__tests__/DraggableTutorWindow.test.tsx
//
// Tests d'intégration pour les resize handles (Phase 2 V2 — mai 2026).
// Les helpers (cornerToPosition / nearestCorner / readSavedCorner / saveCorner /
// clampSize / readSavedSize / saveSize) ont leurs tests unitaires dans
// `DraggableTutorWindow.test.ts`. Ce fichier vérifie le rendu + la
// présence/absence des 8 resize handles selon la prop `resizable`.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DraggableTutorWindow } from "../DraggableTutorWindow";
import {
  TUTOR_MAX_SIZE,
  TUTOR_MIN_SIZE,
} from "../tutorConstants";
import { clampSize, readSavedSize, saveSize } from "../snapHelpers";

const SIZE = { width: 320, height: 480 };

describe("DraggableTutorWindow — resize handles", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders without resize handles by default (resizable=false)", () => {
    render(
      <DraggableTutorWindow size={SIZE} ariaLabel="tutor">
        <div>content</div>
      </DraggableTutorWindow>,
    );
    expect(screen.getByText("content")).toBeInTheDocument();
    // None of the 8 handles should be present.
    [
      "resize-n",
      "resize-s",
      "resize-e",
      "resize-w",
      "resize-nw",
      "resize-ne",
      "resize-sw",
      "resize-se",
    ].forEach((id) => {
      expect(screen.queryByTestId(id)).toBeNull();
    });
  });

  it("renders all 8 resize handles when resizable=true", () => {
    render(
      <DraggableTutorWindow
        size={SIZE}
        ariaLabel="tutor"
        resizable
        onResize={vi.fn()}
      >
        <div>content</div>
      </DraggableTutorWindow>,
    );
    [
      "resize-n",
      "resize-s",
      "resize-e",
      "resize-w",
      "resize-nw",
      "resize-ne",
      "resize-sw",
      "resize-se",
    ].forEach((id) => {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    });
  });

  it("handles have appropriate cursors (edges vs corners)", () => {
    render(
      <DraggableTutorWindow size={SIZE} resizable onResize={vi.fn()}>
        <div>content</div>
      </DraggableTutorWindow>,
    );
    expect((screen.getByTestId("resize-n") as HTMLElement).style.cursor).toBe(
      "ns-resize",
    );
    expect((screen.getByTestId("resize-s") as HTMLElement).style.cursor).toBe(
      "ns-resize",
    );
    expect((screen.getByTestId("resize-e") as HTMLElement).style.cursor).toBe(
      "ew-resize",
    );
    expect((screen.getByTestId("resize-w") as HTMLElement).style.cursor).toBe(
      "ew-resize",
    );
    expect((screen.getByTestId("resize-nw") as HTMLElement).style.cursor).toBe(
      "nwse-resize",
    );
    expect((screen.getByTestId("resize-se") as HTMLElement).style.cursor).toBe(
      "nwse-resize",
    );
    expect((screen.getByTestId("resize-ne") as HTMLElement).style.cursor).toBe(
      "nesw-resize",
    );
    expect((screen.getByTestId("resize-sw") as HTMLElement).style.cursor).toBe(
      "nesw-resize",
    );
  });
});

describe("snapHelpers — size persistence + clamp", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("clampSize honors TUTOR_MIN_SIZE", () => {
    const clamped = clampSize({ width: 100, height: 50 });
    expect(clamped.width).toBe(TUTOR_MIN_SIZE.width);
    expect(clamped.height).toBe(TUTOR_MIN_SIZE.height);
  });

  it("clampSize honors TUTOR_MAX_SIZE", () => {
    const clamped = clampSize({ width: 9999, height: 9999 });
    expect(clamped.width).toBe(TUTOR_MAX_SIZE.width);
    expect(clamped.height).toBe(TUTOR_MAX_SIZE.height);
  });

  it("clampSize rounds to integers", () => {
    const clamped = clampSize({ width: 300.7, height: 400.2 });
    expect(clamped.width).toBe(301);
    expect(clamped.height).toBe(400);
  });

  it("readSavedSize returns clamped fallback when nothing is saved", () => {
    const s = readSavedSize({ width: 280, height: 400 });
    expect(s).toEqual({ width: 280, height: 400 });
  });

  it("saveSize + readSavedSize round-trip", () => {
    saveSize({ width: 350, height: 500 });
    const s = readSavedSize({ width: 280, height: 400 });
    expect(s).toEqual({ width: 350, height: 500 });
  });

  it("readSavedSize falls back when stored value is invalid JSON", () => {
    localStorage.setItem("ds-tutor-size", "garbage");
    const s = readSavedSize({ width: 280, height: 400 });
    expect(s).toEqual({ width: 280, height: 400 });
  });

  it("readSavedSize clamps stored values outside limits", () => {
    saveSize({ width: 99999, height: 50 });
    const s = readSavedSize({ width: 280, height: 400 });
    expect(s.width).toBe(TUTOR_MAX_SIZE.width);
    expect(s.height).toBe(TUTOR_MIN_SIZE.height);
  });
});
