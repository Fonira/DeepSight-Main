/** @jest-environment jsdom */
//
// Tests — RevokeAllDevicesButton
// Fichier source : src/sidepanel/components/RevokeAllDevicesButton.tsx
//
// Couvre :
//  - rendu de la card + bouton "Sécurité"
//  - confirm() rejeté → aucun appel SW
//  - confirm() accepté + success → message ✅ inline + onSuccess()
//  - confirm() accepté + error → message rouge inline

import React from "react";
import { act, render, screen } from "@testing-library/react";
import { RevokeAllDevicesButton } from "../../../src/sidepanel/components/RevokeAllDevicesButton";

describe("RevokeAllDevicesButton", () => {
  let confirmSpy: jest.SpyInstance<boolean, [message?: string | undefined]>;

  beforeEach(() => {
    chrome.runtime.sendMessage = jest
      .fn()
      .mockResolvedValue(undefined) as unknown as typeof chrome.runtime.sendMessage;
    // Par défaut on accepte la confirmation. Override par test.
    confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    confirmSpy.mockRestore();
  });

  it("renders the security card with revoke button", () => {
    render(<RevokeAllDevicesButton />);
    const btn = screen.getByTestId("revoke-all-devices-btn");
    expect(btn).not.toBeNull();
    expect(btn.textContent).toMatch(/Déconnecter tous les autres appareils/i);
  });

  it("does NOT call SW when user cancels the confirm dialog", async () => {
    confirmSpy.mockReturnValue(false);
    render(<RevokeAllDevicesButton />);
    const btn = screen.getByTestId("revoke-all-devices-btn");
    await act(async () => {
      btn.click();
    });
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it("sends REVOKE_ALL_OTHER_SESSIONS action on click + confirm", async () => {
    (
      chrome.runtime.sendMessage as unknown as jest.Mock
    ).mockResolvedValueOnce({
      success: true,
      result: { success: true, message: "✅ 3 sessions révoquées" },
    });
    const onSuccess = jest.fn();
    render(<RevokeAllDevicesButton onSuccess={onSuccess} />);
    const btn = screen.getByTestId("revoke-all-devices-btn");
    await act(async () => {
      btn.click();
    });
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: "REVOKE_ALL_OTHER_SESSIONS",
    });
    // Success message inline + onSuccess called.
    expect(
      screen.getByTestId("revoke-all-devices-success").textContent,
    ).toMatch(/3 sessions/);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it("displays an error message when SW returns success:false", async () => {
    (
      chrome.runtime.sendMessage as unknown as jest.Mock
    ).mockResolvedValueOnce({
      success: false,
      error: "Internal Server Error",
    });
    render(<RevokeAllDevicesButton />);
    const btn = screen.getByTestId("revoke-all-devices-btn");
    await act(async () => {
      btn.click();
    });
    const errorEl = screen.getByTestId("revoke-all-devices-error");
    expect(errorEl.textContent).toMatch(/Internal Server Error/);
  });

  it("maps SESSION_EXPIRED error to friendly French copy", async () => {
    (
      chrome.runtime.sendMessage as unknown as jest.Mock
    ).mockResolvedValueOnce({
      success: false,
      error: "SESSION_EXPIRED",
    });
    render(<RevokeAllDevicesButton />);
    const btn = screen.getByTestId("revoke-all-devices-btn");
    await act(async () => {
      btn.click();
    });
    expect(
      screen.getByTestId("revoke-all-devices-error").textContent,
    ).toMatch(/Session expirée/);
  });
});
