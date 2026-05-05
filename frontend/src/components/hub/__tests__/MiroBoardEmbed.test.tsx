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

  it("renders iframe when status=ready and boardId present", () => {
    render(<MiroBoardEmbed boardId="abc123" status="ready" />);
    const iframe = screen.getByTestId("miro-board-embed-iframe");
    expect(iframe).toBeInTheDocument();
    expect(iframe.tagName).toBe("IFRAME");
    expect(iframe).toHaveAttribute("title", "Miro Workspace");
    expect(iframe).toHaveAttribute("loading", "lazy");
    expect(iframe).toHaveAttribute(
      "referrerpolicy",
      "strict-origin-when-cross-origin",
    );
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

  it("iframe src includes boardId in expected format", () => {
    render(<MiroBoardEmbed boardId="myBoardXYZ" status="ready" />);
    const iframe = screen.getByTestId("miro-board-embed-iframe");
    const src = iframe.getAttribute("src") ?? "";
    expect(src).toContain("https://miro.com/app/embed/myBoardXYZ/");
    expect(src).toContain("embedMode=view_only_without_ui");
    expect(src).toContain("moveToViewport=fit");
  });

  it("does NOT render iframe when status=ready but boardId is null (fallback path)", () => {
    render(
      <MiroBoardEmbed
        boardId={null}
        status="ready"
        viewLink="https://miro.com/app/board/o9J_kyabc=/"
      />,
    );
    expect(screen.queryByTestId("miro-board-embed-iframe")).toBeNull();
    expect(screen.getByTestId("miro-board-embed-fallback")).toBeInTheDocument();
    expect(
      screen.getByTestId("miro-board-embed-fallback-link"),
    ).toHaveAttribute("href", "https://miro.com/app/board/o9J_kyabc=/");
  });
});
