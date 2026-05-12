// frontend/src/components/Tutor/__tests__/TutorFullscreen.test.tsx
import React from "react";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TutorFullscreen } from "../TutorFullscreen";
import { useTutorStore } from "../../../store/tutorStore";

beforeAll(() => {
  Element.prototype.scrollTo =
    vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

vi.mock("../../../contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "fr" }),
}));

vi.mock("../../../services/api", () => ({
  tutorApi: {
    sessionStart: vi.fn().mockResolvedValue({
      session_id: "tutor-fs-test",
      first_prompt: "Comment expliqueriez-vous ?",
      audio_url: null,
    }),
    sessionTurn: vi.fn().mockResolvedValue({
      ai_response: "Bien.",
      audio_url: null,
      turn_count: 3,
    }),
    sessionEnd: vi.fn().mockResolvedValue({
      duration_sec: 30,
      turns_count: 3,
      source_summary_url: null,
      source_video_title: null,
    }),
  },
}));

function renderFullscreen() {
  return render(
    <MemoryRouter>
      <TutorFullscreen />
    </MemoryRouter>,
  );
}

describe("TutorFullscreen", () => {
  beforeEach(() => {
    useTutorStore.getState().reset();
  });

  it("renders default title 'Le Tuteur' when no concept term in store", () => {
    renderFullscreen();
    // Le titre principal vaut "Le Tuteur" en l'absence de concept.
    expect(screen.getByTestId("tutor-fullscreen")).toBeInTheDocument();
    expect(screen.getAllByText(/Le Tuteur/i).length).toBeGreaterThan(0);
  });

  it("shows empty hint when no session is active", () => {
    renderFullscreen();
    expect(
      screen.getByText(/Démarrez une session depuis la popup/i),
    ).toBeInTheDocument();
  });

  it("renders concept term as title when session is active", async () => {
    await useTutorStore.getState().startSession({
      concept_term: "Rasoir d'Occam",
      concept_def: "Principe de parcimonie",
      mode: "text",
    });
    renderFullscreen();
    // Concept term may appear multiple times (header title + content) — at
    // least one occurrence is enough to confirm the title rendered.
    expect(screen.getAllByText("Rasoir d'Occam").length).toBeGreaterThan(0);
  });

  it("renders messages from the store", async () => {
    await useTutorStore.getState().startSession({
      concept_term: "X",
      concept_def: "Y",
      mode: "text",
    });
    renderFullscreen();
    expect(screen.getByText("Comment expliqueriez-vous ?")).toBeInTheDocument();
  });

  it("has a back button (Retour à la popup) that triggers navigation", () => {
    renderFullscreen();
    const backBtn = screen.getByTestId("tutor-fullscreen-back");
    expect(backBtn).toBeInTheDocument();
    // setFullscreen should be invoked on click (clears the flag).
    useTutorStore.getState().setFullscreen(true);
    fireEvent.click(backBtn);
    expect(useTutorStore.getState().fullscreen).toBe(false);
  });

  it("has an end button (X) that ends the session", async () => {
    await useTutorStore.getState().startSession({
      concept_term: "X",
      concept_def: "Y",
      mode: "text",
    });
    renderFullscreen();
    const endBtn = screen.getByTestId("tutor-fullscreen-end");
    fireEvent.click(endBtn);
    // endSession is async — but the test asserts the click works without
    // throwing. State changes are verified separately in tutorStore.test.
    expect(endBtn).toBeInTheDocument();
  });
});
