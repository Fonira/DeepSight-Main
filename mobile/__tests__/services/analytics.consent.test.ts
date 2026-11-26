/**
 * RGPD — analytics mobile en opt-in strict.
 * Aucun événement, aucune session stockée, aucun envoi réseau sans accord.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const CONSENT_KEY = "deepsight_analytics_consent";
const QUEUE_KEY = "deepsight_analytics_queue";
const SESSION_KEY = "deepsight_analytics_session";
const LEGACY_OPT_OUT_KEY = "deepsight_analytics_opt_out";

type AnalyticsModule = typeof import("../../src/services/analytics");

const loadFreshEngine = (): AnalyticsModule["analytics"] => {
  let engine: AnalyticsModule["analytics"] | undefined;
  jest.isolateModules(() => {
    engine = (require("../../src/services/analytics") as AnalyticsModule)
      .analytics;
  });
  if (!engine) throw new Error("analytics engine not loaded");
  return engine;
};

describe("analytics — consentement RGPD", () => {
  const fetchMock = jest.fn();

  beforeEach(async () => {
    jest.useFakeTimers();
    await AsyncStorage.clear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("ne collecte rien par défaut (aucun consentement)", async () => {
    const analytics = loadFreshEngine();
    await analytics.initialize();

    analytics.track("app_opened");
    await analytics.flush();

    expect(await analytics.hasConsent()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(SESSION_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(QUEUE_KEY)).toBeNull();
  });

  it("l'ancien opt-out à 'false' ne vaut pas consentement et est purgé", async () => {
    await AsyncStorage.setItem(LEGACY_OPT_OUT_KEY, "false");
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([{ name: "x" }]));

    const analytics = loadFreshEngine();
    await analytics.initialize();

    expect(await analytics.hasConsent()).toBe(false);
    expect(await AsyncStorage.getItem(LEGACY_OPT_OUT_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(QUEUE_KEY)).toBeNull();
  });

  it("collecte après optIn() puis purge tout après optOut()", async () => {
    const analytics = loadFreshEngine();
    await analytics.initialize();

    await analytics.optIn();
    expect(await AsyncStorage.getItem(CONSENT_KEY)).toBe("true");
    expect(await AsyncStorage.getItem(SESSION_KEY)).not.toBeNull();

    analytics.track("app_opened");
    await analytics.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await analytics.optOut();
    expect(await AsyncStorage.getItem(CONSENT_KEY)).toBe("false");
    expect(await AsyncStorage.getItem(SESSION_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(QUEUE_KEY)).toBeNull();

    analytics.track("app_opened");
    await analytics.flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("redémarre automatiquement au lancement si le consentement existe", async () => {
    await AsyncStorage.setItem(CONSENT_KEY, "true");

    const analytics = loadFreshEngine();
    await analytics.initialize();
    analytics.track("app_opened");
    await analytics.flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
