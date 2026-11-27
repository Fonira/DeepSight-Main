/**
 * Tests — MainView : mode découverte (invité).
 */

import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { resetChromeMocks, localStore } from "../../setup/chrome-api-mock";
import { MainView } from "../../../src/sidepanel/views/MainView";

jest.mock("../../../src/i18n/useTranslation", () => ({
  useTranslation: () => ({
    t: jest.requireActual("../../../src/i18n/fr.json"),
    language: "fr",
    setLanguage: jest.fn(),
  }),
}));

const props = {
  user: null,
  planInfo: null,
  isGuest: true,
  onLogout: jest.fn(),
  onLoginRedirect: jest.fn(),
  onError: jest.fn(),
};

type Action = { action?: string };

function sentActions(): string[] {
  return (chrome.runtime.sendMessage as jest.Mock).mock.calls.map(
    ([msg]) => (msg as Action)?.action ?? "",
  );
}

async function clickAnalyze(): Promise<void> {
  await waitFor(() => {
    expect(screen.getByText("Test Video")).toBeInTheDocument();
  });
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: /Analyser cette vidéo/ }),
    );
  });
}

describe("MainView — guest mode", () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  it("runs the guest analysis and shows the ephemeral summary", async () => {
    (chrome.runtime.sendMessage as jest.Mock).mockImplementation(
      (msg: Action) =>
        Promise.resolve(
          msg?.action === "START_GUEST_ANALYSIS"
            ? {
                success: true,
                result: {
                  video_title: "Titre invité",
                  video_channel: "",
                  video_duration: 120,
                  thumbnail_url: "",
                  summary_content: "**Point clé** de la vidéo",
                  category: "education",
                  word_count: 100,
                  mode: "accessible",
                  lang: "fr",
                  remaining_analyses: 2,
                },
              }
            : {},
        ),
    );

    render(<MainView {...props} />);
    await clickAnalyze();

    await waitFor(() => {
      expect(screen.getByText("Titre invité")).toBeInTheDocument();
    });
    expect(screen.getByText("Point clé")).toBeInTheDocument();
    expect(sentActions()).toContain("START_GUEST_ANALYSIS");
    expect(sentActions()).not.toContain("START_ANALYSIS");
    expect(localStore.deepsight_free_analyses).toBe(1);
  });

  it("offers sign-up when the guest quota is exhausted", async () => {
    (chrome.runtime.sendMessage as jest.Mock).mockImplementation(
      (msg: Action) =>
        Promise.resolve(
          msg?.action === "START_GUEST_ANALYSIS"
            ? {
                success: false,
                error: "Vous avez utilisé vos 3 analyses gratuites.",
                errorCode: "guest_quota_exhausted",
                httpStatus: 429,
              }
            : {},
        ),
    );

    render(<MainView {...props} />);
    await clickAnalyze();

    await waitFor(() => {
      expect(
        screen.getByText(
          "Vous avez utilisé vos analyses gratuites. Créez un compte pour continuer.",
        ),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Se connecter", { selector: "button.v3-button-primary" })).toBeInTheDocument();
  });
});
