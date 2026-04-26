/**
 * Tests — VideoDetectedCard component
 * Fichier source : src/sidepanel/components/VideoDetectedCard.tsx
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { VideoDetectedCard } from "../../../src/sidepanel/components/VideoDetectedCard";

describe("VideoDetectedCard", () => {
  it("renders video title and thumbnail", () => {
    render(
      <VideoDetectedCard
        title="Test Video"
        thumbnail="thumb.jpg"
        platform="youtube"
        onAnalyze={() => {}}
      />,
    );
    expect(screen.getByText("Test Video")).toBeInTheDocument();
    expect(screen.getByAltText(/test video/i)).toHaveAttribute(
      "src",
      "thumb.jpg",
    );
  });

  it("displays platform label", () => {
    render(
      <VideoDetectedCard
        title="V"
        thumbnail=""
        platform="tiktok"
        onAnalyze={() => {}}
      />,
    );
    expect(screen.getByText(/tiktok/i)).toBeInTheDocument();
  });

  it("calls onAnalyze when button clicked", () => {
    const onAnalyze = jest.fn();
    render(
      <VideoDetectedCard
        title="V"
        thumbnail=""
        platform="youtube"
        onAnalyze={onAnalyze}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /analyser/i }));
    expect(onAnalyze).toHaveBeenCalled();
  });
});
