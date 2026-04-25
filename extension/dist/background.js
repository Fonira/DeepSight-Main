(() => {
  var e = {
      815(e, r) {
        var s, t;
        ("undefined" != typeof globalThis
          ? globalThis
          : "undefined" != typeof self && self,
          (s = function (e) {
            "use strict";
            if (
              !(
                globalThis.chrome &&
                globalThis.chrome.runtime &&
                globalThis.chrome.runtime.id
              )
            )
              throw new Error(
                "This script should only be loaded in a browser extension.",
              );
            if (
              globalThis.browser &&
              globalThis.browser.runtime &&
              globalThis.browser.runtime.id
            )
              e.exports = globalThis.browser;
            else {
              const r =
                  "The message port closed before a response was received.",
                s = (e) => {
                  const s = {
                    alarms: {
                      clear: { minArgs: 0, maxArgs: 1 },
                      clearAll: { minArgs: 0, maxArgs: 0 },
                      get: { minArgs: 0, maxArgs: 1 },
                      getAll: { minArgs: 0, maxArgs: 0 },
                    },
                    bookmarks: {
                      create: { minArgs: 1, maxArgs: 1 },
                      get: { minArgs: 1, maxArgs: 1 },
                      getChildren: { minArgs: 1, maxArgs: 1 },
                      getRecent: { minArgs: 1, maxArgs: 1 },
                      getSubTree: { minArgs: 1, maxArgs: 1 },
                      getTree: { minArgs: 0, maxArgs: 0 },
                      move: { minArgs: 2, maxArgs: 2 },
                      remove: { minArgs: 1, maxArgs: 1 },
                      removeTree: { minArgs: 1, maxArgs: 1 },
                      search: { minArgs: 1, maxArgs: 1 },
                      update: { minArgs: 2, maxArgs: 2 },
                    },
                    browserAction: {
                      disable: {
                        minArgs: 0,
                        maxArgs: 1,
                        fallbackToNoCallback: !0,
                      },
                      enable: {
                        minArgs: 0,
                        maxArgs: 1,
                        fallbackToNoCallback: !0,
                      },
                      getBadgeBackgroundColor: { minArgs: 1, maxArgs: 1 },
                      getBadgeText: { minArgs: 1, maxArgs: 1 },
                      getPopup: { minArgs: 1, maxArgs: 1 },
                      getTitle: { minArgs: 1, maxArgs: 1 },
                      openPopup: { minArgs: 0, maxArgs: 0 },
                      setBadgeBackgroundColor: {
                        minArgs: 1,
                        maxArgs: 1,
                        fallbackToNoCallback: !0,
                      },
                      setBadgeText: {
                        minArgs: 1,
                        maxArgs: 1,
                        fallbackToNoCallback: !0,
                      },
                      setIcon: { minArgs: 1, maxArgs: 1 },
                      setPopup: {
                        minArgs: 1,
                        maxArgs: 1,
                        fallbackToNoCallback: !0,
                      },
                      setTitle: {
                        minArgs: 1,
                        maxArgs: 1,
                        fallbackToNoCallback: !0,
                      },
                    },
                    browsingData: {
                      remove: { minArgs: 2, maxArgs: 2 },
                      removeCache: { minArgs: 1, maxArgs: 1 },
                      removeCookies: { minArgs: 1, maxArgs: 1 },
                      removeDownloads: { minArgs: 1, maxArgs: 1 },
                      removeFormData: { minArgs: 1, maxArgs: 1 },
                      removeHistory: { minArgs: 1, maxArgs: 1 },
                      removeLocalStorage: { minArgs: 1, maxArgs: 1 },
                      removePasswords: { minArgs: 1, maxArgs: 1 },
                      removePluginData: { minArgs: 1, maxArgs: 1 },
                      settings: { minArgs: 0, maxArgs: 0 },
                    },
                    commands: { getAll: { minArgs: 0, maxArgs: 0 } },
                    contextMenus: {
                      remove: { minArgs: 1, maxArgs: 1 },
                      removeAll: { minArgs: 0, maxArgs: 0 },
                      update: { minArgs: 2, maxArgs: 2 },
                    },
                    cookies: {
                      get: { minArgs: 1, maxArgs: 1 },
                      getAll: { minArgs: 1, maxArgs: 1 },
                      getAllCookieStores: { minArgs: 0, maxArgs: 0 },
                      remove: { minArgs: 1, maxArgs: 1 },
                      set: { minArgs: 1, maxArgs: 1 },
                    },
                    devtools: {
                      inspectedWindow: {
                        eval: { minArgs: 1, maxArgs: 2, singleCallbackArg: !1 },
                      },
                      panels: {
                        create: {
                          minArgs: 3,
                          maxArgs: 3,
                          singleCallbackArg: !0,
                        },
                        elements: {
                          createSidebarPane: { minArgs: 1, maxArgs: 1 },
                        },
                      },
                    },
                    downloads: {
                      cancel: { minArgs: 1, maxArgs: 1 },
                      download: { minArgs: 1, maxArgs: 1 },
                      erase: { minArgs: 1, maxArgs: 1 },
                      getFileIcon: { minArgs: 1, maxArgs: 2 },
                      open: {
                        minArgs: 1,
                        maxArgs: 1,
                        fallbackToNoCallback: !0,
                      },
                      pause: { minArgs: 1, maxArgs: 1 },
                      removeFile: { minArgs: 1, maxArgs: 1 },
                      resume: { minArgs: 1, maxArgs: 1 },
                      search: { minArgs: 1, maxArgs: 1 },
                      show: {
                        minArgs: 1,
                        maxArgs: 1,
                        fallbackToNoCallback: !0,
                      },
                    },
                    extension: {
                      isAllowedFileSchemeAccess: { minArgs: 0, maxArgs: 0 },
                      isAllowedIncognitoAccess: { minArgs: 0, maxArgs: 0 },
                    },
                    history: {
                      addUrl: { minArgs: 1, maxArgs: 1 },
                      deleteAll: { minArgs: 0, maxArgs: 0 },
                      deleteRange: { minArgs: 1, maxArgs: 1 },
                      deleteUrl: { minArgs: 1, maxArgs: 1 },
                      getVisits: { minArgs: 1, maxArgs: 1 },
                      search: { minArgs: 1, maxArgs: 1 },
                    },
                    i18n: {
                      detectLanguage: { minArgs: 1, maxArgs: 1 },
                      getAcceptLanguages: { minArgs: 0, maxArgs: 0 },
                    },
                    identity: { launchWebAuthFlow: { minArgs: 1, maxArgs: 1 } },
                    idle: { queryState: { minArgs: 1, maxArgs: 1 } },
                    management: {
                      get: { minArgs: 1, maxArgs: 1 },
                      getAll: { minArgs: 0, maxArgs: 0 },
                      getSelf: { minArgs: 0, maxArgs: 0 },
                      setEnabled: { minArgs: 2, maxArgs: 2 },
                      uninstallSelf: { minArgs: 0, maxArgs: 1 },
                    },
                    notifications: {
                      clear: { minArgs: 1, maxArgs: 1 },
                      create: { minArgs: 1, maxArgs: 2 },
                      getAll: { minArgs: 0, maxArgs: 0 },
                      getPermissionLevel: { minArgs: 0, maxArgs: 0 },
                      update: { minArgs: 2, maxArgs: 2 },
                    },
                    pageAction: {
                      getPopup: { minArgs: 1, maxArgs: 1 },
                      getTitle: { minArgs: 1, maxArgs: 1 },
                      hide: {
                        minArgs: 1,
                        maxArgs: 1,
                        fallbackToNoCallback: !0,
                      },
                      setIcon: { minArgs: 1, maxArgs: 1 },
                      setPopup: {
                        minArgs: 1,
                        maxArgs: 1,
                        fallbackToNoCallback: !0,
                      },
                      setTitle: {
                        minArgs: 1,
                        maxArgs: 1,
                        fallbackToNoCallback: !0,
                      },
                      show: {
                        minArgs: 1,
                        maxArgs: 1,
                        fallbackToNoCallback: !0,
                      },
                    },
                    permissions: {
                      contains: { minArgs: 1, maxArgs: 1 },
                      getAll: { minArgs: 0, maxArgs: 0 },
                      remove: { minArgs: 1, maxArgs: 1 },
                      request: { minArgs: 1, maxArgs: 1 },
                    },
                    runtime: {
                      getBackgroundPage: { minArgs: 0, maxArgs: 0 },
                      getPlatformInfo: { minArgs: 0, maxArgs: 0 },
                      openOptionsPage: { minArgs: 0, maxArgs: 0 },
                      requestUpdateCheck: { minArgs: 0, maxArgs: 0 },
                      sendMessage: { minArgs: 1, maxArgs: 3 },
                      sendNativeMessage: { minArgs: 2, maxArgs: 2 },
                      setUninstallURL: { minArgs: 1, maxArgs: 1 },
                    },
                    sessions: {
                      getDevices: { minArgs: 0, maxArgs: 1 },
                      getRecentlyClosed: { minArgs: 0, maxArgs: 1 },
                      restore: { minArgs: 0, maxArgs: 1 },
                    },
                    storage: {
                      local: {
                        clear: { minArgs: 0, maxArgs: 0 },
                        get: { minArgs: 0, maxArgs: 1 },
                        getBytesInUse: { minArgs: 0, maxArgs: 1 },
                        remove: { minArgs: 1, maxArgs: 1 },
                        set: { minArgs: 1, maxArgs: 1 },
                      },
                      managed: {
                        get: { minArgs: 0, maxArgs: 1 },
                        getBytesInUse: { minArgs: 0, maxArgs: 1 },
                      },
                      sync: {
                        clear: { minArgs: 0, maxArgs: 0 },
                        get: { minArgs: 0, maxArgs: 1 },
                        getBytesInUse: { minArgs: 0, maxArgs: 1 },
                        remove: { minArgs: 1, maxArgs: 1 },
                        set: { minArgs: 1, maxArgs: 1 },
                      },
                    },
                    tabs: {
                      captureVisibleTab: { minArgs: 0, maxArgs: 2 },
                      create: { minArgs: 1, maxArgs: 1 },
                      detectLanguage: { minArgs: 0, maxArgs: 1 },
                      discard: { minArgs: 0, maxArgs: 1 },
                      duplicate: { minArgs: 1, maxArgs: 1 },
                      executeScript: { minArgs: 1, maxArgs: 2 },
                      get: { minArgs: 1, maxArgs: 1 },
                      getCurrent: { minArgs: 0, maxArgs: 0 },
                      getZoom: { minArgs: 0, maxArgs: 1 },
                      getZoomSettings: { minArgs: 0, maxArgs: 1 },
                      goBack: { minArgs: 0, maxArgs: 1 },
                      goForward: { minArgs: 0, maxArgs: 1 },
                      highlight: { minArgs: 1, maxArgs: 1 },
                      insertCSS: { minArgs: 1, maxArgs: 2 },
                      move: { minArgs: 2, maxArgs: 2 },
                      query: { minArgs: 1, maxArgs: 1 },
                      reload: { minArgs: 0, maxArgs: 2 },
                      remove: { minArgs: 1, maxArgs: 1 },
                      removeCSS: { minArgs: 1, maxArgs: 2 },
                      sendMessage: { minArgs: 2, maxArgs: 3 },
                      setZoom: { minArgs: 1, maxArgs: 2 },
                      setZoomSettings: { minArgs: 1, maxArgs: 2 },
                      update: { minArgs: 1, maxArgs: 2 },
                    },
                    topSites: { get: { minArgs: 0, maxArgs: 0 } },
                    webNavigation: {
                      getAllFrames: { minArgs: 1, maxArgs: 1 },
                      getFrame: { minArgs: 1, maxArgs: 1 },
                    },
                    webRequest: {
                      handlerBehaviorChanged: { minArgs: 0, maxArgs: 0 },
                    },
                    windows: {
                      create: { minArgs: 0, maxArgs: 1 },
                      get: { minArgs: 1, maxArgs: 2 },
                      getAll: { minArgs: 0, maxArgs: 1 },
                      getCurrent: { minArgs: 0, maxArgs: 1 },
                      getLastFocused: { minArgs: 0, maxArgs: 1 },
                      remove: { minArgs: 1, maxArgs: 1 },
                      update: { minArgs: 2, maxArgs: 2 },
                    },
                  };
                  if (0 === Object.keys(s).length)
                    throw new Error(
                      "api-metadata.json has not been included in browser-polyfill",
                    );
                  class t extends WeakMap {
                    constructor(e, r = void 0) {
                      (super(r), (this.createItem = e));
                    }
                    get(e) {
                      return (
                        this.has(e) || this.set(e, this.createItem(e)),
                        super.get(e)
                      );
                    }
                  }
                  const a =
                      (r, s) =>
                      (...t) => {
                        e.runtime.lastError
                          ? r.reject(new Error(e.runtime.lastError.message))
                          : s.singleCallbackArg ||
                              (t.length <= 1 && !1 !== s.singleCallbackArg)
                            ? r.resolve(t[0])
                            : r.resolve(t);
                      },
                    n = (e) => (1 == e ? "argument" : "arguments"),
                    o = (e, r, s) =>
                      new Proxy(r, { apply: (r, t, a) => s.call(t, e, ...a) });
                  let i = Function.call.bind(Object.prototype.hasOwnProperty);
                  const c = (e, r = {}, s = {}) => {
                      let t = Object.create(null),
                        g = {
                          has: (r, s) => s in e || s in t,
                          get(g, m, l) {
                            if (m in t) return t[m];
                            if (!(m in e)) return;
                            let A = e[m];
                            if ("function" == typeof A)
                              if ("function" == typeof r[m])
                                A = o(e, e[m], r[m]);
                              else if (i(s, m)) {
                                let r = ((e, r) =>
                                  function (s, ...t) {
                                    if (t.length < r.minArgs)
                                      throw new Error(
                                        `Expected at least ${r.minArgs} ${n(r.minArgs)} for ${e}(), got ${t.length}`,
                                      );
                                    if (t.length > r.maxArgs)
                                      throw new Error(
                                        `Expected at most ${r.maxArgs} ${n(r.maxArgs)} for ${e}(), got ${t.length}`,
                                      );
                                    return new Promise((n, o) => {
                                      if (r.fallbackToNoCallback)
                                        try {
                                          s[e](
                                            ...t,
                                            a({ resolve: n, reject: o }, r),
                                          );
                                        } catch (a) {
                                          (console.warn(
                                            `${e} API method doesn't seem to support the callback parameter, falling back to call it without a callback: `,
                                            a,
                                          ),
                                            s[e](...t),
                                            (r.fallbackToNoCallback = !1),
                                            (r.noCallback = !0),
                                            n());
                                        }
                                      else
                                        r.noCallback
                                          ? (s[e](...t), n())
                                          : s[e](
                                              ...t,
                                              a({ resolve: n, reject: o }, r),
                                            );
                                    });
                                  })(m, s[m]);
                                A = o(e, e[m], r);
                              } else A = A.bind(e);
                            else if (
                              "object" == typeof A &&
                              null !== A &&
                              (i(r, m) || i(s, m))
                            )
                              A = c(A, r[m], s[m]);
                            else {
                              if (!i(s, "*"))
                                return (
                                  Object.defineProperty(t, m, {
                                    configurable: !0,
                                    enumerable: !0,
                                    get: () => e[m],
                                    set(r) {
                                      e[m] = r;
                                    },
                                  }),
                                  A
                                );
                              A = c(A, r[m], s["*"]);
                            }
                            return ((t[m] = A), A);
                          },
                          set: (r, s, a, n) => (
                            s in t ? (t[s] = a) : (e[s] = a),
                            !0
                          ),
                          defineProperty: (e, r, s) =>
                            Reflect.defineProperty(t, r, s),
                          deleteProperty: (e, r) =>
                            Reflect.deleteProperty(t, r),
                        },
                        m = Object.create(e);
                      return new Proxy(m, g);
                    },
                    g = (e) => ({
                      addListener(r, s, ...t) {
                        r.addListener(e.get(s), ...t);
                      },
                      hasListener: (r, s) => r.hasListener(e.get(s)),
                      removeListener(r, s) {
                        r.removeListener(e.get(s));
                      },
                    }),
                    m = new t((e) =>
                      "function" != typeof e
                        ? e
                        : function (r) {
                            const s = c(
                              r,
                              {},
                              { getContent: { minArgs: 0, maxArgs: 0 } },
                            );
                            e(s);
                          },
                    ),
                    l = new t((e) =>
                      "function" != typeof e
                        ? e
                        : function (r, s, t) {
                            let a,
                              n,
                              o = !1,
                              i = new Promise((e) => {
                                a = function (r) {
                                  ((o = !0), e(r));
                                };
                              });
                            try {
                              n = e(r, s, a);
                            } catch (e) {
                              n = Promise.reject(e);
                            }
                            const c =
                              !0 !== n &&
                              (g = n) &&
                              "object" == typeof g &&
                              "function" == typeof g.then;
                            var g;
                            if (!0 !== n && !c && !o) return !1;
                            return (
                              (c ? n : i)
                                .then(
                                  (e) => {
                                    t(e);
                                  },
                                  (e) => {
                                    let r;
                                    ((r =
                                      e &&
                                      (e instanceof Error ||
                                        "string" == typeof e.message)
                                        ? e.message
                                        : "An unexpected error occurred"),
                                      t({
                                        __mozWebExtensionPolyfillReject__: !0,
                                        message: r,
                                      }));
                                  },
                                )
                                .catch((e) => {
                                  console.error(
                                    "Failed to send onMessage rejected reply",
                                    e,
                                  );
                                }),
                              !0
                            );
                          },
                    ),
                    A = ({ reject: s, resolve: t }, a) => {
                      e.runtime.lastError
                        ? e.runtime.lastError.message === r
                          ? t()
                          : s(new Error(e.runtime.lastError.message))
                        : a && a.__mozWebExtensionPolyfillReject__
                          ? s(new Error(a.message))
                          : t(a);
                    },
                    u = (e, r, s, ...t) => {
                      if (t.length < r.minArgs)
                        throw new Error(
                          `Expected at least ${r.minArgs} ${n(r.minArgs)} for ${e}(), got ${t.length}`,
                        );
                      if (t.length > r.maxArgs)
                        throw new Error(
                          `Expected at most ${r.maxArgs} ${n(r.maxArgs)} for ${e}(), got ${t.length}`,
                        );
                      return new Promise((e, r) => {
                        const a = A.bind(null, { resolve: e, reject: r });
                        (t.push(a), s.sendMessage(...t));
                      });
                    },
                    d = {
                      devtools: { network: { onRequestFinished: g(m) } },
                      runtime: {
                        onMessage: g(l),
                        onMessageExternal: g(l),
                        sendMessage: u.bind(null, "sendMessage", {
                          minArgs: 1,
                          maxArgs: 3,
                        }),
                      },
                      tabs: {
                        sendMessage: u.bind(null, "sendMessage", {
                          minArgs: 2,
                          maxArgs: 3,
                        }),
                      },
                    },
                    h = {
                      clear: { minArgs: 1, maxArgs: 1 },
                      get: { minArgs: 1, maxArgs: 1 },
                      set: { minArgs: 1, maxArgs: 1 },
                    };
                  return (
                    (s.privacy = {
                      network: { "*": h },
                      services: { "*": h },
                      websites: { "*": h },
                    }),
                    c(e, d, s)
                  );
                };
              e.exports = s(chrome);
            }
          }),
          void 0 === (t = s.apply(r, [e])) || (e.exports = t));
      },
    },
    r = {};
  function s(t) {
    var a = r[t];
    if (void 0 !== a) return a.exports;
    var n = (r[t] = { exports: {} });
    return (e[t].call(n.exports, n, n.exports, s), n.exports);
  }
  ((s.n = (e) => {
    var r = e && e.__esModule ? () => e.default : () => e;
    return (s.d(r, { a: r }), r);
  }),
    (s.d = (e, r) => {
      for (var t in r)
        s.o(r, t) &&
          !s.o(e, t) &&
          Object.defineProperty(e, t, { enumerable: !0, get: r[t] });
    }),
    (s.o = (e, r) => Object.prototype.hasOwnProperty.call(e, r)),
    (() => {
      "use strict";
      var e = s(815);
      const r = s.n(e)(),
        t = "https://api.deepsightsynthesis.com/api";
      async function a() {
        try {
          const e = await r.storage.local.get(["accessToken", "refreshToken"]);
          return {
            accessToken: e.accessToken || null,
            refreshToken: e.refreshToken || null,
          };
        } catch {
          return { accessToken: null, refreshToken: null };
        }
      }
      async function n(e, s) {
        const t = { accessToken: e };
        (s && (t.refreshToken = s), (t.tokenRefreshedAt = Date.now()));
        try {
          await r.storage.local.set(t);
        } catch {}
      }
      async function o() {
        try {
          await r.storage.local.remove([
            "accessToken",
            "refreshToken",
            "user",
            "tokenRefreshedAt",
          ]);
        } catch {}
      }
      async function i() {
        try {
          return (await r.storage.local.get(["user"])).user || null;
        } catch {
          return null;
        }
      }
      async function c(e) {
        try {
          await r.storage.local.set({ user: e });
        } catch {}
      }
      const g = [
          /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\s]+)/,
          /youtube\.com\/shorts\/([^&?\s]+)/,
        ],
        m = [
          /tiktok\.com\/@[\w.-]+\/video\/(\d+)/i,
          /vm\.tiktok\.com\/([\w-]+)/i,
          /m\.tiktok\.com\/v\/(\d+)/i,
          /tiktok\.com\/t\/([\w-]+)/i,
          /tiktok\.com\/video\/(\d+)/i,
        ];
      const l = "ds_crash_log";
      async function A() {
        try {
          const e = await chrome.storage.local.get(l),
            r = Array.isArray(e[l]) ? e[l] : [];
          return (
            r.length > 0 && (await chrome.storage.local.set({ [l]: [] })),
            r
          );
        } catch {
          return [];
        }
      }
      async function u(e) {
        if (0 !== e.length)
          try {
            console.warn(
              `[DeepSight] ${e.length} previous crash(es) detected — will ship to Sentry in Phase 5`,
              e,
            );
          } catch {}
      }
      async function d(e, s = {}) {
        const { accessToken: n } = await a(),
          i = { "Content-Type": "application/json", ...s.headers };
        n && (i.Authorization = `Bearer ${n}`);
        const c = await (async function () {
          try {
            return (
              (await r.storage.local.get("tokenRefreshedAt"))
                .tokenRefreshedAt ?? null
            );
          } catch {
            return null;
          }
        })();
        if (n && c && Date.now() - c > 12e5) {
          await f();
          const e = await a();
          e.accessToken && (i.Authorization = `Bearer ${e.accessToken}`);
        }
        const g = await fetch(`${t}${e}`, { ...s, headers: i });
        if (401 === g.status) {
          if (await f()) {
            const { accessToken: r } = await a();
            i.Authorization = `Bearer ${r}`;
            const n = await fetch(`${t}${e}`, { ...s, headers: i });
            if (!n.ok) throw new Error(`API Error: ${n.status}`);
            return n.json();
          }
          throw (
            await o(),
            console.warn(
              "[DeepSight] Session expired, refresh failed. User needs to re-login.",
            ),
            new Error("SESSION_EXPIRED")
          );
        }
        if (!g.ok) {
          const e = await g.json().catch(() => ({ detail: "Unknown error" }));
          throw new Error(e.detail || `API Error: ${g.status}`);
        }
        return g.json();
      }
      let h = null;
      async function f() {
        return (
          h ||
          ((h = (async () => {
            try {
              return await (async function () {
                const { refreshToken: e } = await a();
                if (!e) return !1;
                try {
                  const r = await fetch(`${t}/auth/refresh`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refresh_token: e }),
                  });
                  if (!r.ok) return !1;
                  const s = await r.json();
                  if (!s.access_token) return !1;
                  const a = s.refresh_token || e;
                  return (await n(s.access_token, a), await c(s.user), !0);
                } catch {
                  return !1;
                }
              })();
            } finally {
              h = null;
            }
          })()),
          h)
        );
      }
      async function x() {
        const e = r.identity.getRedirectURL(),
          s = (function () {
            const e = new Uint8Array(16);
            return (
              crypto.getRandomValues(e),
              Array.from(e, (e) => e.toString(16).padStart(2, "0")).join("")
            );
          })(),
          a = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent("763654536492-8hkdd3n31tqeodnhcak6ef8asu4v287j.apps.googleusercontent.com")}&redirect_uri=${encodeURIComponent(e)}&response_type=${encodeURIComponent("id_token token")}&scope=${encodeURIComponent("openid email profile")}&nonce=${encodeURIComponent(s)}&prompt=select_account`,
          o = await r.identity.launchWebAuthFlow({ url: a, interactive: !0 });
        if (!o) throw new Error("Google login cancelled");
        const i = new URLSearchParams(o.split("#")[1]).get("id_token");
        if (!i) throw new Error("No ID token received from Google");
        const g = await fetch(`${t}/auth/google/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id_token: i, client_platform: "web" }),
        });
        if (!g.ok) {
          const e = await g
            .json()
            .catch(() => ({ detail: "Google login failed" }));
          throw new Error(e.detail || "Google login failed on server");
        }
        const m = await g.json();
        return (
          await n(m.access_token, m.refresh_token),
          await c(m.user),
          m.user
        );
      }
      async function w(e, r = {}) {
        return d("/videos/analyze", {
          method: "POST",
          body: JSON.stringify({
            url: e,
            mode: r.mode || "standard",
            lang: r.lang || "fr",
            category: r.category || "auto",
            model: r.model,
            force_refresh: r.force_refresh || !1,
          }),
        });
      }
      async function y(e) {
        return d(`/videos/status/${e}`);
      }
      async function p() {
        const { accessToken: e } = await a();
        return !!e;
      }
      async function k(e, s) {
        switch (e.action) {
          case "CHECK_AUTH":
            if (await p())
              try {
                return { authenticated: !0, user: (await i()) ?? void 0 };
              } catch {
                return { authenticated: !1 };
              }
            return { authenticated: !1 };
          case "GET_USER":
            try {
              return {
                success: !0,
                user: await (async function () {
                  const e = await d("/auth/me");
                  return (await c(e), e);
                })(),
              };
            } catch (e) {
              return { success: !1, error: e.message };
            }
          case "LOGIN": {
            const { email: r, password: s } = e.data;
            try {
              const e = await (async function (e, r) {
                const s = await fetch(`${t}/auth/login`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: e, password: r }),
                });
                if (!s.ok) {
                  const e = await s
                    .json()
                    .catch(() => ({ detail: "Login failed" }));
                  throw new Error(e.detail || "Login failed");
                }
                const a = await s.json();
                return (
                  await n(a.access_token, a.refresh_token),
                  await c(a.user),
                  a.user
                );
              })(r, s);
              return { success: !0, user: e };
            } catch (e) {
              return { success: !1, error: e.message };
            }
          }
          case "GOOGLE_LOGIN":
            try {
              return { success: !0, user: await x() };
            } catch (e) {
              return { success: !1, error: e.message };
            }
          case "START_ANALYSIS": {
            const { url: r, options: s } = e.data;
            try {
              const { task_id: e } = await w(r, s);
              return { success: !0, result: { task_id: e } };
            } catch (e) {
              return { success: !1, error: e.message };
            }
          }
          case "ANALYZE_VIDEO": {
            const { url: t, options: a } = e.data;
            try {
              const { task_id: e } = await w(t, a),
                n = await (async function (e, s) {
                  const t = Date.now();
                  let a = 2e3;
                  for (; Date.now() - t < 18e5; ) {
                    const n = await y(e);
                    if (
                      "completed" === n.status ||
                      "failed" === n.status ||
                      "cancelled" === n.status
                    )
                      return n;
                    void 0 !== s &&
                      r.tabs
                        .sendMessage(s, {
                          action: "ANALYSIS_PROGRESS",
                          data: {
                            taskId: e,
                            progress: n.progress,
                            message: n.message,
                          },
                        })
                        .catch(() => {});
                    const o = Date.now() - t;
                    (o > 3e5
                      ? (a = 8e3)
                      : o > 12e4
                        ? (a = 5e3)
                        : o > 3e4 && (a = 3e3),
                      await new Promise((e) => setTimeout(e, a)));
                  }
                  throw new Error("Analysis timeout — video may be too long");
                })(e, s);
              if ("completed" === n.status && n.result?.summary_id) {
                const e = (function (e) {
                  return (
                    (function (e) {
                      for (const r of g) {
                        const s = e.match(r);
                        if (s) return s[1];
                      }
                      return null;
                    })(e) ||
                    (function (e) {
                      for (const r of m) {
                        const s = e.match(r);
                        if (s) return s[1];
                      }
                      return null;
                    })(e)
                  );
                })(t);
                e &&
                  (await (async function (e) {
                    const s = (
                      await (async function () {
                        return (
                          (await r.storage.local.get(["recentAnalyses"]))
                            .recentAnalyses || []
                        );
                      })()
                    ).filter((r) => r.videoId !== e.videoId);
                    (s.unshift({ ...e, timestamp: Date.now() }),
                      await r.storage.local.set({
                        recentAnalyses: s.slice(0, 20),
                      }));
                  })({
                    videoId: e,
                    summaryId: n.result.summary_id,
                    title: n.result.video_title || "Unknown",
                  }));
              }
              return { success: !0, result: n };
            } catch (e) {
              return { success: !1, error: e.message };
            }
          }
          case "GET_TASK_STATUS": {
            const { taskId: r } = e.data;
            try {
              return { success: !0, status: await y(r) };
            } catch (e) {
              return { success: !1, error: e.message };
            }
          }
          case "CANCEL_ANALYSIS": {
            const { taskId: r } = e.data;
            try {
              const e = await (async function (e) {
                return d(`/videos/cancel/${e}`, { method: "POST" });
              })(r);
              return { success: !0, result: e };
            } catch (e) {
              return { success: !1, error: e.message };
            }
          }
          case "GET_SUMMARY": {
            const { summaryId: r } = e.data;
            try {
              const e = await (async function (e) {
                const r = await d(`/videos/summary/${e}`);
                if (r.video_url && !r.tournesol)
                  try {
                    const e = r.video_url.match(/[?&]v=([^&]+)/),
                      s = e?.[1];
                    if (s) {
                      const e = await d(`/tournesol/video/${s}`);
                      e.found &&
                        e.data &&
                        (r.tournesol = {
                          found: !0,
                          tournesol_score: e.data.tournesol_score,
                          n_comparisons: e.data.n_comparisons,
                          n_contributors: e.data.n_contributors,
                          criteria_scores: e.data.criteria_scores,
                        });
                    }
                  } catch {}
                return r;
              })(r);
              return { success: !0, summary: e };
            } catch (e) {
              return { success: !1, error: e.message };
            }
          }
          case "ASK_QUESTION": {
            const { summaryId: r, question: s, options: t } = e.data;
            try {
              const e = await (async function (e, r, s = {}) {
                return d("/chat/ask", {
                  method: "POST",
                  body: JSON.stringify({
                    question: r,
                    summary_id: e,
                    mode: s.mode || "standard",
                    use_web_search: s.use_web_search || !1,
                  }),
                });
              })(r, s, t);
              return { success: !0, result: e };
            } catch (e) {
              return { success: !1, error: e.message };
            }
          }
          case "GET_CHAT_HISTORY": {
            const { summaryId: r } = e.data;
            try {
              const e = await (async function (e) {
                try {
                  return (await d(`/chat/${e}/history`)).messages || [];
                } catch {
                  return [];
                }
              })(r);
              return { success: !0, result: e };
            } catch (e) {
              return { success: !1, error: e.message };
            }
          }
          case "GET_PLAN":
            try {
              return {
                success: !0,
                plan: await (async function () {
                  return d("/billing/my-plan?platform=extension");
                })(),
              };
            } catch (e) {
              return { success: !1, error: e.message };
            }
          case "SHARE_ANALYSIS": {
            const { videoId: r } = e.data;
            try {
              const e = await (async function (e) {
                return d("/share", {
                  method: "POST",
                  body: JSON.stringify({ video_id: e }),
                });
              })(r);
              return { success: !0, share_url: e.share_url };
            } catch (e) {
              return { success: !1, error: e.message };
            }
          }
          case "QUICK_CHAT": {
            const { url: r, lang: s } = e.data;
            try {
              const e = await (async function (e, r = "fr") {
                return d("/videos/quick-chat", {
                  method: "POST",
                  body: JSON.stringify({ url: e, lang: r }),
                });
              })(r, s || "fr");
              return { success: !0, result: e };
            } catch (e) {
              return { success: !1, error: e.message };
            }
          }
          case "LOGOUT":
            return (
              await (async function () {
                try {
                  await d("/auth/logout", { method: "POST" });
                } catch {}
                await o();
              })(),
              { success: !0 }
            );
          case "OPEN_POPUP":
            return (
              r.action.setBadgeText({ text: "!" }),
              r.action.setBadgeBackgroundColor({ color: "#6366f1" }),
              { success: !0 }
            );
          case "SYNC_AUTH_FROM_WEBSITE": {
            const { accessToken: s, refreshToken: t, user: a } = e.data;
            if (!s || "string" != typeof s)
              return { success: !1, error: "Invalid accessToken" };
            if (!a || void 0 === a.id || "string" != typeof a.plan)
              return { success: !1, error: "Invalid user data" };
            try {
              return (
                await n(s, t),
                await c(a),
                r.action.setBadgeText({ text: "" }),
                { success: !0 }
              );
            } catch (e) {
              return { success: !1, error: e.message };
            }
          }
          default:
            return { error: "Unknown action" };
        }
      }
      (r.runtime.onMessage.addListener((e, r, s) => {
        const t = r.tab?.id;
        return (
          k(e, t)
            .then(s)
            .catch((e) => s({ error: e.message })),
          !0
        );
      }),
        r.runtime.onInstalled.addListener(async (e) => {
          try {
            const e = await A();
            await u(e);
          } catch {}
          "install" === e.reason &&
            (r.tabs.create({ url: "https://www.deepsightsynthesis.com" }),
            r.storage.local.set({ showYouTubeRecommendation: !0 }));
        }),
        r.runtime.onStartup.addListener(async () => {
          try {
            const e = await A();
            await u(e);
          } catch {}
          (await p()) && (await f());
        }),
        r.alarms.create("keepAlive", { periodInMinutes: 0.5 }),
        r.alarms.create("refreshToken", { periodInMinutes: 30 }),
        r.alarms.onAlarm.addListener(async (e) => {
          "refreshToken" === e.name && (await p()) && (await f());
        }),
        r.storage.onChanged.addListener((e, s) => {
          "local" === s &&
            e.accessToken &&
            (e.accessToken.newValue
              ? r.action.setBadgeText({ text: "" })
              : (r.action.setBadgeText({ text: "!" }),
                r.action.setBadgeBackgroundColor({ color: "#ef4444" })));
        }));
    })());
})();
