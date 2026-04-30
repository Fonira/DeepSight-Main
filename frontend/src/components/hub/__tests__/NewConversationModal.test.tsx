import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NewConversationModal } from "../NewConversationModal";
import { videoApi } from "../../../services/api";

vi.mock("../../../services/api", () => ({
  videoApi: {
    analyze: vi.fn(),
    getTaskStatus: vi.fn(),
    getSummary: vi.fn(),
  },
}));

const mockAnalyze = videoApi.analyze as unknown as ReturnType<typeof vi.fn>;
const mockGetTaskStatus = videoApi.getTaskStatus as unknown as ReturnType<
  typeof vi.fn
>;

describe("NewConversationModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(mockAnalyze).not.toHaveBeenCalled();
  });

  it("calls videoApi.analyze with valid YouTube URL and polls until summary_id available", async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    mockAnalyze.mockResolvedValue({
      task_id: "t-123",
      status: "pending",
    });
    mockGetTaskStatus
      .mockResolvedValueOnce({
        task_id: "t-123",
        status: "processing",
        progress: 50,
      })
      .mockResolvedValueOnce({
        task_id: "t-123",
        status: "completed",
        result: { summary_id: 42 },
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
      expect(mockAnalyze).toHaveBeenCalledWith(
        url,
        "auto",
        "standard",
        undefined,
        false,
        expect.any(String),
      ),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(42), {
      timeout: 8000,
    });
  });

  it("displays progress message during polling", async () => {
    mockAnalyze.mockResolvedValue({
      task_id: "t-1",
      status: "pending",
    });
    mockGetTaskStatus.mockResolvedValue({
      task_id: "t-1",
      status: "processing",
      progress: 30,
      message: "Extraction transcript",
    });
    render(<NewConversationModal open onClose={vi.fn()} onSuccess={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/youtube|tiktok/i), {
      target: { value: "https://www.youtube.com/watch?v=abc12345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: /analyser/i }));
    await waitFor(
      () =>
        expect(screen.getByText(/extraction transcript/i)).toBeInTheDocument(),
      { timeout: 5000 },
    );
  });
});
