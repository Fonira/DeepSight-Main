import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NewConversationModal } from "../NewConversationModal";

const mockStartVideoAnalysis = vi.fn();

vi.mock("../../../contexts/BackgroundAnalysisContext", () => ({
  useBackgroundAnalysis: () => ({
    startVideoAnalysis: mockStartVideoAnalysis,
  }),
}));

describe("NewConversationModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartVideoAnalysis.mockReset();
  });

  it("validates URL: rejects non-YouTube/TikTok URL", () => {
    const onSuccess = vi.fn();
    render(
      <NewConversationModal open onClose={vi.fn()} onSuccess={onSuccess} />,
    );
    const input = screen.getByPlaceholderText(/youtube|tiktok/i);
    fireEvent.change(input, { target: { value: "https://example.com/foo" } });
    fireEvent.click(screen.getByRole("button", { name: /analyser/i }));
    expect(screen.getByText(/url invalide/i)).toBeInTheDocument();
    expect(mockStartVideoAnalysis).not.toHaveBeenCalled();
  });

  it("delegates to background context with valid YouTube URL and propagates onComplete to onSuccess", async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    mockStartVideoAnalysis.mockImplementation(async (params) => {
      // Simulate the context firing onComplete after the polling resolves.
      setTimeout(() => params.onComplete?.(42, "Test"), 5);
      return "video-1";
    });

    render(
      <NewConversationModal open onClose={onClose} onSuccess={onSuccess} />,
    );
    const url = "https://www.youtube.com/watch?v=abc12345678";
    fireEvent.change(screen.getByPlaceholderText(/youtube|tiktok/i), {
      target: { value: url },
    });
    fireEvent.click(screen.getByRole("button", { name: /analyser/i }));

    await waitFor(() =>
      expect(mockStartVideoAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          videoUrl: url,
          onComplete: expect.any(Function),
        }),
      ),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(42), {
      timeout: 5000,
    });
    // Modal should close as soon as startVideoAnalysis resolves.
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("displays an error and keeps the modal open when startVideoAnalysis throws", async () => {
    const onClose = vi.fn();
    mockStartVideoAnalysis.mockRejectedValue(new Error("Network down"));

    render(<NewConversationModal open onClose={onClose} onSuccess={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/youtube|tiktok/i), {
      target: { value: "https://www.youtube.com/watch?v=abc12345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: /analyser/i }));

    await waitFor(() =>
      expect(screen.getByText(/network down/i)).toBeInTheDocument(),
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
