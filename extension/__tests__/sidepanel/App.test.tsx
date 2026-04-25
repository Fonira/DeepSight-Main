/** @jest-environment jsdom */

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { App } from "../../src/sidepanel/App";

// We need to control chrome.storage.session before App mounts.
// chrome-api-mock seeds chrome with storage.local + sync, but NOT session.
// We install a session API helper before each test.

interface SessionStore {
  store: Record<string, unknown>;
}

function installSessionStorage(): SessionStore {
  const session = {
    store: {} as Record<string, unknown>,
  };
  const sessionApi = {
    get: jest.fn((key: string | string[]) => {
      const keys = typeof key === "string" ? [key] : key;
      const result: Record<string, unknown> = {};
      for (const k of keys) {
        if (k in session.store) result[k] = session.store[k];
      }
      return Promise.resolve(result);
    }),
    set: jest.fn((data: Record<string, unknown>) => {
      Object.assign(session.store, data);
      return Promise.resolve();
    }),
    remove: jest.fn((key: string | string[]) => {
      const keys = typeof key === "string" ? [key] : key;
      for (const k of keys) delete session.store[k];
      return Promise.resolve();
    }),
  };
  type ChromeWithSession = {
    storage?: { session?: typeof sessionApi };
  };
  const c = (global as unknown as { chrome: ChromeWithSession }).chrome;
  if (!c.storage) c.storage = {};
  c.storage.session = sessionApi;
  return session;
}

describe("Side Panel <App /> — context hydration", () => {
  let session: SessionStore;

  beforeEach(() => {
    session = installSessionStorage();
  });

  it("hydrates from chrome.storage.session and shows agent_type=explorer when summaryId present", async () => {
    session.store.voicePanelContext = {
      summaryId: 99,
      videoId: "dQw4w9WgXcQ",
      videoTitle: "Test video",
    };
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("agent-type")).toHaveTextContent(/explorer/i);
    });
    expect(screen.getByText("Test video")).toBeInTheDocument();
    expect(screen.getByText(/Analyse #99/)).toBeInTheDocument();
  });

  it("falls back to companion when no context stored", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("agent-type")).toHaveTextContent(/companion/i);
    });
    expect(
      screen.getByText(/Mode compagnon — sans contexte vidéo/i),
    ).toBeInTheDocument();
  });

  it("renders the voice toggle button enabled by default", async () => {
    render(<App />);

    const btn = await screen.findByTestId("voice-toggle-btn");
    expect(btn).toBeEnabled();
    expect(btn.getAttribute("data-active")).toBe("false");
  });

  it("exposes a default 'idle' status before any user click", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("voice-status")).toHaveTextContent(
        /Prêt à appeler/i,
      );
    });
  });
});
