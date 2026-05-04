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

// Helper : mock sendMessage avec une réponse différenciée selon l'action.
function mockSendMessage(handlers: {
  recentQueries?: string[];
  searchResults?: unknown;
}) {
  const sendMessage = chrome.runtime.sendMessage as jest.Mock;
  sendMessage.mockImplementation((msg: { action: string }) => {
    if (msg?.action === "GET_RECENT_QUERIES") {
      return Promise.resolve({
        success: true,
        recentQueries: handlers.recentQueries ?? [],
      });
    }
    if (msg?.action === "SEARCH_GLOBAL") {
      return Promise.resolve(handlers.searchResults ?? { success: true });
    }
    return Promise.resolve({});
  });
  return sendMessage;
}

describe("HomeView", () => {
  beforeEach(() => {
    resetChromeMocks();
    mockSendMessage({});
  });

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

  it("renders the QuickSearch input above the Recents label", async () => {
    mockSendMessage({});
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
    const searchInput = await screen.findByPlaceholderText(
      /rechercher mes analyses/i,
    );
    const recentsLabel = screen.getByText(/^récent$/i);
    // QuickSearch DOIT apparaître AVANT le label "Récent" dans le DOM.
    expect(
      searchInput.compareDocumentPosition(recentsLabel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("opens summary URL in a new tab when result video_id does NOT match current tab", async () => {
    mockSendMessage({
      searchResults: {
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
              source_metadata: {
                summary_title: "Mock Title",
                video_id: "DIFFERENT_VID",
              },
            },
          ],
          searched_at: "",
        },
      },
    });
    // Active tab is on a YouTube video with a different ID → no jump.
    (chrome.tabs.query as jest.Mock).mockResolvedValue([
      {
        id: 42,
        url: "https://www.youtube.com/watch?v=other_video",
      },
    ]);
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

    const input = await screen.findByPlaceholderText(
      /rechercher mes analyses/i,
    );
    fireEvent.change(input, { target: { value: "test" } });

    await waitFor(
      () => {
        expect(screen.getByText("Mock Title")).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    fireEvent.click(screen.getByText("Mock Title"));
    await waitFor(() => {
      expect(tabsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining("/summary/99"),
        }),
      );
    });
  });

  it("dispatches JUMP_TO_TIMESTAMP when result video_id matches current tab", async () => {
    mockSendMessage({
      searchResults: {
        success: true,
        searchResults: {
          query: "test",
          total_results: 1,
          results: [
            {
              source_type: "transcript",
              source_id: 12,
              summary_id: 99,
              score: 0.95,
              text_preview: "Mock preview",
              source_metadata: {
                summary_title: "Same Video Title",
                video_id: "matching_video",
                start_ts: 42.5,
              },
            },
          ],
          searched_at: "",
        },
      },
    });
    (chrome.tabs.query as jest.Mock).mockResolvedValue([
      {
        id: 7,
        url: "https://www.youtube.com/watch?v=matching_video",
      },
    ]);
    const tabsCreate = chrome.tabs.create as jest.Mock;
    const tabsSendMessage = chrome.tabs.sendMessage as jest.Mock;

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

    const input = await screen.findByPlaceholderText(
      /rechercher mes analyses/i,
    );
    fireEvent.change(input, { target: { value: "test" } });

    await waitFor(
      () => {
        expect(screen.getByText("Same Video Title")).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    fireEvent.click(screen.getByText("Same Video Title"));

    await waitFor(() => {
      expect(tabsSendMessage).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          action: "JUMP_TO_TIMESTAMP",
          ts: 42.5,
        }),
      );
    });
    // Pas de fallback ouverture web tier puisqu'on a matched.
    expect(tabsCreate).not.toHaveBeenCalled();
  });

  it("falls back to web /summary when video_id matches but tabs.sendMessage throws", async () => {
    mockSendMessage({
      searchResults: {
        success: true,
        searchResults: {
          query: "test",
          total_results: 1,
          results: [
            {
              source_type: "transcript",
              source_id: 13,
              summary_id: 100,
              score: 0.9,
              text_preview: "Preview",
              source_metadata: {
                summary_title: "Match Fail Title",
                video_id: "match_id",
                start_ts: 30,
              },
            },
          ],
          searched_at: "",
        },
      },
    });
    (chrome.tabs.query as jest.Mock).mockRejectedValueOnce(
      new Error("query failed"),
    );
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

    const input = await screen.findByPlaceholderText(
      /rechercher mes analyses/i,
    );
    fireEvent.change(input, { target: { value: "test" } });

    await waitFor(
      () => {
        expect(screen.getByText("Match Fail Title")).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    fireEvent.click(screen.getByText("Match Fail Title"));
    await waitFor(() => {
      expect(tabsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining("/summary/100"),
        }),
      );
    });
  });
});
