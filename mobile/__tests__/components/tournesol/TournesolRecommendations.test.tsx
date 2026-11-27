/**
 * TournesolRecommendations — un tap sur une vidéo lance l'analyse de son URL et ouvre
 * l'écran de suivi avec le task_id. Régression : navigation vers /analysis/yt:<id>,
 * refusé par le backend (422) → « Impossible de charger l'analyse ».
 */
import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

const mockPush = jest.fn();
const mockAnalyze = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../../../src/services/api", () => ({
  videoApi: { analyze: (...args: unknown[]) => mockAnalyze(...args) },
}));

jest.mock("../../../src/contexts/ThemeContext", () => ({
  useTheme: () => ({
    colors: {
      bgElevated: "#111",
      border: "#222",
      textPrimary: "#fff",
      textTertiary: "#aaa",
      textMuted: "#888",
    },
  }),
}));

jest.mock("../../../src/services/OfflineCache", () => ({
  OfflineCache: { get: jest.fn().mockResolvedValue(null), set: jest.fn() },
  CachePriority: { LOW: "low", HIGH: "high" },
}));

jest.mock("../../../src/hooks/useNetworkStatus", () => ({
  useIsOffline: () => false,
}));

jest.mock("@shopify/flash-list", () => {
  const { View } = jest.requireActual("react-native");
  return {
    FlashList: ({
      data,
      renderItem,
    }: {
      data: unknown[];
      renderItem: (info: { item: unknown; index: number }) => React.ReactNode;
    }) => <View>{data.map((item, index) => renderItem({ item, index }))}</View>,
  };
});

jest.mock("react-native-reanimated", () => {
  const { View } = jest.requireActual("react-native");
  const chain = { delay: () => chain, duration: () => chain };
  return { __esModule: true, default: { View }, FadeInDown: chain };
});

import { TournesolRecommendations } from "../../../src/components/tournesol/TournesolRecommendations";

const recommendations = {
  results: [
    {
      entity: {
        uid: "yt:VID123",
        metadata: { name: "Une vidéo de qualité", video_id: "VID123", uploader: "Chaîne" },
      },
      collective_rating: {
        tournesol_score: 42,
        n_comparisons: 10,
        n_contributors: 5,
        criteria_scores: [],
      },
    },
  ],
};

describe("TournesolRecommendations", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockAnalyze.mockReset();
    (global as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => recommendations,
    });
  });

  it("lance l'analyse de l'URL YouTube et ouvre le suivi avec le task_id", async () => {
    mockAnalyze.mockResolvedValue({ task_id: "task-42" });
    const screen = render(<TournesolRecommendations language="fr" />);

    const card = await screen.findByLabelText("Analyser: Une vidéo de qualité");
    fireEvent.press(card);

    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    expect(mockAnalyze).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://www.youtube.com/watch?v=VID123",
        category: "auto",
      }),
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(tabs)/analysis/[id]",
      params: { id: "task-42" },
    });
    const pushedId = (mockPush.mock.calls[0][0] as { params: { id: string } }).params.id;
    expect(pushedId.startsWith("yt:")).toBe(false);
  });

  it("affiche une alerte lisible si l'analyse ne démarre pas", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    mockAnalyze.mockRejectedValue(new Error("Crédits insuffisants."));
    const screen = render(<TournesolRecommendations language="fr" />);

    fireEvent.press(await screen.findByLabelText("Analyser: Une vidéo de qualité"));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith("Analyse impossible", "Crédits insuffisants."),
    );
    expect(mockPush).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
