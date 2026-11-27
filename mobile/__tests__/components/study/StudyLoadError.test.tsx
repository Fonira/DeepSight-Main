/**
 * StudyLoadError — l'erreur de génération est affichée avec un bouton Réessayer.
 */
import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

jest.mock("../../../src/contexts/ThemeContext", () => ({
  useTheme: () => ({
    colors: { textMuted: "#888", textSecondary: "#ccc", accentPrimary: "#C8903A" },
  }),
}));

import { StudyLoadError } from "../../../src/components/study/StudyLoadError";

describe("StudyLoadError", () => {
  it("affiche le message et relance au tap sur Réessayer", () => {
    const onRetry = jest.fn();
    const screen = render(
      <StudyLoadError
        message="Crédits insuffisants pour générer ce contenu."
        retryLabel="Réessayer"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText("Crédits insuffisants pour générer ce contenu.")).toBeTruthy();
    fireEvent.press(screen.getByTestId("study-load-error-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
