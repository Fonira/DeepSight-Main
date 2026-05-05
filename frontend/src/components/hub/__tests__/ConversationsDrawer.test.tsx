import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ConversationsDrawer } from "../ConversationsDrawer";
import { AuthProvider } from "../../../contexts/AuthContext";
import type { HubConversation } from "../types";
import type { User } from "../../../types/api";

// Mock useHubWorkspacesStore — pas utilisé par les tests existants mais
// présent dans la chaîne d'import depuis Wave 2b (CreateWorkspaceModal).
vi.mock("../../../store/useHubWorkspacesStore", () => {
  const useHubWorkspacesStore = <T,>(
    selector: (s: {
      isCreating: boolean;
      createError: null;
      createWorkspace: () => Promise<unknown>;
      clearErrors: () => void;
    }) => T,
  ): T =>
    selector({
      isCreating: false,
      createError: null,
      createWorkspace: vi.fn(),
      clearErrors: vi.fn(),
    });
  return { useHubWorkspacesStore };
});

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

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    username: "test",
    email: "test@example.com",
    email_verified: true,
    plan: "free",
    credits: 0,
    credits_monthly: 0,
    is_admin: false,
    total_videos: 0,
    total_words: 0,
    total_playlists: 0,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderDrawer(
  drawerProps: Parameters<typeof ConversationsDrawer>[0],
  user: User | null = makeUser(),
) {
  const authValue = {
    user,
    loading: false,
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    loginWithGoogle: vi.fn(),
  };
  return render(
    <MemoryRouter>
      <AuthProvider value={authValue}>
        <ConversationsDrawer {...drawerProps} />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("ConversationsDrawer", () => {
  it("renders nothing when closed", () => {
    const { container } = renderDrawer({
      open: false,
      onClose: () => {},
      conversations: convs,
      activeConvId: null,
      onSelect: () => {},
    });
    expect(container.firstChild).toBeNull();
  });

  it("renders conversations when open", () => {
    renderDrawer({
      open: true,
      onClose: () => {},
      conversations: convs,
      activeConvId: null,
      onSelect: () => {},
    });
    expect(screen.getByText("Lex Fridman · conscience")).toBeInTheDocument();
    expect(screen.getByText("Naval · le levier")).toBeInTheDocument();
  });

  it("calls onSelect with conv id when clicked", () => {
    const onSelect = vi.fn();
    renderDrawer({
      open: true,
      onClose: () => {},
      conversations: convs,
      activeConvId: null,
      onSelect,
    });
    fireEvent.click(screen.getByText("Naval · le levier"));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("filters by search query", () => {
    renderDrawer({
      open: true,
      onClose: () => {},
      conversations: convs,
      activeConvId: null,
      onSelect: () => {},
    });
    fireEvent.change(screen.getByPlaceholderText(/rechercher/i), {
      target: { value: "Naval" },
    });
    expect(screen.queryByText("Lex Fridman · conscience")).toBeNull();
    expect(screen.getByText("Naval · le levier")).toBeInTheDocument();
  });

  it("active conv item has visible indigo ring (F13)", () => {
    const { container } = renderDrawer({
      open: true,
      onClose: () => {},
      conversations: convs,
      activeConvId: 2,
      onSelect: () => {},
    });
    const activeBtn = container.querySelector('[data-conv-id="2"]');
    expect(activeBtn?.className).toMatch(/ring-2/);
    expect(activeBtn?.className).toMatch(/ring-indigo/);
  });

  it("displays short date under each conversation title (F13)", () => {
    renderDrawer({
      open: true,
      onClose: () => {},
      conversations: [
        {
          id: 99,
          summary_id: 99,
          title: "Conv avec date",
          video_source: "youtube",
          video_thumbnail_url: null,
          updated_at: "2026-04-15T10:00:00Z",
        },
      ],
      activeConvId: null,
      onSelect: () => {},
    });
    // Format FR : "15 avr." en 2026
    expect(screen.getByText(/15 avr/)).toBeInTheDocument();
  });

  // ─── Multi-select gating (Wave 2b Agent C) ──────────────────────────────
  it("shows lock icon when user is on free plan", () => {
    renderDrawer(
      {
        open: true,
        onClose: () => {},
        conversations: convs,
        activeConvId: null,
        onSelect: () => {},
      },
      makeUser({ plan: "free" }),
    );
    expect(
      screen.getByRole("button", {
        name: /hub workspace est réservé au plan expert/i,
      }),
    ).toBeInTheDocument();
  });

  it("shows select button when user is on expert plan", () => {
    renderDrawer(
      {
        open: true,
        onClose: () => {},
        conversations: convs,
        activeConvId: null,
        onSelect: () => {},
      },
      makeUser({ plan: "expert" }),
    );
    expect(
      screen.getByRole("button", {
        name: /sélectionner pour créer un workspace/i,
      }),
    ).toBeInTheDocument();
  });

  it("entering select mode disables conversation navigation and toggles selection", () => {
    const onSelect = vi.fn();
    renderDrawer(
      {
        open: true,
        onClose: () => {},
        conversations: convs,
        activeConvId: null,
        onSelect,
      },
      makeUser({ plan: "expert" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /sélectionner pour créer un workspace/i,
      }),
    );
    // Header bascule en mode select.
    expect(screen.getByText(/0 \/ 20 sélectionnée/i)).toBeInTheDocument();
    // Click sur une conv → toggle, pas navigation.
    fireEvent.click(screen.getByText("Lex Fridman · conscience"));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByText(/1 \/ 20 sélectionnée/i)).toBeInTheDocument();
  });

  it("create workspace button is disabled with less than 2 selections", () => {
    renderDrawer(
      {
        open: true,
        onClose: () => {},
        conversations: convs,
        activeConvId: null,
        onSelect: () => {},
      },
      makeUser({ plan: "expert" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /sélectionner pour créer un workspace/i,
      }),
    );
    const createBtn = screen.getByRole("button", { name: /créer workspace/i });
    expect(createBtn).toBeDisabled();
    fireEvent.click(screen.getByText("Lex Fridman · conscience"));
    expect(createBtn).toBeDisabled();
    fireEvent.click(screen.getByText("Naval · le levier"));
    expect(createBtn).not.toBeDisabled();
  });
});
