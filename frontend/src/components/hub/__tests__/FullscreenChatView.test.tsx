// frontend/src/components/hub/__tests__/FullscreenChatView.test.tsx
import React from "react";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FullscreenChatView } from "../FullscreenChatView";
import { useTutorStore } from "../../../store/tutorStore";

// jsdom n'implémente pas Element.scrollTo — TutorFullscreen utilise scrollRef.current?.scrollTo
beforeAll(() => {
  Element.prototype.scrollTo =
    vi.fn() as unknown as typeof Element.prototype.scrollTo;
});

vi.mock("../../../contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "fr" }),
}));

vi.mock("../../../services/api", () => ({
  tutorApi: {
    sessionStart: vi.fn(),
    sessionTurn: vi.fn(),
    sessionEnd: vi.fn(),
  },
}));

function renderView(chatType: string) {
  return render(
    <MemoryRouter>
      <FullscreenChatView chatType={chatType} />
    </MemoryRouter>,
  );
}

describe("FullscreenChatView", () => {
  beforeEach(() => {
    useTutorStore.getState().reset();
  });

  it("renders TutorFullscreen for chatType='tutor'", () => {
    renderView("tutor");
    expect(screen.getByTestId("tutor-fullscreen")).toBeInTheDocument();
  });

  it("returns null for unknown chatType", () => {
    const { container } = renderView("unknown-chat-type");
    expect(container.firstChild).toBeNull();
  });

  it("returns null for empty chatType", () => {
    const { container } = renderView("");
    expect(container.firstChild).toBeNull();
  });

  it("returns null for chatType='quickchat' (V1 not supported)", () => {
    const { container } = renderView("quickchat");
    expect(container.firstChild).toBeNull();
  });
});
