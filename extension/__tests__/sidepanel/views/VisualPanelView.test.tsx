/**
 * Tests — VisualPanelView : chargement de l'analyse visuelle.
 *
 * Bugs couverts :
 *  - fetch direct vers GET /api/videos/{videoId}, route inexistante (404
 *    systématique → jamais d'analyse visuelle affichée) ;
 *  - ce fetch court-circuitait le refresh JWT : un access token expiré
 *    (60 min) déconnectait l'utilisateur.
 */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { resetChromeMocks, seedLocalStorage } from "../../setup/chrome-api-mock";
import { VisualPanelView } from "../../../src/sidepanel/views/VisualPanelView";

const visual = {
  visual_hook: "Plan serré sur le visage",
  visual_structure: "Interview",
  key_moments: [],
  visible_text: "",
  visual_seo_indicators: {},
  summary_visual: "Résumé visuel de test",
};

function mockSummary(response: unknown): void {
  (chrome.runtime.sendMessage as jest.Mock).mockImplementation(
    (msg: { action?: string }) =>
      Promise.resolve(msg?.action === "GET_SUMMARY" ? response : {}),
  );
}

describe("VisualPanelView", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    resetChromeMocks();
    global.fetch = jest.fn() as unknown as typeof global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("loads the analysis through the service worker using the local history", async () => {
    seedLocalStorage({
      recentAnalyses: [
        { videoId: "abc123def45", summaryId: 42, title: "Vidéo", timestamp: 1 },
      ],
    });
    mockSummary({
      success: true,
      summary: { id: 42, video_title: "Vidéo", visual_analysis: visual },
    });

    render(
      <VisualPanelView
        context={{ videoId: "abc123def45" }}
        onClose={jest.fn()}
        onSessionExpired={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("visual-panel-sections")).toBeInTheDocument();
    });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: "GET_SUMMARY",
      data: { summaryId: 42 },
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("shows the empty state when the video was never analysed here", async () => {
    mockSummary({ success: true, summary: {} });
    render(
      <VisualPanelView context={{ videoId: "zzz" }} onClose={jest.fn()} />,
    );
    await waitFor(() => {
      expect(screen.getByTestId("visual-panel-empty")).toBeInTheDocument();
    });
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: "GET_SUMMARY" }),
    );
  });

  it("only signs out when the service worker reports an expired session", async () => {
    seedLocalStorage({
      recentAnalyses: [
        { videoId: "abc123def45", summaryId: 42, title: "Vidéo", timestamp: 1 },
      ],
    });
    mockSummary({
      success: false,
      error: "SESSION_EXPIRED",
      errorCode: "session_expired",
      httpStatus: 401,
    });
    const onSessionExpired = jest.fn();

    render(
      <VisualPanelView
        context={{ videoId: "abc123def45" }}
        onClose={jest.fn()}
        onSessionExpired={onSessionExpired}
      />,
    );

    await waitFor(() => expect(onSessionExpired).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("visual-panel-error")).toBeInTheDocument();
  });
});
