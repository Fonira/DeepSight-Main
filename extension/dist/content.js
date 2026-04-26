(() => {
  var n = {
      40(n, t, e) {
        "use strict";
        e.d(t, { $id: () => a, JF: () => i, PM: () => s, gC: () => o });
        let r = null;
        function s(n) {
          if (r && r !== n) {
            const t = r.host,
              e = n?.host;
            if (t && t.isConnected && t !== e)
              try {
                t.remove();
              } catch {}
          }
          r = n;
        }
        function a(n) {
          return r?.getElementById(n) ?? null;
        }
        function i(n) {
          return r?.querySelector(n) ?? null;
        }
        function o(n) {
          return r
            ? r.querySelectorAll(n)
            : document.createDocumentFragment().querySelectorAll(n);
        }
      },
      815(n, t) {
        var e, r;
        ("undefined" != typeof globalThis
          ? globalThis
          : "undefined" != typeof self && self,
          (e = function (n) {
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
              n.exports = globalThis.browser;
            else {
              const t =
                  "The message port closed before a response was received.",
                e = (n) => {
                  const e = {
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
                  if (0 === Object.keys(e).length)
                    throw new Error(
                      "api-metadata.json has not been included in browser-polyfill",
                    );
                  class r extends WeakMap {
                    constructor(n, t = void 0) {
                      (super(t), (this.createItem = n));
                    }
                    get(n) {
                      return (
                        this.has(n) || this.set(n, this.createItem(n)),
                        super.get(n)
                      );
                    }
                  }
                  const s =
                      (t, e) =>
                      (...r) => {
                        n.runtime.lastError
                          ? t.reject(new Error(n.runtime.lastError.message))
                          : e.singleCallbackArg ||
                              (r.length <= 1 && !1 !== e.singleCallbackArg)
                            ? t.resolve(r[0])
                            : t.resolve(r);
                      },
                    a = (n) => (1 == n ? "argument" : "arguments"),
                    i = (n, t, e) =>
                      new Proxy(t, { apply: (t, r, s) => e.call(r, n, ...s) });
                  let o = Function.call.bind(Object.prototype.hasOwnProperty);
                  const d = (n, t = {}, e = {}) => {
                      let r = Object.create(null),
                        l = {
                          has: (t, e) => e in n || e in r,
                          get(l, c, p) {
                            if (c in r) return r[c];
                            if (!(c in n)) return;
                            let m = n[c];
                            if ("function" == typeof m)
                              if ("function" == typeof t[c])
                                m = i(n, n[c], t[c]);
                              else if (o(e, c)) {
                                let t = ((n, t) =>
                                  function (e, ...r) {
                                    if (r.length < t.minArgs)
                                      throw new Error(
                                        `Expected at least ${t.minArgs} ${a(t.minArgs)} for ${n}(), got ${r.length}`,
                                      );
                                    if (r.length > t.maxArgs)
                                      throw new Error(
                                        `Expected at most ${t.maxArgs} ${a(t.maxArgs)} for ${n}(), got ${r.length}`,
                                      );
                                    return new Promise((a, i) => {
                                      if (t.fallbackToNoCallback)
                                        try {
                                          e[n](
                                            ...r,
                                            s({ resolve: a, reject: i }, t),
                                          );
                                        } catch (s) {
                                          (console.warn(
                                            `${n} API method doesn't seem to support the callback parameter, falling back to call it without a callback: `,
                                            s,
                                          ),
                                            e[n](...r),
                                            (t.fallbackToNoCallback = !1),
                                            (t.noCallback = !0),
                                            a());
                                        }
                                      else
                                        t.noCallback
                                          ? (e[n](...r), a())
                                          : e[n](
                                              ...r,
                                              s({ resolve: a, reject: i }, t),
                                            );
                                    });
                                  })(c, e[c]);
                                m = i(n, n[c], t);
                              } else m = m.bind(n);
                            else if (
                              "object" == typeof m &&
                              null !== m &&
                              (o(t, c) || o(e, c))
                            )
                              m = d(m, t[c], e[c]);
                            else {
                              if (!o(e, "*"))
                                return (
                                  Object.defineProperty(r, c, {
                                    configurable: !0,
                                    enumerable: !0,
                                    get: () => n[c],
                                    set(t) {
                                      n[c] = t;
                                    },
                                  }),
                                  m
                                );
                              m = d(m, t[c], e["*"]);
                            }
                            return ((r[c] = m), m);
                          },
                          set: (t, e, s, a) => (
                            e in r ? (r[e] = s) : (n[e] = s),
                            !0
                          ),
                          defineProperty: (n, t, e) =>
                            Reflect.defineProperty(r, t, e),
                          deleteProperty: (n, t) =>
                            Reflect.deleteProperty(r, t),
                        },
                        c = Object.create(n);
                      return new Proxy(c, l);
                    },
                    l = (n) => ({
                      addListener(t, e, ...r) {
                        t.addListener(n.get(e), ...r);
                      },
                      hasListener: (t, e) => t.hasListener(n.get(e)),
                      removeListener(t, e) {
                        t.removeListener(n.get(e));
                      },
                    }),
                    c = new r((n) =>
                      "function" != typeof n
                        ? n
                        : function (t) {
                            const e = d(
                              t,
                              {},
                              { getContent: { minArgs: 0, maxArgs: 0 } },
                            );
                            n(e);
                          },
                    ),
                    p = new r((n) =>
                      "function" != typeof n
                        ? n
                        : function (t, e, r) {
                            let s,
                              a,
                              i = !1,
                              o = new Promise((n) => {
                                s = function (t) {
                                  ((i = !0), n(t));
                                };
                              });
                            try {
                              a = n(t, e, s);
                            } catch (n) {
                              a = Promise.reject(n);
                            }
                            const d =
                              !0 !== a &&
                              (l = a) &&
                              "object" == typeof l &&
                              "function" == typeof l.then;
                            var l;
                            if (!0 !== a && !d && !i) return !1;
                            return (
                              (d ? a : o)
                                .then(
                                  (n) => {
                                    r(n);
                                  },
                                  (n) => {
                                    let t;
                                    ((t =
                                      n &&
                                      (n instanceof Error ||
                                        "string" == typeof n.message)
                                        ? n.message
                                        : "An unexpected error occurred"),
                                      r({
                                        __mozWebExtensionPolyfillReject__: !0,
                                        message: t,
                                      }));
                                  },
                                )
                                .catch((n) => {
                                  console.error(
                                    "Failed to send onMessage rejected reply",
                                    n,
                                  );
                                }),
                              !0
                            );
                          },
                    ),
                    m = ({ reject: e, resolve: r }, s) => {
                      n.runtime.lastError
                        ? n.runtime.lastError.message === t
                          ? r()
                          : e(new Error(n.runtime.lastError.message))
                        : s && s.__mozWebExtensionPolyfillReject__
                          ? e(new Error(s.message))
                          : r(s);
                    },
                    g = (n, t, e, ...r) => {
                      if (r.length < t.minArgs)
                        throw new Error(
                          `Expected at least ${t.minArgs} ${a(t.minArgs)} for ${n}(), got ${r.length}`,
                        );
                      if (r.length > t.maxArgs)
                        throw new Error(
                          `Expected at most ${t.maxArgs} ${a(t.maxArgs)} for ${n}(), got ${r.length}`,
                        );
                      return new Promise((n, t) => {
                        const s = m.bind(null, { resolve: n, reject: t });
                        (r.push(s), e.sendMessage(...r));
                      });
                    },
                    u = {
                      devtools: { network: { onRequestFinished: l(c) } },
                      runtime: {
                        onMessage: l(p),
                        onMessageExternal: l(p),
                        sendMessage: g.bind(null, "sendMessage", {
                          minArgs: 1,
                          maxArgs: 3,
                        }),
                      },
                      tabs: {
                        sendMessage: g.bind(null, "sendMessage", {
                          minArgs: 2,
                          maxArgs: 3,
                        }),
                      },
                    },
                    b = {
                      clear: { minArgs: 1, maxArgs: 1 },
                      get: { minArgs: 1, maxArgs: 1 },
                      set: { minArgs: 1, maxArgs: 1 },
                    };
                  return (
                    (e.privacy = {
                      network: { "*": b },
                      services: { "*": b },
                      websites: { "*": b },
                    }),
                    d(n, u, e)
                  );
                };
              n.exports = e(chrome);
            }
          }),
          void 0 === (r = e.apply(t, [n])) || (n.exports = r));
      },
    },
    t = {};
  function e(r) {
    var s = t[r];
    if (void 0 !== s) return s.exports;
    var a = (t[r] = { exports: {} });
    return (n[r].call(a.exports, a, a.exports, e), a.exports);
  }
  ((e.n = (n) => {
    var t = n && n.__esModule ? () => n.default : () => n;
    return (e.d(t, { a: t }), t);
  }),
    (e.d = (n, t) => {
      for (var r in t)
        e.o(t, r) &&
          !e.o(n, r) &&
          Object.defineProperty(n, r, { enumerable: !0, get: t[r] });
    }),
    (e.o = (n, t) => Object.prototype.hasOwnProperty.call(n, t)),
    (() => {
      "use strict";
      var n = e(815);
      const t = e.n(n)(),
        r = [
          /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\s]+)/,
          /youtube\.com\/shorts\/([^&?\s]+)/,
        ],
        s = [
          /tiktok\.com\/@[\w.-]+\/video\/(\d+)/i,
          /vm\.tiktok\.com\/([\w-]+)/i,
          /m\.tiktok\.com\/v\/(\d+)/i,
          /tiktok\.com\/t\/([\w-]+)/i,
          /tiktok\.com\/video\/(\d+)/i,
        ];
      const a = "https://www.deepsightsynthesis.com";
      var i = e(40);
      const o = [1, 1.5, 2, 3],
        d = {
          free: 0,
          decouverte: 0,
          plus: 1,
          pro: 2,
          expert: 2,
          etudiant: 1,
          student: 1,
          starter: 1,
        };
      let l = {
          isPlaying: !1,
          isLoading: !1,
          isPaused: !1,
          currentText: "",
          currentTime: 0,
          duration: 0,
          speed: 1,
          language: "fr",
          gender: "female",
        },
        c = null,
        p = null,
        m = null,
        g = null;
      function u() {
        t.storage.local.set({
          tts_speed: l.speed,
          tts_lang: l.language,
          tts_gender: l.gender,
        });
      }
      async function b() {
        const n = await (async function () {
          try {
            return (await t.storage.local.get(["user"])).user || null;
          } catch {
            return null;
          }
        })();
        return (d[n?.plan || "free"] ?? 0) >= 1;
      }
      function x() {
        (c && (c.pause(), c.removeAttribute("src"), (c = null)),
          p && (URL.revokeObjectURL(p), (p = null)));
      }
      function f() {
        (m?.abort(),
          (m = null),
          x(),
          (g = null),
          (l.isPlaying = !1),
          (l.isPaused = !1),
          (l.isLoading = !1),
          (l.currentText = ""),
          (l.currentTime = 0),
          (l.duration = 0),
          w());
      }
      function h() {
        c &&
          (c.paused
            ? (c.play().catch(() => {}), (l.isPaused = !1), (l.isPlaying = !0))
            : (c.pause(), (l.isPaused = !0), (l.isPlaying = !1)),
          w());
      }
      function v() {
        const n = o.indexOf(l.speed);
        ((l.speed = o[(n + 1) % o.length]),
          c && (c.playbackRate = l.speed),
          u(),
          w());
      }
      function y(n) {
        return !isFinite(n) || isNaN(n)
          ? "0:00"
          : `${Math.floor(n / 60)}:${Math.floor(n % 60)
              .toString()
              .padStart(2, "0")}`;
      }
      function w() {
        (0, i.gC)(".ds-tts-btn").forEach((n) => {
          const t = n,
            e = t.dataset.ttsId;
          (t.dataset.ttsText,
            g === e && (l.isPlaying || l.isPaused || l.isLoading)
              ? (t.classList.add("ds-tts-active"),
                (t.innerHTML = (function (n) {
                  return `\n    <span class="ds-tts-play-icon">${l.isLoading ? '<svg class="ds-tts-spinner" width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' : l.isPlaying ? "⏸️" : "▶️"}</span>\n    <div class="ds-tts-progress" id="${n}-progress">\n      <div class="ds-tts-progress-fill" id="${n}-progress-fill" style="width:${l.duration > 0 ? (l.currentTime / l.duration) * 100 : 0}%"></div>\n    </div>\n    <span class="ds-tts-time" id="${n}-time">${y(l.currentTime)}/${y(l.duration)}</span>\n    <span class="ds-tts-stop" title="Stop">⏹️</span>\n    <span class="ds-tts-speed" title="Vitesse">${l.speed}x</span>\n  `;
                })(e || "")),
                (function (n) {
                  const t = n.querySelector(".ds-tts-play-icon"),
                    e = n.querySelector(".ds-tts-stop"),
                    r = n.querySelector(".ds-tts-speed"),
                    s = n.querySelector(".ds-tts-progress");
                  (t?.addEventListener("click", (n) => {
                    (n.stopPropagation(), h());
                  }),
                    e?.addEventListener("click", (n) => {
                      (n.stopPropagation(), f());
                    }),
                    r?.addEventListener("click", (n) => {
                      (n.stopPropagation(), v());
                    }),
                    s?.addEventListener("click", (n) => {
                      if ((n.stopPropagation(), !c || !l.duration)) return;
                      const t = s.getBoundingClientRect(),
                        e = (n.clientX - t.left) / t.width;
                      c.currentTime = e * l.duration;
                    }));
                })(t))
              : (t.classList.remove("ds-tts-active"),
                (t.innerHTML = '<span class="ds-tts-icon">🔊</span>')));
        });
      }
      t.storage.local.get(["tts_speed", "tts_lang", "tts_gender"]).then((n) => {
        (n.tts_speed && (l.speed = n.tts_speed),
          n.tts_lang && (l.language = n.tts_lang),
          n.tts_gender && (l.gender = n.tts_gender));
      });
      let A = 0;
      function k(n, t = "sm") {
        return `<button class="ds-tts-btn ${"md" === t ? "ds-tts-btn-md" : ""}" data-tts-id="${"ds-tts-" + ++A}" data-tts-text="${n.replace(/"/g, "&quot;").replace(/'/g, "&#39;")}" type="button" title="Écouter"><span class="ds-tts-icon">🔊</span></button>`;
      }
      function E() {
        (0, i.gC)(".ds-tts-btn:not([data-bound])").forEach((n) => {
          const e = n;
          (e.setAttribute("data-bound", "1"),
            e.classList.contains("ds-tts-locked") ||
              e.addEventListener("click", (n) => {
                n.stopPropagation();
                const r = e.dataset.ttsText || "",
                  s = e.dataset.ttsId || "";
                r &&
                  s &&
                  (async function (n, e) {
                    if (n?.trim())
                      if (
                        l.currentText !== n ||
                        (!l.isPlaying && !l.isPaused)
                      ) {
                        (f(),
                          (g = e),
                          (l.isLoading = !0),
                          (l.currentText = n),
                          w(),
                          (m = new AbortController()));
                        try {
                          const e = await (async function () {
                            try {
                              const n = await t.storage.local.get([
                                "accessToken",
                                "refreshToken",
                              ]);
                              return {
                                accessToken: n.accessToken || null,
                                refreshToken: n.refreshToken || null,
                              };
                            } catch {
                              return { accessToken: null, refreshToken: null };
                            }
                          })();
                          if (!e.accessToken) throw new Error("Auth required");
                          const r = await fetch(
                            "https://api.deepsightsynthesis.com/api/tts",
                            {
                              method: "POST",
                              headers: {
                                Authorization: `Bearer ${e.accessToken}`,
                                "Content-Type": "application/json",
                              },
                              body: JSON.stringify({
                                text: n,
                                language: l.language,
                                gender: l.gender,
                                speed: l.speed,
                                strip_questions: !0,
                              }),
                              signal: m.signal,
                            },
                          );
                          if (m.signal.aborted) return;
                          if (403 === r.status)
                            throw new Error(
                              "TTS réservé aux abonnés Étudiant+",
                            );
                          if (!r.ok)
                            throw new Error(`TTS erreur (${r.status})`);
                          const s = await r.blob();
                          if (0 === s.size) throw new Error("Audio vide");
                          if (m.signal.aborted) return;
                          (x(),
                            (p = URL.createObjectURL(s)),
                            (c = new Audio(p)),
                            (c.playbackRate = l.speed),
                            (c.onloadedmetadata = () => {
                              ((l.duration = c.duration), w());
                            }),
                            (c.ontimeupdate = () => {
                              ((l.currentTime = c.currentTime),
                                (function () {
                                  if (!g) return;
                                  const n = (0, i.$id)(`${g}-progress-fill`),
                                    t = (0, i.$id)(`${g}-time`);
                                  (n &&
                                    l.duration > 0 &&
                                    (n.style.width =
                                      (l.currentTime / l.duration) * 100 + "%"),
                                    t &&
                                      (t.textContent = `${y(l.currentTime)}/${y(l.duration)}`));
                                })());
                            }),
                            (c.onended = () => {
                              ((l.isPlaying = !1),
                                (l.isPaused = !1),
                                (l.currentTime = 0),
                                (g = null),
                                w());
                            }),
                            (c.onerror = () => f()),
                            await c.play(),
                            (l.isPlaying = !0),
                            (l.isPaused = !1),
                            (l.isLoading = !1),
                            w());
                        } catch (n) {
                          if (
                            n instanceof DOMException &&
                            "AbortError" === n.name
                          )
                            return;
                          (console.warn("[DeepSight TTS]", n),
                            x(),
                            (l.isLoading = !1),
                            (l.isPlaying = !1),
                            (l.currentText = ""),
                            (g = null),
                            w());
                        }
                      } else l.isPaused ? h() : f();
                  })(r, s);
              }));
        });
      }
      let T = null;
      function $() {
        const n = {
          darkReader: C(),
          adBlocker: S(),
          enhancerForYoutube:
            !!document.querySelector('[class*="enhancer-for-youtube"]') ||
            !!document.getElementById("efyt-not-interest"),
          sponsorBlock:
            !!document.querySelector(".sponsorSkipButton") ||
            !!document.getElementById("sponsorblock-bar") ||
            !!document.querySelector('[class*="sponsorBlock"]'),
          returnYoutubeDislike:
            !!document.getElementById("return-youtube-dislike") ||
            !!document.querySelector('[class*="ryd-"]'),
        };
        return ((T = n), n);
      }
      function C() {
        const n = document.documentElement;
        return !!(
          n.hasAttribute("data-darkreader-mode") ||
          n.hasAttribute("data-darkreader-scheme") ||
          document.querySelector('meta[name="darkreader"]') ||
          document.querySelector("style.darkreader")
        );
      }
      function S() {
        const n = document.getElementById("secondary");
        return (
          !!n &&
          "none" !== getComputedStyle(n).display &&
          null === n.offsetParent
        );
      }
      function I() {
        const n = window.location.href;
        return n.includes("youtube.com/watch") || n.includes("tiktok.com/");
      }
      function L() {
        return (
          (function (n) {
            for (const t of r) {
              const e = n.match(t);
              if (e) return e[1];
            }
            return null;
          })((n = window.location.href)) ||
          (function (n) {
            for (const t of s) {
              const e = n.match(t);
              if (e) return e[1];
            }
            return null;
          })(n)
        );
        var n;
      }
      function z() {
        const n = document.documentElement;
        if ("true" === n.getAttribute("dark") || n.hasAttribute("dark"))
          return "dark";
        if (window.matchMedia("(prefers-color-scheme: dark)").matches)
          return "dark";
        if (!(T || $()).darkReader) {
          const t = getComputedStyle(n)
            .getPropertyValue("--yt-spec-base-background")
            .trim();
          if (t.includes("#0f") || t.includes("#18") || t.includes("#21"))
            return "dark";
          const e = getComputedStyle(document.body).backgroundColor;
          if (
            e.includes("rgb(15,") ||
            e.includes("rgb(24,") ||
            e.includes("rgb(33,")
          )
            return "dark";
        }
        return "light";
      }
      let P = null;
      function M() {
        P && (P(), (P = null));
      }
      const _ =
          '/* ============================================================\n   DeepSight Widget — Scoped Design Tokens (--ds-* prefix)\n   Maps to design-tokens.css values for Shadow DOM isolation.\n   ============================================================ */\n\n/* FIX-WHITE-WIDGET: split `:host` and `:root` into separate rules.\n   Some browsers treat the combined `:host, :root { ... }` selector list\n   as invalid inside a Shadow DOM (`:root` doesn\'t match anything in\n   shadow scope), which can drop the entire rule and leave CSS vars\n   undefined — producing a transparent/white widget. */\n:host,\n:root,\n.ds-widget {\n  /* === Text === */\n  --ds-text-primary: #f5f0e8;\n  --ds-text-secondary: #b5a89b;\n  --ds-text-muted: #7a7068;\n  --ds-text-inverse: #0a0a0f;\n\n  /* === Font (system stack — no @import possible in closed Shadow DOM) === */\n  --ds-font-family:\n    -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;\n  --ds-font-display: Georgia, "Times New Roman", serif;\n  --ds-font-mono: ui-monospace, "Cascadia Code", "Fira Code", monospace;\n\n  /* === Font sizes === */\n  --ds-text-xs: 11px;\n  --ds-text-sm: 13px;\n  --ds-text-md: 15px;\n  --ds-text-lg: 18px;\n\n  /* === Font weights === */\n  --ds-weight-normal: 400;\n  --ds-weight-medium: 500;\n  --ds-weight-semi: 600;\n  --ds-weight-bold: 700;\n\n  /* === Line heights === */\n  --ds-leading-tight: 1.3;\n  --ds-leading-normal: 1.5;\n  --ds-leading-relaxed: 1.6;\n\n  /* === Border radius === */\n  --ds-radius-xs: 4px;\n  --ds-radius-sm: 6px;\n  --ds-radius-md: 10px;\n  --ds-radius-lg: 14px;\n  --ds-radius-card: 14px;\n  --ds-radius-pill: 9999px;\n  --ds-radius-input: 8px;\n\n  /* === Borders === */\n  --ds-border: rgba(200, 144, 58, 0.08);\n  --ds-border-hover: rgba(200, 144, 58, 0.2);\n  --ds-border-focus: rgba(200, 144, 58, 0.4);\n  --ds-border-gold: rgba(200, 144, 58, 0.3);\n\n  /* === Gold accents === */\n  --ds-gold-mid: #c8903a;\n  --ds-gold-gradient: linear-gradient(135deg, #c8903a, #e5b86a);\n\n  /* === Glassmorphism === */\n  --ds-glass-bg: rgba(10, 10, 15, 0.85);\n  --ds-glass-border: rgba(200, 144, 58, 0.06);\n\n  /* === Status colors === */\n  --ds-success: #10b981;\n  --ds-success-bg: rgba(16, 185, 129, 0.1);\n  --ds-warning: #f59e0b;\n  --ds-warning-bg: rgba(245, 158, 11, 0.1);\n  --ds-error: #ef4444;\n  --ds-error-bg: rgba(239, 68, 68, 0.1);\n  --ds-info: #3b82f6;\n  --ds-info-bg: rgba(59, 130, 246, 0.1);\n\n  /* === Transitions === */\n  --ds-transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);\n  --ds-transition-normal: 200ms cubic-bezier(0.4, 0, 0.2, 1);\n  --ds-transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);\n\n  /* === Z-index === */\n  --ds-z-widget: 9999;\n\n  /* === Plan badge colors === */\n  --ds-plan-free: #9ca3af;\n  --ds-plan-decouverte: #9ca3af;\n  --ds-plan-student: #3b82f6;\n  --ds-plan-etudiant: #3b82f6;\n  --ds-plan-starter: #8b5cf6;\n  --ds-plan-plus: #8b5cf6;\n  --ds-plan-pro: #c8903a;\n  --ds-plan-expert: #c8903a;\n}\n\n/* ── Keyframes (ds-* prefixed for Shadow DOM isolation) ── */\n\n@keyframes ds-slideIn {\n  from {\n    transform: translateX(100%);\n    opacity: 0;\n  }\n  to {\n    transform: translateX(0);\n    opacity: 1;\n  }\n}\n\n@keyframes ds-fadeIn {\n  from {\n    opacity: 0;\n  }\n  to {\n    opacity: 1;\n  }\n}\n\n@keyframes ds-glow-pulse {\n  0%,\n  100% {\n    box-shadow: 0 0 20px rgba(200, 144, 58, 0.15);\n  }\n  50% {\n    box-shadow: 0 0 30px rgba(200, 144, 58, 0.3);\n  }\n}\n\n@keyframes ds-spin {\n  from {\n    transform: rotate(0deg);\n  }\n  to {\n    transform: rotate(360deg);\n  }\n}\n\n@keyframes ds-phraseOut {\n  from {\n    opacity: 1;\n    transform: translateY(0);\n  }\n  to {\n    opacity: 0;\n    transform: translateY(-6px);\n  }\n}\n\n@keyframes ds-phraseIn {\n  from {\n    opacity: 0;\n    transform: translateY(6px);\n  }\n  to {\n    opacity: 1;\n    transform: translateY(0);\n  }\n}\n',
        j =
          '/* ============================================================\n   DeepSight Extension — Widget YouTube (content script)\n   Remplace l\'ancien content.css\n   Glassmorphism & Premium Glow Effects — V4.2\n   ============================================================ */\n\n/* Tokens loaded inline since Shadow DOM isolates from page CSS */\n\n/* ══════════════════════════════════════════\n   NUCLEAR FIX-WHITE-WIDGET — Always dark, no var() dependency\n   These rules MUST come first and use literal values so the widget\n   is dark even if CSS variables, theme detection, or `.light` class\n   ever leak through. Solid #0a0a0f beats any backdrop-filter weirdness.\n══════════════════════════════════════════ */\n\n:host {\n  color-scheme: dark !important;\n  background-color: #0a0a0f !important;\n}\n\n#deepsight-card,\n#deepsight-card.ds-widget,\n#deepsight-card.ds-widget.dark,\n#deepsight-card.ds-widget.light {\n  background-color: #0a0a0f !important;\n  background-image: none !important;\n  color: #f5f0e8 !important;\n}\n\n/* ══════════════════════════════════════════\n   WIDGET CONTAINER — PREMIUM GLASSMORPHISM\n══════════════════════════════════════════ */\n\n#deepsight-card.ds-widget {\n  all: initial;\n  /* FIX-WHITE-WIDGET: solid hex background — NO var(), NO rgba alpha,\n     NO glass-bg. backdrop-filter could make a 0.85 alpha look near-white\n     on a light page. Solid #0a0a0f is always dark. */\n  font-family: var(\n    --ds-font-family,\n    -apple-system,\n    BlinkMacSystemFont,\n    "Segoe UI",\n    system-ui,\n    sans-serif\n  ) !important;\n  font-size: var(--ds-text-sm, 13px) !important;\n  color: #f5f0e8 !important;\n  background-color: #0a0a0f !important;\n  background-image: none !important;\n  border: 1px solid rgba(200, 144, 58, 0.15) !important;\n  border-radius: var(--ds-radius-card, 14px) !important;\n  box-shadow:\n    0 8px 32px rgba(0, 0, 0, 0.4),\n    0 0 20px rgba(200, 144, 58, 0.05) !important;\n  width: 100% !important;\n  max-width: 420px !important;\n  overflow: hidden !important;\n  position: relative !important;\n  z-index: var(--ds-z-widget, 9999) !important;\n  margin-bottom: 12px !important;\n  box-sizing: border-box !important;\n  animation: ds-slideIn 300ms cubic-bezier(0.4, 0, 0.2, 1) forwards !important;\n}\n\n#deepsight-card.ds-widget * {\n  box-sizing: border-box !important;\n  font-family: var(--ds-font-family) !important;\n}\n\n/* FIX-WHITE-WIDGET: `.light` class fully neutralized — identical to default\n   dark rendering. Solid hex, no var(). */\n#deepsight-card.ds-widget.light {\n  background-color: #0a0a0f !important;\n  background-image: none !important;\n  border-color: rgba(200, 144, 58, 0.15) !important;\n  color: #f5f0e8 !important;\n  box-shadow:\n    0 8px 32px rgba(0, 0, 0, 0.4),\n    0 0 20px rgba(200, 144, 58, 0.05) !important;\n}\n\n/* ══════════════════════════════════════════\n   HEADER — GOLDEN ACCENT LINE\n══════════════════════════════════════════ */\n\n.ds-widget .ds-card-header {\n  display: flex !important;\n  align-items: center !important;\n  justify-content: space-between !important;\n  padding: 10px 14px !important;\n  border-bottom: 2px solid transparent !important;\n  background: linear-gradient(\n    90deg,\n    rgba(255, 255, 255, 0.03),\n    rgba(200, 144, 58, 0.02)\n  ) !important;\n  background-clip: padding-box !important;\n  position: relative !important;\n}\n\n.ds-widget .ds-card-header::after {\n  content: "" !important;\n  position: absolute !important;\n  bottom: -2px !important;\n  left: 0 !important;\n  right: 0 !important;\n  height: 2px !important;\n  background: linear-gradient(\n    90deg,\n    rgba(200, 144, 58, 0.3),\n    rgba(200, 144, 58, 0.1)\n  ) !important;\n}\n\n.ds-widget .ds-card-logo {\n  display: flex !important;\n  align-items: center !important;\n  gap: 8px !important;\n  font-weight: var(--ds-weight-semi) !important;\n  font-size: var(--ds-text-md) !important;\n  color: var(--ds-text-primary) !important;\n}\n\n.ds-widget .ds-card-logo span {\n  background: var(--ds-gold-gradient) !important;\n  -webkit-background-clip: text !important;\n  -webkit-text-fill-color: transparent !important;\n  background-clip: text !important;\n}\n\n.ds-widget .ds-card-badge {\n  font-size: var(--ds-text-xs) !important;\n  color: var(--ds-text-muted) !important;\n  background: rgba(255, 255, 255, 0.06) !important;\n  padding: 2px 7px !important;\n  border-radius: var(--ds-radius-pill) !important;\n  border: 1px solid var(--ds-border) !important;\n}\n\n.ds-widget .ds-header-actions {\n  display: flex !important;\n  align-items: center !important;\n  gap: 6px !important;\n}\n\n.ds-widget .ds-minimize-btn {\n  all: unset !important;\n  cursor: pointer !important;\n  color: var(--ds-text-muted) !important;\n  padding: 4px !important;\n  border-radius: 4px !important;\n  font-size: 16px !important;\n  line-height: 1 !important;\n  transition: color var(--ds-transition-fast) !important;\n}\n\n.ds-widget .ds-minimize-btn:hover {\n  color: var(--ds-text-primary) !important;\n}\n\n/* ══════════════════════════════════════════\n   BODY\n══════════════════════════════════════════ */\n\n.ds-widget .ds-card-body {\n  padding: 14px !important;\n  max-height: 480px !important;\n  overflow-y: auto !important;\n  scrollbar-width: thin !important;\n  scrollbar-color: rgba(255, 255, 255, 0.15) transparent !important;\n}\n\n.ds-widget .ds-card-body::-webkit-scrollbar {\n  width: 4px;\n}\n.ds-widget .ds-card-body::-webkit-scrollbar-track {\n  background: transparent;\n}\n.ds-widget .ds-card-body::-webkit-scrollbar-thumb {\n  background: rgba(255, 255, 255, 0.15);\n  border-radius: 2px;\n}\n\n/* Loading state */\n.ds-widget .ds-loading {\n  display: flex !important;\n  flex-direction: column !important;\n  align-items: center !important;\n  justify-content: center !important;\n  padding: 32px 16px !important;\n  gap: 12px !important;\n}\n\n.ds-widget .ds-loading-text {\n  color: var(--ds-text-muted) !important;\n  font-size: var(--ds-text-sm) !important;\n}\n\n/* ══════════════════════════════════════════\n   LOGIN STATE\n══════════════════════════════════════════ */\n\n.ds-widget .ds-login-container {\n  display: flex !important;\n  flex-direction: column !important;\n  gap: 12px !important;\n}\n\n/* FIX-WHITE-WIDGET: generic button base + ds-btn-primary (used by login).\n   Both classes were referenced in HTML but had no CSS — login submit button\n   rendered as raw HTML. */\n.ds-widget .ds-btn {\n  all: unset !important;\n  box-sizing: border-box !important;\n  display: inline-flex !important;\n  align-items: center !important;\n  justify-content: center !important;\n  gap: 8px !important;\n  width: 100% !important;\n  padding: 10px !important;\n  border-radius: var(--ds-radius-md) !important;\n  cursor: pointer !important;\n  font-family: var(--ds-font-family) !important;\n  font-size: var(--ds-text-sm) !important;\n  font-weight: var(--ds-weight-medium) !important;\n  text-align: center !important;\n  transition: all var(--ds-transition-fast) !important;\n  user-select: none !important;\n}\n\n.ds-widget .ds-btn:disabled {\n  opacity: 0.5 !important;\n  cursor: not-allowed !important;\n}\n\n.ds-widget .ds-btn-primary {\n  background: var(--ds-gold-gradient) !important;\n  color: #0b0f19 !important;\n  border: none !important;\n  font-weight: var(--ds-weight-semi) !important;\n  box-shadow: 0 4px 14px rgba(200, 144, 58, 0.2) !important;\n}\n\n.ds-widget .ds-btn-primary:hover:not(:disabled) {\n  filter: brightness(1.1) !important;\n  box-shadow: 0 6px 20px rgba(200, 144, 58, 0.3) !important;\n}\n\n.ds-widget .ds-login-headline,\n.ds-widget .ds-subtitle {\n  font-size: var(--ds-text-sm) !important;\n  font-weight: var(--ds-weight-normal) !important;\n  color: var(--ds-text-secondary) !important;\n  margin: 0 0 4px !important;\n  line-height: var(--ds-leading-relaxed) !important;\n}\n\n.ds-widget .ds-login-sub {\n  font-size: var(--ds-text-xs) !important;\n  color: var(--ds-text-muted) !important;\n  margin-bottom: 8px !important;\n  line-height: var(--ds-leading-relaxed) !important;\n}\n\n/* FIX-WHITE-WIDGET: `.ds-divider` is what login.ts actually renders. */\n.ds-widget .ds-divider {\n  display: flex !important;\n  align-items: center !important;\n  gap: 8px !important;\n  color: var(--ds-text-muted) !important;\n  font-size: var(--ds-text-xs) !important;\n  margin: 4px 0 !important;\n}\n\n.ds-widget .ds-divider::before,\n.ds-widget .ds-divider::after {\n  content: "" !important;\n  flex: 1 !important;\n  height: 1px !important;\n  background: var(--ds-border) !important;\n}\n\n.ds-widget .ds-divider span {\n  text-transform: uppercase !important;\n  letter-spacing: 0.05em !important;\n  color: var(--ds-text-muted) !important;\n}\n\n.ds-widget .ds-btn-google {\n  display: flex !important;\n  align-items: center !important;\n  justify-content: center !important;\n  gap: 8px !important;\n  width: 100% !important;\n  padding: 10px !important;\n  background: #fff !important;\n  border: 1px solid #dadce0 !important;\n  border-radius: var(--ds-radius-md) !important;\n  cursor: pointer !important;\n  font-size: var(--ds-text-sm) !important;\n  font-weight: var(--ds-weight-medium) !important;\n  color: #3c4043 !important;\n  transition: background var(--ds-transition-fast) !important;\n}\n\n.ds-widget .ds-btn-google:hover {\n  background: #f8f9fa !important;\n}\n\n.ds-widget .ds-divider-text {\n  display: flex !important;\n  align-items: center !important;\n  gap: 8px !important;\n  color: var(--ds-text-muted) !important;\n  font-size: var(--ds-text-xs) !important;\n}\n\n.ds-widget .ds-divider-text::before,\n.ds-widget .ds-divider-text::after {\n  content: "" !important;\n  flex: 1 !important;\n  height: 1px !important;\n  background: var(--ds-border) !important;\n}\n\n.ds-widget .ds-login-form {\n  display: flex !important;\n  flex-direction: column !important;\n  gap: 8px !important;\n}\n\n.ds-widget .ds-login-form input {\n  all: unset !important;\n  display: block !important;\n  width: 100% !important;\n  background: rgba(255, 255, 255, 0.05) !important;\n  border: 1px solid var(--ds-border) !important;\n  border-radius: var(--ds-radius-input) !important;\n  padding: 9px 12px !important;\n  font-size: var(--ds-text-sm) !important;\n  color: var(--ds-text-primary) !important;\n  box-sizing: border-box !important;\n  transition: border-color var(--ds-transition-fast) !important;\n}\n\n.ds-widget .ds-login-form input:focus {\n  border-color: var(--ds-border-focus) !important;\n}\n\n.ds-widget .ds-login-form input::placeholder {\n  color: var(--ds-text-muted) !important;\n}\n\n.ds-widget .ds-error-msg {\n  font-size: var(--ds-text-xs) !important;\n  color: var(--ds-error) !important;\n  background: var(--ds-error-bg) !important;\n  border-radius: var(--ds-radius-sm) !important;\n  padding: 6px 10px !important;\n}\n\n.ds-widget .ds-error-msg.hidden {\n  display: none !important;\n}\n\n/* ══════════════════════════════════════════\n   READY STATE\n══════════════════════════════════════════ */\n\n.ds-widget .ds-ready-container {\n  display: flex !important;\n  flex-direction: column !important;\n  gap: 10px !important;\n}\n\n.ds-widget .ds-user-bar {\n  display: flex !important;\n  align-items: center !important;\n  gap: 8px !important;\n  padding: 8px 10px !important;\n  background: rgba(255, 255, 255, 0.04) !important;\n  border-radius: var(--ds-radius-md) !important;\n  border: 1px solid var(--ds-border) !important;\n}\n\n.ds-widget .ds-user-name {\n  font-weight: var(--ds-weight-medium) !important;\n  font-size: var(--ds-text-sm) !important;\n  flex: 1 !important;\n  overflow: hidden !important;\n  text-overflow: ellipsis !important;\n  white-space: nowrap !important;\n}\n\n.ds-widget .ds-user-credits {\n  font-size: var(--ds-text-xs) !important;\n  color: var(--ds-text-muted) !important;\n}\n\n.ds-widget .ds-btn-analyze {\n  display: flex !important;\n  align-items: center !important;\n  justify-content: center !important;\n  gap: 8px !important;\n  width: 100% !important;\n  padding: 12px !important;\n  background: linear-gradient(135deg, #c8903a, #9b6b4a) !important;\n  background-size: 200% 200% !important;\n  animation: ds-gradient-shift 8s ease infinite !important;\n  border: none !important;\n  border-radius: var(--ds-radius-md) !important;\n  cursor: pointer !important;\n  font-size: var(--ds-text-md) !important;\n  font-weight: var(--ds-weight-semi) !important;\n  color: #0b0f19 !important;\n  box-shadow: 0 4px 15px rgba(200, 144, 58, 0.25) !important;\n  transition: all var(--ds-transition-normal) !important;\n}\n\n.ds-widget .ds-btn-analyze:hover:not(:disabled) {\n  transform: translateY(-1px) !important;\n  box-shadow: 0 0 25px rgba(200, 144, 58, 0.35) !important;\n}\n\n.ds-widget .ds-btn-analyze:disabled {\n  opacity: 0.5 !important;\n  cursor: not-allowed !important;\n  transform: none !important;\n}\n\n.ds-widget .ds-btn-quickchat {\n  display: flex !important;\n  align-items: center !important;\n  justify-content: center !important;\n  gap: 8px !important;\n  width: 100% !important;\n  padding: 10px !important;\n  background: transparent !important;\n  border: 1px solid var(--ds-border-gold) !important;\n  border-radius: var(--ds-radius-md) !important;\n  cursor: pointer !important;\n  font-size: var(--ds-text-sm) !important;\n  font-weight: var(--ds-weight-medium) !important;\n  color: var(--ds-gold-mid) !important;\n  box-shadow: 0 0 12px rgba(200, 144, 58, 0.1) !important;\n  transition: all var(--ds-transition-fast) !important;\n}\n\n.ds-widget .ds-btn-quickchat:hover:not(:disabled) {\n  background: rgba(200, 144, 58, 0.1) !important;\n  box-shadow: 0 0 20px rgba(200, 144, 58, 0.2) !important;\n  transform: translateY(-1px) !important;\n}\n\n.ds-widget .ds-options-row {\n  display: flex !important;\n  gap: 8px !important;\n}\n\n.ds-widget .ds-select {\n  all: unset !important;\n  flex: 1 !important;\n  background: rgba(255, 255, 255, 0.05) !important;\n  border: 1px solid var(--ds-border) !important;\n  border-radius: var(--ds-radius-md) !important;\n  padding: 7px 10px !important;\n  font-size: var(--ds-text-xs) !important;\n  color: var(--ds-text-primary) !important;\n  cursor: pointer !important;\n  display: block !important;\n}\n\n/* ══════════════════════════════════════════\n   ANALYZING STATE\n══════════════════════════════════════════ */\n\n.ds-widget .ds-analyzing-container {\n  display: flex !important;\n  flex-direction: column !important;\n  align-items: center !important;\n  gap: 14px !important;\n  padding: 20px 4px 8px !important;\n  text-align: center !important;\n}\n\n/* Spinner wrapper avec glow radial */\n.ds-widget .ds-spinner-wrapper {\n  position: relative !important;\n  display: flex !important;\n  align-items: center !important;\n  justify-content: center !important;\n}\n\n.ds-widget .ds-spinner-wrapper::before {\n  content: "" !important;\n  position: absolute !important;\n  width: 110px !important;\n  height: 110px !important;\n  border-radius: 50% !important;\n  background: radial-gradient(\n    circle,\n    rgba(91, 141, 184, 0.22) 0%,\n    rgba(196, 147, 90, 0.15) 40%,\n    rgba(107, 67, 128, 0.1) 70%,\n    transparent 100%\n  ) !important;\n  animation: ds-glow-pulse 2.5s ease-in-out infinite !important;\n  pointer-events: none !important;\n}\n\n/* Header : titre + timer */\n.ds-widget .ds-analyzing-header {\n  display: flex !important;\n  align-items: center !important;\n  justify-content: space-between !important;\n  width: 100% !important;\n}\n\n.ds-widget .ds-analyzing-title {\n  font-size: 12px !important;\n  color: var(--ds-text-secondary) !important;\n  font-weight: 600 !important;\n  letter-spacing: 0.02em !important;\n}\n\n.ds-widget .ds-timer {\n  font-size: 10px !important;\n  color: var(--ds-text-muted) !important;\n  background: rgba(255, 255, 255, 0.06) !important;\n  border: 1px solid rgba(255, 255, 255, 0.1) !important;\n  border-radius: 4px !important;\n  padding: 2px 6px !important;\n  font-variant-numeric: tabular-nums !important;\n  letter-spacing: 0.05em !important;\n}\n\n/* Barre de progression — 6px avec glow doré */\n.ds-widget .ds-progress {\n  width: 100% !important;\n  height: 6px !important;\n  background: rgba(255, 255, 255, 0.08) !important;\n  border-radius: 3px !important;\n  overflow: hidden !important;\n  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2) !important;\n}\n\n.ds-widget .ds-progress-bar {\n  height: 100% !important;\n  background: linear-gradient(90deg, #3b82f6, #c8903a, #9b6b4a) !important;\n  background-size: 200% 100% !important;\n  border-radius: 3px !important;\n  transition: width 600ms ease !important;\n  min-width: 4px !important;\n  animation: ds-gradient-shift 3s ease infinite !important;\n  box-shadow: 0 0 8px rgba(200, 144, 58, 0.3) !important;\n}\n\n/* Footer : phrase dynamique + pourcentage */\n.ds-widget .ds-progress-footer {\n  display: flex !important;\n  align-items: center !important;\n  justify-content: space-between !important;\n  width: 100% !important;\n  gap: 8px !important;\n}\n\n.ds-widget .ds-phrase-container {\n  flex: 1 !important;\n  text-align: left !important;\n  overflow: hidden !important;\n  min-height: 16px !important;\n}\n\n.ds-widget .ds-phrase-container.ds-phrase-out .ds-phrase-text {\n  animation: ds-phraseOut 250ms ease forwards !important;\n}\n\n.ds-widget .ds-phrase-container.ds-phrase-in .ds-phrase-text {\n  animation: ds-phraseIn 300ms ease forwards !important;\n}\n\n.ds-widget .ds-phrase-text {\n  font-size: var(--ds-text-xs) !important;\n  color: var(--ds-text-muted) !important;\n  display: block !important;\n  white-space: nowrap !important;\n  overflow: hidden !important;\n  text-overflow: ellipsis !important;\n}\n\n.ds-widget .ds-progress-pct {\n  font-size: 10px !important;\n  color: var(--ds-text-muted) !important;\n  font-variant-numeric: tabular-nums !important;\n  white-space: nowrap !important;\n  flex-shrink: 0 !important;\n}\n\n/* Steps avec icônes et connecteur vertical */\n.ds-widget .ds-analyzing-steps {\n  display: flex !important;\n  flex-direction: column !important;\n  gap: 0 !important;\n  width: 100% !important;\n  font-size: var(--ds-text-xs) !important;\n}\n\n.ds-widget .ds-step {\n  display: flex !important;\n  align-items: flex-start !important;\n  gap: 10px !important;\n  color: var(--ds-text-muted) !important;\n  padding: 2px 0 !important;\n}\n\n.ds-widget .ds-step-left {\n  display: flex !important;\n  flex-direction: column !important;\n  align-items: center !important;\n  flex-shrink: 0 !important;\n  width: 16px !important;\n}\n\n.ds-widget .ds-step-icon {\n  width: 16px !important;\n  height: 16px !important;\n  border-radius: 50% !important;\n  display: flex !important;\n  align-items: center !important;\n  justify-content: center !important;\n  flex-shrink: 0 !important;\n  background: rgba(255, 255, 255, 0.06) !important;\n  border: 1px solid rgba(255, 255, 255, 0.12) !important;\n  transition: all 200ms ease !important;\n}\n\n.ds-widget .ds-step-icon-active {\n  background: rgba(91, 141, 184, 0.2) !important;\n  border-color: rgba(91, 141, 184, 0.5) !important;\n  box-shadow: 0 0 8px rgba(91, 141, 184, 0.3) !important;\n}\n\n.ds-widget .ds-step-icon-done {\n  background: rgba(34, 197, 94, 0.15) !important;\n  border-color: rgba(34, 197, 94, 0.5) !important;\n  color: #22c55e !important;\n}\n\n.ds-widget .ds-step-dot {\n  width: 6px !important;\n  height: 6px !important;\n  border-radius: 50% !important;\n  background: currentColor !important;\n  display: block !important;\n}\n\n.ds-widget .ds-step-connector {\n  width: 1px !important;\n  height: 10px !important;\n  background: rgba(255, 255, 255, 0.1) !important;\n  margin-top: 2px !important;\n}\n\n.ds-widget .ds-step-label {\n  line-height: 16px !important;\n  padding-bottom: 8px !important;\n}\n\n.ds-widget .ds-step.ds-step-active {\n  color: var(--ds-text-primary) !important;\n}\n\n.ds-widget .ds-step.ds-step-active .ds-step-connector {\n  background: rgba(91, 141, 184, 0.3) !important;\n}\n\n.ds-widget .ds-step.ds-step-done {\n  color: var(--ds-success) !important;\n}\n\n.ds-widget .ds-step.ds-step-done .ds-step-connector {\n  background: rgba(34, 197, 94, 0.3) !important;\n}\n\n/* ══════════════════════════════════════════\n   RESULTS STATE\n══════════════════════════════════════════ */\n\n.ds-widget .ds-results-container {\n  display: flex !important;\n  flex-direction: column !important;\n  gap: 12px !important;\n  animation: ds-fadeIn 300ms ease forwards !important;\n}\n\n.ds-widget .ds-status-bar {\n  display: flex !important;\n  align-items: center !important;\n  justify-content: space-between !important;\n  flex-wrap: wrap !important;\n  gap: 6px !important;\n}\n\n.ds-widget .ds-done {\n  font-size: var(--ds-text-xs) !important;\n  color: var(--ds-success) !important;\n  font-weight: var(--ds-weight-medium) !important;\n}\n\n.ds-widget .ds-status-badges {\n  display: flex !important;\n  gap: 6px !important;\n}\n\n.ds-widget .ds-tag {\n  font-size: var(--ds-text-xs) !important;\n  padding: 2px 8px !important;\n  border-radius: var(--ds-radius-pill) !important;\n  background: rgba(255, 255, 255, 0.07) !important;\n  border: 1px solid var(--ds-border) !important;\n  color: var(--ds-text-secondary) !important;\n}\n\n.ds-widget .ds-tag.ds-score-high {\n  color: var(--ds-success) !important;\n  border-color: rgba(76, 175, 80, 0.3) !important;\n}\n.ds-widget .ds-tag.ds-score-mid {\n  color: var(--ds-warning) !important;\n  border-color: rgba(255, 152, 0, 0.3) !important;\n}\n.ds-widget .ds-tag.ds-score-low {\n  color: var(--ds-error) !important;\n  border-color: rgba(239, 68, 68, 0.3) !important;\n}\n\n.ds-widget .ds-reliability-bar {\n  background: rgba(255, 255, 255, 0.05) !important;\n  border-radius: var(--ds-radius-md) !important;\n  padding: 10px !important;\n  border: 1px solid var(--ds-border) !important;\n}\n\n.ds-widget .ds-reliability-header {\n  display: flex !important;\n  justify-content: space-between !important;\n  margin-bottom: 8px !important;\n  font-size: var(--ds-text-xs) !important;\n}\n\n.ds-widget .ds-verdict {\n  font-size: var(--ds-text-sm) !important;\n  line-height: var(--ds-leading-relaxed) !important;\n  color: var(--ds-text-secondary) !important;\n  padding: 10px !important;\n  background: rgba(255, 255, 255, 0.03) !important;\n  border-radius: var(--ds-radius-md) !important;\n  border-left: 3px solid var(--ds-gold-mid) !important;\n}\n\n.ds-widget .ds-keypoints {\n  display: flex !important;\n  flex-direction: column !important;\n  gap: 6px !important;\n}\n\n.ds-widget .ds-kp {\n  display: flex !important;\n  align-items: flex-start !important;\n  gap: 8px !important;\n  font-size: var(--ds-text-xs) !important;\n  line-height: var(--ds-leading-relaxed) !important;\n}\n\n.ds-widget .ds-kp-icon {\n  font-size: 12px !important;\n  flex-shrink: 0 !important;\n  margin-top: 1px !important;\n}\n.ds-widget .ds-kp-text {\n  color: var(--ds-text-secondary) !important;\n}\n.ds-widget .ds-kp-solid .ds-kp-icon {\n  color: var(--ds-success) !important;\n}\n.ds-widget .ds-kp-weak .ds-kp-icon {\n  color: var(--ds-warning) !important;\n}\n.ds-widget .ds-kp-insight .ds-kp-icon {\n  color: var(--ds-info) !important;\n}\n\n.ds-widget .ds-tags {\n  display: flex !important;\n  flex-wrap: wrap !important;\n  gap: 4px !important;\n}\n\n.ds-widget .ds-tag-pill {\n  font-size: var(--ds-text-xs) !important;\n  padding: 2px 8px !important;\n  background: rgba(255, 255, 255, 0.05) !important;\n  border-radius: var(--ds-radius-pill) !important;\n  border: 1px solid var(--ds-border) !important;\n  color: var(--ds-text-muted) !important;\n}\n\n.ds-widget .ds-toggle-detail {\n  all: unset !important;\n  display: flex !important;\n  align-items: center !important;\n  justify-content: space-between !important;\n  width: 100% !important;\n  cursor: pointer !important;\n  font-size: var(--ds-text-xs) !important;\n  color: var(--ds-text-muted) !important;\n  padding: 6px 0 !important;\n  border-bottom: 1px solid var(--ds-border) !important;\n  transition: color var(--ds-transition-fast) !important;\n}\n\n.ds-widget .ds-toggle-detail:hover {\n  color: var(--ds-text-primary) !important;\n}\n\n.ds-widget .ds-detail-panel {\n  font-size: var(--ds-text-xs) !important;\n  line-height: var(--ds-leading-relaxed) !important;\n  color: var(--ds-text-secondary) !important;\n}\n\n.ds-widget .ds-detail-panel.hidden {\n  display: none !important;\n}\n\n.ds-widget .ds-detail-content {\n  padding-top: 8px !important;\n}\n\n.ds-widget .ds-share-actions {\n  display: flex !important;\n  gap: 8px !important;\n}\n\n.ds-widget .ds-btn-outline {\n  flex: 1 !important;\n  padding: 7px 10px !important;\n  background: transparent !important;\n  border: 1px solid var(--ds-border) !important;\n  border-radius: var(--ds-radius-sm) !important;\n  font-size: var(--ds-text-xs) !important;\n  color: var(--ds-text-secondary) !important;\n  cursor: pointer !important;\n  text-align: center !important;\n  transition:\n    border-color var(--ds-transition-fast),\n    color var(--ds-transition-fast) !important;\n}\n\n.ds-widget .ds-btn-outline:hover {\n  border-color: var(--ds-border-hover) !important;\n  color: var(--ds-text-primary) !important;\n}\n\n.ds-widget .ds-summary-actions {\n  display: flex !important;\n  flex-direction: column !important;\n  gap: 8px !important;\n}\n\n.ds-widget .ds-btn-primary-link {\n  display: flex !important;\n  align-items: center !important;\n  justify-content: center !important;\n  gap: 6px !important;\n  width: 100% !important;\n  padding: 10px !important;\n  background: var(--ds-gold-gradient) !important;\n  border-radius: var(--ds-radius-md) !important;\n  font-size: var(--ds-text-sm) !important;\n  font-weight: var(--ds-weight-medium) !important;\n  color: #0b0f19 !important;\n  text-decoration: none !important;\n  text-align: center !important;\n  transition: filter var(--ds-transition-normal) !important;\n}\n\n.ds-widget .ds-btn-primary-link:hover {\n  filter: brightness(1.08) !important;\n}\n\n.ds-widget .ds-btn-secondary-action {\n  display: flex !important;\n  align-items: center !important;\n  justify-content: center !important;\n  gap: 6px !important;\n  width: 100% !important;\n  padding: 9px !important;\n  background: transparent !important;\n  border: 1px solid var(--ds-border-gold) !important;\n  border-radius: var(--ds-radius-md) !important;\n  font-size: var(--ds-text-sm) !important;\n  color: var(--ds-gold-mid) !important;\n  cursor: pointer !important;\n  transition: background var(--ds-transition-fast) !important;\n}\n\n.ds-widget .ds-btn-secondary-action:hover {\n  background: rgba(200, 144, 58, 0.1) !important;\n}\n\n/* ══════════════════════════════════════════\n   FACT-CHECK\n══════════════════════════════════════════ */\n\n.ds-widget .ds-factcheck-list {\n  display: flex !important;\n  flex-direction: column !important;\n  gap: 6px !important;\n}\n\n.ds-widget .ds-fc-item {\n  display: flex !important;\n  align-items: flex-start !important;\n  gap: 8px !important;\n  padding: 8px 10px !important;\n  border-radius: var(--ds-radius-md) !important;\n  font-size: var(--ds-text-xs) !important;\n  border-left: 2px solid transparent !important;\n  border-right: 1px solid transparent !important;\n  border-top: 1px solid transparent !important;\n  border-bottom: 1px solid transparent !important;\n}\n\n.ds-widget .ds-fc-verified {\n  background: var(--ds-success-bg) !important;\n  border-left-color: #10b981 !important;\n  border-right-color: rgba(76, 175, 80, 0.25) !important;\n  border-top-color: rgba(76, 175, 80, 0.25) !important;\n  border-bottom-color: rgba(76, 175, 80, 0.25) !important;\n}\n.ds-widget .ds-fc-uncertain {\n  background: var(--ds-warning-bg) !important;\n  border-left-color: #f59e0b !important;\n  border-right-color: rgba(255, 152, 0, 0.25) !important;\n  border-top-color: rgba(255, 152, 0, 0.25) !important;\n  border-bottom-color: rgba(255, 152, 0, 0.25) !important;\n}\n.ds-widget .ds-fc-contested {\n  background: var(--ds-error-bg) !important;\n  border-left-color: #ef4444 !important;\n  border-right-color: rgba(239, 68, 68, 0.25) !important;\n  border-top-color: rgba(239, 68, 68, 0.25) !important;\n  border-bottom-color: rgba(239, 68, 68, 0.25) !important;\n}\n\n.ds-widget .ds-fc-icon {\n  flex-shrink: 0 !important;\n}\n.ds-widget .ds-fc-text {\n  flex: 1 !important;\n  line-height: var(--ds-leading-relaxed) !important;\n  color: var(--ds-text-secondary) !important;\n}\n\n/* ══════════════════════════════════════════\n   TOURNESOL BADGE\n══════════════════════════════════════════ */\n\n.ds-widget .ds-tournesol-badge {\n  display: flex !important;\n  align-items: center !important;\n  gap: 8px !important;\n  padding: 8px 10px !important;\n  background: rgba(255, 193, 7, 0.08) !important;\n  border: 1px solid rgba(255, 193, 7, 0.2) !important;\n  border-radius: var(--ds-radius-md) !important;\n  font-size: var(--ds-text-xs) !important;\n}\n\n.ds-widget .ds-tournesol-icon {\n  font-size: 16px !important;\n}\n\n.ds-widget .ds-tournesol-info {\n  flex: 1 !important;\n}\n\n.ds-widget .ds-tournesol-score {\n  font-weight: var(--ds-weight-bold) !important;\n  font-size: var(--ds-text-md) !important;\n  color: #ffc107 !important;\n}\n\n/* ══════════════════════════════════════════\n   CHAT STATE\n══════════════════════════════════════════ */\n\n.ds-widget .ds-chat-container {\n  display: flex !important;\n  flex-direction: column !important;\n  gap: 10px !important;\n}\n\n.ds-widget .ds-chat-messages {\n  display: flex !important;\n  flex-direction: column !important;\n  gap: 8px !important;\n  max-height: 280px !important;\n  overflow-y: auto !important;\n  scrollbar-width: thin !important;\n  scrollbar-color: rgba(255, 255, 255, 0.15) transparent !important;\n}\n\n.ds-widget .ds-chat-msg {\n  padding: 9px 12px !important;\n  border-radius: var(--ds-radius-md) !important;\n  font-size: var(--ds-text-xs) !important;\n  line-height: var(--ds-leading-relaxed) !important;\n  max-width: 90% !important;\n}\n\n.ds-widget .ds-chat-msg-user {\n  background: rgba(200, 144, 58, 0.15) !important;\n  border: 1px solid var(--ds-border-gold) !important;\n  color: var(--ds-text-primary) !important;\n  align-self: flex-end !important;\n  box-shadow: 0 2px 8px rgba(200, 144, 58, 0.1) !important;\n}\n\n.ds-widget .ds-chat-msg-assistant {\n  background: rgba(255, 255, 255, 0.05) !important;\n  backdrop-filter: blur(12px) !important;\n  -webkit-backdrop-filter: blur(12px) !important;\n  border: 1px solid rgba(200, 144, 58, 0.06) !important;\n  color: var(--ds-text-secondary) !important;\n  align-self: flex-start !important;\n  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;\n}\n\n.ds-widget .ds-chat-suggestions {\n  display: flex !important;\n  flex-wrap: wrap !important;\n  gap: 6px !important;\n}\n\n.ds-widget .ds-chat-suggestion {\n  all: unset !important;\n  cursor: pointer !important;\n  font-size: var(--ds-text-xs) !important;\n  padding: 5px 10px !important;\n  background: rgba(255, 255, 255, 0.05) !important;\n  border: 1px solid var(--ds-border) !important;\n  border-radius: var(--ds-radius-pill) !important;\n  color: var(--ds-text-secondary) !important;\n  transition: all var(--ds-transition-fast) !important;\n  display: inline-block !important;\n}\n\n.ds-widget .ds-chat-suggestion:hover {\n  background: rgba(200, 144, 58, 0.1) !important;\n  border-color: var(--ds-border-gold) !important;\n  color: var(--ds-text-primary) !important;\n}\n\n.ds-widget .ds-chat-input-row {\n  display: flex !important;\n  gap: 6px !important;\n  align-items: flex-end !important;\n}\n\n.ds-widget .ds-chat-input {\n  all: unset !important;\n  flex: 1 !important;\n  background: rgba(255, 255, 255, 0.05) !important;\n  border: 1px solid var(--ds-border) !important;\n  border-radius: var(--ds-radius-input) !important;\n  padding: 8px 12px !important;\n  font-size: var(--ds-text-xs) !important;\n  color: var(--ds-text-primary) !important;\n  display: block !important;\n  transition: border-color var(--ds-transition-fast) !important;\n}\n\n.ds-widget .ds-chat-input:focus {\n  border-color: var(--ds-border-focus) !important;\n}\n.ds-widget .ds-chat-input::placeholder {\n  color: var(--ds-text-muted) !important;\n}\n\n.ds-widget .ds-chat-send-btn {\n  all: unset !important;\n  cursor: pointer !important;\n  width: 32px !important;\n  height: 32px !important;\n  background: var(--ds-gold-gradient) !important;\n  border-radius: var(--ds-radius-sm) !important;\n  display: flex !important;\n  align-items: center !important;\n  justify-content: center !important;\n  color: #0b0f19 !important;\n  font-size: 14px !important;\n  transition: filter var(--ds-transition-fast) !important;\n}\n\n.ds-widget .ds-chat-send-btn:hover:not(:disabled) {\n  filter: brightness(1.1) !important;\n}\n.ds-widget .ds-chat-send-btn:disabled {\n  opacity: 0.45 !important;\n  cursor: not-allowed !important;\n}\n\n/* ══════════════════════════════════════════\n   PREMIUM TEASERS\n══════════════════════════════════════════ */\n\n.ds-widget .ds-teasers-section {\n  padding: 10px !important;\n  background: rgba(255, 255, 255, 0.03) !important;\n  border-radius: var(--ds-radius-md) !important;\n  border: 1px solid var(--ds-border) !important;\n}\n\n.ds-widget .ds-teasers-title {\n  font-size: var(--ds-text-xs) !important;\n  font-weight: var(--ds-weight-semi) !important;\n  color: var(--ds-text-secondary) !important;\n  margin-bottom: 8px !important;\n}\n\n.ds-widget .ds-teasers-grid {\n  display: flex !important;\n  flex-direction: column !important;\n  gap: 4px !important;\n}\n\n.ds-widget .ds-teaser-item {\n  display: flex !important;\n  align-items: center !important;\n  gap: 8px !important;\n  padding: 6px 8px !important;\n  border-radius: var(--ds-radius-sm) !important;\n  text-decoration: none !important;\n  color: var(--ds-text-muted) !important;\n  font-size: var(--ds-text-xs) !important;\n  transition: background var(--ds-transition-fast) !important;\n}\n\n.ds-widget .ds-teaser-item:hover {\n  background: rgba(255, 255, 255, 0.06) !important;\n}\n.ds-widget .ds-teaser-label {\n  flex: 1 !important;\n}\n.ds-widget .ds-teaser-lock {\n  font-size: 10px !important;\n  color: var(--ds-text-muted) !important;\n}\n.ds-widget .ds-teaser-price {\n  font-size: var(--ds-text-xs) !important;\n  color: var(--ds-gold-mid) !important;\n}\n\n.ds-widget .ds-teasers-all {\n  display: block !important;\n  text-align: center !important;\n  margin-top: 8px !important;\n  font-size: var(--ds-text-xs) !important;\n  color: var(--ds-gold-mid) !important;\n  text-decoration: none !important;\n}\n\n/* ══════════════════════════════════════════\n   ECOSYSTEM BRIDGE\n══════════════════════════════════════════ */\n\n.ds-widget .ds-ecosystem-bridge {\n  display: flex !important;\n  flex-wrap: wrap !important;\n  gap: 6px !important;\n  padding-top: 10px !important;\n  border-top: 1px solid var(--ds-border) !important;\n}\n\n.ds-widget .ds-bridge-link {\n  display: flex !important;\n  align-items: center !important;\n  gap: 5px !important;\n  padding: 5px 10px !important;\n  background: rgba(255, 255, 255, 0.04) !important;\n  border: 1px solid var(--ds-border) !important;\n  border-radius: var(--ds-radius-pill) !important;\n  font-size: var(--ds-text-xs) !important;\n  color: var(--ds-text-muted) !important;\n  text-decoration: none !important;\n  transition: all var(--ds-transition-fast) !important;\n}\n\n.ds-widget .ds-bridge-link:hover {\n  background: rgba(255, 255, 255, 0.08) !important;\n  color: var(--ds-text-primary) !important;\n  border-color: var(--ds-border-hover) !important;\n}\n\n.ds-widget .ds-bridge-link.ds-bridge-upgrade {\n  background: rgba(200, 144, 58, 0.1) !important;\n  border-color: var(--ds-border-gold) !important;\n  color: var(--ds-gold-mid) !important;\n}\n\n/* ══════════════════════════════════════════\n   FOOTER\n══════════════════════════════════════════ */\n\n.ds-widget .ds-card-footer {\n  display: flex !important;\n  align-items: center !important;\n  justify-content: space-between !important;\n  padding: 8px 14px !important;\n  border-top: 1px solid var(--ds-border) !important;\n  background: rgba(255, 255, 255, 0.02) !important;\n}\n\n.ds-widget .ds-card-footer a,\n.ds-widget .ds-link-btn {\n  all: unset !important;\n  cursor: pointer !important;\n  font-size: var(--ds-text-xs) !important;\n  color: var(--ds-text-muted) !important;\n  text-decoration: none !important;\n  transition: color var(--ds-transition-fast) !important;\n}\n\n.ds-widget .ds-card-footer a:hover,\n.ds-widget .ds-link-btn:hover {\n  color: var(--ds-text-secondary) !important;\n}\n\n.ds-widget .ds-card-legal {\n  display: flex !important;\n  align-items: center !important;\n  gap: 8px !important;\n  padding: 4px 14px 8px !important;\n  font-size: var(--ds-text-xs) !important;\n  color: var(--ds-text-muted) !important;\n}\n\n.ds-widget .ds-card-legal a {\n  color: var(--ds-text-muted) !important;\n  text-decoration: none !important;\n}\n\n.ds-widget .ds-card-legal a:hover {\n  text-decoration: underline !important;\n}\n\n/* ══════════════════════════════════════════\n   PLAN BADGE IN USER BAR\n══════════════════════════════════════════ */\n\n.ds-widget [class*="ds-user-plan"] {\n  font-size: var(--ds-text-xs) !important;\n  padding: 1px 7px !important;\n  border-radius: var(--ds-radius-pill) !important;\n  font-weight: var(--ds-weight-medium) !important;\n}\n\n.ds-widget .ds-plan-free {\n  background: rgba(107, 114, 128, 0.2) !important;\n  color: var(--ds-plan-free) !important;\n}\n.ds-widget .ds-plan-etudiant,\n.ds-widget .ds-plan-student {\n  background: rgba(59, 130, 246, 0.15) !important;\n  color: var(--ds-plan-student) !important;\n}\n.ds-widget .ds-plan-starter {\n  background: rgba(139, 92, 246, 0.15) !important;\n  color: var(--ds-plan-starter) !important;\n}\n.ds-widget .ds-plan-pro {\n  background: rgba(200, 144, 58, 0.15) !important;\n  color: var(--ds-plan-pro) !important;\n}\n\n/* ══════════════════════════════════════════\n   TIKTOK FLOATING CARD (overlay)\n══════════════════════════════════════════ */\n\n#deepsight-card.ds-widget.ds-tiktok-float {\n  position: fixed !important;\n  bottom: 80px !important;\n  right: 16px !important;\n  width: 340px !important;\n  max-height: 520px !important;\n  z-index: var(--ds-z-widget) !important;\n}\n\n/* ═══════════════════════════════════════════════════════════════════════════════\n   🔊 TTS — Text-to-Speech Controls\n   ═══════════════════════════════════════════════════════════════════════════════ */\n\n/* Base TTS button — idle state (compact play icon) */\n.ds-tts-btn {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 26px;\n  height: 26px;\n  border-radius: 6px;\n  border: 1px solid rgba(255, 255, 255, 0.08);\n  background: rgba(255, 255, 255, 0.06);\n  color: rgba(255, 255, 255, 0.5);\n  cursor: pointer;\n  transition: all 0.2s ease;\n  flex-shrink: 0;\n  font-size: 12px;\n  padding: 0;\n  vertical-align: middle;\n}\n\n.ds-tts-btn:hover {\n  color: #06b6d4;\n  background: rgba(6, 182, 212, 0.15);\n  border-color: rgba(6, 182, 212, 0.3);\n}\n\n.ds-tts-btn-md {\n  width: 30px;\n  height: 30px;\n  font-size: 14px;\n}\n\n/* Locked state */\n.ds-tts-locked {\n  color: rgba(255, 255, 255, 0.25);\n  cursor: not-allowed;\n}\n.ds-tts-locked:hover {\n  color: rgba(255, 255, 255, 0.35);\n  background: rgba(255, 255, 255, 0.06);\n  border-color: rgba(255, 255, 255, 0.08);\n}\n\n.ds-tts-icon {\n  font-size: 12px;\n  line-height: 1;\n}\n\n/* Active player state — expanded inline mini-player */\n.ds-tts-btn.ds-tts-active {\n  width: auto;\n  min-width: 180px;\n  gap: 6px;\n  padding: 4px 8px;\n  background: rgba(6, 182, 212, 0.08);\n  border-color: rgba(6, 182, 212, 0.25);\n}\n\n.ds-tts-play-icon {\n  cursor: pointer;\n  font-size: 13px;\n  flex-shrink: 0;\n  transition: opacity 0.2s;\n}\n.ds-tts-play-icon:hover {\n  opacity: 0.7;\n}\n\n/* Loading spinner */\n.ds-tts-spinner {\n  animation: ds-spin 0.8s linear infinite;\n  color: #06b6d4;\n}\n\n/* Progress bar */\n.ds-tts-progress {\n  flex: 1;\n  min-width: 40px;\n  height: 4px;\n  background: rgba(255, 255, 255, 0.1);\n  border-radius: 2px;\n  cursor: pointer;\n  position: relative;\n}\n\n.ds-tts-progress-fill {\n  height: 100%;\n  background: #06b6d4;\n  border-radius: 2px;\n  transition: width 0.1s linear;\n}\n\n.ds-tts-time {\n  font-size: 9px;\n  font-family: monospace;\n  color: rgba(255, 255, 255, 0.4);\n  white-space: nowrap;\n}\n\n.ds-tts-stop {\n  cursor: pointer;\n  font-size: 11px;\n  opacity: 0.5;\n  transition: opacity 0.2s;\n}\n.ds-tts-stop:hover {\n  opacity: 1;\n  color: #ef4444;\n}\n\n.ds-tts-speed {\n  cursor: pointer;\n  font-size: 10px;\n  font-family: monospace;\n  color: #06b6d4;\n  background: rgba(6, 182, 212, 0.1);\n  padding: 1px 4px;\n  border-radius: 3px;\n  transition: background 0.2s;\n}\n.ds-tts-speed:hover {\n  background: rgba(6, 182, 212, 0.2);\n}\n\n/* TTS Toolbar — settings bar */\n.ds-tts-toolbar {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  padding: 4px 8px;\n  background: rgba(255, 255, 255, 0.03);\n  border-radius: 6px;\n  border: 1px solid rgba(255, 255, 255, 0.06);\n  margin-top: 6px;\n}\n\n.ds-tts-toolbar-label {\n  font-size: 10px;\n  color: rgba(255, 255, 255, 0.4);\n  margin-right: 2px;\n}\n\n.ds-tts-toolbar-btn {\n  font-size: 12px;\n  padding: 2px 6px;\n  border-radius: 4px;\n  border: none;\n  background: rgba(255, 255, 255, 0.06);\n  color: rgba(255, 255, 255, 0.5);\n  cursor: pointer;\n  transition: all 0.2s;\n}\n.ds-tts-toolbar-btn:hover {\n  background: rgba(255, 255, 255, 0.1);\n  color: rgba(255, 255, 255, 0.7);\n}\n\n/* TTS button in summary header row */\n.ds-summary-tts-row {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  margin-bottom: 6px;\n}\n\n/* ══════════════════════════════════════════\n   PREMIUM GRADIENT ANIMATIONS\n══════════════════════════════════════════ */\n\n@keyframes ds-gradient-shift {\n  0% {\n    background-position: 0% 50%;\n  }\n  50% {\n    background-position: 100% 50%;\n  }\n  100% {\n    background-position: 0% 50%;\n  }\n}\n\n/* ══════════════════════════════════════════\n   COLLAPSED STATE (minimize persistent)\n══════════════════════════════════════════ */\n\n#deepsight-card.ds-widget.ds-collapsed {\n  width: 44px !important;\n  max-width: 44px !important;\n  height: 44px !important;\n  border-radius: 50% !important;\n  overflow: hidden !important;\n  cursor: pointer !important;\n}\n\n.ds-collapsed .ds-card-body,\n.ds-collapsed .ds-card-logo span,\n.ds-collapsed .ds-card-badge,\n.ds-collapsed .ds-minimize-btn {\n  display: none !important;\n}\n\n/* ══════════════════════════════════════════\n   COMPACT RESULTS MODE\n   ══════════════════════════════════════════ */\n.ds-results-compact {\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n}\n.ds-verdict-compact {\n  padding: 12px 14px;\n  background: rgba(99, 102, 241, 0.04);\n  border-left: 3px solid var(--ds-accent-primary, #6366f1);\n  border-radius: 0 8px 8px 0;\n}\n.ds-verdict-text-compact {\n  font-size: 13px;\n  line-height: 1.55;\n  color: var(--ds-text-primary);\n  display: -webkit-box;\n  -webkit-line-clamp: 2;\n  -webkit-box-orient: vertical;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.ds-compact-actions {\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n  margin: 4px 0;\n}\n.ds-btn-primary-xl {\n  padding: 12px 16px;\n  font-size: 14px;\n  font-weight: 600;\n  background: linear-gradient(135deg, #6366f1, #8b5cf6);\n  color: white;\n  border: none;\n  border-radius: 10px;\n  cursor: pointer;\n  transition:\n    transform 0.2s,\n    box-shadow 0.2s;\n  width: 100%;\n}\n.ds-btn-primary-xl:hover {\n  transform: translateY(-1px);\n  box-shadow: 0 8px 24px rgba(99, 102, 241, 0.4);\n}\n.ds-btn-outline-xl {\n  padding: 10px 16px;\n  font-size: 13px;\n  font-weight: 500;\n  background: transparent;\n  color: var(--ds-text-primary);\n  border: 1px solid rgba(255, 255, 255, 0.15);\n  border-radius: 10px;\n  cursor: pointer;\n  transition: all 0.2s;\n  width: 100%;\n}\n.ds-btn-outline-xl:hover {\n  background: rgba(255, 255, 255, 0.05);\n  border-color: rgba(255, 255, 255, 0.25);\n}\n.ds-link-tertiary {\n  display: block;\n  text-align: center;\n  font-size: 12px;\n  color: var(--ds-text-muted);\n  text-decoration: none;\n  padding: 6px 0;\n  transition: color 0.15s;\n}\n.ds-link-tertiary:hover {\n  color: var(--ds-accent-primary, #6366f1);\n}\n.ds-details-wrapper {\n  border: 1px solid rgba(255, 255, 255, 0.08);\n  border-radius: 8px;\n  background: rgba(255, 255, 255, 0.02);\n  padding: 0;\n  margin-top: 4px;\n}\n.ds-details-toggle {\n  padding: 10px 14px;\n  font-size: 12px;\n  color: var(--ds-text-muted);\n  cursor: pointer;\n  list-style: none;\n  user-select: none;\n  transition: color 0.15s;\n}\n.ds-details-toggle::-webkit-details-marker {\n  display: none;\n}\n.ds-details-toggle:hover {\n  color: var(--ds-text-primary);\n}\n.ds-details-wrapper[open] .ds-details-toggle {\n  color: var(--ds-text-primary);\n}\n.ds-details-body {\n  padding: 8px 14px 12px;\n  border-top: 1px solid rgba(255, 255, 255, 0.05);\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n}\n',
        R =
          "/* DeepSight Content Script Styles — Premium Glassmorphism V4.2 */\n\n/* ══════════════════════════════════════════\n   INJECTED CARD CONTAINER\n══════════════════════════════════════════ */\n\n.deepsight-injected-card {\n  backdrop-filter: blur(24px) saturate(150%) !important;\n  -webkit-backdrop-filter: blur(24px) saturate(150%) !important;\n  border: 1px solid rgba(200, 144, 58, 0.06) !important;\n  border-radius: 10px !important;\n  box-shadow:\n    0 8px 32px rgba(0, 0, 0, 0.4),\n    0 0 20px rgba(200, 144, 58, 0.05) !important;\n  background: var(--ds-glass-bg, rgba(10, 10, 15, 0.5)) !important;\n}\n\n/* Light theme variant */\n.deepsight-injected-card.light {\n  background: rgba(255, 255, 255, 0.85) !important;\n  border-color: rgba(166, 120, 40, 0.08) !important;\n  box-shadow:\n    0 8px 32px rgba(0, 0, 0, 0.15),\n    0 0 20px rgba(200, 144, 58, 0.04) !important;\n}\n\n/* ══════════════════════════════════════════\n   GOUVERNAIL SPINNER — PREMIUM ANIMATION\n══════════════════════════════════════════ */\n\n.ds-gouvernail-spinner {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  animation: ds-gouvernail-spin 2s linear infinite;\n  filter: drop-shadow(0 0 4px rgba(200, 144, 58, 0.3));\n}\n\n.ds-gouvernail-spinner-sm {\n  width: 18px;\n  height: 18px;\n  animation: ds-gouvernail-spin 2s linear infinite;\n  filter: drop-shadow(0 0 3px rgba(200, 144, 58, 0.25));\n}\n\n.ds-gouvernail-spinner svg {\n  width: 100%;\n  height: 100%;\n  color: #c8903a;\n}\n\n@keyframes ds-gouvernail-spin {\n  from {\n    transform: rotate(0deg);\n  }\n  to {\n    transform: rotate(360deg);\n  }\n}\n\n/* ══════════════════════════════════════════\n   LOADING STATE — ENHANCED VISUAL\n══════════════════════════════════════════ */\n\n.ds-loading {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  gap: 12px;\n  padding: 20px 0;\n}\n\n.ds-loading-text {\n  color: rgba(255, 255, 255, 0.7);\n  font-size: 14px;\n  margin: 0;\n  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);\n}\n\n/* ══════════════════════════════════════════\n   PREMIUM GRADIENT ANIMATIONS\n══════════════════════════════════════════ */\n\n@keyframes ds-gradient-shift {\n  0% {\n    background-position: 0% 50%;\n  }\n  50% {\n    background-position: 100% 50%;\n  }\n  100% {\n    background-position: 0% 50%;\n  }\n}\n",
        O = "deepsight-card",
        N = "deepsight-host",
        D = [
          { selector: "#secondary-inner", position: "prepend" },
          { selector: "#secondary", position: "prepend" },
          {
            selector: "ytd-watch-next-secondary-results-renderer",
            position: "prepend",
          },
          { selector: "#below", position: "prepend" },
          { selector: "ytd-watch-metadata", position: "afterend" },
        ],
        q = [
          '[class*="DivBrowserModeContainer"]',
          '[class*="DivVideoDetailContainer"]',
          "#app",
          "body",
        ];
      function B(n) {
        const t = getComputedStyle(n);
        return (
          n.offsetHeight > 0 &&
          n.offsetWidth > 50 &&
          "none" !== t.display &&
          "hidden" !== t.visibility &&
          "0" !== t.opacity
        );
      }
      let F = !1;
      function U() {
        document.getElementById(N)?.remove();
      }
      function H() {
        return (0, i.$id)(O);
      }
      function G(n) {
        const t = W();
        t && (t.innerHTML = n);
      }
      function W() {
        return (0, i.JF)(`#${O} .ds-card-body`);
      }
      function Q() {
        const n = H(),
          t = (0, i.$id)("ds-minimize-btn");
        n && (n.classList.add("ds-collapsed"), t && (t.textContent = "+"));
      }
      const V = [
        "#secondary-inner",
        "#secondary",
        "ytd-watch-next-secondary-results-renderer",
        "#below",
        "ytd-watch-metadata",
      ];
      function Y() {
        for (const n of V) {
          const t = document.querySelector(n);
          if (t instanceof HTMLElement && B(t)) return !0;
        }
        return !1;
      }
      let K = null;
      function X() {
        (K?.disconnect(), (K = null));
      }
      function Z() {
        if (document.fullscreenElement) return "fullscreen";
        const n = document.querySelector("ytd-watch-flexy");
        return n?.hasAttribute("theater") ? "theater" : "default";
      }
      let J = null,
        nn = null;
      function tn() {
        (J?.disconnect(),
          (J = null),
          nn && document.removeEventListener("fullscreenchange", nn),
          (nn = null));
      }
      function en(n) {
        const t = document.createElement("div");
        return ((t.textContent = n), t.innerHTML);
      }
      const rn = {
        résumé: "📝",
        summary: "📝",
        synthèse: "📝",
        introduction: "🎬",
        contexte: "🌍",
        context: "🌍",
        analyse: "🔬",
        analysis: "🔬",
        "points clés": "🎯",
        "key points": "🎯",
        "points forts": "💪",
        strengths: "💪",
        "points faibles": "⚠️",
        weaknesses: "⚠️",
        limites: "⚠️",
        conclusion: "🏁",
        recommandations: "💡",
        recommendations: "💡",
        sources: "📚",
        références: "📚",
        references: "📚",
        "fact-check": "🔍",
        vérification: "🔍",
        arguments: "⚖️",
        méthodologie: "🧪",
        methodology: "🧪",
        données: "📊",
        data: "📊",
        statistiques: "📊",
        opinion: "💬",
        avis: "💬",
        biais: "🎭",
        bias: "🎭",
        nuances: "🎨",
        perspectives: "👁️",
        timeline: "📅",
        chronologie: "📅",
        définitions: "📖",
        glossaire: "📖",
      };
      function sn(n) {
        const t = n.toLowerCase().trim();
        for (const [n, e] of Object.entries(rn)) if (t.includes(n)) return e;
        return "📌";
      }
      function an(n) {
        return n
          .replace(/`([^`]+)`/g, '<code class="ds-md-code">$1</code>')
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.+?)\*/g, "<em>$1</em>")
          .replace(
            /\[?(SOLIDE|SOLID)\]?/g,
            '<span class="ds-marker ds-marker-solid">✅ Établi</span>',
          )
          .replace(
            /\[?(PLAUSIBLE)\]?/g,
            '<span class="ds-marker ds-marker-plausible">🔵 Probable</span>',
          )
          .replace(
            /\[?(INCERTAIN|UNCERTAIN)\]?/g,
            '<span class="ds-marker ds-marker-uncertain">🟡 Incertain</span>',
          )
          .replace(
            /\[?(A VERIFIER|À VÉRIFIER|TO VERIFY|QUESTIONABLE|WEAK)\]?/g,
            '<span class="ds-marker ds-marker-weak">🔴 À vérifier</span>',
          );
      }
      function on(n) {
        return n
          .replace(/\*\*(.+?)\*\*/g, "$1")
          .replace(/\*(.+?)\*/g, "$1")
          .replace(/`([^`]+)`/g, "$1")
          .replace(/#{1,6}\s+/g, "")
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
          .replace(/^>\s+/gm, "")
          .replace(/\n+/g, " ")
          .trim();
      }
      function dn(n, t) {
        if (n.length <= t) return n;
        const e = n.substring(0, t),
          r = e.lastIndexOf(" ");
        return (r > 0.6 * t ? e.substring(0, r) : e) + "...";
      }
      function ln(n) {
        (G(
          `\n    <div class="ds-login-container">\n      <p class="ds-subtitle">Analysez cette vidéo avec l'IA</p>\n\n      <button class="ds-btn ds-btn-google" id="ds-google-login" type="button">\n        <svg width="16" height="16" viewBox="0 0 24 24">\n          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>\n          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>\n          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>\n          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>\n        </svg>\n        Connexion avec Google\n      </button>\n\n      <div class="ds-divider"><span>ou</span></div>\n\n      <form id="ds-login-form" class="ds-login-form">\n        <input type="email" id="ds-email" placeholder="Email" required autocomplete="email" />\n        <input type="password" id="ds-password" placeholder="Mot de passe" required autocomplete="current-password" />\n        <div id="ds-login-error" class="ds-error-msg hidden"></div>\n        <button type="submit" class="ds-btn ds-btn-primary" id="ds-login-btn">Connexion</button>\n      </form>\n\n      <div class="ds-card-footer">\n        <a href="${a}/register" target="_blank" rel="noreferrer">Créer un compte</a>\n        <span>·</span>\n        <a href="${a}" target="_blank" rel="noreferrer">deepsightsynthesis.com</a>\n      </div>\n    </div>\n  `,
        ),
          (0, i.$id)("ds-google-login")?.addEventListener("click", async () => {
            const e = (0, i.$id)("ds-google-login");
            e &&
              ((e.disabled = !0),
              (e.innerHTML =
                '<svg class="ds-gouvernail-spinner ds-gouvernail-spinner-sm" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" width="14" height="14"><circle cx="24" cy="24" r="20" opacity="0.3"/><circle cx="24" cy="24" r="3"/><line x1="24" y1="4" x2="24" y2="11"/></svg> Connexion...'));
            try {
              const r = await t.runtime.sendMessage({ action: "GOOGLE_LOGIN" });
              r?.success && r.user
                ? n()
                : (cn(r?.error || "Connexion Google échouée"),
                  e &&
                    ((e.disabled = !1),
                    (e.textContent = "Connexion avec Google")));
            } catch (n) {
              (cn(n.message),
                e &&
                  ((e.disabled = !1),
                  (e.textContent = "Connexion avec Google")));
            }
          }),
          (0, i.$id)("ds-login-form")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            const r = (0, i.$id)("ds-email").value,
              s = (0, i.$id)("ds-password").value,
              a = (0, i.$id)("ds-login-btn");
            a && ((a.disabled = !0), (a.textContent = "Connexion..."));
            try {
              const e = await t.runtime.sendMessage({
                action: "LOGIN",
                data: { email: r, password: s },
              });
              e?.success && e.user
                ? n()
                : (cn(e?.error || "Connexion échouée"),
                  a && ((a.disabled = !1), (a.textContent = "Connexion")));
            } catch (n) {
              (cn(en(n.message)),
                a && ((a.disabled = !1), (a.textContent = "Connexion")));
            }
          }));
      }
      function cn(n) {
        const t = (0, i.$id)("ds-login-error");
        t && ((t.textContent = n), t.classList.remove("hidden"));
      }
      const pn = {
        fr: {
          credits: "crédits",
          analyzeButton: "Analyser cette vidéo",
          quickChatButton: "Quick Chat IA",
          logout: "Déconnexion",
          preparing: "Préparation...",
          loading: "Chargement...",
          startingAnalysis: "Démarrage de l'analyse...",
          askQuestion: "Posez une question sur cette vidéo",
          webSearchUsed: "Recherche web utilisée",
          backToResults: "Retour aux résultats",
          responding: "En train de répondre...",
          chatError: "Erreur de chat",
        },
        en: {
          credits: "credits",
          analyzeButton: "Analyze this video",
          quickChatButton: "Quick AI Chat",
          logout: "Log out",
          preparing: "Preparing...",
          loading: "Loading...",
          startingAnalysis: "Starting analysis...",
          askQuestion: "Ask a question about this video",
          webSearchUsed: "Web search used",
          backToResults: "Back to results",
          responding: "Responding...",
          chatError: "Chat error",
        },
      };
      function mn() {
        return pn.fr;
      }
      function gn(n) {
        const {
          user: t,
          tournesol: e,
          onAnalyze: r,
          onQuickChat: s,
          onLogout: o,
        } = n;
        (G(
          `\n    <div class="ds-ready-container">\n      <div class="ds-user-bar">\n        <span class="ds-user-name">${en(t.username)}</span>\n        <span class="ds-user-plan ds-plan-${en(t.plan)}">${en(t.plan)}</span>\n        <span class="ds-user-credits">${t.credits} ${mn().credits}</span>\n      </div>\n      ${(function (
            n,
          ) {
            if (!n?.found || null === n.tournesol_score) return "";
            const t = Math.round(n.tournesol_score);
            return `<div class="ds-tournesol-badge" style="font-size:10px;color:${t >= 50 ? "var(--ds-success)" : t >= 0 ? "var(--ds-warning)" : "var(--ds-error)"};margin-top:${document.querySelector('tournesol-entity-context, [class*="tournesol"], #tournesol-rate') ? "32px" : "4px"}">🌻 Tournesol: ${t > 0 ? "+" : ""}${t}</div>`;
          })(
            e,
          )}\n\n      <button class="ds-btn ds-btn-analyze" id="ds-analyze-btn" type="button">\n        🚀 ${mn().analyzeButton}\n      </button>\n\n      <button class="ds-btn ds-btn-quickchat" id="ds-quickchat-btn" type="button">\n        💬 ${mn().quickChatButton}\n      </button>\n\n      <div class="ds-options-row">\n        <select id="ds-mode" class="ds-select" title="Mode d'analyse">\n          <option value="standard">📋 Standard</option>\n          <option value="accessible">📖 Accessible</option>\n        </select>\n        <select id="ds-lang" class="ds-select" title="Langue">\n          <option value="fr">🇫🇷 FR</option>\n          <option value="en">🇬🇧 EN</option>\n          <option value="es">🇪🇸 ES</option>\n          <option value="de">🇩🇪 DE</option>\n        </select>\n      </div>\n\n      <div class="ds-card-footer">\n        <a href="${a}" target="_blank" rel="noreferrer">🌐 deepsightsynthesis.com</a>\n        <button id="ds-logout" class="ds-link-btn" type="button">${mn().logout}</button>\n      </div>\n    </div>\n  `,
        ),
          (0, i.$id)("ds-analyze-btn")?.addEventListener("click", () => {
            const n = (0, i.$id)("ds-mode").value,
              t = (0, i.$id)("ds-lang").value;
            r(n, t);
          }),
          (0, i.$id)("ds-quickchat-btn")?.addEventListener(
            "click",
            async () => {
              const n = (0, i.$id)("ds-quickchat-btn"),
                t = (0, i.$id)("ds-lang")?.value || "fr";
              (n &&
                ((n.disabled = !0),
                (n.innerHTML = `<svg class="ds-gouvernail-spinner ds-gouvernail-spinner-sm" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" width="14" height="14"><circle cx="24" cy="24" r="20" opacity="0.3"/><circle cx="24" cy="24" r="3"/><line x1="24" y1="4" x2="24" y2="11"/></svg> ${mn().preparing}`)),
                s(t));
            },
          ),
          (0, i.$id)("ds-logout")?.addEventListener("click", o));
      }
      const un = {
        tech: [
          "Quelles sont les principales technologies mentionnées ?",
          "Quels sont les risques évoqués ?",
          "Comment cela s'applique-t-il concrètement ?",
          "Quelles alternatives sont proposées ?",
        ],
        science: [
          "Quelles sont les preuves scientifiques citées ?",
          "Y a-t-il des biais dans cette étude ?",
          "Qui sont les chercheurs impliqués ?",
          "Quelles sont les limites de cette recherche ?",
        ],
        education: [
          "Quels sont les points clés à retenir ?",
          "Comment appliquer ces concepts ?",
          "Y a-t-il des exercices pratiques suggérés ?",
          "Quelles ressources complémentaires sont recommandées ?",
        ],
        news: [
          "Quels sont les faits vérifiables ?",
          "Quelles sources sont citées ?",
          "Y a-t-il des éléments de contexte importants ?",
          "Quels sont les différents points de vue ?",
        ],
        default: [
          "Quel est le message principal de cette vidéo ?",
          "Quels sont les points les plus importants ?",
          "Y a-t-il des éléments à vérifier ?",
          "Que recommande l'auteur ?",
        ],
      };
      let bn = !1;
      function xn(n, t) {
        return (un[n] ?? un.default).slice(0, t);
      }
      function fn(n, t, e) {
        if (bn) return;
        const r = (0, i.$id)(n);
        r &&
          ((bn = !0),
          r.querySelectorAll(".ds-chat-suggestion").forEach((n) => {
            const r = parseInt(n.dataset.index ?? "0", 10);
            n.addEventListener("click", () => {
              ((bn = !1), t[r] && e(t[r]));
            });
          }),
          (bn = !1));
      }
      const hn = {
          free: 0,
          decouverte: 0,
          plus: 1,
          pro: 2,
          expert: 2,
          etudiant: 1,
          student: 1,
          starter: 1,
        },
        vn = {
          tech: "💻",
          science: "🔬",
          education: "📚",
          news: "📰",
          entertainment: "🎬",
          gaming: "🎮",
          music: "🎵",
          sports: "⚽",
          business: "💼",
          lifestyle: "🌟",
          other: "📋",
        };
      async function yn(n) {
        const { summary: e, userPlan: r, onChat: s } = n,
          o = {
            verdict: (function (n) {
              const t = [
                /#+\s*(?:Conclusion|Verdict|Synthèse|Résumé|Summary|En résumé|Final Assessment|Overall Assessment)[^\n]*\n([\s\S]*?)(?=\n#|\n---|\n\*{3,}|$)/i,
                /\*\*(?:Conclusion|Verdict|Synthèse|En résumé|Summary)\*\*[:\s]*([\s\S]*?)(?=\n\n|\n#|\n---|\n\*{3,}|$)/i,
              ];
              for (const e of t) {
                const t = n.match(e);
                if (t && t[1]) {
                  const n = on(t[1]).trim();
                  if (n.length > 20) return dn(n, 200);
                }
              }
              const e = n.split(/\n\n+/).filter((n) => {
                const t = n.trim();
                return (
                  t.length > 30 &&
                  !t.startsWith("#") &&
                  !t.startsWith("-") &&
                  !t.startsWith("*")
                );
              });
              return e.length > 0
                ? dn(on(e[e.length - 1]), 200)
                : "Analysis complete. See detailed view for full results.";
            })((m = e.summary_content)),
            keyPoints: (function (n) {
              const t = [],
                e = n.split("\n"),
                r = [/\b(?:SOLIDE|SOLID)\b/i, /\u2705\s*\*\*/, /\u2705/],
                s = [
                  /\b(?:A VERIFIER|TO VERIFY|QUESTIONABLE|WEAK|INCERTAIN|UNCERTAIN)\b/i,
                  /\u26A0\uFE0F\s*\*\*/,
                  /\u2753/,
                  /\u26A0/,
                ],
                a = [/\b(?:PLAUSIBLE)\b/i, /\uD83D\uDCA1/];
              for (const n of e) {
                const e = n.replace(/^[\s\-*]+/, "").trim();
                if (e.length < 10) continue;
                let i = null;
                if (
                  (r.some((t) => t.test(n))
                    ? (i = "solid")
                    : s.some((t) => t.test(n))
                      ? (i = "weak")
                      : a.some((t) => t.test(n)) && (i = "insight"),
                  i && t.filter((n) => n.type === i).length < 2)
                ) {
                  const n = on(e)
                    .replace(
                      /\b(?:SOLIDE|SOLID|PLAUSIBLE|INCERTAIN|UNCERTAIN|A VERIFIER|TO VERIFY|QUESTIONABLE|WEAK)\b\s*[:—\-–]?\s*/gi,
                      "",
                    )
                    .replace(/^[✅⚠️❓💡🔍🔬]\s*/u, "")
                    .trim();
                  n.length > 10 && t.push({ type: i, text: dn(n, 120) });
                }
                if (t.length >= 4) break;
              }
              if (t.length < 2) {
                const e =
                  /#+\s*(?:Points?\s+(?:forts?|clés?|faibles?)|Key\s+(?:Points?|Findings?|Takeaways?)|Strengths?|Weaknesses?|Main\s+Points?)[^\n]*\n([\s\S]*?)(?=\n#|$)/gi;
                let r;
                for (; null !== (r = e.exec(n)) && t.length < 4; ) {
                  const n = r[1].match(/^[\s]*[-*]\s+(.+)$/gm);
                  if (n)
                    for (const e of n.slice(0, 4 - t.length)) {
                      const n = on(e.replace(/^[\s]*[-*]\s+/, ""));
                      n.length > 10 &&
                        !t.some((t) => t.text === dn(n, 120)) &&
                        t.push({ type: "insight", text: dn(n, 120) });
                    }
                }
              }
              return t.slice(0, 4);
            })(m),
            tags: (function (n) {
              const t = [],
                e = n.match(
                  /#+\s*(?:Tags?|Thèmes?|Themes?|Topics?|Catégories?|Categories?)[^\n]*\n([\s\S]*?)(?=\n#|$)/i,
                );
              if (e) {
                const n = e[1].match(/[-*]\s+(.+)/g);
                if (n)
                  for (const e of n.slice(0, 3)) {
                    const n = on(e.replace(/^[-*]\s+/, "")).trim();
                    n.length > 0 && n.length < 30 && t.push(n);
                  }
              }
              if (0 === t.length) {
                const e = n.match(/^#{2,3}\s+(.+)$/gm);
                if (e) {
                  const n =
                    /^(?:Conclusion|Summary|Résumé|Synthèse|Introduction|Verdict|Analysis|Points?\s+(?:clés?|forts?|faibles?)|Key\s+(?:Points?|Findings?)|Strengths?|Weaknesses?|Overview)/i;
                  for (const r of e) {
                    const e = on(r.replace(/^#{2,3}\s+/, "")).trim();
                    if (
                      e.length > 2 &&
                      e.length < 35 &&
                      !n.test(e) &&
                      (t.push(e), t.length >= 3)
                    )
                      break;
                  }
                }
              }
              return t.slice(0, 3);
            })(m),
          },
          d = (function (n) {
            const t = n.split("\n"),
              e = [];
            let r = !1,
              s = !1;
            for (let n = 0; n < t.length; n++) {
              let a = t[n];
              if (/^-{3,}$/.test(a.trim()) || /^\*{3,}$/.test(a.trim())) {
                (r && (e.push("</ul>"), (r = !1)),
                  s && (e.push("</ol>"), (s = !1)),
                  e.push('<hr class="ds-md-hr">'));
                continue;
              }
              const i = a.match(/^(#{1,4})\s+(.+)$/);
              if (i) {
                (r && (e.push("</ul>"), (r = !1)),
                  s && (e.push("</ol>"), (s = !1)));
                const n = i[1].length,
                  t = i[2],
                  a = n <= 2 ? sn(t) : "",
                  o = an(t),
                  d = a ? `${a}&nbsp;&nbsp;` : "";
                e.push(`<h${n} class="ds-md-h${n}">${d}${o}</h${n}>`);
                continue;
              }
              if (a.startsWith("&gt; ") || "&gt;" === a) {
                (r && (e.push("</ul>"), (r = !1)),
                  s && (e.push("</ol>"), (s = !1)));
                const n = an(a.replace(/^&gt;\s?/, ""));
                e.push(
                  `<blockquote class="ds-md-blockquote">${n}</blockquote>`,
                );
                continue;
              }
              const o = a.match(/^(\s*)[-*]\s+(.+)$/);
              if (o) {
                (s && (e.push("</ol>"), (s = !1)),
                  r || (e.push('<ul class="ds-md-ul">'), (r = !0)),
                  e.push(`<li>${an(o[2])}</li>`));
                continue;
              }
              const d = a.match(/^(\s*)\d+\.\s+(.+)$/);
              d
                ? (r && (e.push("</ul>"), (r = !1)),
                  s || (e.push('<ol class="ds-md-ol">'), (s = !0)),
                  e.push(`<li>${an(d[2])}</li>`))
                : (r && (e.push("</ul>"), (r = !1)),
                  s && (e.push("</ol>"), (s = !1)),
                  "" !== a.trim()
                    ? e.push(`<p class="ds-md-p">${an(a)}</p>`)
                    : e.push('<div class="ds-md-spacer"></div>'));
            }
            return (r && e.push("</ul>"), s && e.push("</ol>"), e.join("\n"));
          })(en(e.summary_content)).replace(
            /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g,
            (n, t) =>
              `<a href="#" class="ds-timestamp" data-time="${(function (n) {
                const t = n.split(":").map(Number);
                return 3 === t.length
                  ? 3600 * t[0] + 60 * t[1] + t[2]
                  : 60 * t[0] + t[1];
              })(t)}">[${t}]</a>`,
          ),
          c = vn[e.category] ?? "📋",
          p =
            (g = e.reliability_score) >= 80
              ? "ds-score-high"
              : g >= 60
                ? "ds-score-mid"
                : "ds-score-low";
        var m, g;
        const x = (function (n) {
            return n >= 80 ? "✅" : n >= 60 ? "⚠️" : "❓";
          })(e.reliability_score),
          f = await b(),
          h = f
            ? k(o.verdict || e.summary_content.slice(0, 2e3), "md")
            : '<button class="ds-tts-btn ds-tts-locked" type="button" title="Lecture vocale — Plan Étudiant+"><span class="ds-tts-icon">🔒</span></button>',
          y = f
            ? `\n    <div class="ds-tts-toolbar">\n      <span class="ds-tts-toolbar-label">🔊 Voix</span>\n      <button class="ds-tts-toolbar-btn" id="ds-tts-lang" title="Langue">${"fr" === l.language ? "🇫🇷" : "🇬🇧"}</button>\n      <button class="ds-tts-toolbar-btn" id="ds-tts-gender" title="Genre">${"female" === l.gender ? "♀" : "♂"}</button>\n      <button class="ds-tts-toolbar-btn" id="ds-tts-speed-global" title="Vitesse">${l.speed}x</button>\n    </div>\n  `
            : "",
          w = o.keyPoints
            .map((n) => {
              return `<div class="ds-kp ds-kp-${n.type}">\n      <span class="ds-kp-icon">${((t = n.type), "solid" === t ? "✅" : "weak" === t ? "⚠️" : "💡")}</span>\n      <span class="ds-kp-text">${en(n.text)}</span>\n    </div>`;
              var t;
            })
            .join(""),
          A =
            o.tags.length > 0
              ? `<div class="ds-tags">${o.tags.map((n) => `<span class="ds-tag-pill">${en(n)}</span>`).join("")}</div>`
              : "",
          T = (e.facts_to_verify ?? [])
            .filter((n) => n.trim().length > 0)
            .map((n) => ({ text: n.trim(), icon: "🔍" })),
          $ =
            T.length > 0
              ? `<div style="margin-top:8px">${(function (n, t = 3) {
                  return 0 === n.length
                    ? ""
                    : `<div class="ds-factcheck-list">${n
                        .slice(0, t)
                        .map(
                          (n) =>
                            `<div class="ds-fact-item"><span class="ds-fact-icon">${n.icon}</span><span class="ds-fact-text">${n.text}</span></div>`,
                        )
                        .join("")}</div>`;
                })(T, 2)}</div>`
              : "",
          C = xn(e.category, 4),
          S = (function (n) {
            return 0 === n.length
              ? ""
              : `<div class="ds-chat-suggestions" id="ds-results-suggestions">${n.map((n, t) => `<button class="ds-chat-suggestion" data-index="${t}" type="button">${n}</button>`).join("")}</div>`;
          })(C),
          I = (function (n) {
            const t = hn[n] ?? 0,
              e = [
                {
                  icon: "🃏",
                  label: "Flashcards IA",
                  minPlan: "pro",
                  price: "5,99€",
                },
                {
                  icon: "🧠",
                  label: "Carte mentale",
                  minPlan: "pro",
                  price: "5,99€",
                },
                {
                  icon: "🌐",
                  label: "Recherche web IA",
                  minPlan: "pro",
                  price: "5,99€",
                },
                {
                  icon: "📦",
                  label: "Export PDF/DOCX",
                  minPlan: "pro",
                  price: "5,99€",
                },
              ].filter((n) => (hn[n.minPlan] ?? 0) > t);
            return 0 === e.length
              ? `<div class="ds-teaser-pro-cta"><span>📱 Révisez sur mobile —</span><a href="${a}/mobile" target="_blank" rel="noreferrer" class="ds-teaser-link">Télécharger l'app</a></div>`
              : `\n    <div class="ds-teasers-section">\n      <div class="ds-teasers-title">✨ Débloquez plus</div>\n      <div class="ds-teasers-grid">${e
                  .slice(0, 3)
                  .map(
                    (n) =>
                      `\n    <a href="${a}/upgrade" target="_blank" rel="noreferrer" class="ds-teaser-item" title="Dès ${n.price}/mois">\n      <span class="ds-teaser-icon">${n.icon}</span>\n      <span class="ds-teaser-label">${n.label}</span>\n      <span class="ds-teaser-lock">🔒</span>\n      <span class="ds-teaser-price">${n.price}/m</span>\n    </a>\n  `,
                  )
                  .join(
                    "",
                  )}</div>\n      <a href="${a}/upgrade" target="_blank" rel="noreferrer" class="ds-teasers-all">Voir tous les plans →</a>\n    </div>\n  `;
          })(r);
        var L;
        const z = `\n    ${w ? `<div class="ds-keypoints ds-stagger">${w}</div>` : ""}\n    ${A}\n    ${$}\n\n    <button class="ds-toggle-detail" id="ds-toggle-detail" type="button">\n      <span class="ds-toggle-text">Voir l'analyse détaillée</span>\n      <span class="ds-toggle-arrow">▼</span>\n    </button>\n    <div class="ds-detail-panel hidden" id="ds-detail-panel">\n      <div class="ds-detail-content">${d}</div>\n    </div>\n\n    <div class="ds-share-actions">\n      <button class="ds-btn-outline" id="ds-copy-btn" type="button">📋 Copier</button>\n    </div>\n\n    ${S}\n    <div class="ds-premium-teasers">${I}</div>\n    ${((L = e.id), `\n    <div class="ds-ecosystem-bridge">\n      <a href="${a}/summary/${L}" target="_blank" rel="noreferrer" class="ds-bridge-link" title="Voir l'analyse complète sur le web">\n        🌐 Web\n      </a>\n      <a href="https://apps.apple.com/app/deepsight/id6744066498" target="_blank" rel="noreferrer" class="ds-bridge-link" title="App iOS">\n        🍎 iOS\n      </a>\n      <a href="https://play.google.com/store/apps/details?id=com.deepsight.app" target="_blank" rel="noreferrer" class="ds-bridge-link" title="App Android">\n        🤖 Android\n      </a>\n      <a href="${a}/upgrade" target="_blank" rel="noreferrer" class="ds-bridge-link ds-bridge-upgrade">\n        ⚡ Upgrade\n      </a>\n    </div>\n  `)}\n\n    <div class="ds-card-footer">\n      <a href="${a}" target="_blank" rel="noreferrer">🌐 deepsightsynthesis.com</a>\n    </div>\n  `;
        (G(
          `\n    <div class="ds-results-compact">\n      <div class="ds-status-bar">\n        <span class="ds-done">✅ Analyse prête</span>\n        <div class="ds-status-badges">\n          <span class="ds-tag">${c} ${en(e.category)}</span>\n          <span class="ds-tag ${p}">${x} ${e.reliability_score}%</span>\n        </div>\n      </div>\n\n      <div class="ds-reliability-bar">\n        <div class="ds-reliability-header">\n          <span style="color:var(--ds-text-muted)">Fiabilité</span>\n          <span class="${p}" style="font-weight:600">${e.reliability_score}/100</span>\n        </div>\n        <div class="ds-progress" style="height:6px">\n          <div class="ds-progress-bar ds-fill-bar" data-score="${p.replace("ds-score-", "")}"\n               style="width:${e.reliability_score}%;background:${e.reliability_score >= 80 ? "var(--ds-success)" : e.reliability_score >= 60 ? "var(--ds-warning)" : "var(--ds-error)"}">\n          </div>\n        </div>\n      </div>\n\n      <div class="ds-verdict-compact">\n        <div class="ds-summary-tts-row">\n          <p class="ds-verdict-text-compact" style="flex:1;margin:0">${en(o.verdict)}</p>\n          ${h}\n        </div>\n      </div>\n      ${y}\n\n      <div class="ds-compact-actions">\n        <button class="ds-btn-primary-xl" id="ds-open-fullscreen" type="button">\n          🔍 Voir l'analyse complète\n        </button>\n        <button class="ds-btn-outline-xl" id="ds-share-btn" type="button">\n          🔗 Partager cette analyse\n        </button>\n        <a href="${a}/summary/${e.id}" target="_blank" rel="noreferrer" class="ds-link-tertiary">\n          🌐 Ouvrir sur DeepSight Web ↗\n        </a>\n      </div>\n\n      <details class="ds-details-wrapper">\n        <summary class="ds-details-toggle">▸ Voir le détail ici</summary>\n        <div class="ds-details-body">\n          ${z}\n        </div>\n      </details>\n\n      <button class="ds-btn-secondary-action" id="ds-chat-btn" type="button">\n        💬 Chatter avec la vidéo\n      </button>\n    </div>\n  `,
        ),
          (function (n, e, r) {
            ((0, i.$id)("ds-open-fullscreen")?.addEventListener("click", () => {
              const e = t.runtime.getURL(`viewer.html?id=${n.id}`);
              t.tabs.create({ url: e });
            }),
              (0, i.$id)("ds-toggle-detail")?.addEventListener("click", () => {
                const n = (0, i.$id)("ds-detail-panel"),
                  t = (0, i.$id)("ds-toggle-detail");
                if (!n || !t) return;
                const e = n.classList.contains("hidden");
                n.classList.toggle("hidden");
                const r = t.querySelector(".ds-toggle-arrow"),
                  s = t.querySelector(".ds-toggle-text");
                (r && (r.textContent = e ? "▲" : "▼"),
                  s &&
                    (s.textContent = e
                      ? "Masquer l'analyse"
                      : "Voir l'analyse détaillée"));
              }),
              (0, i.gC)(".ds-timestamp").forEach((n) => {
                n.addEventListener("click", (t) => {
                  t.preventDefault();
                  const e = parseInt(n.dataset.time ?? "0", 10),
                    r = document.querySelector("video");
                  r && ((r.currentTime = e), r.play());
                });
              }),
              (0, i.$id)("ds-chat-btn")?.addEventListener("click", () => {
                e.onChat(n.id, n.video_title);
              }),
              fn("ds-results-suggestions", r, (t) => {
                (e.onChat(n.id, n.video_title),
                  setTimeout(() => {
                    const n = (0, i.$id)("ds-chat-input");
                    n && ((n.value = t), (0, i.$id)("ds-chat-send")?.click());
                  }, 100));
              }),
              (0, i.$id)("ds-copy-btn")?.addEventListener(
                "click",
                e.onCopyLink,
              ),
              (0, i.$id)("ds-share-btn")?.addEventListener("click", e.onShare));
          })(e, n, C),
          E(),
          f &&
            ((0, i.$id)("ds-tts-lang")?.addEventListener("click", () => {
              ((l.language = "fr" === l.language ? "en" : "fr"), u());
              const n = (0, i.$id)("ds-tts-lang");
              n && (n.textContent = "fr" === l.language ? "🇫🇷" : "🇬🇧");
            }),
            (0, i.$id)("ds-tts-gender")?.addEventListener("click", () => {
              ((l.gender = "female" === l.gender ? "male" : "female"), u());
              const n = (0, i.$id)("ds-tts-gender");
              n && (n.textContent = "female" === l.gender ? "♀" : "♂");
            }),
            (0, i.$id)("ds-tts-speed-global")?.addEventListener("click", () => {
              v();
              const n = (0, i.$id)("ds-tts-speed-global");
              n && (n.textContent = `${l.speed}x`);
            })));
      }
      let wn = !1;
      function An(n) {
        return `<div class="ds-chat-msg ${"user" === n.role ? "ds-chat-msg-user" : "ds-chat-msg-assistant"}">${
          "assistant" === n.role
            ? en(n.content)
                .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                .replace(/\*(.*?)\*/g, "<em>$1</em>")
                .replace(/\n/g, "<br>")
            : en(n.content)
        }${n.web_search_used ? `<span style="font-size:10px;color:var(--ds-info);display:block;margin-top:3px">🌐 ${mn().webSearchUsed}</span>` : ""}${"assistant" === n.role && n.content.length > 20 ? `<div style="margin-top:4px">${wn ? k(n.content) : '<button class="ds-tts-btn ds-tts-locked" type="button" title="Lecture vocale — Plan Étudiant+"><span class="ds-tts-icon">🔒</span></button>'}</div>` : ""}</div>`;
      }
      function kn(n) {
        const t = (0, i.$id)("ds-chat-messages");
        if (!t) return;
        const e = t.querySelector('[style*="text-align:center"]');
        e?.remove();
        const r = document.createElement("div");
        r.innerHTML = An(n);
        const s = r.firstElementChild;
        (s && t.appendChild(s), En());
      }
      function En() {
        requestAnimationFrame(() => {
          const n = (0, i.$id)("ds-chat-messages");
          n && (n.scrollTop = n.scrollHeight);
        });
      }
      function Tn(n) {
        const t = (0, i.$id)("ds-chat-input"),
          e = (0, i.$id)("ds-chat-send");
        (t && (t.disabled = n),
          e &&
            ((e.disabled = n),
            (e.innerHTML = n
              ? '<svg class="ds-gouvernail-spinner ds-gouvernail-spinner-sm" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" width="14" height="14"><circle cx="24" cy="24" r="20" opacity="0.3"/><circle cx="24" cy="24" r="3"/><line x1="24" y1="4" x2="24" y2="11"/></svg>'
              : "➤")));
      }
      async function $n(n) {
        const e = (0, i.$id)("ds-chat-input");
        if (!e) return;
        const r = e.value.trim();
        if (!r) return;
        ((e.value = ""),
          Tn(!0),
          (0, i.$id)("ds-chat-suggestions")?.remove(),
          kn({ role: "user", content: r }));
        const s = (0, i.$id)("ds-chat-messages"),
          a = `ds-loading-${Date.now()}`;
        if (s) {
          const n = document.createElement("div");
          ((n.id = a),
            (n.className = "ds-chat-msg ds-chat-msg-assistant"),
            (n.innerHTML =
              '<svg class="ds-gouvernail-spinner ds-gouvernail-spinner-sm" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" width="14" height="14"><circle cx="24" cy="24" r="20" opacity="0.3"/><circle cx="24" cy="24" r="3"/><line x1="24" y1="4" x2="24" y2="11"/></svg> En train de répondre...'),
            s.appendChild(n),
            En());
        }
        try {
          const e = await t.runtime.sendMessage({
            action: "ASK_QUESTION",
            data: { summaryId: n, question: r, options: {} },
          });
          if (((0, i.$id)(a)?.remove(), !e?.success))
            throw new Error(e?.error || "Erreur de chat");
          const s = e.result;
          (kn({
            role: "assistant",
            content: s.response,
            web_search_used: s.web_search_used,
          }),
            E());
        } catch (n) {
          ((0, i.$id)(a)?.remove(),
            kn({ role: "assistant", content: `❌ ${n.message}` }));
        } finally {
          (Tn(!1), (0, i.$id)("ds-chat-input")?.focus());
        }
      }
      const Cn = "ds_crash_log";
      let Sn = [];
      function In(n, t) {
        (Sn.push({ step: n, detail: t, t: Date.now() }),
          Sn.length > 100 && (Sn = Sn.slice(-100)));
        try {
          void 0 !== t
            ? console.log("[DeepSight-boot]", n, t)
            : console.log("[DeepSight-boot]", n);
        } catch {}
      }
      async function Ln(n, t) {
        const e = n instanceof Error ? n : new Error(String(n)),
          r = {
            message: e.message || "Unknown error",
            stack: e.stack,
            context: t,
            steps: Sn.map((n) => n.step),
            timestamp: Date.now(),
            url:
              "undefined" != typeof location && location.href
                ? location.href
                : "",
            userAgent:
              "undefined" != typeof navigator && navigator.userAgent
                ? navigator.userAgent
                : "",
          };
        try {
          const n = await chrome.storage.local.get(Cn),
            t = [...(Array.isArray(n[Cn]) ? n[Cn] : []), r].slice(-20);
          await chrome.storage.local.set({ [Cn]: t });
        } catch (n) {
          try {
            console.error("[DeepSight-crash]", r, n);
          } catch {}
        }
      }
      const zn = {
        state: "login",
        videoId: null,
        currentTaskId: null,
        user: null,
        planInfo: null,
        summary: null,
        tournesol: null,
        injected: !1,
        injectionAttempts: 0,
      };
      function Pn() {
        try {
          if (zn.injected && H())
            return void In("inject:skip-already-injected");
          if (zn.injectionAttempts > 30)
            return void In("inject:max-attempts-reached");
          (zn.injectionAttempts++,
            In("inject:attempt", { n: zn.injectionAttempts }));
          const r = (function () {
              const n = window.location.hostname;
              return n.includes("youtube.com") || n.includes("youtu.be")
                ? "youtube"
                : n.includes("tiktok.com")
                  ? "tiktok"
                  : null;
            })(),
            s = "tiktok" === r;
          In("inject:platform-theme", { platform: r, theme: z() });
          const a = (function (n, t) {
            let e, r;
            try {
              e = document.createElement("div");
            } catch {
              return null;
            }
            ((e.id = N),
              (e.style.cssText =
                "all:initial;display:block;width:100%;max-width:420px;margin-bottom:12px;background-color:#0a0a0f;color-scheme:dark;"),
              t &&
                (e.style.cssText =
                  "all:initial;position:fixed;bottom:20px;right:20px;width:360px;max-height:80vh;z-index:2147483646;background-color:#0a0a0f;color-scheme:dark;"));
            try {
              r = e.attachShadow({ mode: "closed" });
            } catch {
              return null;
            }
            (0, i.PM)(r);
            const s = (n) => {
              n.stopPropagation();
            };
            (e.addEventListener("keydown", s),
              e.addEventListener("keyup", s),
              e.addEventListener("keypress", s));
            const a = document.createElement("style");
            ((a.textContent = [_, j, R].join("\n\n")), r.appendChild(a));
            const o = document.createElement("div");
            return (
              (o.id = O),
              (o.className = "ds-widget deepsight-card dark"),
              (o.style.backgroundColor = "#0a0a0f"),
              (o.style.color = "#f5f0e8"),
              t &&
                (o.classList.add("deepsight-card-floating"),
                (o.style.cssText =
                  "overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.5);border-radius:12px;background-color:#0a0a0f;color:#f5f0e8;")),
              r.appendChild(o),
              e
            );
          })(0, s);
          if (!a) {
            In("inject:createWidgetShell-returned-null");
            const n = zn.injectionAttempts <= 10 ? 300 : 1e3;
            return void setTimeout(Pn, n);
          }
          const o = H();
          if (o) {
            o.innerHTML = `\n    <div class="ds-card-header">\n      <div class="ds-card-logo">${(function (
              n = 22,
            ) {
              return `<img src="${t.runtime.getURL("assets/deepsight-logo-cosmic.png")}" alt="DeepSight" width="${n}" height="${n}" style="object-fit:contain;border-radius:50%;" />`;
            })(
              22,
            )}<span>Deep Sight</span></div>\n      <div style="display:flex;align-items:center;gap:4px">\n        <span class="ds-card-badge">AI</span>\n        <button class="ds-minimize-btn" id="ds-minimize-btn" type="button" title="Réduire">−</button>\n      </div>\n    </div>\n  `;
            const r =
                ((n = () => {
                  (In("skeleton:retry-clicked"),
                    (zn.injected = !1),
                    (zn.injectionAttempts = 0),
                    U(),
                    Pn());
                }),
                {
                  html: '\n    <div class="ds-card-body">\n      <div class="ds-loading" style="padding:16px;text-align:center">\n        <div style="color:var(--ds-gold-mid);font-size:24px;margin-bottom:8px">⏳</div>\n        <p class="ds-loading-text" style="color:var(--ds-text-secondary);font-size:12px;margin:0 0 12px">\n          Chargement de DeepSight…\n        </p>\n        <button\n          type="button"\n          id="ds-skeleton-retry"\n          class="ds-btn ds-btn-primary"\n          style="font-size:11px;padding:6px 12px;display:none"\n        >\n          Réessayer\n        </button>\n      </div>\n    </div>\n  ',
                  bind: () => {
                    Promise.resolve()
                      .then(e.bind(e, 40))
                      .then(({ $id: t }) => {
                        setTimeout(() => {
                          const e = t("ds-skeleton-retry");
                          e &&
                            !e.hasAttribute("data-bound") &&
                            (e.setAttribute("data-bound", "1"),
                            (e.style.display = "inline-block"),
                            e.addEventListener("click", n));
                        }, 1e4);
                      })
                      .catch(() => {});
                  },
                }),
              s = document.createElement("div");
            s.innerHTML = r.html;
            const a = s.firstElementChild;
            (a && o.appendChild(a),
              r.bind(),
              In("inject:widget-populated-with-skeleton"));
          } else In("inject:widgetCard-null");
          const d = (function (n, t) {
            const e = document.getElementById(N);
            if ((e && e !== n && e.remove(), (F = !1), t)) {
              for (const t of q)
                if (document.querySelector(t))
                  return (document.body.appendChild(n), !0);
              return !1;
            }
            for (const { selector: t, position: e } of D) {
              const r = document.querySelector(t);
              if (r instanceof HTMLElement && B(r))
                return (
                  "prepend" === e
                    ? r.insertBefore(n, r.firstChild)
                    : r.parentElement?.insertBefore(n, r.nextSibling),
                  !0
                );
            }
            return (
              (F = !0),
              (n.style.cssText =
                "all:initial;position:fixed;bottom:20px;right:20px;width:380px;max-height:80vh;z-index:2147483646;"),
              document.body.appendChild(n),
              !0
            );
          })(a, s);
          if ((In("inject:injectWidget-result", { success: d }), d))
            ((zn.injected = !0),
              (zn.injectionAttempts = 0),
              (function () {
                const n = (0, i.$id)("ds-minimize-btn"),
                  e = H();
                n &&
                  e &&
                  (t.storage.local.get(["ds_minimized"]).then((n) => {
                    n.ds_minimized && Q();
                  }),
                  n.addEventListener("click", () => {
                    e.classList.contains("ds-collapsed")
                      ? ((function () {
                          const n = H(),
                            t = (0, i.$id)("ds-minimize-btn");
                          n &&
                            (n.classList.remove("ds-collapsed"),
                            t && (t.textContent = "−"));
                        })(),
                        t.storage.local.set({ ds_minimized: !1 }))
                      : (Q(), t.storage.local.set({ ds_minimized: !0 }));
                  }));
              })(),
              (function (n) {
                M();
                const t = new MutationObserver(() => {
                  n(z());
                });
                t.observe(document.documentElement, {
                  attributes: !0,
                  attributeFilter: ["dark", "class"],
                });
                const e = window.matchMedia("(prefers-color-scheme: dark)"),
                  r = () => {
                    n(z());
                  };
                (e.addEventListener("change", r),
                  (P = () => {
                    (e.removeEventListener("change", r), t.disconnect());
                  }));
              })(() => {
                const n = H();
                n &&
                  !n.classList.contains("dark") &&
                  (n.classList.remove("light"), n.classList.add("dark"));
              }),
              (function () {
                X();
                const n =
                  document.querySelector("ytd-watch-flexy") ||
                  document.querySelector("#content");
                n &&
                  ((K = new MutationObserver(() => {
                    document.getElementById("deepsight-host") ||
                      (In("observer:widget-detached"),
                      (zn.injected = !1),
                      Pn());
                  })),
                  K.observe(n, { childList: !0, subtree: !1 }));
              })(),
              (function (n) {
                tn();
                const t = document.querySelector("ytd-watch-flexy");
                (t &&
                  ((J = new MutationObserver(() => n(Z()))),
                  J.observe(t, {
                    attributes: !0,
                    attributeFilter: ["theater"],
                  })),
                  (nn = () => n(Z())),
                  document.addEventListener("fullscreenchange", nn));
              })((n) => {
                const t = document.getElementById("deepsight-host");
                t &&
                  ("fullscreen" === n
                    ? (t.style.display = "none")
                    : "theater" === n
                      ? ((t.style.cssText =
                          "all:initial;position:fixed;bottom:20px;right:20px;width:380px;max-height:80vh;z-index:2147483646;"),
                        (t.style.display = ""))
                      : (t.style.cssText =
                          "all:initial;display:block;width:100%;max-width:420px;margin-bottom:12px;"));
              }),
              In("inject:success-calling-initCard"),
              Mn());
          else {
            const n = 15e3;
            if (500 * zn.injectionAttempts >= n)
              (In("inject:budget-exceeded-force-floating"),
                (zn.injected = !1),
                setTimeout(Pn, 1e3));
            else {
              const n = zn.injectionAttempts <= 10 ? 300 : 1e3;
              setTimeout(Pn, n);
            }
          }
        } catch (n) {
          (In("inject:caught-error", { message: n.message }),
            Ln(n, { step: "tryInjectWidget", attempt: zn.injectionAttempts }),
            zn.injectionAttempts < 3 && setTimeout(Pn, 1e3));
        }
        var n;
      }
      async function Mn() {
        try {
          const r = await ((n = t.runtime.sendMessage({
            action: "CHECK_AUTH",
          })),
          (e = { authenticated: !1 }),
          new Promise((t) => {
            let r = !1;
            const s = setTimeout(() => {
              r || ((r = !0), t(e));
            }, 5e3);
            n.then(
              (n) => {
                r || ((r = !0), clearTimeout(s), t(n));
              },
              () => {
                r || ((r = !0), clearTimeout(s), t(e));
              },
            );
          }));
          if (
            (In("initCard:auth-checked", { authenticated: !!r?.authenticated }),
            !r?.authenticated)
          )
            return (
              (zn.state = "login"),
              (zn.user = null),
              void ln(() => Mn())
            );
          ((zn.user = r.user ?? null),
            t.runtime
              .sendMessage({ action: "GET_PLAN" })
              .then((n) => {
                const t = n;
                t?.success && (zn.planInfo = t.plan ?? null);
              })
              .catch(() => {}),
            zn.videoId &&
              (async function (n) {
                try {
                  const e = await t.runtime.sendMessage({
                    action: "GET_TOURNESOL",
                    data: { videoId: n },
                  });
                  return e?.success && e.data ? e.data : null;
                } catch {
                  return null;
                }
              })(zn.videoId)
                .then((n) => {
                  ((zn.tournesol = n),
                    "ready" === zn.state &&
                      zn.user &&
                      gn({
                        user: {
                          username: zn.user.username,
                          plan: zn.user.plan,
                          credits: zn.user.credits,
                        },
                        tournesol: zn.tournesol,
                        videoTitle: _n(),
                        onAnalyze: (n, t) => Rn(n, t),
                        onQuickChat: (n) => On(n),
                        onLogout: Bn,
                      }));
                })
                .catch(() => {}),
            (zn.state = "ready"),
            gn({
              user: {
                username: zn.user.username,
                plan: zn.user.plan,
                credits: zn.user.credits,
              },
              tournesol: zn.tournesol,
              videoTitle: _n(),
              onAnalyze: (n, t) => Rn(n, t),
              onQuickChat: (n) => On(n),
              onLogout: Bn,
            }));
        } catch (n) {
          Fn(`Erreur d'initialisation: ${n.message}`);
        }
        var n, e;
      }
      function _n() {
        const n = document.querySelector('meta[property="og:title"]');
        if (n instanceof HTMLMetaElement && n.content) return n.content;
        const t = document.querySelector('meta[name="title"]');
        if (t instanceof HTMLMetaElement && t.content) return t.content;
        const e =
          document.querySelector("ytd-watch-metadata h1 yt-formatted-string") ??
          document.querySelector("h1.title yt-formatted-string") ??
          document.querySelector("h1.title");
        if (e?.textContent?.trim()) return e.textContent.trim();
        return (
          document.title.replace(/\s*[-–—]\s*YouTube\s*$/, "").trim() || ""
        );
      }
      function jn() {
        (zn.currentTaskId &&
          t.runtime
            .sendMessage({
              action: "CANCEL_ANALYSIS",
              data: { taskId: zn.currentTaskId },
            })
            .catch(() => {}),
          (zn.state = "ready"),
          (zn.currentTaskId = null),
          zn.user &&
            gn({
              user: {
                username: zn.user.username,
                plan: zn.user.plan,
                credits: zn.user.credits,
              },
              tournesol: zn.tournesol,
              videoTitle: _n(),
              onAnalyze: Rn,
              onQuickChat: On,
              onLogout: Bn,
            }));
      }
      async function Rn(n, e) {
        if (!zn.videoId) return;
        ((zn.state = "analyzing"),
          (zn.currentTaskId = null),
          (function (n, t, e) {
            if (
              (G(
                `\n    <div class="ds-analyzing-container">\n      <div class="ds-loading" style="text-align:center;padding:16px 0">\n        \n    <div class="ds-gouvernail-spinner" style="width:48px;height:48px;">\n      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">\n        <circle cx="24" cy="24" r="20" opacity="0.3"/>\n        <circle cx="24" cy="24" r="3"/>\n        <line x1="24" y1="4" x2="24" y2="11"/>\n        <line x1="38.1" y1="9.9" x2="33.2" y2="14.8"/>\n        <line x1="44" y1="24" x2="37" y2="24"/>\n        <line x1="38.1" y1="38.1" x2="33.2" y2="33.2"/>\n        <line x1="24" y1="44" x2="24" y2="37"/>\n        <line x1="9.9" y1="38.1" x2="14.8" y2="33.2"/>\n        <line x1="4" y1="24" x2="11" y2="24"/>\n        <line x1="9.9" y1="9.9" x2="14.8" y2="14.8"/>\n      </svg>\n    </div>\n        <p class="ds-loading-text" id="ds-progress-text">${en("Démarrage de l'analyse...")}</p>\n      </div>\n      <div class="ds-progress" style="margin:8px 0">\n        <div class="ds-progress-bar" id="ds-progress-bar" style="width:0%"></div>\n      </div>\n      <button id="ds-cancel-btn" style="\n        display:block;margin:12px auto 0;padding:6px 16px;\n        background:transparent;border:1px solid rgba(255,255,255,0.15);\n        border-radius:8px;color:rgba(255,255,255,0.5);font-size:12px;\n        cursor:pointer;transition:all 0.2s;\n      ">Annuler</button>\n    </div>\n  `,
              ),
              e)
            ) {
              const n = W(),
                t = n?.querySelector("#ds-cancel-btn");
              t &&
                (t.addEventListener("click", e),
                t.addEventListener("mouseenter", () => {
                  ((t.style.color = "#ef4444"),
                    (t.style.borderColor = "rgba(239,68,68,0.3)"),
                    (t.style.background = "rgba(239,68,68,0.1)"));
                }),
                t.addEventListener("mouseleave", () => {
                  ((t.style.color = "rgba(255,255,255,0.5)"),
                    (t.style.borderColor = "rgba(255,255,255,0.15)"),
                    (t.style.background = "transparent"));
                }));
            }
          })(0, 0, jn));
        const r = window.location.href;
        try {
          const s = await t.runtime.sendMessage({
            action: "ANALYZE_VIDEO",
            data: { url: r, options: { mode: n, lang: e, category: "auto" } },
          });
          if (!s?.success) throw new Error(s?.error || "Analyse échouée");
          const a = s.result;
          if ("completed" === a.status && a.result?.summary_id)
            await (async function (n) {
              const e = await t.runtime.sendMessage({
                action: "GET_SUMMARY",
                data: { summaryId: n },
              });
              if (!e?.success)
                throw new Error(e?.error || "Récupération analyse échouée");
              ((zn.summary = e.summary),
                (zn.state = "results"),
                zn.videoId &&
                  (await (async function (n) {
                    const e = (
                      await (async function () {
                        return (
                          (await t.storage.local.get(["recentAnalyses"]))
                            .recentAnalyses || []
                        );
                      })()
                    ).filter((t) => t.videoId !== n.videoId);
                    (e.unshift({ ...n, timestamp: Date.now() }),
                      await t.storage.local.set({
                        recentAnalyses: e.slice(0, 20),
                      }));
                  })({
                    videoId: zn.videoId,
                    summaryId: zn.summary.id,
                    title: zn.summary.video_title,
                  })),
                await yn({
                  summary: zn.summary,
                  userPlan: zn.user?.plan ?? "free",
                  onChat: Nn,
                  onCopyLink: Dn,
                  onShare: qn,
                }));
            })(a.result.summary_id);
          else if ("failed" === a.status)
            throw new Error(a.error ?? "Analyse échouée");
        } catch (n) {
          ((zn.state = "ready"),
            Fn(n.message),
            setTimeout(() => {
              zn.user &&
                gn({
                  user: {
                    username: zn.user.username,
                    plan: zn.user.plan,
                    credits: zn.user.credits,
                  },
                  tournesol: zn.tournesol,
                  videoTitle: _n(),
                  onAnalyze: Rn,
                  onQuickChat: On,
                  onLogout: Bn,
                });
            }, 3e3));
        }
      }
      async function On(n) {
        try {
          const e = await t.runtime.sendMessage({
            action: "QUICK_CHAT",
            data: { url: window.location.href, lang: n },
          });
          if (!e?.success) throw new Error(e?.error || "Quick Chat échoué");
          const r = e.result;
          Nn(r.summary_id, r.video_title);
        } catch (n) {
          Fn(n.message);
          const t = (0, i.$id)("ds-quickchat-btn");
          t && ((t.disabled = !1), (t.innerHTML = "💬 Quick Chat IA"));
        }
      }
      async function Nn(n, e) {
        zn.state = "chat";
        let r = [];
        try {
          const e = await t.runtime.sendMessage({
            action: "GET_CHAT_HISTORY",
            data: { summaryId: n },
          });
          e?.success && Array.isArray(e.result) && (r = e.result);
        } catch {}
        await (async function (n) {
          const {
              summaryId: t,
              videoTitle: e,
              category: r = "default",
              messages: s = [],
              onBack: o,
            } = n,
            d = xn(r, 4);
          wn = await b();
          const l = s.map(An).join("");
          (G(
            `\n    <div class="ds-chat-container ds-animate-fadeIn">\n      ${o ? `<button class="ds-link-btn" id="ds-chat-back" type="button" style="font-size:11px;margin-bottom:4px">← ${mn().backToResults}</button>` : ""}\n      <div style="font-size:11px;color:var(--ds-text-muted);margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${en(e)}">\n        💬 Chat — ${en(e)}\n      </div>\n\n      <div class="ds-chat-messages" id="ds-chat-messages">\n        ${l || `<div style="text-align:center;color:var(--ds-text-muted);font-size:11px;padding:16px 0">${mn().askQuestion}</div>`}\n      </div>\n\n      ${0 === s.length ? `\n        <div class="ds-chat-suggestions" id="ds-chat-suggestions">\n          ${d.map((n, t) => `<button class="ds-chat-suggestion" data-index="${t}" type="button">${en(n)}</button>`).join("")}\n        </div>\n      ` : ""}\n\n      <div class="ds-chat-input-row">\n        <input\n          type="text"\n          id="ds-chat-input"\n          class="ds-chat-input"\n          placeholder="Posez une question..."\n          autocomplete="off"\n          maxlength="500"\n        />\n        <button class="ds-chat-send-btn" id="ds-chat-send" type="button" title="Envoyer">➤</button>\n      </div>\n\n      <div class="ds-card-footer" style="margin-top:6px">\n        <a href="${a}/summary/${t}" target="_blank" rel="noreferrer" style="font-size:11px">\n          📖 Voir l'analyse complète\n        </a>\n        <span style="font-size:11px;color:var(--ds-text-muted)">Alt+C pour ouvrir</span>\n      </div>\n    </div>\n  `,
          ),
            (function (n, t, e) {
              (e && (0, i.$id)("ds-chat-back")?.addEventListener("click", e),
                fn("ds-chat-suggestions", t, (t) => {
                  const e = (0, i.$id)("ds-chat-input");
                  e && ((e.value = t), $n(n));
                }));
              const r = (0, i.$id)("ds-chat-input"),
                s = (0, i.$id)("ds-chat-send");
              (s?.addEventListener("click", () => $n(n)),
                r?.addEventListener("keydown", (t) => {
                  "Enter" !== t.key ||
                    t.shiftKey ||
                    (t.preventDefault(), $n(n));
                }));
            })(t, d, o),
            E(),
            En());
        })({
          summaryId: n,
          videoTitle: e,
          category: zn.summary?.category ?? "default",
          messages: r,
          onBack: zn.summary
            ? () => {
                ((zn.state = "results"),
                  yn({
                    summary: zn.summary,
                    userPlan: zn.user?.plan ?? "free",
                    onChat: Nn,
                    onCopyLink: Dn,
                    onShare: qn,
                  }));
              }
            : void 0,
        });
      }
      async function Dn() {
        if (!zn.summary) return;
        const n = (0, i.$id)("ds-copy-btn");
        if (!n) return;
        let e = `${a}/summary/${zn.summary.id}`;
        try {
          const n = await t.runtime.sendMessage({
            action: "SHARE_ANALYSIS",
            data: { videoId: zn.videoId },
          });
          n?.success && n.share_url && (e = n.share_url);
        } catch {}
        const r = [
          "🎯 DeepSight — Analyse IA",
          "",
          `📹 ${zn.summary.video_title}`,
          `🏷️ Catégorie: ${zn.summary.category}`,
          `📊 Fiabilité: ${zn.summary.reliability_score}%`,
          "",
          `🔗 ${e}`,
          "—",
          "deepsightsynthesis.com",
        ].join("\n");
        try {
          (await navigator.clipboard.writeText(r),
            (n.textContent = "✅ Copié!"),
            setTimeout(() => {
              n.textContent = "📋 Copier";
            }, 2e3));
        } catch {
          ((n.textContent = "❌ Échec"),
            setTimeout(() => {
              n.textContent = "📋 Copier";
            }, 2e3));
        }
      }
      async function qn() {
        if (!zn.summary) return;
        const n = (0, i.$id)("ds-share-btn");
        if (n)
          try {
            const e = await t.runtime.sendMessage({
                action: "SHARE_ANALYSIS",
                data: { videoId: zn.videoId },
              }),
              r = e?.success ? e.share_url : `${a}/summary/${zn.summary.id}`;
            (await navigator.clipboard.writeText(r),
              (n.textContent = "✅ Lien copié!"),
              setTimeout(() => {
                n.textContent = "🔗 Partager";
              }, 2e3));
          } catch {
            ((n.textContent = "❌ Échec"),
              setTimeout(() => {
                n.textContent = "🔗 Partager";
              }, 2e3));
          }
      }
      async function Bn() {
        (await t.runtime.sendMessage({ action: "LOGOUT" }),
          (zn.user = null),
          (zn.planInfo = null),
          (zn.summary = null),
          (zn.tournesol = null),
          (zn.state = "login"),
          ln(() => Mn()));
      }
      function Fn(n) {
        const t = W();
        if (!t) return;
        const e = "undefined" != typeof navigator && !navigator.onLine,
          r = document.createElement("div");
        if (
          ((r.style.cssText =
            "padding:8px 12px;background:var(--ds-error-bg);border-radius:8px;font-size:11px;color:var(--ds-error);margin-top:8px;display:flex;flex-direction:column;gap:6px"),
          (r.textContent = e
            ? "📡 Hors ligne — vérifiez votre connexion"
            : `❌ ${n}`),
          e)
        ) {
          const n = document.createElement("button");
          ((n.type = "button"),
            (n.textContent = "Réessayer"),
            (n.style.cssText =
              "padding:4px 8px;border-radius:4px;background:var(--ds-gold-mid);color:#0a0a0f;border:none;font-size:10px;cursor:pointer;align-self:flex-start"),
            n.addEventListener("click", () => {
              Mn();
            }),
            r.appendChild(n));
        }
        t.appendChild(r);
      }
      async function Un(n) {
        (f(),
          X(),
          tn(),
          M(),
          (T = null),
          $(),
          (zn.videoId = n),
          (zn.summary = null),
          (zn.tournesol = null),
          (zn.state = "login"),
          (zn.injected = !1),
          (zn.injectionAttempts = 0),
          U(),
          n && I() && setTimeout(Pn, 800));
      }
      function Hn() {
        try {
          if (
            (In("bootstrap:start", {
              url: location.href,
              readyState: document.readyState,
            }),
            !I())
          )
            return void In("bootstrap:not-video-page");
          if (((zn.videoId = L()), !zn.videoId))
            return void In("bootstrap:no-video-id");
          (In("bootstrap:video-id", { videoId: zn.videoId }),
            $(),
            In("bootstrap:anchor-ready", { ready: Y() }),
            setTimeout(Pn, 1e3),
            (function (n) {
              let t = L();
              function e() {
                const e = L();
                e !== t && ((t = e), setTimeout(() => n(e), 500));
              }
              const r = history.pushState;
              ((history.pushState = function (...n) {
                (r.apply(history, n), e());
              }),
                window.addEventListener("popstate", e),
                document.addEventListener("yt-navigate-finish", e),
                document.addEventListener("yt-page-data-updated", e));
            })(Un),
            In("bootstrap:ready"));
        } catch (n) {
          (In("bootstrap:caught-error", { message: n.message }),
            Ln(n, { step: "bootstrap" }));
        }
      }
      (t.runtime.onMessage.addListener((n) => {
        const t = n;
        if ("ANALYSIS_PROGRESS" === t.action) {
          const { taskId: n, progress: e, message: r } = t.data;
          return (
            "analyzing" === zn.state &&
              ((zn.currentTaskId = n),
              (function (n, t) {
                const e = W();
                if (!e) return;
                const r = e.querySelector("#ds-progress-bar"),
                  s = e.querySelector("#ds-progress-text");
                (r && (r.style.width = `${t}%`), s && (s.textContent = n));
              })(r, e)),
            Promise.resolve({ success: !0 })
          );
        }
        return "TOGGLE_WIDGET" === t.action
          ? (H() ? U() : Pn(), Promise.resolve({ success: !0 }))
          : "START_ANALYSIS_FROM_COMMAND" === t.action
            ? ("ready" === zn.state && Rn("standard", "fr"),
              Promise.resolve({ success: !0 }))
            : "OPEN_CHAT_FROM_COMMAND" === t.action
              ? ("results" === zn.state &&
                  zn.summary &&
                  Nn(zn.summary.id, zn.summary.video_title),
                Promise.resolve({ success: !0 }))
              : void 0;
      }),
        window.addEventListener("error", (n) => {
          n.error && Ln(n.error, { source: "window.onerror" });
        }),
        window.addEventListener("unhandledrejection", (n) => {
          Ln(n.reason, { source: "unhandledrejection" });
        }),
        "undefined" != typeof window &&
          window.addEventListener("online", () => {
            (In("network:online-retry"),
              ("login" !== zn.state && "ready" !== zn.state) || Mn());
          }),
        "loading" === document.readyState
          ? document.addEventListener("DOMContentLoaded", Hn)
          : Hn());
    })());
})();
