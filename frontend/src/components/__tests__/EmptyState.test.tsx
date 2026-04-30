import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { History as HistoryIcon } from "lucide-react";
import { renderWithProviders } from "../../__tests__/test-utils";
import { EmptyState } from "../EmptyState";

describe("EmptyState", () => {
  it("renders title, description and icon", () => {
    renderWithProviders(
      <EmptyState
        icon={HistoryIcon}
        title="Aucune analyse"
        description="Lancez votre première analyse"
      />,
    );
    expect(screen.getByText("Aucune analyse")).toBeInTheDocument();
    expect(
      screen.getByText("Lancez votre première analyse"),
    ).toBeInTheDocument();
  });

  it("renders CTA when ctaLabel and ctaHref provided", async () => {
    renderWithProviders(
      <EmptyState
        icon={HistoryIcon}
        title="Vide"
        description="Rien"
        ctaLabel="Lancer une analyse"
        ctaHref="/dashboard"
      />,
    );
    const cta = screen.getByRole("link", { name: /lancer une analyse/i });
    expect(cta).toHaveAttribute("href", "/dashboard");
  });

  it("calls onCta when ctaLabel + onCta provided (no href)", async () => {
    const onCta = vi.fn();
    renderWithProviders(
      <EmptyState
        icon={HistoryIcon}
        title="Vide"
        description="Rien"
        ctaLabel="Action"
        onCta={onCta}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /action/i }));
    expect(onCta).toHaveBeenCalledTimes(1);
  });

  it("renders suggestedVideo block when provided", () => {
    renderWithProviders(
      <EmptyState
        icon={HistoryIcon}
        title="Vide"
        description="Rien"
        suggestedVideo={{
          title: "Vidéo recommandée",
          thumbnailUrl: "https://example.com/thumb.jpg",
          href: "/dashboard?video=abc",
        }}
      />,
    );
    expect(screen.getByText("Vidéo recommandée")).toBeInTheDocument();
    const thumb = screen.getByRole("img");
    expect(thumb).toHaveAttribute("src", "https://example.com/thumb.jpg");
  });

  it("does NOT render CTA when ctaLabel missing", () => {
    renderWithProviders(
      <EmptyState icon={HistoryIcon} title="Vide" description="Rien" />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
