import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { resetChromeMocks } from "../../setup/chrome-api-mock";
import { HomeView } from "../../../src/sidepanel/views/HomeView";

const mockUser = { plan: "pro" as const, creditsLeft: 30 };
const mockRecents = [
  {
    id: "1",
    videoId: "v1",
    title: "Vid",
    thumbnail: "",
    createdAt: "2026-04-26T10:00:00Z",
  },
];

describe("HomeView", () => {
  it("renders QG mode (UrlInputCard) when no video detected", () => {
    render(
      <HomeView
        user={mockUser}
        recents={mockRecents}
        currentTab={{ url: "https://example.com", platform: null, tabId: 1 }}
        onAnalyze={() => {}}
        onSelectRecent={() => {}}
        onUpgrade={() => {}}
      />,
    );
    expect(screen.getByPlaceholderText(/url youtube/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /analyser cette vidéo/i }),
    ).toBeNull();
  });

  it("renders Video mode (VideoDetectedCard) when on YouTube", () => {
    render(
      <HomeView
        user={mockUser}
        recents={mockRecents}
        currentTab={{
          url: "https://www.youtube.com/watch?v=abc",
          platform: "youtube",
          tabId: 1,
        }}
        videoMeta={{ title: "Test Vid", thumbnail: "thumb.jpg" }}
        onAnalyze={() => {}}
        onSelectRecent={() => {}}
        onUpgrade={() => {}}
      />,
    );
    expect(screen.getByText("Test Vid")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /analyser cette vidéo/i }),
    ).toBeInTheDocument();
  });

  it("falls back to UrlInputCard when on YT but videoMeta is missing", () => {
    render(
      <HomeView
        user={mockUser}
        recents={mockRecents}
        currentTab={{
          url: "https://www.youtube.com/watch?v=abc",
          platform: "youtube",
          tabId: 1,
        }}
        onAnalyze={() => {}}
        onSelectRecent={() => {}}
        onUpgrade={() => {}}
      />,
    );
    expect(screen.getByPlaceholderText(/url youtube/i)).toBeInTheDocument();
  });

  it("displays the user plan badge", () => {
    render(
      <HomeView
        user={{ plan: "pro", creditsLeft: 42 }}
        recents={mockRecents}
        currentTab={{ url: null, platform: null, tabId: null }}
        onAnalyze={() => {}}
        onSelectRecent={() => {}}
        onUpgrade={() => {}}
      />,
    );
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText(/42 crédits/i)).toBeInTheDocument();
  });

  it("renders the recents list", () => {
    render(
      <HomeView
        user={mockUser}
        recents={mockRecents}
        currentTab={{ url: null, platform: null, tabId: null }}
        onAnalyze={() => {}}
        onSelectRecent={() => {}}
        onUpgrade={() => {}}
      />,
    );
    expect(screen.getByText("Vid")).toBeInTheDocument();
  });
});

describe("HomeView — QuickSearch integration", () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  it("renders the QuickSearch input above the Recents label", () => {
    render(
      <HomeView
        user={mockUser}
        recents={mockRecents}
        currentTab={{ url: null, platform: null, tabId: null }}
        onAnalyze={() => {}}
        onSelectRecent={() => {}}
        onUpgrade={() => {}}
      />,
    );
    const searchInput = screen.getByPlaceholderText(/rechercher mes analyses/i);
    const recentsLabel = screen.getByText(/^récent$/i);
    // QuickSearch DOIT apparaître AVANT le label "Récent" dans le DOM.
    expect(
      searchInput.compareDocumentPosition(recentsLabel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("opens summary URL in a new tab when a result is clicked", async () => {
    const sendMessage = chrome.runtime.sendMessage as jest.Mock;
    sendMessage.mockResolvedValue({
      success: true,
      searchResults: {
        query: "test",
        total_results: 1,
        results: [
          {
            source_type: "summary",
            source_id: 99,
            summary_id: 99,
            score: 0.95,
            text_preview: "Mock preview",
            source_metadata: { summary_title: "Mock Title" },
          },
        ],
        searched_at: "",
      },
    });
    const tabsCreate = chrome.tabs.create as jest.Mock;

    render(
      <HomeView
        user={mockUser}
        recents={mockRecents}
        currentTab={{ url: null, platform: null, tabId: null }}
        onAnalyze={() => {}}
        onSelectRecent={() => {}}
        onUpgrade={() => {}}
      />,
    );

    const input = screen.getByPlaceholderText(/rechercher mes analyses/i);
    fireEvent.change(input, { target: { value: "test" } });

    await waitFor(
      () => {
        expect(screen.getByText("Mock Title")).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    fireEvent.click(screen.getByText("Mock Title"));
    expect(tabsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining("/summary/99") }),
    );
  });
});
