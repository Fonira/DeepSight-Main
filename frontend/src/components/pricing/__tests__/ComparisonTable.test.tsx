import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComparisonTable } from "../ComparisonTable";

describe("ComparisonTable", () => {
  it("renders 3 columns (free, pro, expert) + features column", () => {
    render(<ComparisonTable cycle="monthly" />);
    // Headers : 3 plans
    expect(
      screen.getByRole("columnheader", { name: /Gratuit/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /^Pro/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /^Expert/ }),
    ).toBeInTheDocument();
  });

  it("displays Pro voice minutes (30) and Expert (120)", () => {
    render(<ComparisonTable cycle="monthly" />);
    expect(screen.getByText(/30\s*min\/mois/i)).toBeInTheDocument();
    expect(screen.getByText(/120\s*min\/mois/i)).toBeInTheDocument();
  });

  it("shows monthly prices when cycle=monthly", () => {
    render(<ComparisonTable cycle="monthly" />);
    expect(screen.getByText(/8[,.]?99/)).toBeInTheDocument();
    expect(screen.getByText(/19[,.]?99/)).toBeInTheDocument();
  });

  it("shows yearly prices when cycle=yearly", () => {
    render(<ComparisonTable cycle="yearly" />);
    expect(screen.getByText(/89[,.]?90/)).toBeInTheDocument();
    expect(screen.getByText(/199[,.]?90/)).toBeInTheDocument();
  });

  it("highlights popular badge on Pro", () => {
    render(<ComparisonTable cycle="monthly" />);
    expect(screen.getByText(/populaire/i)).toBeInTheDocument();
  });
});
