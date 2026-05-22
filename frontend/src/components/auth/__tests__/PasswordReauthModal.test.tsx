/**
 * 🧪 Tests — PasswordReauthModal
 *
 * Couvre :
 *   1. render quand `open=true` (title + input + boutons)
 *   2. submit success → onSuccess appelé avec le reauth_token
 *   3. submit 401 → message "Mot de passe incorrect" affiché
 *   4. clic Annuler → onCancel appelé
 *   5. ne render rien quand `open=false`
 *
 * Pattern emprunté à `UpgradeModal.test.tsx` :
 *   - PAS de vi.useFakeTimers (framer-motion ne fonctionne pas avec)
 *   - waitFor pour les états asynchrones
 *   - mock vi.mock("../../services/api", ...) pour authApi.requestReauth
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
} from "../../../__tests__/test-utils";
import { PasswordReauthModal } from "../PasswordReauthModal";

// ─── Mocks ────────────────────────────────────────────────────────────────

// On garde la vraie ApiError pour pouvoir simuler un 401.
const requestReauthMock = vi.fn();

vi.mock("../../../services/api", async () => {
  const actual =
    await vi.importActual<typeof import("../../../services/api")>(
      "../../../services/api",
    );
  return {
    ...actual,
    authApi: {
      ...actual.authApi,
      requestReauth: (...args: unknown[]) => requestReauthMock(...args),
    },
  };
});

// ─── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  requestReauthMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────

describe("PasswordReauthModal - Visibility", () => {
  it("renders nothing when open=false", () => {
    const { container } = renderWithProviders(
      <PasswordReauthModal
        open={false}
        audience="billing"
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // No dialog in document
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it("renders dialog with password input and buttons when open=true", () => {
    renderWithProviders(
      <PasswordReauthModal
        open={true}
        audience="billing"
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // FR par défaut (LanguageProvider)
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Confirmation requise/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Pour modifier votre abonnement/i),
    ).toBeInTheDocument();
    // L'input password est identifié par son id (le label "Mot de passe"
    // existe en double avec le toggle Eye, donc on cible directement).
    const passwordInput = document.getElementById("reauth-password");
    expect(passwordInput).not.toBeNull();
    expect(passwordInput?.getAttribute("type")).toBe("password");
    expect(
      screen.getByRole("button", { name: /Confirmer/i }),
    ).toBeInTheDocument();
    // Annuler appears multiple times (X button aria-label + footer button)
    const cancelButtons = screen.getAllByRole("button", { name: /Annuler/i });
    expect(cancelButtons.length).toBeGreaterThanOrEqual(1);
  });
});

describe("PasswordReauthModal - Submit success", () => {
  it("calls onSuccess with reauth_token when API returns 200", async () => {
    const onSuccess = vi.fn();
    const onCancel = vi.fn();
    requestReauthMock.mockResolvedValueOnce({
      reauth_token: "ru_abcdef123",
      expires_in: 300,
    });

    const user = userEvent.setup();
    renderWithProviders(
      <PasswordReauthModal
        open={true}
        audience="delete"
        onSuccess={onSuccess}
        onCancel={onCancel}
      />,
    );

    const input = document.getElementById(
      "reauth-password",
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    await user.type(input, "hunter2");

    const submitBtn = screen.getByRole("button", { name: /Confirmer/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith("ru_abcdef123");
    });

    // API called with correct args
    expect(requestReauthMock).toHaveBeenCalledWith("hunter2", "delete");
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe("PasswordReauthModal - 401 error display", () => {
  it("shows 'Mot de passe incorrect' on 401 and does NOT call onSuccess", async () => {
    const onSuccess = vi.fn();
    const onCancel = vi.fn();

    // Import the real ApiError and throw it
    const { ApiError } = await import("../../../services/api");
    requestReauthMock.mockRejectedValueOnce(
      new ApiError("Invalid password", 401),
    );

    const user = userEvent.setup();
    renderWithProviders(
      <PasswordReauthModal
        open={true}
        audience="change-password"
        onSuccess={onSuccess}
        onCancel={onCancel}
      />,
    );

    const input = document.getElementById(
      "reauth-password",
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    await user.type(input, "wrongpassword");
    await user.click(screen.getByRole("button", { name: /Confirmer/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Mot de passe incorrect/i),
      ).toBeInTheDocument();
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe("PasswordReauthModal - Cancel", () => {
  it("calls onCancel when footer 'Annuler' button clicked", async () => {
    const onSuccess = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <PasswordReauthModal
        open={true}
        audience="billing"
        onSuccess={onSuccess}
        onCancel={onCancel}
      />,
    );

    // Le bouton "Annuler" du footer (le X a aria-label "Annuler" aussi).
    // On prend celui dans le form (footer) qui est un <button type="button">
    // avec text content "Annuler".
    const cancelButtons = screen.getAllByRole("button", { name: /Annuler/i });
    // Le footer button contient le texte "Annuler" visible (pas que aria-label).
    const footerCancel = cancelButtons.find(
      (b) => b.textContent?.trim() === "Annuler",
    );
    expect(footerCancel).toBeTruthy();

    await user.click(footerCancel!);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe("PasswordReauthModal - Submit disabled when password empty", () => {
  it("disables Confirmer button when input is empty", () => {
    renderWithProviders(
      <PasswordReauthModal
        open={true}
        audience="billing"
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const submitBtn = screen.getByRole("button", {
      name: /Confirmer/i,
    }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });
});
