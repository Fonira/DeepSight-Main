/**
 * Tests — RecentsList component
 * Fichier source : src/sidepanel/components/RecentsList.tsx
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { RecentsList } from "../../../src/sidepanel/components/RecentsList";

describe("RecentsList", () => {
  const mockRecents = [
    {
      id: "1",
      videoId: "abc",
      title: "Video 1",
      thumbnail: "thumb1.jpg",
      createdAt: "2026-04-26T10:00:00Z",
    },
    {
      id: "2",
      videoId: "def",
      title: "Video 2",
      thumbnail: "thumb2.jpg",
      createdAt: "2026-04-25T10:00:00Z",
    },
  ];

  it("renders empty state when no recents", () => {
    render(<RecentsList recents={[]} onSelect={() => {}} />);
    expect(screen.getByText(/aucune analyse récente/i)).toBeInTheDocument();
  });

  it("renders all recent items", () => {
    render(<RecentsList recents={mockRecents} onSelect={() => {}} />);
    expect(screen.getByText("Video 1")).toBeInTheDocument();
    expect(screen.getByText("Video 2")).toBeInTheDocument();
  });

  it("calls onSelect with the recent when item clicked", () => {
    const onSelect = jest.fn();
    render(<RecentsList recents={mockRecents} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Video 1"));
    expect(onSelect).toHaveBeenCalledWith(mockRecents[0]);
  });
});
