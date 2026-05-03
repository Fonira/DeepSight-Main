// mobile/src/components/tutor/__tests__/TutorBottomSheet.test.tsx
//
// Tests intégration : ouverture/fermeture, auto-startSession, props requises.

import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import { TutorBottomSheet } from "../TutorBottomSheet";
import { tutorApi } from "../../../services/api";
import { ThemeProvider } from "@/contexts/ThemeContext";

jest.mock("../../../services/api", () => ({
  tutorApi: {
    sessionStart: jest.fn(),
    sessionTurn: jest.fn(),
    sessionEnd: jest.fn(),
  },
}));

const mockedSessionStart = tutorApi.sessionStart as jest.MockedFunction<
  typeof tutorApi.sessionStart
>;

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider>{ui}</ThemeProvider>);

describe("TutorBottomSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retourne null si conceptTerm absent", () => {
    const { queryByTestId } = renderWithTheme(
      <TutorBottomSheet
        isOpen
        onClose={jest.fn()}
        conceptTerm={null}
        conceptDef="def"
      />,
    );
    expect(queryByTestId("tutor-bottom-sheet")).toBeNull();
    expect(mockedSessionStart).not.toHaveBeenCalled();
  });

  it("ne démarre pas la session quand isOpen=false", () => {
    renderWithTheme(
      <TutorBottomSheet
        isOpen={false}
        onClose={jest.fn()}
        conceptTerm="Rasoir d'Occam"
        conceptDef="parcimonie"
      />,
    );
    expect(mockedSessionStart).not.toHaveBeenCalled();
  });

  it("démarre la session avec mode=text quand isOpen passe à true", async () => {
    mockedSessionStart.mockResolvedValueOnce({
      session_id: "sess_open",
      first_prompt: "Premier prompt",
      audio_url: null,
    });

    const { rerender } = renderWithTheme(
      <TutorBottomSheet
        isOpen={false}
        onClose={jest.fn()}
        conceptTerm="Rasoir d'Occam"
        conceptDef="parcimonie"
        summaryId={123}
        sourceVideoTitle="Philosophie"
      />,
    );

    rerender(
      <ThemeProvider>
        <TutorBottomSheet
          isOpen
          onClose={jest.fn()}
          conceptTerm="Rasoir d'Occam"
          conceptDef="parcimonie"
          summaryId={123}
          sourceVideoTitle="Philosophie"
        />
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(mockedSessionStart).toHaveBeenCalledTimes(1);
    });

    expect(mockedSessionStart).toHaveBeenCalledWith({
      concept_term: "Rasoir d'Occam",
      concept_def: "parcimonie",
      summary_id: 123,
      source_video_title: "Philosophie",
      mode: "text",
      lang: "fr",
    });
  });

  it("ne démarre pas la session 2 fois si re-renderisé open", async () => {
    mockedSessionStart.mockResolvedValueOnce({
      session_id: "sess_once",
      first_prompt: "p",
      audio_url: null,
    });

    const { rerender } = renderWithTheme(
      <TutorBottomSheet
        isOpen
        onClose={jest.fn()}
        conceptTerm="C"
        conceptDef="D"
      />,
    );

    await waitFor(() => expect(mockedSessionStart).toHaveBeenCalledTimes(1));

    rerender(
      <ThemeProvider>
        <TutorBottomSheet
          isOpen
          onClose={jest.fn()}
          conceptTerm="C"
          conceptDef="D"
        />
      </ThemeProvider>,
    );

    // Toujours 1 seul appel (startedRef garde la mémoire)
    expect(mockedSessionStart).toHaveBeenCalledTimes(1);
  });
});
