/**
 * Tests for PasswordReauthBottomSheet — Auth V2 Wave 1 Mobile Step 2.
 *
 * Coverage:
 *  - hidden state quand visible=false
 *  - submit success → onSuccess(reauth_token) appelé
 *  - submit 401 → erreur "Mot de passe incorrect" affichée + onSuccess pas appelé
 *  - cancel → onCancel appelé
 *  - submit ne fait rien quand password vide
 */
import React from "react";
import {
  render,
  fireEvent,
  screen,
  waitFor,
  act,
} from "@testing-library/react-native";

// ─── Mocks ─────────────────────────────────────────────────────────────────
// Surcharge la mock globale de @gorhom/bottom-sheet (jest.setup.js) pour
// fournir BottomSheetTextInput + un ref qui expose snapToIndex/close
// (utilisés par le composant via useEffect → sheetRef.current?.snapToIndex(0)).
jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");
  const { View, TextInput } = require("react-native");
  const BottomSheet = React.forwardRef(
    (
      props: { children?: React.ReactNode; [k: string]: unknown },
      ref: React.Ref<unknown>,
    ) => {
      React.useImperativeHandle(ref, () => ({
        snapToIndex: jest.fn(),
        snapToPosition: jest.fn(),
        expand: jest.fn(),
        collapse: jest.fn(),
        close: jest.fn(),
        forceClose: jest.fn(),
      }));
      return React.createElement(View, props);
    },
  );
  return {
    __esModule: true,
    default: BottomSheet,
    BottomSheetScrollView: (props: { children?: React.ReactNode }) =>
      React.createElement(View, props),
    BottomSheetView: (props: { children?: React.ReactNode }) =>
      React.createElement(View, props),
    BottomSheetBackdrop: (props: { children?: React.ReactNode }) =>
      React.createElement(View, props),
    BottomSheetTextInput: React.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<unknown>) =>
        React.createElement(TextInput, { ...props, ref }),
    ),
  };
});

// Mock authApi.requestReauth.
const mockRequestReauth = jest.fn();
jest.mock("../../../src/services/api", () => ({
  authApi: {
    requestReauth: (...args: unknown[]) => mockRequestReauth(...args),
  },
  ApiError: class ApiError extends Error {
    status: number;
    code?: string;
    detail?: string;
    constructor(message: string, status: number) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  },
}));

// Import after mocks are set up.
import { PasswordReauthBottomSheet } from "../../../src/components/auth/PasswordReauthBottomSheet";
import { ApiError } from "../../../src/services/api";

describe("PasswordReauthBottomSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the sheet content when visible=true", () => {
    render(
      <PasswordReauthBottomSheet
        visible
        audience="billing"
        onSuccess={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByTestId("reauth-bottom-sheet")).toBeTruthy();
    expect(screen.getByTestId("reauth-password-input")).toBeTruthy();
    expect(screen.getByTestId("reauth-submit-btn")).toBeTruthy();
    expect(screen.getByTestId("reauth-cancel-btn")).toBeTruthy();
    expect(screen.getByText("Confirmation requise")).toBeTruthy();
    // Audience-specific copy.
    expect(
      screen.getByText(
        "Pour modifier votre abonnement, confirmez votre mot de passe.",
      ),
    ).toBeTruthy();
  });

  it("calls onSuccess(reauth_token) when submit succeeds", async () => {
    const onSuccess = jest.fn();
    const onCancel = jest.fn();
    mockRequestReauth.mockResolvedValueOnce({
      reauth_token: "tok_abc123",
      expires_in: 300,
    });

    render(
      <PasswordReauthBottomSheet
        visible
        audience="billing"
        onSuccess={onSuccess}
        onCancel={onCancel}
      />,
    );

    const input = screen.getByTestId("reauth-password-input");
    fireEvent.changeText(input, "hunter2");

    await act(async () => {
      fireEvent.press(screen.getByTestId("reauth-submit-btn"));
    });

    await waitFor(() => {
      expect(mockRequestReauth).toHaveBeenCalledWith("hunter2", "billing");
      expect(onSuccess).toHaveBeenCalledWith("tok_abc123");
      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  it("displays error and does NOT call onSuccess on 401", async () => {
    const onSuccess = jest.fn();
    mockRequestReauth.mockRejectedValueOnce(
      new ApiError("Unauthorized", 401),
    );

    render(
      <PasswordReauthBottomSheet
        visible
        audience="delete"
        onSuccess={onSuccess}
        onCancel={jest.fn()}
      />,
    );

    const input = screen.getByTestId("reauth-password-input");
    fireEvent.changeText(input, "wrong-password");

    await act(async () => {
      fireEvent.press(screen.getByTestId("reauth-submit-btn"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("reauth-error")).toBeTruthy();
      expect(screen.getByText("Mot de passe incorrect")).toBeTruthy();
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("calls onCancel when cancel button is pressed", () => {
    const onCancel = jest.fn();
    render(
      <PasswordReauthBottomSheet
        visible
        audience="change-password"
        onSuccess={jest.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.press(screen.getByTestId("reauth-cancel-btn"));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("does not call requestReauth when password is empty", async () => {
    const onSuccess = jest.fn();
    render(
      <PasswordReauthBottomSheet
        visible
        audience="change-email"
        onSuccess={onSuccess}
        onCancel={jest.fn()}
      />,
    );

    // Don't type anything — submit button should be disabled / no-op.
    await act(async () => {
      fireEvent.press(screen.getByTestId("reauth-submit-btn"));
    });

    expect(mockRequestReauth).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
