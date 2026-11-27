// StudyToolsModal : plus d'appels aux routes inexistantes (/study/limits,
// /study/cost-preview, /additional-questions) ; coûts réels affichés ;
// génération via request() (renouvellement du jeton).

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const requestMock = vi.fn();

vi.mock("../../services/api", () => ({
  request: (...args: unknown[]) => requestMock(...args),
}));

vi.mock("../ui", () => ({
  DeepSightSpinner: () => <div data-testid="spinner" />,
}));

vi.mock("../StudyCard", () => ({
  StudyCard: () => <div data-testid="study-card" />,
}));

vi.mock("../ConceptMap", () => ({
  ConceptMap: () => <div data-testid="concept-map" />,
}));

import { StudyToolsModal } from "../StudyToolsModal";

describe("StudyToolsModal", () => {
  beforeEach(() => {
    requestMock.mockReset();
  });
  afterEach(() => cleanup());

  it("n'appelle aucune API à l'ouverture et affiche les coûts réels", () => {
    render(
      <StudyToolsModal
        isOpen
        onClose={() => {}}
        summaryId={42}
        videoTitle="Vidéo"
      />,
    );

    expect(requestMock).not.toHaveBeenCalled();
    expect(screen.getAllByText("1 crédit")).toHaveLength(2);
    expect(screen.getByText("2 crédits")).toBeInTheDocument();
    // Solde inconnu : pas de « Vos crédits: 0 » trompeur
    expect(screen.queryByText(/Vos crédits/)).toBeNull();
  });

  it("génère la fiche via request() sur la route existante", async () => {
    requestMock.mockResolvedValue({ study_card: { quiz: [] } });
    render(
      <StudyToolsModal
        isOpen
        onClose={() => {}}
        summaryId={42}
        videoTitle="Vidéo"
      />,
    );

    fireEvent.click(screen.getByText("Fiche de révision"));
    fireEvent.click(
      screen.getByRole("button", { name: /Générer \(1 crédit\)/ }),
    );

    expect(await screen.findByTestId("study-card")).toBeInTheDocument();
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock.mock.calls[0][0]).toBe("/api/videos/study/42/card");
    expect(requestMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
  });

  it("bloque la génération quand le solde connu est insuffisant", () => {
    render(
      <StudyToolsModal
        isOpen
        onClose={() => {}}
        summaryId={42}
        videoTitle="Vidéo"
        userCredits={1}
      />,
    );

    fireEvent.click(screen.getByText("Pack complet"));
    expect(
      screen.getByRole("button", { name: /Crédits insuffisants/ }),
    ).toBeDisabled();
  });
});
