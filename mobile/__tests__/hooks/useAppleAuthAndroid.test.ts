/**
 * Tests pour useAppleAuthAndroid (hook flow OAuth web Apple sur Android).
 *
 * Couvre :
 *  - Happy path : openAuthSessionAsync resolve avec deeplink → parse OK.
 *  - User cancel (Custom Tab ferme).
 *  - Apple renvoie error=user_cancelled_authorize dans le deeplink.
 *  - id_token manquant → error.
 *  - state mismatch (CSRF) → error.
 *  - User JSON Apple parse correctement (first sign-in).
 *  - buildAppleAuthorizeUrl assemble les bons params.
 */
import { renderHook, act } from "@testing-library/react-native";
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";
import {
  useAppleAuthAndroid,
  buildAppleAuthorizeUrl,
} from "../../src/hooks/useAppleAuthAndroid";

describe("useAppleAuthAndroid", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to deterministic random bytes (0xAB → hex "ab" repeated)
    (Crypto.getRandomBytesAsync as jest.Mock).mockImplementation(
      (length: number) => Promise.resolve(new Uint8Array(length).fill(0xab)),
    );
  });

  describe("signInWithAppleAndroid — happy path", () => {
    test("returns success with identityToken + state", async () => {
      // state genere par le hook avec mock crypto = 64 chars 'ab' (32 bytes hex)
      const expectedState = "ab".repeat(32);
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({
        type: "success",
        url: `deepsight://auth/apple/callback?id_token=apple.jwt.token&code=auth_code&state=${expectedState}`,
      });

      const { result } = renderHook(() => useAppleAuthAndroid());

      let status: any;
      await act(async () => {
        status = await result.current.signInWithAppleAndroid();
      });

      expect(status.type).toBe("success");
      expect(status.result.identityToken).toBe("apple.jwt.token");
      expect(status.result.authorizationCode).toBe("auth_code");
      expect(status.result.state).toBe(expectedState);
    });

    test("parses Apple user JSON on first sign-in (email + fullName)", async () => {
      const expectedState = "ab".repeat(32);
      const appleUserJson = encodeURIComponent(
        JSON.stringify({
          name: { firstName: "Tim", lastName: "Cook" },
          email: "tim@privaterelay.appleid.com",
        }),
      );
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({
        type: "success",
        url: `deepsight://auth/apple/callback?id_token=jwt&state=${expectedState}&user=${appleUserJson}`,
      });

      const { result } = renderHook(() => useAppleAuthAndroid());

      let status: any;
      await act(async () => {
        status = await result.current.signInWithAppleAndroid();
      });

      expect(status.type).toBe("success");
      expect(status.result.email).toBe("tim@privaterelay.appleid.com");
      expect(status.result.fullName).toBe("Tim Cook");
    });

    test("returns null email/fullName on subsequent sign-in (no user param)", async () => {
      const expectedState = "ab".repeat(32);
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({
        type: "success",
        url: `deepsight://auth/apple/callback?id_token=jwt&state=${expectedState}`,
      });

      const { result } = renderHook(() => useAppleAuthAndroid());

      let status: any;
      await act(async () => {
        status = await result.current.signInWithAppleAndroid();
      });

      expect(status.type).toBe("success");
      expect(status.result.email).toBeNull();
      expect(status.result.fullName).toBeNull();
    });
  });

  describe("signInWithAppleAndroid — cancellation", () => {
    test("returns cancel when WebBrowser type=cancel", async () => {
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({
        type: "cancel",
      });

      const { result } = renderHook(() => useAppleAuthAndroid());

      let status: any;
      await act(async () => {
        status = await result.current.signInWithAppleAndroid();
      });

      expect(status.type).toBe("cancel");
    });

    test("returns cancel when WebBrowser type=dismiss", async () => {
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({
        type: "dismiss",
      });

      const { result } = renderHook(() => useAppleAuthAndroid());

      let status: any;
      await act(async () => {
        status = await result.current.signInWithAppleAndroid();
      });

      expect(status.type).toBe("cancel");
    });

    test("returns cancel when Apple deeplink has error=user_cancelled_authorize", async () => {
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({
        type: "success",
        url: "deepsight://auth/apple/callback?error=user_cancelled_authorize",
      });

      const { result } = renderHook(() => useAppleAuthAndroid());

      let status: any;
      await act(async () => {
        status = await result.current.signInWithAppleAndroid();
      });

      expect(status.type).toBe("cancel");
    });
  });

  describe("signInWithAppleAndroid — errors", () => {
    test("returns error when id_token missing from deeplink", async () => {
      const expectedState = "ab".repeat(32);
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({
        type: "success",
        url: `deepsight://auth/apple/callback?code=only_code&state=${expectedState}`,
      });

      const { result } = renderHook(() => useAppleAuthAndroid());

      let status: any;
      await act(async () => {
        status = await result.current.signInWithAppleAndroid();
      });

      expect(status.type).toBe("error");
      expect(status.message).toMatch(/id_token/);
    });

    test("returns error on state mismatch (CSRF protection)", async () => {
      // Le hook genere state = "ab"*32 mais Apple renvoie un state different
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({
        type: "success",
        url: "deepsight://auth/apple/callback?id_token=jwt&state=DIFFERENT_STATE",
      });

      const { result } = renderHook(() => useAppleAuthAndroid());

      let status: any;
      await act(async () => {
        status = await result.current.signInWithAppleAndroid();
      });

      expect(status.type).toBe("error");
      expect(status.message).toMatch(/CSRF|state/i);
    });

    test("returns error when Apple sends generic error in deeplink", async () => {
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValueOnce({
        type: "success",
        url: "deepsight://auth/apple/callback?error=server_error",
      });

      const { result } = renderHook(() => useAppleAuthAndroid());

      let status: any;
      await act(async () => {
        status = await result.current.signInWithAppleAndroid();
      });

      expect(status.type).toBe("error");
      expect(status.message).toMatch(/server_error/);
    });

    test("returns error when WebBrowser throws", async () => {
      (WebBrowser.openAuthSessionAsync as jest.Mock).mockRejectedValueOnce(
        new Error("WebBrowser unavailable"),
      );

      const { result } = renderHook(() => useAppleAuthAndroid());

      let status: any;
      await act(async () => {
        status = await result.current.signInWithAppleAndroid();
      });

      expect(status.type).toBe("error");
      expect(status.message).toMatch(/WebBrowser unavailable/);
    });
  });

  describe("buildAppleAuthorizeUrl", () => {
    test("builds URL with all required Apple OAuth params", () => {
      const url = buildAppleAuthorizeUrl({
        state: "test_state",
        nonce: "test_nonce",
      });

      expect(url).toContain("https://appleid.apple.com/auth/authorize");
      expect(url).toContain("response_type=code+id_token");
      expect(url).toContain("response_mode=form_post");
      expect(url).toContain("client_id=com.deepsightsynthesis.signin");
      expect(url).toContain(
        encodeURIComponent(
          "https://api.deepsightsynthesis.com/api/auth/apple/callback/native",
        ),
      );
      expect(url).toContain("scope=name+email");
      expect(url).toContain("state=test_state");
      expect(url).toContain("nonce=test_nonce");
    });
  });
});
