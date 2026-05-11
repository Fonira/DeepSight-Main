// frontend/src/routes/__tests__/legacyRedirects.test.tsx
//
// Hub centralization PR1 — ensures the three legacy paths (/chat,
// /voice-call, /history) redirect into /hub with the right query params
// preserved. Each test mounts the redirect under a MemoryRouter and
// inspects the final location via a LocationDisplay probe.
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import {
  ChatLegacyRedirect,
  VoiceCallLegacyRedirect,
  HistoryLegacyRedirect,
} from "../legacyRedirects";

const LocationDisplay: React.FC = () => {
  const location = useLocation();
  return (
    <div data-testid="location">{location.pathname + location.search}</div>
  );
};

const renderAt = (initialEntry: string) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/chat" element={<ChatLegacyRedirect />} />
        <Route path="/voice-call" element={<VoiceCallLegacyRedirect />} />
        <Route path="/history" element={<HistoryLegacyRedirect />} />
        <Route path="/hub" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>,
  );

describe("ChatLegacyRedirect", () => {
  it("redirects /chat?summary=42 to /hub?conv=42&tab=chat", () => {
    renderAt("/chat?summary=42");
    expect(screen.getByTestId("location").textContent).toBe(
      "/hub?conv=42&tab=chat",
    );
  });

  it("redirects /chat?summaryId=99 (canonical alias) to /hub?conv=99&tab=chat", () => {
    renderAt("/chat?summaryId=99");
    expect(screen.getByTestId("location").textContent).toBe(
      "/hub?conv=99&tab=chat",
    );
  });

  it("redirects /chat without summary to bare /hub", () => {
    renderAt("/chat");
    expect(screen.getByTestId("location").textContent).toBe("/hub");
  });
});

describe("VoiceCallLegacyRedirect", () => {
  it("redirects /voice-call?summary=42 to /hub?conv=42&voice=1", () => {
    renderAt("/voice-call?summary=42");
    expect(screen.getByTestId("location").textContent).toBe(
      "/hub?conv=42&voice=1",
    );
  });

  it("redirects /voice-call without summary to /hub?voice=1 (free-form mode)", () => {
    renderAt("/voice-call");
    expect(screen.getByTestId("location").textContent).toBe("/hub?voice=1");
  });
});

describe("HistoryLegacyRedirect", () => {
  it("redirects /history to /hub?view=history", () => {
    renderAt("/history");
    expect(screen.getByTestId("location").textContent).toBe(
      "/hub?view=history",
    );
  });

  it("preserves arbitrary search params alongside view=history", () => {
    renderAt("/history?q=foo&page=2");
    // URLSearchParams orders params deterministically (insertion order).
    expect(screen.getByTestId("location").textContent).toBe(
      "/hub?q=foo&page=2&view=history",
    );
  });
});
