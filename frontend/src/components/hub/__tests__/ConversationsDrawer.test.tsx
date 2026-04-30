import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConversationsDrawer } from "../ConversationsDrawer";
import type { HubConversation } from "../types";

const convs: HubConversation[] = [
  {
    id: 1,
    summary_id: 10,
    title: "Lex Fridman · conscience",
    video_source: "youtube",
    video_thumbnail_url: null,
    last_snippet: "3 niveaux de conscience",
    updated_at: new Date().toISOString(),
  },
  {
    id: 2,
    summary_id: 11,
    title: "Naval · le levier",
    video_source: "youtube",
    video_thumbnail_url: null,
    last_snippet: "Permissionless leverage",
    updated_at: new Date(Date.now() - 86_400_000).toISOString(),
  },
];

describe("ConversationsDrawer", () => {
  it("renders nothing when closed", () => {
    const { container } = render(
      <ConversationsDrawer
        open={false}
        onClose={() => {}}
        conversations={convs}
        activeConvId={null}
        onSelect={() => {}}
        onNewConv={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders conversations when open", () => {
    render(
      <ConversationsDrawer
        open={true}
        onClose={() => {}}
        conversations={convs}
        activeConvId={null}
        onSelect={() => {}}
        onNewConv={() => {}}
      />,
    );
    expect(screen.getByText("Lex Fridman · conscience")).toBeInTheDocument();
    expect(screen.getByText("Naval · le levier")).toBeInTheDocument();
  });

  it("calls onSelect with conv id when clicked", () => {
    const onSelect = vi.fn();
    render(
      <ConversationsDrawer
        open={true}
        onClose={() => {}}
        conversations={convs}
        activeConvId={null}
        onSelect={onSelect}
        onNewConv={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("Naval · le levier"));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("filters by search query", () => {
    render(
      <ConversationsDrawer
        open={true}
        onClose={() => {}}
        conversations={convs}
        activeConvId={null}
        onSelect={() => {}}
        onNewConv={() => {}}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/rechercher/i), {
      target: { value: "Naval" },
    });
    expect(screen.queryByText("Lex Fridman · conscience")).toBeNull();
    expect(screen.getByText("Naval · le levier")).toBeInTheDocument();
  });
});
