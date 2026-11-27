/**
 * Tests — MainView : polling du statut d'analyse.
 * Fichier source : src/sidepanel/views/MainView.tsx (+ pollingPolicy.ts)
 *
 * Bugs couverts :
 *  - une 429 relançait GET_TASK_STATUS toutes les 2,5 s (boucle de 429) ;
 *  - une erreur définitive (404 Task not found) laissait le spinner tourner
 *    indéfiniment (les erreurs de polling étaient ignorées).
 */

import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { resetChromeMocks } from "../../setup/chrome-api-mock";
import { MainView } from "../../../src/sidepanel/views/MainView";
import type { MessageResponse } from "../../../src/types";

jest.mock("../../../src/i18n/useTranslation", () => ({
  useTranslation: () => ({
    t: jest.requireActual("../../../src/i18n/fr.json"),
    language: "fr",
    setLanguage: jest.fn(),
  }),
}));

const baseProps = {
  user: {
    id: 1,
    username: "alice",
    email: "a@b.com",
    plan: "pro" as const,
    credits: 100,
    credits_monthly: 150,
    default_mode: "standard",
    default_lang: "fr",
  },
  planInfo: {
    plan_name: "Pro",
    plan_id: "pro" as const,
    monthly_analyses: 30,
    analyses_this_month: 1,
    credits: 100,
    credits_monthly: 150,
    features: {
      analysis: true,
      synthesis: true,
      chat: true,
      flashcards: true,
      mind_maps: true,
      web_search: true,
      playlists: true,
      exports: true,
    },
  },
  isGuest: false,
  onLoginRedirect: jest.fn(),
  onError: jest.fn(),
};

type Action = { action?: string };

function statusCalls(): number {
  return (chrome.runtime.sendMessage as jest.Mock).mock.calls.filter(
    ([msg]) => (msg as Action)?.action === "GET_TASK_STATUS",
  ).length;
}

async function startAnalysis(): Promise<void> {
  // Le tab YouTube du mock chrome ("Test Video") doit être détecté avant de
  // cliquer : l'état vide affiche aussi « Analyser cette vidéo » (titre).
  await waitFor(() => {
    expect(screen.getByText("Test Video")).toBeInTheDocument();
  });
  await act(async () => {
    fireEvent.click(
      screen.getByRole("button", { name: /Analyser cette vidéo/ }),
    );
  });
}

describe("MainView — analysis polling", () => {
  beforeEach(() => {
    resetChromeMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("waits for Retry-After on 429, then stops on a definitive error", async () => {
    const statusResponses: MessageResponse[] = [
      {
        success: false,
        error: "Trop de requêtes. Réessayez dans 20 secondes.",
        errorCode: "rate_limited",
        httpStatus: 429,
        retryAfter: 20,
      },
      { success: false, error: "Task not found", httpStatus: 404 },
    ];
    (chrome.runtime.sendMessage as jest.Mock).mockImplementation(
      (msg: Action) => {
        if (msg?.action === "START_ANALYSIS") {
          return Promise.resolve({ success: true, result: { task_id: "t1" } });
        }
        if (msg?.action === "GET_TASK_STATUS") {
          return Promise.resolve(statusResponses.shift());
        }
        return Promise.resolve({});
      },
    );

    render(<MainView {...baseProps} onLogout={jest.fn()} />);
    await startAnalysis();

    await act(async () => {
      jest.advanceTimersByTime(2500);
    });
    expect(statusCalls()).toBe(1);

    // Pendant le Retry-After : aucune nouvelle requête.
    await act(async () => {
      jest.advanceTimersByTime(19_000);
    });
    expect(statusCalls()).toBe(1);

    await act(async () => {
      jest.advanceTimersByTime(1_000);
    });
    expect(statusCalls()).toBe(2);

    // 404 → carte d'erreur, plus de polling.
    await waitFor(() => {
      expect(screen.getByText("Task not found")).toBeInTheDocument();
    });
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(statusCalls()).toBe(2);
  });

  it("logs out when the session expired during polling", async () => {
    const onLogout = jest.fn();
    (chrome.runtime.sendMessage as jest.Mock).mockImplementation(
      (msg: Action) => {
        if (msg?.action === "START_ANALYSIS") {
          return Promise.resolve({ success: true, result: { task_id: "t1" } });
        }
        if (msg?.action === "GET_TASK_STATUS") {
          return Promise.resolve({
            success: false,
            error: "SESSION_EXPIRED",
            errorCode: "session_expired",
            httpStatus: 401,
          });
        }
        return Promise.resolve({});
      },
    );

    render(<MainView {...baseProps} onLogout={onLogout} />);
    await startAnalysis();
    await act(async () => {
      jest.advanceTimersByTime(2500);
    });

    await waitFor(() => expect(onLogout).toHaveBeenCalled());
    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });
    expect(statusCalls()).toBe(1);
  });

  it("shows an error instead of spinning when the summary cannot be loaded", async () => {
    (chrome.runtime.sendMessage as jest.Mock).mockImplementation(
      (msg: Action) => {
        if (msg?.action === "START_ANALYSIS") {
          return Promise.resolve({ success: true, result: { task_id: "t1" } });
        }
        if (msg?.action === "GET_TASK_STATUS") {
          return Promise.resolve({
            success: true,
            status: {
              status: "completed",
              progress: 100,
              message: "",
              result: { summary_id: 7 },
            },
          });
        }
        if (msg?.action === "GET_SUMMARY") {
          return Promise.resolve({
            success: false,
            error: "DeepSight est en accès privé.",
            errorCode: "private_mode",
            httpStatus: 403,
          });
        }
        return Promise.resolve({});
      },
    );

    render(<MainView {...baseProps} onLogout={jest.fn()} />);
    await startAnalysis();
    await act(async () => {
      jest.advanceTimersByTime(2500);
    });

    await waitFor(() => {
      expect(
        screen.getByText(/temporairement en accès privé/),
      ).toBeInTheDocument();
    });
  });
});
