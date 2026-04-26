/**
 * Tests — UrlInputCard component
 * Fichier source : src/sidepanel/components/UrlInputCard.tsx
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { UrlInputCard } from "../../../src/sidepanel/components/UrlInputCard";

describe("UrlInputCard", () => {
  it("renders input and submit button", () => {
    render(<UrlInputCard onSubmit={() => {}} />);
    expect(screen.getByPlaceholderText(/url youtube/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /analyser/i }),
    ).toBeInTheDocument();
  });

  it("calls onSubmit with URL when valid YouTube URL submitted", () => {
    const onSubmit = jest.fn();
    render(<UrlInputCard onSubmit={onSubmit} />);
    const input = screen.getByPlaceholderText(
      /url youtube/i,
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: { value: "https://www.youtube.com/watch?v=abc123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /analyser/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=abc123",
    );
  });

  it("shows error and does NOT call onSubmit on invalid URL", () => {
    const onSubmit = jest.fn();
    render(<UrlInputCard onSubmit={onSubmit} />);
    const input = screen.getByPlaceholderText(/url youtube/i);
    fireEvent.change(input, { target: { value: "not a url" } });
    fireEvent.click(screen.getByRole("button", { name: /analyser/i }));
    expect(screen.getByText(/url invalide/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
