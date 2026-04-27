/** @jest-environment jsdom */
//
// Tests — `GET_VOICE_BUTTON_STATE` handler in background.ts
//
// L'handler doit :
//  1. Renvoyer success:false si pas authentifié (pas de token).
//  2. Renvoyer success:false si pas d'user stocké.
//  3. Renvoyer { success:true, state:{ plan, trialUsed:false, monthlyMinutesUsed:0 } }
//     avec mapping plan : expert→expert, pro→pro, sinon free.

import { handleMessage } from "../../src/background";
import { resetChromeMocks, seedLocalStorage } from "../setup/chrome-api-mock";

describe("GET_VOICE_BUTTON_STATE handler", () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  it("returns success:false when no access token (unauthenticated)", async () => {
    const res = await handleMessage({
      action: "GET_VOICE_BUTTON_STATE",
    });
    expect(res.success).toBe(false);
    expect(res.state).toBeUndefined();
  });

  it("returns success:false when no stored user", async () => {
    seedLocalStorage({ accessToken: "valid-token" });
    const res = await handleMessage({
      action: "GET_VOICE_BUTTON_STATE",
    });
    expect(res.success).toBe(false);
    expect(res.state).toBeUndefined();
  });

  it("maps user.plan='expert' to voice plan 'expert'", async () => {
    seedLocalStorage({
      accessToken: "tok",
      user: {
        id: 1,
        email: "x@y.z",
        username: "x",
        plan: "expert",
        credits: 0,
        credits_monthly: 0,
      },
    });
    const res = await handleMessage({
      action: "GET_VOICE_BUTTON_STATE",
    });
    expect(res.success).toBe(true);
    expect(res.state).toEqual({
      plan: "expert",
      trialUsed: false,
      monthlyMinutesUsed: 0,
    });
  });

  it("maps user.plan='pro' to voice plan 'pro'", async () => {
    seedLocalStorage({
      accessToken: "tok",
      user: {
        id: 1,
        email: "x@y.z",
        username: "x",
        plan: "pro",
        credits: 0,
        credits_monthly: 0,
      },
    });
    const res = await handleMessage({
      action: "GET_VOICE_BUTTON_STATE",
    });
    expect(res.success).toBe(true);
    expect(res.state?.plan).toBe("pro");
  });

  it("maps user.plan='free' to voice plan 'free'", async () => {
    seedLocalStorage({
      accessToken: "tok",
      user: {
        id: 1,
        email: "x@y.z",
        username: "x",
        plan: "free",
        credits: 0,
        credits_monthly: 0,
      },
    });
    const res = await handleMessage({
      action: "GET_VOICE_BUTTON_STATE",
    });
    expect(res.success).toBe(true);
    expect(res.state?.plan).toBe("free");
  });

  it("maps unsupported plans (starter/student/team) to voice plan 'free'", async () => {
    for (const plan of ["starter", "student", "team"] as const) {
      seedLocalStorage({
        accessToken: "tok",
        user: {
          id: 1,
          email: "x@y.z",
          username: "x",
          plan,
          credits: 0,
          credits_monthly: 0,
        },
      });
      const res = await handleMessage({
        action: "GET_VOICE_BUTTON_STATE",
      });
      expect(res.success).toBe(true);
      expect(res.state?.plan).toBe("free");
    }
  });

  // [I4] : Backend expose voice_quota dans /api/billing/my-plan.
  // L'handler tente fetchPlan() best-effort pour le propager dans state.
  it("[I4] propagates voice_quota.trial_used from /api/billing/my-plan", async () => {
    seedLocalStorage({
      accessToken: "tok",
      user: {
        id: 1,
        email: "x@y.z",
        username: "x",
        plan: "free",
        credits: 0,
        credits_monthly: 0,
      },
    });
    // Mock global fetch pour /api/billing/my-plan.
    const origFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          plan: "free",
          plan_name: "Gratuit",
          plan_id: "free",
          monthly_analyses: 5,
          analyses_this_month: 0,
          credits: 0,
          credits_monthly: 0,
          features: {},
          voice_quota: { trial_used: true, monthly_minutes_used: 3 },
        }),
    }) as unknown as typeof global.fetch;

    const res = await handleMessage({
      action: "GET_VOICE_BUTTON_STATE",
    });

    expect(res.success).toBe(true);
    expect(res.state?.trialUsed).toBe(true);
    expect(res.state?.monthlyMinutesUsed).toBe(3);

    global.fetch = origFetch;
  });

  it("[I4] falls back to (false, 0) if fetchPlan fails", async () => {
    seedLocalStorage({
      accessToken: "tok",
      user: {
        id: 1,
        email: "x@y.z",
        username: "x",
        plan: "expert",
        credits: 0,
        credits_monthly: 0,
      },
    });
    const origFetch = global.fetch;
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error("network down")) as unknown as typeof global.fetch;

    const res = await handleMessage({
      action: "GET_VOICE_BUTTON_STATE",
    });

    expect(res.success).toBe(true);
    expect(res.state?.trialUsed).toBe(false);
    expect(res.state?.monthlyMinutesUsed).toBe(0);

    global.fetch = origFetch;
  });
});
