import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InputBar } from "../InputBar";

describe("InputBar", () => {
  it("calls onSend with the trimmed text", () => {
    const onSend = vi.fn();
    render(<InputBar onSend={onSend} onPttHoldComplete={() => {}} />);
    const input = screen.getByPlaceholderText(/posez votre question/i);
    fireEvent.change(input, { target: { value: "Hello world" } });
    const sendBtn = screen.getByRole("button", { name: /envoyer/i });
    fireEvent.click(sendBtn);
    expect(onSend).toHaveBeenCalledWith("Hello world");
  });

  it("shows mic button when input is empty (no Phone CTA — it lives on the Hub now)", () => {
    render(<InputBar onSend={() => {}} onPttHoldComplete={() => {}} />);
    expect(
      screen.getByRole("button", { name: /maintenir/i }),
    ).toBeInTheDocument();
    // Le micro-bouton téléphone a été retiré au profit du QuickVoiceCallCTA
    // hero rendu par HubPage. On vérifie qu'il n'est plus présent ici.
    expect(
      screen.queryByRole("button", { name: /full call/i }),
    ).not.toBeInTheDocument();
  });

  it("send on non-chat tab calls onTabChange('chat') then onSend (F4)", () => {
    const onSend = vi.fn();
    const onTabChange = vi.fn();
    render(
      <InputBar
        onSend={onSend}
        onPttHoldComplete={() => {}}
        activeTab="synthesis"
        onTabChange={onTabChange}
      />,
    );
    const input = screen.getByPlaceholderText(/posez votre question/i);
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: /envoyer/i }));
    expect(onTabChange).toHaveBeenCalledWith("chat");
    expect(onSend).toHaveBeenCalledWith("Hello");
  });

  it("send on chat tab does NOT call onTabChange", () => {
    const onSend = vi.fn();
    const onTabChange = vi.fn();
    render(
      <InputBar
        onSend={onSend}
        onPttHoldComplete={() => {}}
        activeTab="chat"
        onTabChange={onTabChange}
      />,
    );
    const input = screen.getByPlaceholderText(/posez votre question/i);
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: /envoyer/i }));
    expect(onTabChange).not.toHaveBeenCalled();
    expect(onSend).toHaveBeenCalledWith("Hello");
  });

  it("renders the Plateformes chip (open by default)", () => {
    render(<InputBar onSend={() => {}} onPttHoldComplete={() => {}} />);
    expect(screen.getByText(/Plateformes/i)).toBeInTheDocument();
  });
});
