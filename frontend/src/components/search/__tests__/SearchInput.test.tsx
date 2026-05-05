import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchInput } from "../SearchInput";

vi.mock("../useRecentQueries", () => ({
  useRecentQueries: () => ({
    queries: ["transition énergétique", "crise énergie"],
    addQuery: vi.fn(),
    clear: vi.fn(),
  }),
}));

afterEach(cleanup);

describe("SearchInput", () => {
  it("renders placeholder", () => {
    render(<SearchInput value="" onChange={() => {}} />);
    expect(screen.getByPlaceholderText(/rechercher/i)).toBeInTheDocument();
  });

  it("calls onChange when typing", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} autoFocus={false} />);
    const input = screen.getByRole("searchbox");
    await user.type(input, "ai");
    expect(onChange).toHaveBeenCalled();
  });

  it("shows suggestions when focused with empty value", async () => {
    const user = userEvent.setup();
    render(<SearchInput value="" onChange={() => {}} autoFocus={false} />);
    await user.click(screen.getByRole("searchbox"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText("transition énergétique")).toBeInTheDocument();
  });

  it("clears value when X button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchInput value="hello" onChange={onChange} autoFocus={false} />);
    await user.click(screen.getByLabelText(/effacer/i));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("calls onSubmit when pressing Enter", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <SearchInput
        value="hello"
        onChange={() => {}}
        onSubmit={onSubmit}
        autoFocus={false}
      />,
    );
    await user.click(screen.getByRole("searchbox"));
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledWith("hello");
  });
});
