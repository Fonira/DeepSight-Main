/**
 * useVoiceEnabled.test.tsx — Tests pour le hook de gating premium voice.
 *
 * Encapsule la logique admin email + PLAN_LIMITS dupliquée dans 3 pages
 * (DashboardPage, History, DebatePage). Spec #2 §c.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockUseAuth = vi.fn();
vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../../../config/planPrivileges", () => ({
  normalizePlanId: (plan: string | undefined | null) => plan || "free",
  PLAN_LIMITS: {
    free: { voiceChatEnabled: false },
    plus: { voiceChatEnabled: true },
    pro: { voiceChatEnabled: true },
  },
}));

import { useVoiceEnabled } from "../hooks/useVoiceEnabled";

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("useVoiceEnabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retourne false pour un user free non admin", () => {
    mockUseAuth.mockReturnValue({
      user: {
        email: "user@example.com",
        plan: "free",
        is_admin: false,
      },
    });

    const { result } = renderHook(() => useVoiceEnabled());
    expect(result.current).toBe(false);
  });

  it("retourne true pour un user pro non admin", () => {
    mockUseAuth.mockReturnValue({
      user: {
        email: "user@example.com",
        plan: "pro",
        is_admin: false,
      },
    });

    const { result } = renderHook(() => useVoiceEnabled());
    expect(result.current).toBe(true);
  });

  it("retourne true pour un user plus", () => {
    mockUseAuth.mockReturnValue({
      user: {
        email: "user@example.com",
        plan: "plus",
        is_admin: false,
      },
    });

    const { result } = renderHook(() => useVoiceEnabled());
    expect(result.current).toBe(true);
  });

  it("retourne true pour un admin avec is_admin=true (peu importe le plan)", () => {
    mockUseAuth.mockReturnValue({
      user: {
        email: "someone@example.com",
        plan: "free",
        is_admin: true,
      },
    });

    const { result } = renderHook(() => useVoiceEnabled());
    expect(result.current).toBe(true);
  });

  it("retourne true pour l'admin email canonique même si plan free", () => {
    mockUseAuth.mockReturnValue({
      user: {
        email: "maximeleparc3@gmail.com",
        plan: "free",
        is_admin: false,
      },
    });

    const { result } = renderHook(() => useVoiceEnabled());
    expect(result.current).toBe(true);
  });

  it("admin email matching est case-insensitive", () => {
    mockUseAuth.mockReturnValue({
      user: {
        email: "MaximeLeParc3@GMAIL.com",
        plan: "free",
        is_admin: false,
      },
    });

    const { result } = renderHook(() => useVoiceEnabled());
    expect(result.current).toBe(true);
  });

  it("retourne false si user est null", () => {
    mockUseAuth.mockReturnValue({ user: null });

    const { result } = renderHook(() => useVoiceEnabled());
    expect(result.current).toBe(false);
  });

  it("retourne false si plan est undefined (fallback free)", () => {
    mockUseAuth.mockReturnValue({
      user: { email: "user@example.com", plan: undefined, is_admin: false },
    });

    const { result } = renderHook(() => useVoiceEnabled());
    expect(result.current).toBe(false);
  });
});
