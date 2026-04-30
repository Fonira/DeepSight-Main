import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BillingToggle } from "../BillingToggle";

describe("BillingToggle", () => {
  it("renders monthly active state by default", () => {
    render(<BillingToggle value="monthly" onChange={() => {}} />);
    const monthly = screen.getByRole("button", { name: /mensuel/i });
    expect(monthly).toHaveAttribute("aria-pressed", "true");
  });

  it("renders yearly active state", () => {
    render(<BillingToggle value="yearly" onChange={() => {}} />);
    const yearly = screen.getByRole("button", { name: /annuel/i });
    expect(yearly).toHaveAttribute("aria-pressed", "true");
  });

  it("displays -17 % badge near yearly", () => {
    render(<BillingToggle value="monthly" onChange={() => {}} />);
    expect(screen.getByText(/-17\s*%/)).toBeInTheDocument();
  });

  it("calls onChange('yearly') when clicking annuel", () => {
    const onChange = vi.fn();
    render(<BillingToggle value="monthly" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /annuel/i }));
    expect(onChange).toHaveBeenCalledWith("yearly");
  });

  it("calls onChange('monthly') when clicking mensuel", () => {
    const onChange = vi.fn();
    render(<BillingToggle value="yearly" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /mensuel/i }));
    expect(onChange).toHaveBeenCalledWith("monthly");
  });
});
