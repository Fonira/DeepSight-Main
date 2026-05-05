// frontend/src/components/hub/__tests__/MiroBoardEmbed.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MiroBoardEmbed } from "../MiroBoardEmbed";

describe("MiroBoardEmbed", () => {
  it("renders skeleton when status=creating", () => {
    render(<MiroBoardEmbed boardId="board-123" status="creating" />);
    expect(screen.getByTestId("miro-board-embed-skeleton")).toBeInTheDocument();
    expect(screen.getByText(/Création du workspace Miro/i)).toBeInTheDocument();
    // aria-busy quand creating
    const region = screen.getByRole("region", {
      name: /Hub Workspace Miro Board/i,
    });
    expect(region).toHaveAttribute("aria-busy", "true");
  });

  it("renders 'Open in Miro' link when status=ready and boardId present", () => {
    render(<MiroBoardEmbed boardId="abc123" status="ready" />);
    const ready = screen.getByTestId("miro-board-embed-ready");
    expect(ready).toBeInTheDocument();
    expect(screen.getByText(/Workspace Miro prêt/i)).toBeInTheDocument();

    const link = screen.getByTestId("miro-board-embed-open-link");
    expect(link.tagName).toBe("A");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("href", "https://miro.com/app/board/abc123");
  });

  it("renders error block when status=failed", () => {
    render(
      <MiroBoardEmbed
        boardId={null}
        status="failed"
        errorMessage="Network error: timeout after 30s"
      />,
    );
    expect(screen.getByTestId("miro-board-embed-error")).toBeInTheDocument();
    expect(
      screen.getByText(/Workspace Miro indisponible/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Network error: timeout after 30s/i),
    ).toBeInTheDocument();
  });

  it("uses viewLink prop when provided (overrides boardId-based URL)", () => {
    render(
      <MiroBoardEmbed
        boardId="abc123"
        status="ready"
        viewLink="https://miro.com/app/board/o9J_kyabc=/"
      />,
    );
    const link = screen.getByTestId("miro-board-embed-open-link");
    expect(link).toHaveAttribute(
      "href",
      "https://miro.com/app/board/o9J_kyabc=/",
    );
  });

  it("uses viewLink fallback when boardId is null but status=ready", () => {
    render(
      <MiroBoardEmbed
        boardId={null}
        status="ready"
        viewLink="https://miro.com/app/board/o9J_kyabc=/"
      />,
    );
    // No iframe ever (we removed it entirely)
    expect(screen.queryByTestId("miro-board-embed-iframe")).toBeNull();
    // Renders the ready link card (viewLink works as the URL source)
    expect(screen.getByTestId("miro-board-embed-ready")).toBeInTheDocument();
    expect(
      screen.getByTestId("miro-board-embed-open-link"),
    ).toHaveAttribute("href", "https://miro.com/app/board/o9J_kyabc=/");
  });

  it("renders safe fallback when status=ready but no boardId AND no viewLink", () => {
    render(<MiroBoardEmbed boardId={null} status="ready" />);
    expect(screen.getByTestId("miro-board-embed-fallback")).toBeInTheDocument();
    expect(
      screen.getByText(/Workspace prêt mais lien indisponible/i),
    ).toBeInTheDocument();
  });
});
