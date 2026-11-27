/** @jest-environment jsdom */
/**
 * Tests — authSyncMain (MAIN world sur www.deepsightsynthesis.com).
 *
 * Bug couvert : le script lisait localStorage `accessToken` / `refreshToken`
 * / `user`, alors que le site écrit `access_token` / `refresh_token` et
 * `cached_user` = {user, timestamp} → aucune synchronisation web → extension.
 */

type Posted = {
  type: string;
  payload: {
    accessToken: string;
    refreshToken: string;
    user: Record<string, unknown>;
  };
};

describe("authSyncMain", () => {
  let postSpy: jest.SpyInstance;

  function loadScript(): void {
    jest.isolateModules(() => {
      require("../../src/authSyncMain/index");
    });
  }

  function posted(): Posted[] {
    return postSpy.mock.calls
      .map(([message]) => message as Posted)
      .filter((m) => m?.type === "DEEPSIGHT_AUTH_SUCCESS");
  }

  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
    postSpy = jest.spyOn(window, "postMessage").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    postSpy.mockRestore();
  });

  it("forwards the website session stored under the current keys", () => {
    localStorage.setItem("access_token", "web-access");
    localStorage.setItem("refresh_token", "web-refresh");
    localStorage.setItem(
      "cached_user",
      JSON.stringify({ user: { id: 7, plan: "pro" }, timestamp: Date.now() }),
    );

    loadScript();
    jest.advanceTimersByTime(2000);

    expect(posted()).toEqual([
      {
        type: "DEEPSIGHT_AUTH_SUCCESS",
        payload: {
          accessToken: "web-access",
          refreshToken: "web-refresh",
          user: { id: 7, plan: "pro" },
        },
      },
    ]);
    expect(postSpy).toHaveBeenCalledWith(
      expect.anything(),
      window.location.origin,
    );
  });

  it("picks up a login made after page load (SPA) and does not repeat itself", () => {
    loadScript();
    jest.advanceTimersByTime(2000);
    expect(posted()).toHaveLength(0);

    localStorage.setItem("access_token", "token-1");
    localStorage.setItem("refresh_token", "refresh-1");
    localStorage.setItem(
      "cached_user",
      JSON.stringify({ user: { id: 1, plan: "free" }, timestamp: 1 }),
    );
    jest.advanceTimersByTime(5000);
    expect(posted()).toHaveLength(1);

    jest.advanceTimersByTime(15000);
    expect(posted()).toHaveLength(1);

    localStorage.setItem("access_token", "token-2");
    jest.advanceTimersByTime(5000);
    expect(posted()).toHaveLength(2);
    expect(posted()[1].payload.accessToken).toBe("token-2");
  });

  it("still accepts the legacy key names", () => {
    localStorage.setItem("accessToken", "legacy-access");
    localStorage.setItem("refreshToken", "legacy-refresh");
    localStorage.setItem("user", JSON.stringify({ id: 3, plan: "free" }));

    loadScript();
    jest.advanceTimersByTime(2000);

    expect(posted()[0].payload).toEqual({
      accessToken: "legacy-access",
      refreshToken: "legacy-refresh",
      user: { id: 3, plan: "free" },
    });
  });

  it("sends nothing without a complete session", () => {
    localStorage.setItem("access_token", "only-access");
    loadScript();
    jest.advanceTimersByTime(10000);
    expect(posted()).toHaveLength(0);
  });
});
