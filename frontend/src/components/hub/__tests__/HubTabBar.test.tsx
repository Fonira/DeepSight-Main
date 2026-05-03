import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HubTabBar } from "../HubTabBar";

describe("HubTabBar", () => {
  const baseProps = {
    activeTab: "synthesis" as const,
    onTabChange: vi.fn(),
    chatMessageCount: 0,
    factCheckCount: 0,
  };

  it("rend les 6 onglets globaux", () => {
    render(<HubTabBar {...baseProps} />);
    expect(screen.getByRole("tab", { name: /Synthèse/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Quiz/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Flashcards/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Fiabilité/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /GEO/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Chat/ })).toBeInTheDocument();
  });

  it("marque l'onglet actif avec aria-selected", () => {
    render(<HubTabBar {...baseProps} activeTab="quiz" />);
    expect(screen.getByRole("tab", { name: /Quiz/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: /Synthèse/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("appelle onTabChange au click", () => {
    const onTabChange = vi.fn();
    render(<HubTabBar {...baseProps} onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole("tab", { name: /Chat/ }));
    expect(onTabChange).toHaveBeenCalledWith("chat");
  });

  it("affiche un badge sur l'onglet Chat si messages > 0", () => {
    render(<HubTabBar {...baseProps} chatMessageCount={3} />);
    const chatTab = screen.getByRole("tab", { name: /Chat/ });
    expect(chatTab).toHaveTextContent("3");
  });

  it("n'affiche pas de badge sur Chat si messages === 0", () => {
    render(<HubTabBar {...baseProps} chatMessageCount={0} />);
    const chatTab = screen.getByRole("tab", { name: /Chat/ });
    expect(chatTab.textContent).toBe("Chat");
  });

  it("affiche un badge rouge sur Fiabilité si factCheckCount > 0", () => {
    render(<HubTabBar {...baseProps} factCheckCount={2} />);
    const fiaTab = screen.getByRole("tab", { name: /Fiabilité/ });
    expect(fiaTab).toHaveTextContent("2");
  });
});
