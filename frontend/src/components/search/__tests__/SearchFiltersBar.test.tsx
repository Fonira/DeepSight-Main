import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchFiltersBar } from "../SearchFiltersBar";

afterEach(cleanup);

describe("SearchFiltersBar", () => {
  it("renders 'Tout' active by default when no source_types", () => {
    render(
      <SearchFiltersBar
        filters={{}}
        onChange={() => {}}
        onToggleAdvanced={() => {}}
        advancedOpen={false}
      />,
    );
    const all = screen.getByRole("button", { name: /Tout/ });
    expect(all).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles a type pill on click", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <SearchFiltersBar
        filters={{}}
        onChange={onChange}
        onToggleAdvanced={() => {}}
        advancedOpen={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Synthèse/ }));
    expect(onChange).toHaveBeenCalledWith({ source_types: ["summary"] });
  });

  it("expands advanced filters when clicked", async () => {
    const user = userEvent.setup();
    const onToggleAdvanced = vi.fn();
    render(
      <SearchFiltersBar
        filters={{}}
        onChange={() => {}}
        onToggleAdvanced={onToggleAdvanced}
        advancedOpen={false}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Filtres avancés/ }));
    expect(onToggleAdvanced).toHaveBeenCalled();
  });
});
