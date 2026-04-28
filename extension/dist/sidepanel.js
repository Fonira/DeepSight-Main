(() => {
  var e,
    t,
    n = {
      815(e, t) {
        var n, a;
        ("undefined" != typeof globalThis
          ? globalThis
          : "undefined" != typeof self && self,
          (n = function (e) {
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
              const t =
                  "The message port closed before a response was received.",
                n = (e) => {
                  const n = {
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
                  if (0 === Object.keys(n).length)
                    throw new Error(
                      "api-metadata.json has not been included in browser-polyfill",
                    );
                  class a extends WeakMap {
                    constructor(e, t = void 0) {
                      (super(t), (this.createItem = e));
                    }
                    get(e) {
                      return (
                        this.has(e) || this.set(e, this.createItem(e)),
                        super.get(e)
                      );
                    }
                  }
                  const s =
                      (t, n) =>
                      (...a) => {
                        e.runtime.lastError
                          ? t.reject(new Error(e.runtime.lastError.message))
                          : n.singleCallbackArg ||
                              (a.length <= 1 && !1 !== n.singleCallbackArg)
                            ? t.resolve(a[0])
                            : t.resolve(a);
                      },
                    r = (e) => (1 == e ? "argument" : "arguments"),
                    i = (e, t, n) =>
                      new Proxy(t, { apply: (t, a, s) => n.call(a, e, ...s) });
                  let o = Function.call.bind(Object.prototype.hasOwnProperty);
                  const l = (e, t = {}, n = {}) => {
                      let a = Object.create(null),
                        c = {
                          has: (t, n) => n in e || n in a,
                          get(c, d, u) {
                            if (d in a) return a[d];
                            if (!(d in e)) return;
                            let m = e[d];
                            if ("function" == typeof m)
                              if ("function" == typeof t[d])
                                m = i(e, e[d], t[d]);
                              else if (o(n, d)) {
                                let t = ((e, t) =>
                                  function (n, ...a) {
                                    if (a.length < t.minArgs)
                                      throw new Error(
                                        `Expected at least ${t.minArgs} ${r(t.minArgs)} for ${e}(), got ${a.length}`,
                                      );
                                    if (a.length > t.maxArgs)
                                      throw new Error(
                                        `Expected at most ${t.maxArgs} ${r(t.maxArgs)} for ${e}(), got ${a.length}`,
                                      );
                                    return new Promise((r, i) => {
                                      if (t.fallbackToNoCallback)
                                        try {
                                          n[e](
                                            ...a,
                                            s({ resolve: r, reject: i }, t),
                                          );
                                        } catch (s) {
                                          (console.warn(
                                            `${e} API method doesn't seem to support the callback parameter, falling back to call it without a callback: `,
                                            s,
                                          ),
                                            n[e](...a),
                                            (t.fallbackToNoCallback = !1),
                                            (t.noCallback = !0),
                                            r());
                                        }
                                      else
                                        t.noCallback
                                          ? (n[e](...a), r())
                                          : n[e](
                                              ...a,
                                              s({ resolve: r, reject: i }, t),
                                            );
                                    });
                                  })(d, n[d]);
                                m = i(e, e[d], t);
                              } else m = m.bind(e);
                            else if (
                              "object" == typeof m &&
                              null !== m &&
                              (o(t, d) || o(n, d))
                            )
                              m = l(m, t[d], n[d]);
                            else {
                              if (!o(n, "*"))
                                return (
                                  Object.defineProperty(a, d, {
                                    configurable: !0,
                                    enumerable: !0,
                                    get: () => e[d],
                                    set(t) {
                                      e[d] = t;
                                    },
                                  }),
                                  m
                                );
                              m = l(m, t[d], n["*"]);
                            }
                            return ((a[d] = m), m);
                          },
                          set: (t, n, s, r) => (
                            n in a ? (a[n] = s) : (e[n] = s),
                            !0
                          ),
                          defineProperty: (e, t, n) =>
                            Reflect.defineProperty(a, t, n),
                          deleteProperty: (e, t) =>
                            Reflect.deleteProperty(a, t),
                        },
                        d = Object.create(e);
                      return new Proxy(d, c);
                    },
                    c = (e) => ({
                      addListener(t, n, ...a) {
                        t.addListener(e.get(n), ...a);
                      },
                      hasListener: (t, n) => t.hasListener(e.get(n)),
                      removeListener(t, n) {
                        t.removeListener(e.get(n));
                      },
                    }),
                    d = new a((e) =>
                      "function" != typeof e
                        ? e
                        : function (t) {
                            const n = l(
                              t,
                              {},
                              { getContent: { minArgs: 0, maxArgs: 0 } },
                            );
                            e(n);
                          },
                    ),
                    u = new a((e) =>
                      "function" != typeof e
                        ? e
                        : function (t, n, a) {
                            let s,
                              r,
                              i = !1,
                              o = new Promise((e) => {
                                s = function (t) {
                                  ((i = !0), e(t));
                                };
                              });
                            try {
                              r = e(t, n, s);
                            } catch (e) {
                              r = Promise.reject(e);
                            }
                            const l =
                              !0 !== r &&
                              (c = r) &&
                              "object" == typeof c &&
                              "function" == typeof c.then;
                            var c;
                            if (!0 !== r && !l && !i) return !1;
                            return (
                              (l ? r : o)
                                .then(
                                  (e) => {
                                    a(e);
                                  },
                                  (e) => {
                                    let t;
                                    ((t =
                                      e &&
                                      (e instanceof Error ||
                                        "string" == typeof e.message)
                                        ? e.message
                                        : "An unexpected error occurred"),
                                      a({
                                        __mozWebExtensionPolyfillReject__: !0,
                                        message: t,
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
                    m = ({ reject: n, resolve: a }, s) => {
                      e.runtime.lastError
                        ? e.runtime.lastError.message === t
                          ? a()
                          : n(new Error(e.runtime.lastError.message))
                        : s && s.__mozWebExtensionPolyfillReject__
                          ? n(new Error(s.message))
                          : a(s);
                    },
                    p = (e, t, n, ...a) => {
                      if (a.length < t.minArgs)
                        throw new Error(
                          `Expected at least ${t.minArgs} ${r(t.minArgs)} for ${e}(), got ${a.length}`,
                        );
                      if (a.length > t.maxArgs)
                        throw new Error(
                          `Expected at most ${t.maxArgs} ${r(t.maxArgs)} for ${e}(), got ${a.length}`,
                        );
                      return new Promise((e, t) => {
                        const s = m.bind(null, { resolve: e, reject: t });
                        (a.push(s), n.sendMessage(...a));
                      });
                    },
                    g = {
                      devtools: { network: { onRequestFinished: c(d) } },
                      runtime: {
                        onMessage: c(u),
                        onMessageExternal: c(u),
                        sendMessage: p.bind(null, "sendMessage", {
                          minArgs: 1,
                          maxArgs: 3,
                        }),
                      },
                      tabs: {
                        sendMessage: p.bind(null, "sendMessage", {
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
                    (n.privacy = {
                      network: { "*": h },
                      services: { "*": h },
                      websites: { "*": h },
                    }),
                    l(e, g, n)
                  );
                };
              e.exports = n(chrome);
            }
          }),
          void 0 === (a = n.apply(t, [e])) || (e.exports = a));
      },
    },
    a = {};
  function s(e) {
    var t = a[e];
    if (void 0 !== t) return t.exports;
    var r = (a[e] = { exports: {} });
    return (n[e].call(r.exports, r, r.exports, s), r.exports);
  }
  ((s.m = n),
    (s.n = (e) => {
      var t = e && e.__esModule ? () => e.default : () => e;
      return (s.d(t, { a: t }), t);
    }),
    (s.d = (e, t) => {
      for (var n in t)
        s.o(t, n) &&
          !s.o(e, n) &&
          Object.defineProperty(e, n, { enumerable: !0, get: t[n] });
    }),
    (s.f = {}),
    (s.e = (e) =>
      Promise.all(Object.keys(s.f).reduce((t, n) => (s.f[n](e, t), t), []))),
    (s.u = (e) => "elevenlabs-sdk.js"),
    (s.miniCssF = (e) => {}),
    (s.g = (function () {
      if ("object" == typeof globalThis) return globalThis;
      try {
        return this || new Function("return this")();
      } catch (e) {
        if ("object" == typeof window) return window;
      }
    })()),
    (s.o = (e, t) => Object.prototype.hasOwnProperty.call(e, t)),
    (e = {}),
    (t = "deepsight-extension:"),
    (s.l = (n, a, r, i) => {
      if (e[n]) e[n].push(a);
      else {
        var o, l;
        if (void 0 !== r)
          for (
            var c = document.getElementsByTagName("script"), d = 0;
            d < c.length;
            d++
          ) {
            var u = c[d];
            if (
              u.getAttribute("src") == n ||
              u.getAttribute("data-webpack") == t + r
            ) {
              o = u;
              break;
            }
          }
        (o ||
          ((l = !0),
          ((o = document.createElement("script")).charset = "utf-8"),
          s.nc && o.setAttribute("nonce", s.nc),
          o.setAttribute("data-webpack", t + r),
          (o.src = n)),
          (e[n] = [a]));
        var m = (t, a) => {
            ((o.onerror = o.onload = null), clearTimeout(p));
            var s = e[n];
            if (
              (delete e[n],
              o.parentNode && o.parentNode.removeChild(o),
              s && s.forEach((e) => e(a)),
              t)
            )
              return t(a);
          },
          p = setTimeout(
            m.bind(null, void 0, { type: "timeout", target: o }),
            12e4,
          );
        ((o.onerror = m.bind(null, o.onerror)),
          (o.onload = m.bind(null, o.onload)),
          l && document.head.appendChild(o));
      }
    }),
    (s.r = (e) => {
      ("undefined" != typeof Symbol &&
        Symbol.toStringTag &&
        Object.defineProperty(e, Symbol.toStringTag, { value: "Module" }),
        Object.defineProperty(e, "__esModule", { value: !0 }));
    }),
    (() => {
      var e;
      s.g.importScripts && (e = s.g.location + "");
      var t = s.g.document;
      if (
        !e &&
        t &&
        (t.currentScript &&
          "SCRIPT" === t.currentScript.tagName.toUpperCase() &&
          (e = t.currentScript.src),
        !e)
      ) {
        var n = t.getElementsByTagName("script");
        if (n.length)
          for (var a = n.length - 1; a > -1 && (!e || !/^http(s?):/.test(e)); )
            e = n[a--].src;
      }
      if (!e)
        throw new Error(
          "Automatic publicPath is not supported in this browser",
        );
      ((e = e
        .replace(/^blob:/, "")
        .replace(/#.*$/, "")
        .replace(/\?.*$/, "")
        .replace(/\/[^\/]+$/, "/")),
        (s.p = e));
    })(),
    (() => {
      var e = { 796: 0 };
      s.f.j = (t, n) => {
        var a = s.o(e, t) ? e[t] : void 0;
        if (0 !== a)
          if (a) n.push(a[2]);
          else {
            var r = new Promise((n, s) => (a = e[t] = [n, s]));
            n.push((a[2] = r));
            var i = s.p + s.u(t),
              o = new Error();
            s.l(
              i,
              (n) => {
                if (s.o(e, t) && (0 !== (a = e[t]) && (e[t] = void 0), a)) {
                  var r = n && ("load" === n.type ? "missing" : n.type),
                    i = n && n.target && n.target.src;
                  ((o.message =
                    "Loading chunk " + t + " failed.\n(" + r + ": " + i + ")"),
                    (o.name = "ChunkLoadError"),
                    (o.type = r),
                    (o.request = i),
                    a[1](o));
                }
              },
              "chunk-" + t,
              t,
            );
          }
      };
      var t = (t, n) => {
          var a,
            r,
            [i, o, l] = n,
            c = 0;
          if (i.some((t) => 0 !== e[t])) {
            for (a in o) s.o(o, a) && (s.m[a] = o[a]);
            l && l(s);
          }
          for (t && t(n); c < i.length; c++)
            ((r = i[c]), s.o(e, r) && e[r] && e[r][0](), (e[r] = 0));
        },
        n = (self.webpackChunkdeepsight_extension =
          self.webpackChunkdeepsight_extension || []);
      (n.forEach(t.bind(null, 0)), (n.push = t.bind(null, n.push.bind(n))));
    })(),
    (() => {
      "use strict";
      var e,
        t,
        n,
        a,
        r,
        i,
        o,
        l,
        c,
        d,
        u,
        m,
        p,
        g,
        h,
        f = {},
        _ = [],
        v = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,
        y = Array.isArray;
      function b(e, t) {
        for (var n in t) e[n] = t[n];
        return e;
      }
      function A(e) {
        e && e.parentNode && e.parentNode.removeChild(e);
      }
      function x(t, n, a) {
        var s,
          r,
          i,
          o = {};
        for (i in n)
          "key" == i ? (s = n[i]) : "ref" == i ? (r = n[i]) : (o[i] = n[i]);
        if (
          (arguments.length > 2 &&
            (o.children = arguments.length > 3 ? e.call(arguments, 2) : a),
          "function" == typeof t && null != t.defaultProps)
        )
          for (i in t.defaultProps)
            void 0 === o[i] && (o[i] = t.defaultProps[i]);
        return w(t, o, s, r, null);
      }
      function w(e, a, s, r, i) {
        var o = {
          type: e,
          props: a,
          key: s,
          ref: r,
          __k: null,
          __: null,
          __b: 0,
          __e: null,
          __c: null,
          constructor: void 0,
          __v: null == i ? ++n : i,
          __i: -1,
          __u: 0,
        };
        return (null == i && null != t.vnode && t.vnode(o), o);
      }
      function k(e) {
        return e.children;
      }
      function C(e, t) {
        ((this.props = e), (this.context = t));
      }
      function N(e, t) {
        if (null == t) return e.__ ? N(e.__, e.__i + 1) : null;
        for (var n; t < e.__k.length; t++)
          if (null != (n = e.__k[t]) && null != n.__e) return n.__e;
        return "function" == typeof e.type ? N(e) : null;
      }
      function M(e) {
        if (e.__P && e.__d) {
          var n = e.__v,
            a = n.__e,
            s = [],
            r = [],
            i = b({}, n);
          ((i.__v = n.__v + 1),
            t.vnode && t.vnode(i),
            U(
              e.__P,
              i,
              n,
              e.__n,
              e.__P.namespaceURI,
              32 & n.__u ? [a] : null,
              s,
              null == a ? N(n) : a,
              !!(32 & n.__u),
              r,
            ),
            (i.__v = n.__v),
            (i.__.__k[i.__i] = i),
            V(s, i, r),
            (n.__e = n.__ = null),
            i.__e != a && S(i));
        }
      }
      function S(e) {
        if (null != (e = e.__) && null != e.__c)
          return (
            (e.__e = e.__c.base = null),
            e.__k.some(function (t) {
              if (null != t && null != t.__e)
                return (e.__e = e.__c.base = t.__e);
            }),
            S(e)
          );
      }
      function P(e) {
        ((!e.__d && (e.__d = !0) && a.push(e) && !E.__r++) ||
          r != t.debounceRendering) &&
          ((r = t.debounceRendering) || i)(E);
      }
      function E() {
        try {
          for (var e, t = 1; a.length; )
            (a.length > t && a.sort(o), (e = a.shift()), (t = a.length), M(e));
        } finally {
          a.length = E.__r = 0;
        }
      }
      function T(e, t, n, a, s, r, i, o, l, c, d) {
        var u,
          m,
          p,
          g,
          h,
          v,
          y,
          b = (a && a.__k) || _,
          A = t.length;
        for (l = I(n, t, b, l, A), u = 0; u < A; u++)
          null != (p = n.__k[u]) &&
            ((m = (-1 != p.__i && b[p.__i]) || f),
            (p.__i = u),
            (v = U(e, p, m, s, r, i, o, l, c, d)),
            (g = p.__e),
            p.ref &&
              m.ref != p.ref &&
              (m.ref && q(m.ref, null, p), d.push(p.ref, p.__c || g, p)),
            null == h && null != g && (h = g),
            (y = !!(4 & p.__u)) || m.__k === p.__k
              ? ((l = D(p, l, e, y)), y && m.__e && (m.__e = null))
              : "function" == typeof p.type && void 0 !== v
                ? (l = v)
                : g && (l = g.nextSibling),
            (p.__u &= -7));
        return ((n.__e = h), l);
      }
      function I(e, t, n, a, s) {
        var r,
          i,
          o,
          l,
          c,
          d = n.length,
          u = d,
          m = 0;
        for (e.__k = new Array(s), r = 0; r < s; r++)
          null != (i = t[r]) && "boolean" != typeof i && "function" != typeof i
            ? ("string" == typeof i ||
              "number" == typeof i ||
              "bigint" == typeof i ||
              i.constructor == String
                ? (i = e.__k[r] = w(null, i, null, null, null))
                : y(i)
                  ? (i = e.__k[r] = w(k, { children: i }, null, null, null))
                  : void 0 === i.constructor && i.__b > 0
                    ? (i = e.__k[r] =
                        w(i.type, i.props, i.key, i.ref ? i.ref : null, i.__v))
                    : (e.__k[r] = i),
              (l = r + m),
              (i.__ = e),
              (i.__b = e.__b + 1),
              (o = null),
              -1 != (c = i.__i = $(i, n, l, u)) &&
                (u--, (o = n[c]) && (o.__u |= 2)),
              null == o || null == o.__v
                ? (-1 == c && (s > d ? m-- : s < d && m++),
                  "function" != typeof i.type && (i.__u |= 4))
                : c != l &&
                  (c == l - 1
                    ? m--
                    : c == l + 1
                      ? m++
                      : (c > l ? m-- : m++, (i.__u |= 4))))
            : (e.__k[r] = null);
        if (u)
          for (r = 0; r < d; r++)
            null != (o = n[r]) &&
              !(2 & o.__u) &&
              (o.__e == a && (a = N(o)), j(o, o));
        return a;
      }
      function D(e, t, n, a) {
        var s, r;
        if ("function" == typeof e.type) {
          for (s = e.__k, r = 0; s && r < s.length; r++)
            s[r] && ((s[r].__ = e), (t = D(s[r], t, n, a)));
          return t;
        }
        e.__e != t &&
          (a &&
            (t && e.type && !t.parentNode && (t = N(e)),
            n.insertBefore(e.__e, t || null)),
          (t = e.__e));
        do {
          t = t && t.nextSibling;
        } while (null != t && 8 == t.nodeType);
        return t;
      }
      function L(e, t) {
        return (
          (t = t || []),
          null == e ||
            "boolean" == typeof e ||
            (y(e)
              ? e.some(function (e) {
                  L(e, t);
                })
              : t.push(e)),
          t
        );
      }
      function $(e, t, n, a) {
        var s,
          r,
          i,
          o = e.key,
          l = e.type,
          c = t[n],
          d = null != c && !(2 & c.__u);
        if ((null === c && null == o) || (d && o == c.key && l == c.type))
          return n;
        if (a > (d ? 1 : 0))
          for (s = n - 1, r = n + 1; s >= 0 || r < t.length; )
            if (
              null != (c = t[(i = s >= 0 ? s-- : r++)]) &&
              !(2 & c.__u) &&
              o == c.key &&
              l == c.type
            )
              return i;
        return -1;
      }
      function O(e, t, n) {
        "-" == t[0]
          ? e.setProperty(t, null == n ? "" : n)
          : (e[t] =
              null == n
                ? ""
                : "number" != typeof n || v.test(t)
                  ? n
                  : n + "px");
      }
      function z(e, t, n, a, s) {
        var r, i;
        e: if ("style" == t)
          if ("string" == typeof n) e.style.cssText = n;
          else {
            if (("string" == typeof a && (e.style.cssText = a = ""), a))
              for (t in a) (n && t in n) || O(e.style, t, "");
            if (n) for (t in n) (a && n[t] == a[t]) || O(e.style, t, n[t]);
          }
        else if ("o" == t[0] && "n" == t[1])
          ((r = t != (t = t.replace(u, "$1"))),
            (i = t.toLowerCase()),
            (t =
              i in e || "onFocusOut" == t || "onFocusIn" == t
                ? i.slice(2)
                : t.slice(2)),
            e.l || (e.l = {}),
            (e.l[t + r] = n),
            n
              ? a
                ? (n[d] = a[d])
                : ((n[d] = m), e.addEventListener(t, r ? g : p, r))
              : e.removeEventListener(t, r ? g : p, r));
        else {
          if ("http://www.w3.org/2000/svg" == s)
            t = t.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
          else if (
            "width" != t &&
            "height" != t &&
            "href" != t &&
            "list" != t &&
            "form" != t &&
            "tabIndex" != t &&
            "download" != t &&
            "rowSpan" != t &&
            "colSpan" != t &&
            "role" != t &&
            "popover" != t &&
            t in e
          )
            try {
              e[t] = null == n ? "" : n;
              break e;
            } catch (e) {}
          "function" == typeof n ||
            (null == n || (!1 === n && "-" != t[4])
              ? e.removeAttribute(t)
              : e.setAttribute(t, "popover" == t && 1 == n ? "" : n));
        }
      }
      function R(e) {
        return function (n) {
          if (this.l) {
            var a = this.l[n.type + e];
            if (null == n[c]) n[c] = m++;
            else if (n[c] < a[d]) return;
            return a(t.event ? t.event(n) : n);
          }
        };
      }
      function U(e, n, a, s, r, i, o, l, c, d) {
        var u,
          m,
          p,
          g,
          h,
          f,
          v,
          x,
          w,
          N,
          M,
          S,
          P,
          E,
          I,
          D = n.type;
        if (void 0 !== n.constructor) return null;
        (128 & a.__u && ((c = !!(32 & a.__u)), (i = [(l = n.__e = a.__e)])),
          (u = t.__b) && u(n));
        e: if ("function" == typeof D)
          try {
            if (
              ((x = n.props),
              (w = D.prototype && D.prototype.render),
              (N = (u = D.contextType) && s[u.__c]),
              (M = u ? (N ? N.props.value : u.__) : s),
              a.__c
                ? (v = (m = n.__c = a.__c).__ = m.__E)
                : (w
                    ? (n.__c = m = new D(x, M))
                    : ((n.__c = m = new C(x, M)),
                      (m.constructor = D),
                      (m.render = W)),
                  N && N.sub(m),
                  m.state || (m.state = {}),
                  (m.__n = s),
                  (p = m.__d = !0),
                  (m.__h = []),
                  (m._sb = [])),
              w && null == m.__s && (m.__s = m.state),
              w &&
                null != D.getDerivedStateFromProps &&
                (m.__s == m.state && (m.__s = b({}, m.__s)),
                b(m.__s, D.getDerivedStateFromProps(x, m.__s))),
              (g = m.props),
              (h = m.state),
              (m.__v = n),
              p)
            )
              (w &&
                null == D.getDerivedStateFromProps &&
                null != m.componentWillMount &&
                m.componentWillMount(),
                w &&
                  null != m.componentDidMount &&
                  m.__h.push(m.componentDidMount));
            else {
              if (
                (w &&
                  null == D.getDerivedStateFromProps &&
                  x !== g &&
                  null != m.componentWillReceiveProps &&
                  m.componentWillReceiveProps(x, M),
                n.__v == a.__v ||
                  (!m.__e &&
                    null != m.shouldComponentUpdate &&
                    !1 === m.shouldComponentUpdate(x, m.__s, M)))
              ) {
                (n.__v != a.__v &&
                  ((m.props = x), (m.state = m.__s), (m.__d = !1)),
                  (n.__e = a.__e),
                  (n.__k = a.__k),
                  n.__k.some(function (e) {
                    e && (e.__ = n);
                  }),
                  _.push.apply(m.__h, m._sb),
                  (m._sb = []),
                  m.__h.length && o.push(m));
                break e;
              }
              (null != m.componentWillUpdate &&
                m.componentWillUpdate(x, m.__s, M),
                w &&
                  null != m.componentDidUpdate &&
                  m.__h.push(function () {
                    m.componentDidUpdate(g, h, f);
                  }));
            }
            if (
              ((m.context = M),
              (m.props = x),
              (m.__P = e),
              (m.__e = !1),
              (S = t.__r),
              (P = 0),
              w)
            )
              ((m.state = m.__s),
                (m.__d = !1),
                S && S(n),
                (u = m.render(m.props, m.state, m.context)),
                _.push.apply(m.__h, m._sb),
                (m._sb = []));
            else
              do {
                ((m.__d = !1),
                  S && S(n),
                  (u = m.render(m.props, m.state, m.context)),
                  (m.state = m.__s));
              } while (m.__d && ++P < 25);
            ((m.state = m.__s),
              null != m.getChildContext &&
                (s = b(b({}, s), m.getChildContext())),
              w &&
                !p &&
                null != m.getSnapshotBeforeUpdate &&
                (f = m.getSnapshotBeforeUpdate(g, h)),
              (E =
                null != u && u.type === k && null == u.key
                  ? B(u.props.children)
                  : u),
              (l = T(e, y(E) ? E : [E], n, a, s, r, i, o, l, c, d)),
              (m.base = n.__e),
              (n.__u &= -161),
              m.__h.length && o.push(m),
              v && (m.__E = m.__ = null));
          } catch (e) {
            if (((n.__v = null), c || null != i))
              if (e.then) {
                for (
                  n.__u |= c ? 160 : 128;
                  l && 8 == l.nodeType && l.nextSibling;
                )
                  l = l.nextSibling;
                ((i[i.indexOf(l)] = null), (n.__e = l));
              } else {
                for (I = i.length; I--; ) A(i[I]);
                F(n);
              }
            else ((n.__e = a.__e), (n.__k = a.__k), e.then || F(n));
            t.__e(e, n, a);
          }
        else
          null == i && n.__v == a.__v
            ? ((n.__k = a.__k), (n.__e = a.__e))
            : (l = n.__e = H(a.__e, n, a, s, r, i, o, c, d));
        return ((u = t.diffed) && u(n), 128 & n.__u ? void 0 : l);
      }
      function F(e) {
        e && (e.__c && (e.__c.__e = !0), e.__k && e.__k.some(F));
      }
      function V(e, n, a) {
        for (var s = 0; s < a.length; s++) q(a[s], a[++s], a[++s]);
        (t.__c && t.__c(n, e),
          e.some(function (n) {
            try {
              ((e = n.__h),
                (n.__h = []),
                e.some(function (e) {
                  e.call(n);
                }));
            } catch (e) {
              t.__e(e, n.__v);
            }
          }));
      }
      function B(e) {
        return "object" != typeof e || null == e || e.__b > 0
          ? e
          : y(e)
            ? e.map(B)
            : b({}, e);
      }
      function H(n, a, s, r, i, o, l, c, d) {
        var u,
          m,
          p,
          g,
          h,
          _,
          v,
          b = s.props || f,
          x = a.props,
          w = a.type;
        if (
          ("svg" == w
            ? (i = "http://www.w3.org/2000/svg")
            : "math" == w
              ? (i = "http://www.w3.org/1998/Math/MathML")
              : i || (i = "http://www.w3.org/1999/xhtml"),
          null != o)
        )
          for (u = 0; u < o.length; u++)
            if (
              (h = o[u]) &&
              "setAttribute" in h == !!w &&
              (w ? h.localName == w : 3 == h.nodeType)
            ) {
              ((n = h), (o[u] = null));
              break;
            }
        if (null == n) {
          if (null == w) return document.createTextNode(x);
          ((n = document.createElementNS(i, w, x.is && x)),
            c && (t.__m && t.__m(a, o), (c = !1)),
            (o = null));
        }
        if (null == w) b === x || (c && n.data == x) || (n.data = x);
        else {
          if (((o = o && e.call(n.childNodes)), !c && null != o))
            for (b = {}, u = 0; u < n.attributes.length; u++)
              b[(h = n.attributes[u]).name] = h.value;
          for (u in b)
            ((h = b[u]),
              "dangerouslySetInnerHTML" == u
                ? (p = h)
                : "children" == u ||
                  u in x ||
                  ("value" == u && "defaultValue" in x) ||
                  ("checked" == u && "defaultChecked" in x) ||
                  z(n, u, null, h, i));
          for (u in x)
            ((h = x[u]),
              "children" == u
                ? (g = h)
                : "dangerouslySetInnerHTML" == u
                  ? (m = h)
                  : "value" == u
                    ? (_ = h)
                    : "checked" == u
                      ? (v = h)
                      : (c && "function" != typeof h) ||
                        b[u] === h ||
                        z(n, u, h, b[u], i));
          if (m)
            (c ||
              (p && (m.__html == p.__html || m.__html == n.innerHTML)) ||
              (n.innerHTML = m.__html),
              (a.__k = []));
          else if (
            (p && (n.innerHTML = ""),
            T(
              "template" == a.type ? n.content : n,
              y(g) ? g : [g],
              a,
              s,
              r,
              "foreignObject" == w ? "http://www.w3.org/1999/xhtml" : i,
              o,
              l,
              o ? o[0] : s.__k && N(s, 0),
              c,
              d,
            ),
            null != o)
          )
            for (u = o.length; u--; ) A(o[u]);
          c ||
            ((u = "value"),
            "progress" == w && null == _
              ? n.removeAttribute("value")
              : null != _ &&
                (_ !== n[u] ||
                  ("progress" == w && !_) ||
                  ("option" == w && _ != b[u])) &&
                z(n, u, _, b[u], i),
            (u = "checked"),
            null != v && v != n[u] && z(n, u, v, b[u], i));
        }
        return n;
      }
      function q(e, n, a) {
        try {
          if ("function" == typeof e) {
            var s = "function" == typeof e.__u;
            (s && e.__u(), (s && null == n) || (e.__u = e(n)));
          } else e.current = n;
        } catch (e) {
          t.__e(e, a);
        }
      }
      function j(e, n, a) {
        var s, r;
        if (
          (t.unmount && t.unmount(e),
          (s = e.ref) && ((s.current && s.current != e.__e) || q(s, null, n)),
          null != (s = e.__c))
        ) {
          if (s.componentWillUnmount)
            try {
              s.componentWillUnmount();
            } catch (e) {
              t.__e(e, n);
            }
          s.base = s.__P = null;
        }
        if ((s = e.__k))
          for (r = 0; r < s.length; r++)
            s[r] && j(s[r], n, a || "function" != typeof e.type);
        (a || A(e.__e), (e.__c = e.__ = e.__e = void 0));
      }
      function W(e, t, n) {
        return this.constructor(e, n);
      }
      function G(n, a, s) {
        var r, i, o, l;
        (a == document && (a = document.documentElement),
          t.__ && t.__(n, a),
          (i = (r = "function" == typeof s) ? null : (s && s.__k) || a.__k),
          (o = []),
          (l = []),
          U(
            a,
            (n = ((!r && s) || a).__k = x(k, null, [n])),
            i || f,
            f,
            a.namespaceURI,
            !r && s
              ? [s]
              : i
                ? null
                : a.firstChild
                  ? e.call(a.childNodes)
                  : null,
            o,
            !r && s ? s : i ? i.__e : a.firstChild,
            r,
            l,
          ),
          V(o, n, l));
      }
      function Y(e, t) {
        G(e, t, Y);
      }
      function K(t, n, a) {
        var s,
          r,
          i,
          o,
          l = b({}, t.props);
        for (i in (t.type && t.type.defaultProps && (o = t.type.defaultProps),
        n))
          "key" == i
            ? (s = n[i])
            : "ref" == i
              ? (r = n[i])
              : (l[i] = void 0 === n[i] && null != o ? o[i] : n[i]);
        return (
          arguments.length > 2 &&
            (l.children = arguments.length > 3 ? e.call(arguments, 2) : a),
          w(t.type, l, s || t.key, r || t.ref, null)
        );
      }
      function Q(e) {
        function t(e) {
          var n, a;
          return (
            this.getChildContext ||
              ((n = new Set()),
              ((a = {})[t.__c] = this),
              (this.getChildContext = function () {
                return a;
              }),
              (this.componentWillUnmount = function () {
                n = null;
              }),
              (this.shouldComponentUpdate = function (e) {
                this.props.value != e.value &&
                  n.forEach(function (e) {
                    ((e.__e = !0), P(e));
                  });
              }),
              (this.sub = function (e) {
                n.add(e);
                var t = e.componentWillUnmount;
                e.componentWillUnmount = function () {
                  (n && n.delete(e), t && t.call(e));
                };
              })),
            e.children
          );
        }
        return (
          (t.__c = "__cC" + h++),
          (t.__ = e),
          (t.Provider =
            t.__l =
            (t.Consumer = function (e, t) {
              return e.children(t);
            }).contextType =
              t),
          t
        );
      }
      ((e = _.slice),
        (t = {
          __e: function (e, t, n, a) {
            for (var s, r, i; (t = t.__); )
              if ((s = t.__c) && !s.__)
                try {
                  if (
                    ((r = s.constructor) &&
                      null != r.getDerivedStateFromError &&
                      (s.setState(r.getDerivedStateFromError(e)), (i = s.__d)),
                    null != s.componentDidCatch &&
                      (s.componentDidCatch(e, a || {}), (i = s.__d)),
                    i)
                  )
                    return (s.__E = s);
                } catch (t) {
                  e = t;
                }
            throw e;
          },
        }),
        (n = 0),
        (C.prototype.setState = function (e, t) {
          var n;
          ((n =
            null != this.__s && this.__s != this.state
              ? this.__s
              : (this.__s = b({}, this.state))),
            "function" == typeof e && (e = e(b({}, n), this.props)),
            e && b(n, e),
            null != e && this.__v && (t && this._sb.push(t), P(this)));
        }),
        (C.prototype.forceUpdate = function (e) {
          this.__v && ((this.__e = !0), e && this.__h.push(e), P(this));
        }),
        (C.prototype.render = k),
        (a = []),
        (i =
          "function" == typeof Promise
            ? Promise.prototype.then.bind(Promise.resolve())
            : setTimeout),
        (o = function (e, t) {
          return e.__v.__b - t.__v.__b;
        }),
        (E.__r = 0),
        (l = Math.random().toString(8)),
        (c = "__d" + l),
        (d = "__a" + l),
        (u = /(PointerCapture)$|Capture$/i),
        (m = 0),
        (p = R(!1)),
        (g = R(!0)),
        (h = 0));
      var X,
        Z,
        J,
        ee,
        te = 0,
        ne = [],
        ae = t,
        se = ae.__b,
        re = ae.__r,
        ie = ae.diffed,
        oe = ae.__c,
        le = ae.unmount,
        ce = ae.__;
      function de(e, t) {
        (ae.__h && ae.__h(Z, e, te || t), (te = 0));
        var n = Z.__H || (Z.__H = { __: [], __h: [] });
        return (e >= n.__.length && n.__.push({}), n.__[e]);
      }
      function ue(e) {
        return ((te = 1), me(Se, e));
      }
      function me(e, t, n) {
        var a = de(X++, 2);
        if (
          ((a.t = e),
          !a.__c &&
            ((a.__ = [
              n ? n(t) : Se(void 0, t),
              function (e) {
                var t = a.__N ? a.__N[0] : a.__[0],
                  n = a.t(t, e);
                t !== n && ((a.__N = [n, a.__[1]]), a.__c.setState({}));
              },
            ]),
            (a.__c = Z),
            !Z.__f))
        ) {
          var s = function (e, t, n) {
            if (!a.__c.__H) return !0;
            var s = a.__c.__H.__.filter(function (e) {
              return e.__c;
            });
            if (
              s.every(function (e) {
                return !e.__N;
              })
            )
              return !r || r.call(this, e, t, n);
            var i = a.__c.props !== e;
            return (
              s.some(function (e) {
                if (e.__N) {
                  var t = e.__[0];
                  ((e.__ = e.__N), (e.__N = void 0), t !== e.__[0] && (i = !0));
                }
              }),
              (r && r.call(this, e, t, n)) || i
            );
          };
          Z.__f = !0;
          var r = Z.shouldComponentUpdate,
            i = Z.componentWillUpdate;
          ((Z.componentWillUpdate = function (e, t, n) {
            if (this.__e) {
              var a = r;
              ((r = void 0), s(e, t, n), (r = a));
            }
            i && i.call(this, e, t, n);
          }),
            (Z.shouldComponentUpdate = s));
        }
        return a.__N || a.__;
      }
      function pe(e, t) {
        var n = de(X++, 3);
        !ae.__s && Me(n.__H, t) && ((n.__ = e), (n.u = t), Z.__H.__h.push(n));
      }
      function ge(e, t) {
        var n = de(X++, 4);
        !ae.__s && Me(n.__H, t) && ((n.__ = e), (n.u = t), Z.__h.push(n));
      }
      function he(e) {
        return (
          (te = 5),
          _e(function () {
            return { current: e };
          }, [])
        );
      }
      function fe(e, t, n) {
        ((te = 6),
          ge(
            function () {
              if ("function" == typeof e) {
                var n = e(t());
                return function () {
                  (e(null), n && "function" == typeof n && n());
                };
              }
              if (e)
                return (
                  (e.current = t()),
                  function () {
                    return (e.current = null);
                  }
                );
            },
            null == n ? n : n.concat(e),
          ));
      }
      function _e(e, t) {
        var n = de(X++, 7);
        return (Me(n.__H, t) && ((n.__ = e()), (n.__H = t), (n.__h = e)), n.__);
      }
      function ve(e, t) {
        return (
          (te = 8),
          _e(function () {
            return e;
          }, t)
        );
      }
      function ye(e) {
        var t = Z.context[e.__c],
          n = de(X++, 9);
        return (
          (n.c = e),
          t ? (null == n.__ && ((n.__ = !0), t.sub(Z)), t.props.value) : e.__
        );
      }
      function be(e, t) {
        ae.useDebugValue && ae.useDebugValue(t ? t(e) : e);
      }
      function Ae() {
        var e = de(X++, 11);
        if (!e.__) {
          for (var t = Z.__v; null !== t && !t.__m && null !== t.__; ) t = t.__;
          var n = t.__m || (t.__m = [0, 0]);
          e.__ = "P" + n[0] + "-" + n[1]++;
        }
        return e.__;
      }
      function xe() {
        for (var e; (e = ne.shift()); ) {
          var t = e.__H;
          if (e.__P && t)
            try {
              (t.__h.some(Ce), t.__h.some(Ne), (t.__h = []));
            } catch (n) {
              ((t.__h = []), ae.__e(n, e.__v));
            }
        }
      }
      ((ae.__b = function (e) {
        ((Z = null), se && se(e));
      }),
        (ae.__ = function (e, t) {
          (e && t.__k && t.__k.__m && (e.__m = t.__k.__m), ce && ce(e, t));
        }),
        (ae.__r = function (e) {
          (re && re(e), (X = 0));
          var t = (Z = e.__c).__H;
          (t &&
            (J === Z
              ? ((t.__h = []),
                (Z.__h = []),
                t.__.some(function (e) {
                  (e.__N && (e.__ = e.__N), (e.u = e.__N = void 0));
                }))
              : (t.__h.some(Ce), t.__h.some(Ne), (t.__h = []), (X = 0))),
            (J = Z));
        }),
        (ae.diffed = function (e) {
          ie && ie(e);
          var t = e.__c;
          (t &&
            t.__H &&
            (t.__H.__h.length &&
              ((1 !== ne.push(t) && ee === ae.requestAnimationFrame) ||
                ((ee = ae.requestAnimationFrame) || ke)(xe)),
            t.__H.__.some(function (e) {
              (e.u && (e.__H = e.u), (e.u = void 0));
            })),
            (J = Z = null));
        }),
        (ae.__c = function (e, t) {
          (t.some(function (e) {
            try {
              (e.__h.some(Ce),
                (e.__h = e.__h.filter(function (e) {
                  return !e.__ || Ne(e);
                })));
            } catch (n) {
              (t.some(function (e) {
                e.__h && (e.__h = []);
              }),
                (t = []),
                ae.__e(n, e.__v));
            }
          }),
            oe && oe(e, t));
        }),
        (ae.unmount = function (e) {
          le && le(e);
          var t,
            n = e.__c;
          n &&
            n.__H &&
            (n.__H.__.some(function (e) {
              try {
                Ce(e);
              } catch (e) {
                t = e;
              }
            }),
            (n.__H = void 0),
            t && ae.__e(t, n.__v));
        }));
      var we = "function" == typeof requestAnimationFrame;
      function ke(e) {
        var t,
          n = function () {
            (clearTimeout(a), we && cancelAnimationFrame(t), setTimeout(e));
          },
          a = setTimeout(n, 35);
        we && (t = requestAnimationFrame(n));
      }
      function Ce(e) {
        var t = Z,
          n = e.__c;
        ("function" == typeof n && ((e.__c = void 0), n()), (Z = t));
      }
      function Ne(e) {
        var t = Z;
        ((e.__c = e.__()), (Z = t));
      }
      function Me(e, t) {
        return (
          !e ||
          e.length !== t.length ||
          t.some(function (t, n) {
            return t !== e[n];
          })
        );
      }
      function Se(e, t) {
        return "function" == typeof t ? t(e) : t;
      }
      function Pe(e, t) {
        for (var n in t) e[n] = t[n];
        return e;
      }
      function Ee(e, t) {
        for (var n in e) if ("__source" !== n && !(n in t)) return !0;
        for (var a in t) if ("__source" !== a && e[a] !== t[a]) return !0;
        return !1;
      }
      function Te(e, t) {
        var n = t(),
          a = ue({ t: { __: n, u: t } }),
          s = a[0].t,
          r = a[1];
        return (
          ge(
            function () {
              ((s.__ = n), (s.u = t), Ie(s) && r({ t: s }));
            },
            [e, n, t],
          ),
          pe(
            function () {
              return (
                Ie(s) && r({ t: s }),
                e(function () {
                  Ie(s) && r({ t: s });
                })
              );
            },
            [e],
          ),
          n
        );
      }
      function Ie(e) {
        try {
          return !(
            ((t = e.__) === (n = e.u()) && (0 !== t || 1 / t == 1 / n)) ||
            (t != t && n != n)
          );
        } catch (e) {
          return !0;
        }
        var t, n;
      }
      function De(e) {
        e();
      }
      function Le(e) {
        return e;
      }
      function $e() {
        return [!1, De];
      }
      var Oe = ge;
      function ze(e, t) {
        ((this.props = e), (this.context = t));
      }
      (((ze.prototype = new C()).isPureReactComponent = !0),
        (ze.prototype.shouldComponentUpdate = function (e, t) {
          return Ee(this.props, e) || Ee(this.state, t);
        }));
      var Re = t.__b;
      t.__b = function (e) {
        (e.type &&
          e.type.__f &&
          e.ref &&
          ((e.props.ref = e.ref), (e.ref = null)),
          Re && Re(e));
      };
      var Ue =
          ("undefined" != typeof Symbol &&
            Symbol.for &&
            Symbol.for("react.forward_ref")) ||
          3911,
        Fe = function (e, t) {
          return null == e ? null : L(L(e).map(t));
        },
        Ve = {
          map: Fe,
          forEach: Fe,
          count: function (e) {
            return e ? L(e).length : 0;
          },
          only: function (e) {
            var t = L(e);
            if (1 !== t.length) throw "Children.only";
            return t[0];
          },
          toArray: L,
        },
        Be = t.__e;
      t.__e = function (e, t, n, a) {
        if (e.then)
          for (var s, r = t; (r = r.__); )
            if ((s = r.__c) && s.__c)
              return (
                null == t.__e && ((t.__e = n.__e), (t.__k = n.__k)),
                s.__c(e, t)
              );
        Be(e, t, n, a);
      };
      var He = t.unmount;
      function qe(e, t, n) {
        return (
          e &&
            (e.__c &&
              e.__c.__H &&
              (e.__c.__H.__.forEach(function (e) {
                "function" == typeof e.__c && e.__c();
              }),
              (e.__c.__H = null)),
            null != (e = Pe({}, e)).__c &&
              (e.__c.__P === n && (e.__c.__P = t),
              (e.__c.__e = !0),
              (e.__c = null)),
            (e.__k =
              e.__k &&
              e.__k.map(function (e) {
                return qe(e, t, n);
              }))),
          e
        );
      }
      function je(e, t, n) {
        return (
          e &&
            n &&
            ((e.__v = null),
            (e.__k =
              e.__k &&
              e.__k.map(function (e) {
                return je(e, t, n);
              })),
            e.__c &&
              e.__c.__P === t &&
              (e.__e && n.appendChild(e.__e),
              (e.__c.__e = !0),
              (e.__c.__P = n))),
          e
        );
      }
      function We() {
        ((this.__u = 0), (this.o = null), (this.__b = null));
      }
      function Ge(e) {
        var t = e.__ && e.__.__c;
        return t && t.__a && t.__a(e);
      }
      function Ye() {
        ((this.i = null), (this.l = null));
      }
      ((t.unmount = function (e) {
        var t = e.__c;
        (t && (t.__z = !0),
          t && t.__R && t.__R(),
          t && 32 & e.__u && (e.type = null),
          He && He(e));
      }),
        ((We.prototype = new C()).__c = function (e, t) {
          var n = t.__c,
            a = this;
          (null == a.o && (a.o = []), a.o.push(n));
          var s = Ge(a.__v),
            r = !1,
            i = function () {
              r || a.__z || ((r = !0), (n.__R = null), s ? s(l) : l());
            };
          n.__R = i;
          var o = n.__P;
          n.__P = null;
          var l = function () {
            if (!--a.__u) {
              if (a.state.__a) {
                var e = a.state.__a;
                a.__v.__k[0] = je(e, e.__c.__P, e.__c.__O);
              }
              var t;
              for (a.setState({ __a: (a.__b = null) }); (t = a.o.pop()); )
                ((t.__P = o), t.forceUpdate());
            }
          };
          (a.__u++ || 32 & t.__u || a.setState({ __a: (a.__b = a.__v.__k[0]) }),
            e.then(i, i));
        }),
        (We.prototype.componentWillUnmount = function () {
          this.o = [];
        }),
        (We.prototype.render = function (e, t) {
          if (this.__b) {
            if (this.__v.__k) {
              var n = document.createElement("div"),
                a = this.__v.__k[0].__c;
              this.__v.__k[0] = qe(this.__b, n, (a.__O = a.__P));
            }
            this.__b = null;
          }
          var s = t.__a && x(k, null, e.fallback);
          return (
            s && (s.__u &= -33),
            [x(k, null, t.__a ? null : e.children), s]
          );
        }));
      var Ke = function (e, t, n) {
        if (
          (++n[1] === n[0] && e.l.delete(t),
          e.props.revealOrder && ("t" !== e.props.revealOrder[0] || !e.l.size))
        )
          for (n = e.i; n; ) {
            for (; n.length > 3; ) n.pop()();
            if (n[1] < n[0]) break;
            e.i = n = n[2];
          }
      };
      function Qe(e) {
        return (
          (this.getChildContext = function () {
            return e.context;
          }),
          e.children
        );
      }
      function Xe(e) {
        var t = this,
          n = e.h;
        if (
          ((t.componentWillUnmount = function () {
            (G(null, t.v), (t.v = null), (t.h = null));
          }),
          t.h && t.h !== n && t.componentWillUnmount(),
          !t.v)
        ) {
          for (var a = t.__v; null !== a && !a.__m && null !== a.__; ) a = a.__;
          ((t.h = n),
            (t.v = {
              nodeType: 1,
              parentNode: n,
              childNodes: [],
              __k: { __m: a.__m },
              contains: function () {
                return !0;
              },
              namespaceURI: n.namespaceURI,
              insertBefore: function (e, n) {
                (this.childNodes.push(e), t.h.insertBefore(e, n));
              },
              removeChild: function (e) {
                (this.childNodes.splice(this.childNodes.indexOf(e) >>> 1, 1),
                  t.h.removeChild(e));
              },
            }));
        }
        G(x(Qe, { context: t.context }, e.__v), t.v);
      }
      (((Ye.prototype = new C()).__a = function (e) {
        var t = this,
          n = Ge(t.__v),
          a = t.l.get(e);
        return (
          a[0]++,
          function (s) {
            var r = function () {
              t.props.revealOrder ? (a.push(s), Ke(t, e, a)) : s();
            };
            n ? n(r) : r();
          }
        );
      }),
        (Ye.prototype.render = function (e) {
          ((this.i = null), (this.l = new Map()));
          var t = L(e.children);
          e.revealOrder && "b" === e.revealOrder[0] && t.reverse();
          for (var n = t.length; n--; )
            this.l.set(t[n], (this.i = [1, 0, this.i]));
          return e.children;
        }),
        (Ye.prototype.componentDidUpdate = Ye.prototype.componentDidMount =
          function () {
            var e = this;
            this.l.forEach(function (t, n) {
              Ke(e, n, t);
            });
          }));
      var Ze =
          ("undefined" != typeof Symbol &&
            Symbol.for &&
            Symbol.for("react.element")) ||
          60103,
        Je =
          /^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image(!S)|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/,
        et = /^on(Ani|Tra|Tou|BeforeInp|Compo)/,
        tt = /[A-Z0-9]/g,
        nt = "undefined" != typeof document,
        at = function (e) {
          return (
            "undefined" != typeof Symbol && "symbol" == typeof Symbol()
              ? /fil|che|rad/
              : /fil|che|ra/
          ).test(e);
        };
      function st(e, t, n) {
        return (
          null == t.__k && (t.textContent = ""),
          G(e, t),
          "function" == typeof n && n(),
          e ? e.__c : null
        );
      }
      ((C.prototype.isReactComponent = !0),
        [
          "componentWillMount",
          "componentWillReceiveProps",
          "componentWillUpdate",
        ].forEach(function (e) {
          Object.defineProperty(C.prototype, e, {
            configurable: !0,
            get: function () {
              return this["UNSAFE_" + e];
            },
            set: function (t) {
              Object.defineProperty(this, e, {
                configurable: !0,
                writable: !0,
                value: t,
              });
            },
          });
        }));
      var rt = t.event;
      t.event = function (e) {
        return (
          rt && (e = rt(e)),
          (e.persist = function () {}),
          (e.isPropagationStopped = function () {
            return this.cancelBubble;
          }),
          (e.isDefaultPrevented = function () {
            return this.defaultPrevented;
          }),
          (e.nativeEvent = e)
        );
      };
      var it,
        ot = {
          configurable: !0,
          get: function () {
            return this.class;
          },
        },
        lt = t.vnode;
      t.vnode = function (e) {
        ("string" == typeof e.type &&
          (function (e) {
            var t = e.props,
              n = e.type,
              a = {},
              s = -1 == n.indexOf("-");
            for (var r in t) {
              var i = t[r];
              if (
                !(
                  ("value" === r && "defaultValue" in t && null == i) ||
                  (nt && "children" === r && "noscript" === n) ||
                  "class" === r ||
                  "className" === r
                )
              ) {
                var o = r.toLowerCase();
                ("defaultValue" === r && "value" in t && null == t.value
                  ? (r = "value")
                  : "download" === r && !0 === i
                    ? (i = "")
                    : "translate" === o && "no" === i
                      ? (i = !1)
                      : "o" === o[0] && "n" === o[1]
                        ? "ondoubleclick" === o
                          ? (r = "ondblclick")
                          : "onchange" !== o ||
                              ("input" !== n && "textarea" !== n) ||
                              at(t.type)
                            ? "onfocus" === o
                              ? (r = "onfocusin")
                              : "onblur" === o
                                ? (r = "onfocusout")
                                : et.test(r) && (r = o)
                            : (o = r = "oninput")
                        : s && Je.test(r)
                          ? (r = r.replace(tt, "-$&").toLowerCase())
                          : null === i && (i = void 0),
                  "oninput" === o && a[(r = o)] && (r = "oninputCapture"),
                  (a[r] = i));
              }
            }
            ("select" == n &&
              (a.multiple &&
                Array.isArray(a.value) &&
                (a.value = L(t.children).forEach(function (e) {
                  e.props.selected = -1 != a.value.indexOf(e.props.value);
                })),
              null != a.defaultValue &&
                (a.value = L(t.children).forEach(function (e) {
                  e.props.selected = a.multiple
                    ? -1 != a.defaultValue.indexOf(e.props.value)
                    : a.defaultValue == e.props.value;
                }))),
              t.class && !t.className
                ? ((a.class = t.class),
                  Object.defineProperty(a, "className", ot))
                : t.className && (a.class = a.className = t.className),
              (e.props = a));
          })(e),
          (e.$$typeof = Ze),
          lt && lt(e));
      };
      var ct = t.__r;
      t.__r = function (e) {
        (ct && ct(e), (it = e.__c));
      };
      var dt = t.diffed;
      t.diffed = function (e) {
        dt && dt(e);
        var t = e.props,
          n = e.__e;
        (null != n &&
          "textarea" === e.type &&
          "value" in t &&
          t.value !== n.value &&
          (n.value = null == t.value ? "" : t.value),
          (it = null));
      };
      var ut = {
        ReactCurrentDispatcher: {
          current: {
            readContext: function (e) {
              return it.__n[e.__c].props.value;
            },
            useCallback: ve,
            useContext: ye,
            useDebugValue: be,
            useDeferredValue: Le,
            useEffect: pe,
            useId: Ae,
            useImperativeHandle: fe,
            useInsertionEffect: Oe,
            useLayoutEffect: ge,
            useMemo: _e,
            useReducer: me,
            useRef: he,
            useState: ue,
            useSyncExternalStore: Te,
            useTransition: $e,
          },
        },
      };
      function mt(e) {
        return !!e && e.$$typeof === Ze;
      }
      function pt(e) {
        return !!e.__k && (G(null, e), !0);
      }
      var gt = {
          useState: ue,
          useId: Ae,
          useReducer: me,
          useEffect: pe,
          useLayoutEffect: ge,
          useInsertionEffect: Oe,
          useTransition: $e,
          useDeferredValue: Le,
          useSyncExternalStore: Te,
          startTransition: De,
          useRef: he,
          useImperativeHandle: fe,
          useMemo: _e,
          useCallback: ve,
          useContext: ye,
          useDebugValue: be,
          version: "18.3.1",
          Children: Ve,
          render: st,
          hydrate: function (e, t, n) {
            return (Y(e, t), "function" == typeof n && n(), e ? e.__c : null);
          },
          unmountComponentAtNode: pt,
          createPortal: function (e, t) {
            var n = x(Xe, { __v: e, h: t });
            return ((n.containerInfo = t), n);
          },
          createElement: x,
          createContext: Q,
          createFactory: function (e) {
            return x.bind(null, e);
          },
          cloneElement: function (e) {
            return mt(e) ? K.apply(null, arguments) : e;
          },
          createRef: function () {
            return { current: null };
          },
          Fragment: k,
          isValidElement: mt,
          isElement: mt,
          isFragment: function (e) {
            return mt(e) && e.type === k;
          },
          isMemo: function (e) {
            return (
              !!e &&
              "string" == typeof e.displayName &&
              0 == e.displayName.indexOf("Memo(")
            );
          },
          findDOMNode: function (e) {
            return (e && (e.base || (1 === e.nodeType && e))) || null;
          },
          Component: C,
          PureComponent: ze,
          memo: function (e, t) {
            function n(e) {
              var n = this.props.ref;
              return (
                n != e.ref &&
                  n &&
                  ("function" == typeof n ? n(null) : (n.current = null)),
                t ? !t(this.props, e) || n != e.ref : Ee(this.props, e)
              );
            }
            function a(t) {
              return ((this.shouldComponentUpdate = n), x(e, t));
            }
            return (
              (a.displayName = "Memo(" + (e.displayName || e.name) + ")"),
              (a.__f = a.prototype.isReactComponent = !0),
              (a.type = e),
              a
            );
          },
          forwardRef: function (e) {
            function t(t) {
              var n = Pe({}, t);
              return (delete n.ref, e(n, t.ref || null));
            }
            return (
              (t.$$typeof = Ue),
              (t.render = e),
              (t.prototype.isReactComponent = t.__f = !0),
              (t.displayName = "ForwardRef(" + (e.displayName || e.name) + ")"),
              t
            );
          },
          flushSync: function (e, n) {
            var a = t.debounceRendering;
            t.debounceRendering = function (e) {
              return e();
            };
            var s = e(n);
            return ((t.debounceRendering = a), s);
          },
          unstable_batchedUpdates: function (e, t) {
            return e(t);
          },
          StrictMode: k,
          Suspense: We,
          SuspenseList: Ye,
          lazy: function (e) {
            var t,
              n,
              a,
              s = null;
            function r(r) {
              if (
                (t ||
                  (t = e()).then(
                    function (e) {
                      (e && (s = e.default || e), (a = !0));
                    },
                    function (e) {
                      ((n = e), (a = !0));
                    },
                  ),
                n)
              )
                throw n;
              if (!a) throw t;
              return s ? x(s, r) : null;
            }
            return ((r.displayName = "Lazy"), (r.__f = !0), r);
          },
          __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: ut,
        },
        ht = 0;
      function ft(e, n, a, s, r, i) {
        n || (n = {});
        var o,
          l,
          c = n;
        if ("ref" in c)
          for (l in ((c = {}), n)) "ref" == l ? (o = n[l]) : (c[l] = n[l]);
        var d = {
          type: e,
          props: c,
          key: a,
          ref: o,
          __k: null,
          __: null,
          __b: 0,
          __e: null,
          __c: null,
          constructor: void 0,
          __v: --ht,
          __i: -1,
          __u: 0,
          __source: r,
          __self: i,
        };
        if ("function" == typeof e && (o = e.defaultProps))
          for (l in o) void 0 === c[l] && (c[l] = o[l]);
        return (t.vnode && t.vnode(d), d);
      }
      Array.isArray;
      var _t = s(815);
      const vt = s.n(_t)(),
        yt = ({ size: e = 20, className: t }) =>
          ft("svg", {
            width: e,
            height: e,
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "2",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            className: t,
            children: ft("path", {
              d: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
            }),
          }),
        bt = ({ size: e = 20, className: t }) =>
          ft("svg", {
            width: e,
            height: e,
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "2",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            className: t,
            children: [
              ft("line", { x1: "22", y1: "2", x2: "11", y2: "13" }),
              ft("polygon", { points: "22 2 15 22 11 13 2 9 22 2" }),
            ],
          }),
        At = ({ size: e = 20, className: t }) =>
          ft("svg", {
            width: e,
            height: e,
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "2",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            className: t,
            children: [
              ft("line", { x1: "19", y1: "12", x2: "5", y2: "12" }),
              ft("polyline", { points: "12 19 5 12 12 5" }),
            ],
          }),
        xt = ({ size: e = 20, className: t }) =>
          ft("svg", {
            width: e,
            height: e,
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "2",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            className: t,
            children: [
              ft("path", { d: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" }),
              ft("polyline", { points: "16 17 21 12 16 7" }),
              ft("line", { x1: "21", y1: "12", x2: "9", y2: "12" }),
            ],
          }),
        wt = ({ size: e = 20, className: t }) =>
          ft("svg", {
            width: e,
            height: e,
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "2",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            className: t,
            children: [
              ft("path", {
                d: "M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6",
              }),
              ft("polyline", { points: "15 3 21 3 21 9" }),
              ft("line", { x1: "10", y1: "14", x2: "21", y2: "3" }),
            ],
          }),
        kt = ({ size: e = 16, className: t }) =>
          ft("svg", {
            width: e,
            height: e,
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "2",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            className: t,
            children: ft("polyline", { points: "6 9 12 15 18 9" }),
          }),
        Ct = ({ size: e = 16, className: t }) =>
          ft("svg", {
            width: e,
            height: e,
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "2",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            className: t,
            children: ft("polyline", { points: "18 15 12 9 6 15" }),
          }),
        Nt = ({ size: e = 20, className: t }) =>
          ft("svg", {
            width: e,
            height: e,
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: "2",
            strokeLinecap: "round",
            strokeLinejoin: "round",
            className: t,
            children: [
              ft("circle", { cx: "18", cy: "5", r: "3" }),
              ft("circle", { cx: "6", cy: "12", r: "3" }),
              ft("circle", { cx: "18", cy: "19", r: "3" }),
              ft("line", { x1: "8.59", y1: "13.51", x2: "15.42", y2: "17.49" }),
              ft("line", { x1: "15.41", y1: "6.51", x2: "8.59", y2: "10.49" }),
            ],
          }),
        Mt = () =>
          ft("svg", {
            width: "18",
            height: "18",
            viewBox: "0 0 24 24",
            children: [
              ft("path", {
                fill: "#4285F4",
                d: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z",
              }),
              ft("path", {
                fill: "#34A853",
                d: "M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z",
              }),
              ft("path", {
                fill: "#FBBC05",
                d: "M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z",
              }),
              ft("path", {
                fill: "#EA4335",
                d: "M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z",
              }),
            ],
          }),
        St = {
          play: "M5 3l14 9-14 9V3z",
          camera:
            "M23 7l-7 5 7 5V7zM14 5H3a2 2 0 00-2 2v10a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2z",
          headphones: "M3 18v-6a9 9 0 0118 0v6",
          youtube:
            "M22.54 6.42A2.78 2.78 0 0020.6 4.42C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.25 29 29 0 00-.46-5.33z",
          waveform: "M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0",
          book: "M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zm20 0h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z",
          lightbulb:
            "M9 18h6M10 22h4M12 2a6 6 0 00-6 6c0 2 1 3.5 2.5 5 .5.5 1 1.5 1 2.5V17h5v-1.5c0-1 .5-2 1-2.5 1.5-1.5 2.5-3 2.5-5a6 6 0 00-6-6z",
          brain:
            "M12 4c-2 0-3.5 1-4 2.5-.5-1-2-1.5-3-.5S3.5 8 4 9c-1 .5-1.5 2-.5 3s2 1.5 3 1c.5 1.5 2 2.5 4 2.5s3.5-1 4-2.5c1 .5 2 0 3-1s.5-2.5-.5-3c.5-1 0-2.5-1-3.5s-2.5 0-3 .5C15.5 5 14 4 12 4z",
          graduation:
            "M22 10l-10-5L2 10l10 5zm-16 2v5c0 2 2.7 3 6 3s6-1 6-3v-5",
          sparkles:
            "M12 3v2m0 14v2m9-9h-2M5 12H3m15.4-6.4l-1.4 1.4M7 17l-1.4 1.4m12.8 0L17 17M7 7L5.6 5.6",
          lightning: "M13 2L3 14h9l-1 8 10-12h-9z",
          robot:
            "M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z",
          search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
          globe:
            "M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z",
          star: "M12 2l2.4 7.4h7.6l-6 4.6 2.4 7.4-6.4-4.8-6.4 4.8 2.4-7.4-6-4.6h7.6z",
          heart:
            "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z",
          sparkle4pt: "M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z",
          crown: "M2 17l3-7 4 4 3-9 3 9 4-4 3 7z",
          diamond: "M12 2l10 10-10 10L2 12z",
          code: "M16 18l6-6-6-6M8 6l-6 6 6 6",
          shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
        },
        Pt = Object.values(St),
        Et = ({
          name: e,
          size: t = 24,
          color: n = "currentColor",
          strokeWidth: a = 1.5,
          className: s = "",
          style: r,
        }) => {
          const i = St[e];
          return i
            ? ft("svg", {
                width: t,
                height: t,
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: n,
                strokeWidth: a,
                strokeLinecap: "round",
                strokeLinejoin: "round",
                className: `doodle-icon ${s}`,
                style: r,
                "aria-hidden": "true",
                children: ft("path", { d: i }),
              })
            : null;
        },
        Tt = {
          xs: { container: 24, wheel: 22 },
          sm: { container: 40, wheel: 36 },
          md: { container: 64, wheel: 58 },
          lg: { container: 96, wheel: 88 },
        },
        It = { slow: 8, normal: 5, fast: 2 },
        Dt = [
          {
            src: "platforms/youtube-icon-red.png",
            alt: "YouTube",
            size: 18,
            position: { top: -8, left: "50%" },
            delay: 0,
          },
          {
            src: "platforms/tiktok-note-white.png",
            alt: "TikTok",
            size: 16,
            position: { top: "50%", right: -8 },
            delay: 0.5,
          },
          {
            src: "platforms/mistral-m-orange.svg",
            alt: "Mistral",
            size: 16,
            position: { bottom: -8, left: "50%" },
            delay: 1,
          },
          {
            src: "platforms/tournesol-logo.png",
            alt: "Tournesol",
            size: 16,
            position: { top: "50%", left: -8 },
            delay: 1.5,
          },
        ],
        Lt = ({
          size: e = "md",
          className: t = "",
          label: n = "Chargement...",
          showLabel: a = !1,
          speed: s = "normal",
          showLogos: r = !1,
        }) => {
          const { container: i, wheel: o } = Tt[e],
            l = It[s],
            c = i >= 36,
            d = r && i >= 64,
            u = vt.runtime.getURL("assets/spinner-cosmic.jpg"),
            m = vt.runtime.getURL("assets/spinner-wheel.jpg"),
            p = d ? i + 40 : i;
          return ft("div", {
            className: `ds-spinner-wrapper ${t}`,
            role: "status",
            "aria-label": n,
            style: {
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            },
            children: [
              ft("div", {
                style: {
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: p,
                  height: p,
                },
                children: [
                  d &&
                    Dt.map((e, t) => {
                      const n = vt.runtime.getURL(e.src),
                        a = p / 2,
                        s = p / 2,
                        r = i / 2 + 14,
                        o = (90 * t - 90) * (Math.PI / 180),
                        l = a + Math.cos(o) * r - e.size / 2,
                        c = s + Math.sin(o) * r - e.size / 2;
                      return ft(
                        "img",
                        {
                          src: n,
                          alt: e.alt,
                          style: {
                            position: "absolute",
                            width: e.size,
                            height: e.size,
                            left: l,
                            top: c,
                            objectFit: "contain",
                            zIndex: 20,
                            filter: "drop-shadow(0 0 6px rgba(200,144,58,0.4))",
                            animation: `logoPulse 3s ease-in-out ${e.delay}s infinite`,
                          },
                        },
                        e.alt,
                      );
                    }),
                  ft("div", {
                    style: {
                      position: "absolute",
                      width: i,
                      height: i,
                      left: d ? 20 : 0,
                      top: d ? 20 : 0,
                      borderRadius: "50%",
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    },
                    children: [
                      c &&
                        ft("img", {
                          src: u,
                          alt: "",
                          "aria-hidden": "true",
                          style: {
                            position: "absolute",
                            width: "100%",
                            height: "100%",
                            left: 0,
                            top: 0,
                            objectFit: "cover",
                            maskImage:
                              "radial-gradient(circle at center, transparent 0%, transparent 38%, rgba(0,0,0,0.4) 45%, black 52%, black 100%)",
                            WebkitMaskImage:
                              "radial-gradient(circle at center, transparent 0%, transparent 38%, rgba(0,0,0,0.4) 45%, black 52%, black 100%)",
                            zIndex: 1,
                            mixBlendMode: "screen",
                            animation: "colorCycle 12s ease-in-out infinite",
                          },
                        }),
                      ft("img", {
                        src: m,
                        alt: "",
                        "aria-hidden": "true",
                        style: {
                          width: o,
                          height: o,
                          position: "relative",
                          zIndex: 10,
                          mixBlendMode: "screen",
                          opacity: 0.85,
                          filter:
                            "brightness(1.2) contrast(1.25) saturate(1.1)",
                          animation: `gouvernailSpin ${l}s linear infinite`,
                          willChange: "transform",
                        },
                      }),
                    ],
                  }),
                ],
              }),
              a &&
                ft("span", {
                  style: {
                    fontSize: 13,
                    color: "var(--text-tertiary)",
                    animation: "glowPulse 2s ease-in-out infinite",
                  },
                  children: n,
                }),
              ft("span", {
                style: {
                  position: "absolute",
                  width: 1,
                  height: 1,
                  padding: 0,
                  margin: -1,
                  overflow: "hidden",
                  clip: "rect(0,0,0,0)",
                  border: 0,
                },
                children: n,
              }),
            ],
          });
        },
        $t = {
          fr: JSON.parse(
            '{"common":{"login":"Se connecter","logout":"Déconnexion","back":"Retour","retry":"Réessayer","send":"Envoyer","hide":"Masquer","error":"Erreur","viewPlans":"Voir les plans","allPlans":"Tous les plans","createAccount":"Créer un compte","unlock":"Débloquer","analyses":"analyses","credits":"crédits"},"login":{"tagline":"Ne subissez plus vos vidéos — interrogez-les.","badgeFr":"IA Française","badgeEu":"Données en Europe","googleLoading":"Connexion Google...","googleButton":"Continuer avec Google","divider":"ou","emailPlaceholder":"Adresse e-mail","passwordPlaceholder":"Mot de passe","loginLoading":"Connexion...","guestButton":"Essayer sans compte (3 analyses gratuites)","privacy":"Confidentialité","terms":"CGU"},"plans":{"free":"Gratuit","pro":"Pro","expert":"Expert","etudiant":"Pro","student":"Pro","starter":"Pro","equipe":"Expert","team":"Expert"},"upsell":{"free":{"label":"Pro","feature":"30 analyses + Cartes mentales + Web Search","price":"5,99€"},"pro":{"label":"Expert","feature":"100 analyses + Mistral Large + Playlists 20 vidéos","price":"14,99€"}},"analysis":{"noVideo":"Ouvre une vidéo YouTube ou TikTok pour l\'analyser","analyzeButton":"Analyser cette vidéo","starting":"Démarrage de l\'analyse...","processing":"Traitement en cours...","failed":"Analyse échouée","startFailed":"Impossible de démarrer l\'analyse","recent":"Analyses récentes","quotaExceeded":"Quota atteint","quotaExceededText":"Passez au plan supérieur","mode":"Mode","language":"Langue","quickChatButton":"Quick Chat IA","quickChatPreparing":"Préparation du chat...","modes":{"standard":"Standard","accessible":"Accessible","expert":"Expert"},"languages":{"fr":"Français","en":"English","es":"Español","de":"Deutsch"}},"guest":{"banner":"Mode découverte — 3 analyses gratuites sans compte","exhaustedText":"Créez un compte gratuit pour sauvegarder vos analyses et en faire plus"},"credits":{"critical":"Plus que {count} crédits —","recharge":"Recharger","remaining":"{count} crédits restants","low":"cr."},"mistral":{"badge":"Propulsé par Mistral AI"},"synthesis":{"complete":"Analyse complète","fullAnalysis":"Analyse complète","chat":"Chat","share":"Partager","showDetail":"Voir l\'analyse détaillée","hideDetail":"Masquer l\'analyse détaillée","printPdf":"Imprimer / PDF","reliable":"Fiable","toVerify":"À vérifier","unreliable":"Peu fiable","generatingDef":"Définition en cours de génération...","shareTitle":"Synthèse DeepSight","verdict":"Verdict","keyPoints":"Points Clés","concepts":"Concepts","tags":"Tags","generatedBy":"Généré par","analysisDesc":"Analyse IA de vidéos YouTube & TikTok","euBadge":"IA 100% Européenne propulsée par Mistral AI"},"features":{"flashcards":"Flashcards","flashcardsDesc":"Révisez avec des cartes mémoire générées par l\'IA","mindMaps":"Cartes mentales","mindMapsDesc":"Visualisez les idées clés sous forme de carte","webSearch":"Recherche web","webSearchDesc":"Enrichissez l\'analyse avec des sources externes","exports":"Exports","exportsDesc":"Téléchargez en PDF, DOCX ou Markdown","playlists":"Playlists","playlistsDesc":"Analysez des playlists entières en un clic","mobileDesc":"Accédez à DeepSight sur mobile","fromPrice":"dès {price}"},"chat":{"welcome":"Pose une question sur cette vidéo.","sessionExpired":"Session expirée","reconnect":"Se reconnecter","webSearchEnable":"Activer recherche web","webSearchDisable":"Désactiver recherche web","webSearchLocked":"Recherche web — plan payant requis","inputPlaceholder":"Pose une question...","expiredPlaceholder":"Session expirée...","webEnriched":"Enrichi par le web","unavailable":"Réponse indisponible","suggestions":["Quels sont les points clés ?","Résume en 3 phrases","Y a-t-il des biais ?","Quelles sources sont citées ?"]},"widget":{"analyze":"Analyser cette vidéo","quickChat":"Quick Chat IA","back":"← Retour","minimize":"Réduire","expand":"Agrandir","analyzing":"Analyse en cours...","analysisComplete":"Analyse complète","reliability":"Fiabilité","verdict":"Verdict","keyPoints":"Points clés","seeDetail":"Voir l\'analyse détaillée","hideDetail":"Masquer","chatWith":"Chatter avec la vidéo","openFull":"Analyse complète sur DeepSight","copy":"Copier","share":"Partager","copied":"Copié!","tournesolScore":"Score Tournesol"},"panel":{"synthesis":"Synthèse","chat":"Chat","factcheck":"Faits","tournesol":"Tournesol","study":"Étude","noVideo":"Aucune vidéo détectée","noVideoSub":"Naviguez sur YouTube ou TikTok pour analyser une vidéo.","notAnalyzed":"Vidéo non analysée","notAnalyzedSub":"Lancez l\'analyse depuis le widget YouTube.","loading":"Chargement..."},"bridge":{"title":"Retrouvez cette analyse sur","web":"Application Web","ios":"App iOS","android":"App Android","upgrade":"Passer Pro"},"teaser":{"unlockMore":"Débloquez plus","flashcards":"Flashcards IA","mindmap":"Carte mentale","webSearch":"Recherche web IA","export":"Export PDF/DOCX","playlists":"Playlists entières","seeAllPlans":"Voir tous les plans →","reviewMobile":"Révisez vos flashcards sur mobile","downloadApp":"Télécharger l\'app"},"ytRecommend":{"title":"Essayez DeepSight sur YouTube !","subtitle":"Naviguez vers une vidéo pour l\'analyser avec l\'IA","dismiss":"Fermer"},"onboarding":{"welcome":"Bienvenue sur DeepSight !","step1":"Ouvrez une vidéo YouTube","step2":"Cliquez sur \'Analyser\'","step3":"Lisez la synthèse IA","shortcuts":"Raccourcis clavier","shortcutWidget":"Alt+D — Toggle widget","shortcutAnalyze":"Alt+A — Analyser","shortcutChat":"Alt+C — Chat","shortcutPanel":"Alt+S — Side Panel"},"results":{"backToAnalysis":"Nouvelle analyse"},"voiceCall":{"buttonLabel":"Appel rapide","buttonAriaLabel":"Lancer un appel vocal avec un agent IA sur cette vidéo","buttonLabelFloating":"🎙️ Appeler la vidéo","trialBadge":"1 essai gratuit","trialUsed":"Essai utilisé","trialUsedTitle":"Essai utilisé — passer en Expert","minutesRemaining":"{count} min restantes","upgradeBadge":"Passer en Expert","connecting":{"title":"Connexion à l\'agent…","subtitle":"DeepSight commence à analyser la vidéo en parallèle. L\'appel démarre dans une seconde.","ariaStatus":"Connexion vocale en cours"},"callActive":{"live":"En appel","mute":"🔇 Mute","hangup":"📞 Raccrocher","muteAriaLabel":"Couper le micro","hangupAriaLabel":"Terminer l\'appel","settingsAriaLabel":"Réglages voix","applyingSettings":"Réapplication des réglages…"},"ctxBar":{"inProgress":"Analyse en cours · {percent}% du transcript reçu","complete":"Analyse complète","ariaInProgress":"Progression analyse vidéo : {percent} pourcent","ariaComplete":"Analyse vidéo complète"},"upgradeCta":{"trialUsedHeadline":"Tu as adoré ?","monthlyQuotaHeadline":"Tu as épuisé ton quota","proNoVoiceHeadline":"Voice call exclusif Expert","headlineSuffix":"Continue avec 30 min/mois","trialUsedBody":"Tu viens d\'utiliser ton essai gratuit. Upgrade vers Expert pour appeler n\'importe quelle vidéo, autant que tu veux.","monthlyQuotaBody":"Tu as utilisé tes 30 min de voice call ce mois-ci. Patience jusqu\'au mois prochain… ou upgrade pour plus.","proNoVoiceBody":"Le voice call est inclus uniquement dans le plan Expert (30 min/mois).","planName":"Expert","planPrice":"14.99€","planPeriod":"/mois","feature1":"✓ 30 min de voice call/mois","feature2":"✓ Analyses illimitées","feature3":"✓ Mind maps, web search, exports","ctaPrimary":"Passer en Expert →","ctaDismiss":"Continuer en Free (sans voice)"},"errors":{"micPermission":"Permission micro requise.","callEnded":"Appel terminé.","genericPrefix":"Erreur :","close":"Fermer","connectingTimeout":"Délai de connexion dépassé. Vérifie ta connexion."}},"promos":{"free":[{"text":"30 analyses/mois + Cartes mentales + Web Search — dès 5,99€/mois","cta":"Passer à Pro"},{"text":"Seulement 5 analyses/mois ? Passez à 30 avec Pro","cta":"Upgrade →"},{"text":"Quota limité ? Débloquez 30 analyses et toutes les fonctionnalités Pro","cta":"Voir les plans"}],"pro":[{"text":"100 analyses/mois + Mistral Large + Playlists 20 vidéos — Expert","cta":"Passer à Expert"},{"text":"DeepSight sur mobile — révisez vos flashcards partout","cta":"Télécharger"}],"expert":[{"text":"Gérez vos playlists et exports sur deepsightsynthesis.com","cta":"Ouvrir"}]}}',
          ),
          en: JSON.parse(
            '{"common":{"login":"Log in","logout":"Log out","back":"Back","retry":"Retry","send":"Send","hide":"Hide","error":"Error","viewPlans":"View plans","allPlans":"All plans","createAccount":"Create account","unlock":"Unlock","analyses":"analyses","credits":"credits"},"login":{"tagline":"Stop enduring your videos — question them.","badgeFr":"French AI","badgeEu":"Data in Europe","googleLoading":"Google login...","googleButton":"Continue with Google","divider":"or","emailPlaceholder":"Email address","passwordPlaceholder":"Password","loginLoading":"Logging in...","guestButton":"Try without an account (3 free analyses)","privacy":"Privacy","terms":"Terms"},"plans":{"free":"Free","pro":"Pro","expert":"Expert","etudiant":"Pro","student":"Pro","starter":"Pro","equipe":"Expert","team":"Expert"},"upsell":{"free":{"label":"Pro","feature":"30 analyses + Mind maps + Web Search","price":"€5.99"},"pro":{"label":"Expert","feature":"100 analyses + Mistral Large + 20-video playlists","price":"€14.99"}},"analysis":{"noVideo":"Open a YouTube or TikTok video to analyze it","analyzeButton":"Analyze this video","starting":"Starting analysis...","processing":"Processing...","failed":"Analysis failed","startFailed":"Could not start analysis","recent":"Recent analyses","quotaExceeded":"Quota reached","quotaExceededText":"Upgrade to a higher plan","mode":"Mode","language":"Language","quickChatButton":"Quick AI Chat","quickChatPreparing":"Preparing chat...","modes":{"standard":"Standard","accessible":"Accessible","expert":"Expert"},"languages":{"fr":"Français","en":"English","es":"Español","de":"Deutsch"}},"guest":{"banner":"Discovery mode — 3 free analyses without an account","exhaustedText":"Create a free account to save your analyses and do more"},"credits":{"critical":"Only {count} credits left —","recharge":"Top up","remaining":"{count} credits remaining","low":"cr."},"mistral":{"badge":"Powered by Mistral AI"},"synthesis":{"complete":"Analysis complete","fullAnalysis":"Full analysis","chat":"Chat","share":"Share","showDetail":"Show detailed analysis","hideDetail":"Hide detailed analysis","printPdf":"Print / PDF","reliable":"Reliable","toVerify":"To verify","unreliable":"Unreliable","generatingDef":"Generating definition...","shareTitle":"DeepSight Synthesis","verdict":"Verdict","keyPoints":"Key Points","concepts":"Concepts","tags":"Tags","generatedBy":"Generated by","analysisDesc":"AI analysis of YouTube & TikTok videos","euBadge":"100% European AI powered by Mistral AI"},"features":{"flashcards":"Flashcards","flashcardsDesc":"Study with AI-generated memory cards","mindMaps":"Mind maps","mindMapsDesc":"Visualize key ideas as a mind map","webSearch":"Web search","webSearchDesc":"Enrich analysis with external sources","exports":"Exports","exportsDesc":"Download as PDF, DOCX or Markdown","playlists":"Playlists","playlistsDesc":"Analyze entire playlists in one click","mobileDesc":"Access DeepSight on mobile","fromPrice":"from {price}"},"chat":{"welcome":"Ask a question about this video.","sessionExpired":"Session expired","reconnect":"Reconnect","webSearchEnable":"Enable web search","webSearchDisable":"Disable web search","webSearchLocked":"Web search — paid plan required","inputPlaceholder":"Ask a question...","expiredPlaceholder":"Session expired...","webEnriched":"Enriched by the web","unavailable":"Response unavailable","suggestions":["What are the key points?","Summarize in 3 sentences","Are there any biases?","What sources are cited?"]},"widget":{"analyze":"Analyze this video","quickChat":"Quick AI Chat","back":"← Back","minimize":"Minimize","expand":"Expand","analyzing":"Analyzing...","analysisComplete":"Analysis complete","reliability":"Reliability","verdict":"Verdict","keyPoints":"Key points","seeDetail":"See detailed analysis","hideDetail":"Hide","chatWith":"Chat with this video","openFull":"Full analysis on DeepSight","copy":"Copy","share":"Share","copied":"Copied!","tournesolScore":"Tournesol score"},"panel":{"synthesis":"Analysis","chat":"Chat","factcheck":"Facts","tournesol":"Tournesol","study":"Study","noVideo":"No video detected","noVideoSub":"Go to YouTube or TikTok to analyze a video.","notAnalyzed":"Video not yet analyzed","notAnalyzedSub":"Launch analysis from the YouTube widget.","loading":"Loading..."},"bridge":{"title":"Find this analysis on","web":"Web App","ios":"iOS App","android":"Android App","upgrade":"Go Pro"},"teaser":{"unlockMore":"Unlock more","flashcards":"AI Flashcards","mindmap":"Mind map","webSearch":"AI Web search","export":"PDF/DOCX Export","playlists":"Full playlists","seeAllPlans":"See all plans →","reviewMobile":"Study flashcards on mobile","downloadApp":"Download the app"},"ytRecommend":{"title":"Try DeepSight on YouTube!","subtitle":"Navigate to a video to analyze it with AI","dismiss":"Close"},"onboarding":{"welcome":"Welcome to DeepSight!","step1":"Open a YouTube video","step2":"Click \'Analyze\'","step3":"Read the AI synthesis","shortcuts":"Keyboard shortcuts","shortcutWidget":"Alt+D — Toggle widget","shortcutAnalyze":"Alt+A — Analyze","shortcutChat":"Alt+C — Chat","shortcutPanel":"Alt+S — Side Panel"},"results":{"backToAnalysis":"New analysis"},"voiceCall":{"buttonLabel":"Quick call","buttonAriaLabel":"Start a voice call with an AI agent about this video","buttonLabelFloating":"🎙️ Call the video","trialBadge":"1 free trial","trialUsed":"Trial used","trialUsedTitle":"Trial used — upgrade to Expert","minutesRemaining":"{count} min left","upgradeBadge":"Upgrade to Expert","connecting":{"title":"Connecting to the agent…","subtitle":"DeepSight is analyzing the video in parallel. The call starts in a second.","ariaStatus":"Voice call connecting"},"callActive":{"live":"On call","mute":"🔇 Mute","hangup":"📞 Hang up","muteAriaLabel":"Mute microphone","hangupAriaLabel":"End call","settingsAriaLabel":"Voice settings","applyingSettings":"Applying settings…"},"ctxBar":{"inProgress":"Analyzing · {percent}% of transcript received","complete":"Analysis complete","ariaInProgress":"Video analysis progress: {percent} percent","ariaComplete":"Video analysis complete"},"upgradeCta":{"trialUsedHeadline":"Loved it?","monthlyQuotaHeadline":"You\'ve used your quota","proNoVoiceHeadline":"Voice call is Expert-only","headlineSuffix":"Continue with 30 min/mo","trialUsedBody":"You just used your free trial. Upgrade to Expert to call any video, as much as you want.","monthlyQuotaBody":"You\'ve used your 30 min of voice call this month. Wait for next month… or upgrade for more.","proNoVoiceBody":"Voice call is only included in the Expert plan (30 min/month).","planName":"Expert","planPrice":"$14.99","planPeriod":"/mo","feature1":"✓ 30 min voice call/month","feature2":"✓ Unlimited analyses","feature3":"✓ Mind maps, web search, exports","ctaPrimary":"Upgrade to Expert →","ctaDismiss":"Stay Free (no voice)"},"errors":{"micPermission":"Microphone permission required.","callEnded":"Call ended.","genericPrefix":"Error:","close":"Close","connectingTimeout":"Connection timeout. Please check your connection."}},"promos":{"free":[{"text":"30 analyses/month + Mind maps + Web Search — from €5.99/mo","cta":"Upgrade to Pro"},{"text":"Only 5 analyses/month? Get 30 with Pro","cta":"Upgrade →"},{"text":"Limited quota? Unlock 30 analyses and all Pro features","cta":"View plans"}],"pro":[{"text":"100 analyses/month + Mistral Large + 20-video playlists — Expert","cta":"Upgrade to Expert"},{"text":"DeepSight on mobile — study your flashcards anywhere","cta":"Download"}],"expert":[{"text":"Manage your playlists and exports on deepsightsynthesis.com","cta":"Open"}]}}',
          ),
        },
        Ot = "ds_language";
      function zt() {
        const [e, t] = ue("fr");
        pe(() => {
          vt.storage.sync.get([Ot]).then((e) => {
            const n = e[Ot];
            ("en" !== n && "fr" !== n) || t(n);
          });
        }, []);
        const n = ve((e) => {
          (t(e), vt.storage.sync.set({ [Ot]: e }));
        }, []);
        return { t: $t[e], language: e, setLanguage: n };
      }
      const Rt = ({
          onLogin: e,
          onGoogleLogin: t,
          onGuestMode: n,
          error: a,
        }) => {
          const { t: s, language: r, setLanguage: i } = zt(),
            [o, l] = ue(""),
            [c, d] = ue(""),
            [u, m] = ue(!1),
            [p, g] = ue(!1),
            [h, f] = ue(null),
            _ = h || a;
          return ft("div", {
            className: "login-view",
            children: [
              ft(Et, {
                name: "sparkles",
                size: 32,
                className: "doodle-decoration",
                style: { top: 20, left: 16, transform: "rotate(-15deg)" },
              }),
              ft(Et, {
                name: "brain",
                size: 28,
                className: "doodle-decoration",
                style: { top: 60, right: 20, transform: "rotate(10deg)" },
              }),
              ft(Et, {
                name: "lightning",
                size: 24,
                className: "doodle-decoration",
                style: { bottom: 80, left: 24, transform: "rotate(-25deg)" },
              }),
              ft(Et, {
                name: "star",
                size: 20,
                className: "doodle-decoration",
                style: { bottom: 120, right: 30, transform: "rotate(20deg)" },
              }),
              ft("div", {
                className: "login-lang-toggle",
                children: [
                  ft("button", {
                    className:
                      "login-lang-btn " +
                      ("fr" === r ? "login-lang-active" : ""),
                    onClick: () => i("fr"),
                    children: "FR",
                  }),
                  ft("button", {
                    className:
                      "login-lang-btn " +
                      ("en" === r ? "login-lang-active" : ""),
                    onClick: () => i("en"),
                    children: "EN",
                  }),
                ],
              }),
              ft("div", {
                className: "login-hero",
                children: ft(Lt, { size: "lg", speed: "slow", showLogos: !0 }),
              }),
              ft("div", {
                className: "login-logo",
                children: ft("h1", { children: "DeepSight" }),
              }),
              ft("p", {
                className: "login-tagline",
                children: s.login.tagline,
              }),
              ft("div", {
                className: "login-platforms",
                children: [
                  ft("img", {
                    src: vt.runtime.getURL("platforms/youtube-icon-red.png"),
                    alt: "YouTube",
                    className: "login-platform-logo",
                    style: { height: 20, width: "auto" },
                  }),
                  ft("span", { className: "login-platform-sep" }),
                  ft("img", {
                    src: vt.runtime.getURL("platforms/tiktok-note-white.png"),
                    alt: "TikTok",
                    className: "login-platform-logo",
                    style: { height: 18, width: "auto" },
                  }),
                  ft("span", { className: "login-platform-sep" }),
                  ft("img", {
                    src: vt.runtime.getURL("platforms/mistral-m-orange.svg"),
                    alt: "Mistral",
                    className: "login-platform-logo",
                    style: { height: 18, width: "auto" },
                  }),
                  ft("span", { className: "login-platform-sep" }),
                  ft("img", {
                    src: vt.runtime.getURL("platforms/tournesol-logo.png"),
                    alt: "Tournesol",
                    className: "login-platform-logo",
                    style: { height: 16, width: "auto" },
                  }),
                ],
              }),
              ft("div", {
                className: "login-badges",
                children: [
                  ft("span", {
                    className: "login-badge",
                    children: [
                      ft("span", {
                        className: "login-badge-flag",
                        children: "🇫🇷",
                      }),
                      " ",
                      s.login.badgeFr,
                    ],
                  }),
                  ft("span", {
                    className: "login-badge",
                    children: [
                      ft("span", {
                        className: "login-badge-flag",
                        children: "🇪🇺",
                      }),
                      " ",
                      s.login.badgeEu,
                    ],
                  }),
                ],
              }),
              ft("button", {
                className: "btn-google",
                onClick: async function () {
                  (g(!0), f(null));
                  try {
                    await t();
                  } catch (e) {
                    f(e.message);
                  } finally {
                    g(!1);
                  }
                },
                disabled: p || u,
                children: p
                  ? s.login.googleLoading
                  : ft(k, {
                      children: [ft(Mt, {}), " ", s.login.googleButton],
                    }),
              }),
              ft("div", {
                className: "login-divider",
                children: s.login.divider,
              }),
              ft("form", {
                className: "login-form",
                onSubmit: async function (t) {
                  if ((t.preventDefault(), o && c)) {
                    (m(!0), f(null));
                    try {
                      await e(o, c);
                    } catch (e) {
                      f(e.message);
                    } finally {
                      m(!1);
                    }
                  }
                },
                children: [
                  ft("input", {
                    type: "email",
                    placeholder: s.login.emailPlaceholder,
                    value: o,
                    onChange: (e) => l(e.target.value),
                    required: !0,
                    disabled: u,
                  }),
                  ft("input", {
                    type: "password",
                    placeholder: s.login.passwordPlaceholder,
                    value: c,
                    onChange: (e) => d(e.target.value),
                    required: !0,
                    disabled: u,
                  }),
                  _ && ft("div", { className: "login-error", children: _ }),
                  ft("button", {
                    type: "submit",
                    className: "btn-login",
                    disabled: u || !o || !c,
                    children: u ? s.login.loginLoading : s.common.login,
                  }),
                ],
              }),
              ft("button", {
                className: "btn-guest",
                onClick: n,
                children: s.login.guestButton,
              }),
              ft("div", {
                className: "login-footer",
                children: [
                  ft("a", {
                    href: "https://www.deepsightsynthesis.com/register",
                    target: "_blank",
                    rel: "noreferrer",
                    children: s.common.createAccount,
                  }),
                  ft("span", { children: "·" }),
                  ft("a", {
                    href: "https://www.deepsightsynthesis.com",
                    target: "_blank",
                    rel: "noreferrer",
                    children: "deepsightsynthesis.com",
                  }),
                ],
              }),
              ft("div", {
                className: "login-legal",
                children: [
                  ft("a", {
                    href: "https://www.deepsightsynthesis.com/legal/privacy",
                    target: "_blank",
                    rel: "noreferrer",
                    children: s.login.privacy,
                  }),
                  ft("span", { children: "·" }),
                  ft("a", {
                    href: "https://www.deepsightsynthesis.com/legal/cgu",
                    target: "_blank",
                    rel: "noreferrer",
                    children: s.login.terms,
                  }),
                ],
              }),
            ],
          });
        },
        Ut = [
          /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\s]+)/,
          /youtube\.com\/shorts\/([^&?\s]+)/,
        ],
        Ft = [
          /tiktok\.com\/@[\w.-]+\/video\/(\d+)/i,
          /vm\.tiktok\.com\/([\w-]+)/i,
          /m\.tiktok\.com\/v\/(\d+)/i,
          /tiktok\.com\/t\/([\w-]+)/i,
          /tiktok\.com\/video\/(\d+)/i,
        ];
      function Vt(e) {
        return (function (e) {
          return Ut.some((t) => t.test(e));
        })(e)
          ? "youtube"
          : (function (e) {
                return Ft.some((t) => t.test(e));
              })(e)
            ? "tiktok"
            : null;
      }
      async function Bt() {
        return (
          (await vt.storage.local.get(["recentAnalyses"])).recentAnalyses || []
        );
      }
      async function Ht() {
        return (
          (await vt.storage.local.get(["deepsight_free_analyses"]))
            .deepsight_free_analyses || 0
        );
      }
      const qt = "https://www.deepsightsynthesis.com",
        jt = {
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
      function Wt(e) {
        const t = document.createElement("div");
        return ((t.textContent = e), t.innerHTML);
      }
      function Gt(e) {
        const t = e.split("\n"),
          n = [];
        let a = !1,
          s = !1;
        for (let e = 0; e < t.length; e++) {
          let r = t[e];
          if (/^-{3,}$/.test(r.trim()) || /^\*{3,}$/.test(r.trim())) {
            (a && (n.push("</ul>"), (a = !1)),
              s && (n.push("</ol>"), (s = !1)),
              n.push('<hr class="ds-md-hr">'));
            continue;
          }
          const i = r.match(/^(#{1,4})\s+(.+)$/);
          if (i) {
            (a && (n.push("</ul>"), (a = !1)),
              s && (n.push("</ol>"), (s = !1)));
            const e = i[1].length,
              t = i[2],
              r = e <= 2 ? Kt(t) : "",
              o = Qt(t),
              l = r ? `${r}&nbsp;&nbsp;` : "";
            n.push(`<h${e} class="ds-md-h${e}">${l}${o}</h${e}>`);
            continue;
          }
          if (r.startsWith("&gt; ") || "&gt;" === r) {
            (a && (n.push("</ul>"), (a = !1)),
              s && (n.push("</ol>"), (s = !1)));
            const e = Qt(r.replace(/^&gt;\s?/, ""));
            n.push(`<blockquote class="ds-md-blockquote">${e}</blockquote>`);
            continue;
          }
          const o = r.match(/^(\s*)[-*]\s+(.+)$/);
          if (o) {
            (s && (n.push("</ol>"), (s = !1)),
              a || (n.push('<ul class="ds-md-ul">'), (a = !0)),
              n.push(`<li>${Qt(o[2])}</li>`));
            continue;
          }
          const l = r.match(/^(\s*)\d+\.\s+(.+)$/);
          l
            ? (a && (n.push("</ul>"), (a = !1)),
              s || (n.push('<ol class="ds-md-ol">'), (s = !0)),
              n.push(`<li>${Qt(l[2])}</li>`))
            : (a && (n.push("</ul>"), (a = !1)),
              s && (n.push("</ol>"), (s = !1)),
              "" !== r.trim()
                ? n.push(`<p class="ds-md-p">${Qt(r)}</p>`)
                : n.push('<div class="ds-md-spacer"></div>'));
        }
        return (a && n.push("</ul>"), s && n.push("</ol>"), n.join("\n"));
      }
      const Yt = {
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
      function Kt(e) {
        const t = e.toLowerCase().trim();
        for (const [e, n] of Object.entries(Yt)) if (t.includes(e)) return n;
        return "📌";
      }
      function Qt(e) {
        return e
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
      function Xt(e) {
        return e
          .replace(/\*\*(.+?)\*\*/g, "$1")
          .replace(/\*(.+?)\*/g, "$1")
          .replace(/`([^`]+)`/g, "$1")
          .replace(/#{1,6}\s+/g, "")
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
          .replace(/^>\s+/gm, "")
          .replace(/\n+/g, " ")
          .trim();
      }
      function Zt(e, t) {
        if (e.length <= t) return e;
        const n = e.substring(0, t),
          a = n.lastIndexOf(" ");
        return (a > 0.6 * t ? n.substring(0, a) : n) + "...";
      }
      function Jt(e) {
        switch (e) {
          case "solid":
            return "✅";
          case "weak":
            return "⚠️";
          case "insight":
            return "💡";
        }
      }
      function en(e) {
        switch (e) {
          case "solid":
            return "keypoint-solid";
          case "weak":
            return "keypoint-weak";
          case "insight":
            return "keypoint-insight";
        }
      }
      const tn = [
          {
            key: "flashcards",
            icon: "🗂️",
            doodleName: "book",
            labelKey: "flashcards",
            hash: "#flashcards",
            minPlan: "pro",
            price: "5,99€",
          },
          {
            key: "mind_maps",
            icon: "🧠",
            doodleName: "brain",
            labelKey: "mindMaps",
            hash: "#mindmap",
            minPlan: "pro",
            price: "5,99€",
          },
          {
            key: "web_search",
            icon: "🌐",
            doodleName: "globe",
            labelKey: "webSearch",
            hash: "#websearch",
            minPlan: "pro",
            price: "5,99€",
          },
          {
            key: "exports",
            icon: "📤",
            doodleName: "code",
            labelKey: "exports",
            hash: "#export",
            minPlan: "pro",
            price: "5,99€",
          },
          {
            key: "playlists",
            icon: "🎬",
            doodleName: "camera",
            labelKey: "playlists",
            hash: "#playlists",
            minPlan: "pro",
            price: "5,99€",
          },
        ],
        nn = ({ summary: e, summaryId: t, planInfo: n, onOpenChat: a }) => {
          const { t: s, language: r } = zt(),
            [i, o] = ue(!1),
            l = (function (e) {
              const t = (function (e) {
                  const t = [
                    /#+\s*(?:Conclusion|Verdict|Synthèse|Résumé|Summary|En résumé|Final Assessment|Overall Assessment)[^\n]*\n([\s\S]*?)(?=\n#|\n---|\n\*{3,}|$)/i,
                    /\*\*(?:Conclusion|Verdict|Synthèse|En résumé|Summary)\*\*[:\s]*([\s\S]*?)(?=\n\n|\n#|\n---|\n\*{3,}|$)/i,
                  ];
                  for (const n of t) {
                    const t = e.match(n);
                    if (t && t[1]) {
                      const e = Xt(t[1]).trim();
                      if (e.length > 20) return Zt(e, 200);
                    }
                  }
                  const n = e.split(/\n\n+/).filter((e) => {
                    const t = e.trim();
                    return (
                      t.length > 30 &&
                      !t.startsWith("#") &&
                      !t.startsWith("-") &&
                      !t.startsWith("*")
                    );
                  });
                  return n.length > 0
                    ? Zt(Xt(n[n.length - 1]), 200)
                    : "Analysis complete. See detailed view for full results.";
                })(e),
                n = (function (e) {
                  const t = [],
                    n = e.split("\n"),
                    a = [/\b(?:SOLIDE|SOLID)\b/i, /\u2705\s*\*\*/, /\u2705/],
                    s = [
                      /\b(?:A VERIFIER|TO VERIFY|QUESTIONABLE|WEAK|INCERTAIN|UNCERTAIN)\b/i,
                      /\u26A0\uFE0F\s*\*\*/,
                      /\u2753/,
                      /\u26A0/,
                    ],
                    r = [/\b(?:PLAUSIBLE)\b/i, /\uD83D\uDCA1/];
                  for (const e of n) {
                    const n = e.replace(/^[\s\-*]+/, "").trim();
                    if (n.length < 10) continue;
                    let i = null;
                    if (
                      (a.some((t) => t.test(e))
                        ? (i = "solid")
                        : s.some((t) => t.test(e))
                          ? (i = "weak")
                          : r.some((t) => t.test(e)) && (i = "insight"),
                      i && t.filter((e) => e.type === i).length < 2)
                    ) {
                      const e = Xt(n)
                        .replace(
                          /\b(?:SOLIDE|SOLID|PLAUSIBLE|INCERTAIN|UNCERTAIN|A VERIFIER|TO VERIFY|QUESTIONABLE|WEAK)\b\s*[:—\-–]?\s*/gi,
                          "",
                        )
                        .replace(/^[✅⚠️❓💡🔍🔬]\s*/u, "")
                        .trim();
                      e.length > 10 && t.push({ type: i, text: Zt(e, 120) });
                    }
                    if (t.length >= 4) break;
                  }
                  if (t.length < 2) {
                    const n =
                      /#+\s*(?:Points?\s+(?:forts?|clés?|faibles?)|Key\s+(?:Points?|Findings?|Takeaways?)|Strengths?|Weaknesses?|Main\s+Points?)[^\n]*\n([\s\S]*?)(?=\n#|$)/gi;
                    let a;
                    for (; null !== (a = n.exec(e)) && t.length < 4; ) {
                      const e = a[1].match(/^[\s]*[-*]\s+(.+)$/gm);
                      if (e)
                        for (const n of e.slice(0, 4 - t.length)) {
                          const e = Xt(n.replace(/^[\s]*[-*]\s+/, ""));
                          e.length > 10 &&
                            !t.some((t) => t.text === Zt(e, 120)) &&
                            t.push({ type: "insight", text: Zt(e, 120) });
                        }
                    }
                  }
                  return t.slice(0, 4);
                })(e),
                a = (function (e) {
                  const t = [],
                    n = e.match(
                      /#+\s*(?:Tags?|Thèmes?|Themes?|Topics?|Catégories?|Categories?)[^\n]*\n([\s\S]*?)(?=\n#|$)/i,
                    );
                  if (n) {
                    const e = n[1].match(/[-*]\s+(.+)/g);
                    if (e)
                      for (const n of e.slice(0, 3)) {
                        const e = Xt(n.replace(/^[-*]\s+/, "")).trim();
                        e.length > 0 && e.length < 30 && t.push(e);
                      }
                  }
                  if (0 === t.length) {
                    const n = e.match(/^#{2,3}\s+(.+)$/gm);
                    if (n) {
                      const e =
                        /^(?:Conclusion|Summary|Résumé|Synthèse|Introduction|Verdict|Analysis|Points?\s+(?:clés?|forts?|faibles?)|Key\s+(?:Points?|Findings?)|Strengths?|Weaknesses?|Overview)/i;
                      for (const a of n) {
                        const n = Xt(a.replace(/^#{2,3}\s+/, "")).trim();
                        if (
                          n.length > 2 &&
                          n.length < 35 &&
                          !e.test(n) &&
                          (t.push(n), t.length >= 3)
                        )
                          break;
                      }
                    }
                  }
                  return t.slice(0, 3);
                })(e);
              return { verdict: t, keyPoints: n, tags: a };
            })(e.summary_content),
            c = jt[e.category] || "📋",
            d = e.reliability_score,
            u = d >= 80 ? "score-high" : d >= 60 ? "score-mid" : "score-low",
            m = d >= 80 ? "✅" : d >= 60 ? "⚠️" : "❓",
            p = Gt(Wt(e.summary_content)),
            g = tn.map((e) => ({
              cta: e,
              available: n?.features?.[e.key] ?? !1,
            }));
          return ft("div", {
            className: "synthesis",
            children: [
              ft("div", {
                className: "synthesis-header",
                children: [
                  ft("span", {
                    className: "synthesis-done",
                    children: ["✅", " ", s.synthesis.complete],
                  }),
                  ft("div", {
                    className: "synthesis-badges",
                    children: [
                      ft("span", {
                        className: "synthesis-badge",
                        children: [c, " ", e.category],
                      }),
                      ft("span", {
                        className: `synthesis-badge ${u}`,
                        children: [m, " ", d, "%"],
                      }),
                    ],
                  }),
                ],
              }),
              ft("div", {
                className: "synthesis-platforms",
                children: [
                  ft("img", {
                    src: vt.runtime.getURL("platforms/youtube-icon-red.png"),
                    alt: "YouTube",
                    style: { height: 16 },
                  }),
                  ft("span", { className: "synthesis-platform-sep" }),
                  ft("img", {
                    src: vt.runtime.getURL("platforms/tiktok-note-white.png"),
                    alt: "TikTok",
                    style: { height: 14 },
                  }),
                  ft("span", { className: "synthesis-platform-sep" }),
                  ft("img", {
                    src: vt.runtime.getURL("platforms/mistral-logo-white.png"),
                    alt: "Mistral AI",
                    style: { height: 12, opacity: 0.7 },
                  }),
                  ft("span", { className: "synthesis-platform-sep" }),
                  ft("img", {
                    src: vt.runtime.getURL("platforms/tournesol-logo.png"),
                    alt: "Tournesol",
                    style: { height: 13, opacity: 0.8 },
                  }),
                ],
              }),
              e.tournesol?.found &&
                null !== e.tournesol.tournesol_score &&
                ft("a", {
                  href: `https://tournesol.app/entities/yt:${e.video_url?.match(/[?&]v=([^&]+)/)?.[1] || ""}`,
                  target: "_blank",
                  rel: "noreferrer",
                  className: "tournesol-badge",
                  title: `Score Tournesol: ${e.tournesol.tournesol_score} | ${e.tournesol.n_contributors} contributeurs | ${e.tournesol.n_comparisons} comparaisons`,
                  style: {
                    background:
                      e.tournesol.tournesol_score >= 50
                        ? "rgba(34,197,94,0.12)"
                        : e.tournesol.tournesol_score >= 20
                          ? "rgba(234,179,8,0.12)"
                          : "var(--bg-secondary)",
                    border:
                      "1px solid " +
                      (e.tournesol.tournesol_score >= 50
                        ? "rgba(34,197,94,0.25)"
                        : e.tournesol.tournesol_score >= 20
                          ? "rgba(234,179,8,0.25)"
                          : "var(--border-default)"),
                  },
                  children: [
                    ft("span", { style: { fontSize: "14px" }, children: "🌻" }),
                    ft("span", {
                      style: { fontWeight: 600, color: "var(--text-primary)" },
                      children: [
                        "Tournesol: ",
                        e.tournesol.tournesol_score > 0 ? "+" : "",
                        Math.round(e.tournesol.tournesol_score),
                      ],
                    }),
                    ft("span", {
                      style: {
                        opacity: 0.6,
                        fontSize: "11px",
                        color: "var(--text-tertiary)",
                      },
                      children: ["(", e.tournesol.n_contributors, " votes)"],
                    }),
                  ],
                }),
              ft("div", {
                className: "synthesis-verdict",
                children: ft("p", { children: l.verdict }),
              }),
              l.keyPoints.length > 0 &&
                ft("div", {
                  className: "synthesis-keypoints",
                  children: l.keyPoints.map((e, t) =>
                    ft(
                      "div",
                      {
                        className: `keypoint ${en(e.type)}`,
                        children: [
                          ft("span", {
                            className: "keypoint-icon",
                            children: Jt(e.type),
                          }),
                          ft("span", {
                            className: "keypoint-text",
                            children: e.text,
                          }),
                        ],
                      },
                      t,
                    ),
                  ),
                }),
              l.tags.length > 0 &&
                ft("div", {
                  className: "synthesis-tags",
                  children: l.tags.map((e, t) =>
                    ft("span", { className: "tag-pill", children: e }, t),
                  ),
                }),
              e.concepts &&
                e.concepts.length > 0 &&
                ft("div", {
                  className: "synthesis-concepts",
                  children: e.concepts.slice(0, 3).map((e, t) =>
                    ft(
                      "div",
                      {
                        className: "concept-item",
                        children: [
                          ft("div", {
                            className: "concept-name",
                            children: e.name,
                          }),
                          ft("div", {
                            className: "concept-def",
                            children: e.definition || s.synthesis.generatingDef,
                          }),
                        ],
                      },
                      t,
                    ),
                  ),
                }),
              ft("button", {
                className: "toggle-detail",
                onClick: () => o(!i),
                children: [
                  ft("span", {
                    children: i
                      ? s.synthesis.hideDetail
                      : s.synthesis.showDetail,
                  }),
                  ft(i ? Ct : kt, { size: 14 }),
                ],
              }),
              i &&
                ft("div", {
                  className: "detail-panel",
                  dangerouslySetInnerHTML: { __html: p },
                }),
              ft("div", {
                className: "synthesis-actions",
                children: [
                  ft("a", {
                    href: `${qt}/summary/${t}`,
                    target: "_blank",
                    rel: "noreferrer",
                    className: "btn-action btn-action-primary",
                    children: [
                      ft(wt, { size: 14 }),
                      " ",
                      s.synthesis.fullAnalysis,
                    ],
                  }),
                  ft("button", {
                    className: "btn-action btn-action-secondary",
                    onClick: a,
                    children: [ft(yt, { size: 14 }), " ", s.synthesis.chat],
                  }),
                  ft("button", {
                    className: "btn-action btn-action-secondary",
                    onClick: () => {
                      const t =
                          d >= 80
                            ? s.synthesis.reliable
                            : d >= 60
                              ? s.synthesis.toVerify
                              : s.synthesis.unreliable,
                        n = (function (e, t, n, a, s, r) {
                          const i =
                              n >= 80
                                ? "#22c55e"
                                : n >= 60
                                  ? "#eab308"
                                  : "#ef4444",
                            o = "fr" === r ? "fr-FR" : "en-US",
                            l = new Date(e.created_at).toLocaleDateString(o, {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            }),
                            c = t.keyPoints
                              .map(
                                (e) =>
                                  `<div style="display:flex;gap:10px;padding:12px 16px;border-radius:10px;background:rgba(200,144,58,0.06);border:1px solid rgba(200,144,58,0.1);margin-bottom:8px">\n      <span style="font-size:16px;flex-shrink:0">${"solid" === e.type ? "✅" : "weak" === e.type ? "⚠️" : "💡"}</span>\n      <span style="color:#F5F0E8;font-size:14px;line-height:1.6">${e.text}</span>\n    </div>`,
                              )
                              .join(""),
                            d = t.tags
                              .map(
                                (e) =>
                                  `<span style="display:inline-block;padding:4px 12px;border-radius:20px;background:rgba(200,144,58,0.12);color:#C8903A;font-size:12px;font-weight:500">${e}</span>`,
                              )
                              .join(" "),
                            u = (e.concepts || [])
                              .slice(0, 5)
                              .map(
                                (e) =>
                                  `<div style="padding:14px 18px;border-radius:12px;background:rgba(155,107,74,0.08);border:1px solid rgba(155,107,74,0.15)">\n      <div style="font-weight:600;color:#9B6B4A;font-size:14px;margin-bottom:4px;font-family:'Cormorant Garamond',serif">${e.name}</div>\n      <div style="color:#B5A89B;font-size:13px;line-height:1.5">${e.definition || s.synthesis.generatingDef}</div>\n    </div>`,
                              )
                              .join("");
                          return `<!DOCTYPE html>\n<html lang="${r}">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${e.video_title} — ${s.synthesis.shareTitle}</title>\n  <link rel="preconnect" href="https://fonts.googleapis.com">\n  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">\n  <style>\n    *{margin:0;padding:0;box-sizing:border-box}\n    body{font-family:'DM Sans',system-ui,sans-serif;background:#0a0a0f;color:#F5F0E8;min-height:100vh}\n    .page{max-width:720px;margin:0 auto;padding:40px 24px 60px}\n    .header{text-align:center;margin-bottom:32px}\n    .logo{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:#C8903A;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:16px;font-family:'Cormorant Garamond',serif}\n    .video-title{font-size:22px;font-weight:700;line-height:1.35;color:#F5F0E8;margin-bottom:8px;font-family:'Cormorant Garamond',serif}\n    .video-meta{display:flex;align-items:center;justify-content:center;gap:16px;font-size:13px;color:#7A7068;flex-wrap:wrap}\n    .score-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;font-weight:600;font-size:13px;background:${i}15;color:${i}}\n    .section{margin-top:28px}\n    .section-title{font-size:15px;font-weight:600;color:#B5A89B;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:14px;display:flex;align-items:center;gap:8px;font-family:'Cormorant Garamond',serif}\n    .verdict{padding:20px 24px;border-radius:14px;background:rgba(200,144,58,0.06);border:1px solid rgba(200,144,58,0.12);border-left:3px solid #C8903A;font-size:15px;line-height:1.7;color:#F5F0E8}\n    .concepts-grid{display:grid;gap:10px}\n    .tags{display:flex;flex-wrap:wrap;gap:8px}\n    .footer{margin-top:40px;padding-top:20px;border-top:1px solid rgba(200,144,58,0.08);text-align:center;color:#45455a;font-size:12px}\n    .footer a{color:#C8903A;text-decoration:none}\n    .footer a:hover{text-decoration:underline}\n    .btn-print{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;border-radius:10px;background:linear-gradient(135deg,#C8903A,#D4A054);color:#0a0a0f;font-size:13px;font-weight:600;cursor:pointer;border:none;font-family:inherit;transition:all 0.2s}\n    .btn-print:hover{transform:translateY(-1px);box-shadow:0 4px 20px rgba(200,144,58,0.35)}\n    .actions{text-align:center;margin-top:28px;display:flex;gap:12px;justify-content:center}\n    @media print{\n      body{background:white;color:#1a1a1a}\n      .verdict{background:#faf7f2;border-color:#e2e8f0}\n      .score-badge{background:#f0fdf4}\n      .actions,.btn-print{display:none!important}\n      .section-title{color:#64748b}\n      .footer{color:#94a3b8}\n    }\n  </style>\n</head>\n<body>\n  <div class="page">\n    <div class="header">\n      <div class="logo">DeepSight Synthesis</div>\n      <h1 class="video-title">${e.video_title}</h1>\n      <div class="video-meta">\n        <span>${e.video_channel}</span>\n        <span>${e.category}</span>\n        <span>${l}</span>\n        <span class="score-badge">${n}% — ${a}</span>\n      </div>\n    </div>\n\n    <div class="section">\n      <div class="section-title">${s.synthesis.verdict}</div>\n      <div class="verdict">${t.verdict}</div>\n    </div>\n\n    ${t.keyPoints.length > 0 ? `\n    <div class="section">\n      <div class="section-title">${s.synthesis.keyPoints}</div>\n      ${c}\n    </div>` : ""}\n\n    ${(e.concepts || []).length > 0 ? `\n    <div class="section">\n      <div class="section-title">${s.synthesis.concepts}</div>\n      <div class="concepts-grid">${u}</div>\n    </div>` : ""}\n\n    ${t.tags.length > 0 ? `\n    <div class="section">\n      <div class="section-title">${s.synthesis.tags}</div>\n      <div class="tags">${d}</div>\n    </div>` : ""}\n\n    <div class="actions">\n      <button class="btn-print" onclick="window.print()">${s.synthesis.printPdf}</button>\n    </div>\n\n    <div class="footer">\n      <p>${s.synthesis.generatedBy} <a href="https://www.deepsightsynthesis.com" target="_blank">DeepSight</a> — ${s.synthesis.analysisDesc}</p>\n      <p style="margin-top:4px">🇫🇷🇪🇺 ${s.synthesis.euBadge}</p>\n    </div>\n  </div>\n</body>\n</html>`;
                        })(e, l, d, t, s, r),
                        a = new Blob([n], { type: "text/html" }),
                        i = URL.createObjectURL(a);
                      vt.tabs.create({ url: i });
                    },
                    title: s.synthesis.share,
                    children: [ft(Nt, { size: 14 }), " ", s.synthesis.share],
                  }),
                ],
              }),
              ft("div", {
                className: "feature-ctas",
                children: [
                  g.map(({ cta: e, available: n }) =>
                    ft(
                      "button",
                      n
                        ? {
                            className: "feature-cta feature-cta-available",
                            onClick: () =>
                              vt.tabs.create({
                                url: `${qt}/summary/${t}${e.hash}`,
                              }),
                            children: [
                              ft("span", {
                                className: "feature-cta-icon",
                                children: ft(Et, {
                                  name: e.doodleName,
                                  size: 16,
                                  color: "var(--accent-primary)",
                                }),
                              }),
                              ft("span", {
                                className: "feature-cta-label",
                                children: s.features[e.labelKey],
                              }),
                              ft("span", {
                                className: "feature-cta-arrow",
                                children: "↗",
                              }),
                            ],
                          }
                        : {
                            className: "feature-cta feature-cta-locked",
                            onClick: () =>
                              vt.tabs.create({ url: `${qt}/upgrade` }),
                            children: [
                              ft("span", {
                                className: "feature-cta-icon",
                                children: ft(Et, {
                                  name: e.doodleName,
                                  size: 16,
                                  color: "var(--text-muted)",
                                }),
                              }),
                              ft("span", {
                                className: "feature-cta-label",
                                children: s.features[e.labelKey],
                              }),
                              ft("span", {
                                className: "feature-cta-price",
                                children: s.features.fromPrice.replace(
                                  "{price}",
                                  e.price,
                                ),
                              }),
                            ],
                          },
                      e.key,
                    ),
                  ),
                  ft("a", {
                    href: `${qt}/upgrade`,
                    target: "_blank",
                    rel: "noreferrer",
                    className: "feature-cta-all-plans",
                    onClick: (e) => {
                      (e.preventDefault(),
                        vt.tabs.create({ url: `${qt}/upgrade` }));
                    },
                    children: [s.common.allPlans, " ", "↗"],
                  }),
                ],
              }),
            ],
          });
        };
      function an(e) {
        return e.replace(/\[\[([^\]]+)\]\]/g, "$1").trim();
      }
      const sn = [
          "plus",
          "pro",
          "starter",
          "student",
          "etudiant",
          "expert",
          "team",
          "equipe",
        ],
        rn = ({
          summaryId: e,
          videoTitle: t,
          onClose: n,
          onSessionExpired: a,
          userPlan: s,
        }) => {
          const { t: r } = zt(),
            [i, o] = ue([]),
            [l, c] = ue(""),
            [d, u] = ue(!1),
            [m, p] = ue(!0),
            [g, h] = ue(!1),
            [f, _] = ue(!1),
            v = he(null),
            y = !!(b = s) && sn.includes(b.toLowerCase());
          var b;
          const A = r.chat.suggestions;
          async function x(t, n) {
            const a = t || l.trim();
            if (!a || d) return;
            (t || c(""), o((e) => [...e, { role: "user", content: a }]), u(!0));
            const s = {};
            (n || (y && f)) && (s.use_web_search = !0);
            try {
              const t = await vt.runtime.sendMessage({
                action: "ASK_QUESTION",
                data: { summaryId: e, question: a, options: s },
              });
              if (t.success) {
                const e = t.result;
                o((t) => [
                  ...t,
                  {
                    role: "assistant",
                    content: e.response,
                    web_search_used: e.web_search_used,
                  },
                ]);
              } else {
                const e = t.error || "";
                e.includes("SESSION_EXPIRED")
                  ? h(!0)
                  : o((t) => [
                      ...t,
                      {
                        role: "assistant",
                        content: `${r.common.error} : ${e || r.chat.unavailable}`,
                      },
                    ]);
              }
            } catch (e) {
              const t = e.message || "";
              t.includes("SESSION_EXPIRED")
                ? h(!0)
                : o((e) => [
                    ...e,
                    { role: "assistant", content: `${r.common.error} : ${t}` },
                  ]);
            } finally {
              u(!1);
            }
          }
          function w(e) {
            x(an(e));
          }
          (pe(() => {
            !(async function () {
              try {
                const t = await vt.runtime.sendMessage({
                  action: "GET_CHAT_HISTORY",
                  data: { summaryId: e },
                });
                t.success && Array.isArray(t.result) && o(t.result);
              } catch {
              } finally {
                p(!1);
              }
            })();
          }, [e]),
            pe(() => {
              v.current && (v.current.scrollTop = v.current.scrollHeight);
            }, [i, d]));
          const k = t.length > 30 ? t.substring(0, 30) + "..." : t;
          return ft("div", {
            className: "chat-view",
            children: [
              ft("div", {
                className: "chat-header",
                children: [
                  ft("button", {
                    className: "icon-btn",
                    onClick: n,
                    title: r.common.back,
                    children: ft(At, { size: 18 }),
                  }),
                  ft("span", {
                    className: "chat-header-title",
                    children: [r.synthesis.chat, " : « ", k, " »"],
                  }),
                ],
              }),
              ft("div", {
                className: "chat-messages",
                ref: v,
                children: [
                  m
                    ? ft("div", {
                        className: "chat-welcome",
                        children: ft(Lt, { size: "xs", speed: "fast" }),
                      })
                    : 0 === i.length
                      ? ft("div", {
                          className: "chat-welcome",
                          children: [
                            ft(Et, {
                              name: "robot",
                              size: 32,
                              color: "var(--accent-primary)",
                              style: { opacity: 0.6 },
                            }),
                            ft("p", { children: r.chat.welcome }),
                            ft("div", {
                              className: "chat-suggestions",
                              children: A.map((e, t) =>
                                ft(
                                  "button",
                                  {
                                    className: "chat-suggestion-btn",
                                    onClick: () => {
                                      x(e);
                                    },
                                    disabled: d || g,
                                    children: [
                                      ft("span", {
                                        className: "chat-suggestion-arrow",
                                        children: "→",
                                      }),
                                      e,
                                    ],
                                  },
                                  t,
                                ),
                              ),
                            }),
                          ],
                        })
                      : i.map((e, t) =>
                          ft(
                            on,
                            {
                              msg: e,
                              onQuestionClick: w,
                              webEnrichedLabel: r.chat.webEnriched,
                            },
                            t,
                          ),
                        ),
                  d &&
                    ft("div", {
                      className: "chat-typing",
                      children: [
                        ft("div", { className: "chat-typing-dot" }),
                        ft("div", { className: "chat-typing-dot" }),
                        ft("div", { className: "chat-typing-dot" }),
                      ],
                    }),
                ],
              }),
              g &&
                ft("div", {
                  className: "chat-session-expired",
                  children: [
                    ft("span", {
                      children: ["🔒", " ", r.chat.sessionExpired],
                    }),
                    ft("button", {
                      className: "chat-reconnect-btn",
                      onClick: () => {
                        a ? a() : n();
                      },
                      children: r.chat.reconnect,
                    }),
                  ],
                }),
              ft("div", {
                className: "chat-input-area",
                children: [
                  ft("button", {
                    className:
                      "chat-ws-toggle " + (f && y ? "chat-ws-active" : ""),
                    onClick: () => {
                      y && _(!f);
                    },
                    title: y
                      ? f
                        ? r.chat.webSearchDisable
                        : r.chat.webSearchEnable
                      : r.chat.webSearchLocked,
                    style: { opacity: y ? 1 : 0.4 },
                    children: ft(Et, {
                      name: "globe",
                      size: 14,
                      color:
                        f && y ? "var(--accent-primary)" : "var(--text-muted)",
                    }),
                  }),
                  ft("input", {
                    type: "text",
                    className: "chat-input",
                    value: l,
                    onChange: (e) => c(e.target.value),
                    onKeyDown: function (e) {
                      "Enter" !== e.key ||
                        e.shiftKey ||
                        (e.preventDefault(), x());
                    },
                    placeholder: g
                      ? r.chat.expiredPlaceholder
                      : r.chat.inputPlaceholder,
                    disabled: d || g,
                    autoFocus: !0,
                  }),
                  ft("button", {
                    className: "chat-send-btn",
                    onClick: () => x(),
                    disabled: !l.trim() || d || g,
                    title: r.common.send,
                    children: ft(bt, { size: 16 }),
                  }),
                ],
              }),
            ],
          });
        },
        on = ({ msg: e, onQuestionClick: t, webEnrichedLabel: n }) => {
          const a = _e(
            () =>
              "user" === e.role
                ? { text: e.content, questions: [] }
                : (function (e) {
                    const t = /\[ask:\s*([^\]]+)\]/g,
                      n = [];
                    let a;
                    for (; null !== (a = t.exec(e)); ) {
                      const e = a[1].trim();
                      e && n.push(e);
                    }
                    return { text: e.replace(t, "").trim(), questions: n };
                  })(e.content),
            [e.content, e.role],
          );
          return ft("div", {
            className: `chat-msg chat-msg-${e.role}`,
            children:
              "assistant" === e.role
                ? ft(k, {
                    children: [
                      e.web_search_used &&
                        ft("div", {
                          className: "chat-web-badge",
                          children: [
                            ft(Et, {
                              name: "globe",
                              size: 12,
                              color: "var(--accent-primary)",
                              style: {
                                display: "inline-block",
                                verticalAlign: "middle",
                                marginRight: 4,
                              },
                            }),
                            n,
                          ],
                        }),
                      ft("div", {
                        className: "chat-md-content",
                        dangerouslySetInnerHTML: { __html: Gt(Wt(a.text)) },
                      }),
                      a.questions.length > 0 &&
                        ft("div", {
                          className: "chat-ask-pills",
                          children: a.questions.map((e, n) =>
                            ft(
                              "button",
                              {
                                className: "chat-ask-pill",
                                onClick: () => t(e),
                                children: [
                                  ft("span", {
                                    className: "chat-ask-arrow",
                                    children: "→",
                                  }),
                                  an(e),
                                ],
                              },
                              n,
                            ),
                          ),
                        }),
                    ],
                  })
                : e.content,
          });
        },
        ln =
          "linear-gradient(135deg, rgba(200,144,58,0.15), rgba(155,107,74,0.15))",
        cn =
          "linear-gradient(135deg, rgba(200,144,58,0.2), rgba(200,144,58,0.08))",
        dn = [
          {
            id: "free-flashcards",
            textKey: 0,
            url: `${qt}/upgrade`,
            gradient: cn,
          },
          {
            id: "free-mindmap",
            textKey: 1,
            url: `${qt}/upgrade`,
            gradient:
              "linear-gradient(135deg, rgba(155,107,74,0.15), rgba(200,144,58,0.1))",
          },
          { id: "free-quota", textKey: 2, url: `${qt}/upgrade`, gradient: ln },
        ],
        un = [
          { id: "pro-mobile", textKey: 0, url: `${qt}/mobile`, gradient: ln },
          { id: "pro-web", textKey: 1, url: qt, gradient: cn },
        ];
      function mn(e) {
        switch (e) {
          case "plus":
          case "pro":
          case "expert":
          case "etudiant":
          case "student":
          case "starter":
            return "pro";
          default:
            return "free";
        }
      }
      const pn = ({ planInfo: e }) => {
          const { t } = zt(),
            [n, a] = ue(0),
            [s, r] = ue(!1),
            i = mn(e?.plan_id),
            o = ((l = e?.plan_id), "pro" === mn(l) ? un : dn);
          var l;
          const c = t.promos[i];
          if (
            (pe(() => {
              vt.storage.local.get(["promoDismissedAt"]).then((e) => {
                e.promoDismissedAt &&
                  (Date.now() - e.promoDismissedAt > 864e5
                    ? vt.storage.local.remove(["promoDismissedAt"])
                    : r(!0));
              });
            }, []),
            pe(() => {
              if (s || o.length <= 1) return;
              const e = setInterval(() => {
                a((e) => (e + 1) % o.length);
              }, 8e3);
              return () => clearInterval(e);
            }, [s, o.length]),
            pe(() => {
              a(0);
            }, [e?.plan_id]),
            s || 0 === o.length)
          )
            return null;
          const d = n % o.length,
            u = o[d],
            m = c[d] || c[0],
            p = ["sparkle4pt", "star", "crown"];
          return ft("div", {
            className: "promo-banner",
            style: {
              background: u.gradient,
              borderTop: "1px solid var(--border-accent)",
            },
            children: [
              ft("div", {
                className: "promo-content",
                children: [
                  ft("div", {
                    style: { display: "flex", alignItems: "center", gap: 8 },
                    children: [
                      ft(Et, {
                        name: p[d % p.length],
                        size: 16,
                        color: "var(--accent-primary)",
                      }),
                      ft("span", {
                        className: "promo-text",
                        style: { color: "var(--text-primary)" },
                        children: m.text,
                      }),
                    ],
                  }),
                  ft("a", {
                    href: u.url,
                    target: "_blank",
                    rel: "noreferrer",
                    className: "promo-cta",
                    style: { color: "var(--accent-primary)" },
                    onClick: (e) => {
                      (e.preventDefault(), vt.tabs.create({ url: u.url }));
                    },
                    children: [m.cta, " →"],
                  }),
                ],
              }),
              ft("button", {
                className: "promo-close",
                onClick: () => {
                  (r(!0),
                    vt.storage.local.set({ promoDismissedAt: Date.now() }));
                },
                title: t.common.hide,
                style: {
                  background: "var(--accent-primary-muted)",
                  color: "var(--accent-primary)",
                },
                children: "×",
              }),
            ],
          });
        },
        gn = ({
          plan: e,
          trialUsed: t,
          monthlyMinutesUsed: n,
          videoId: a,
          videoTitle: s,
        }) => {
          const { t: r } = zt();
          if (!a) return null;
          const i = "free" === e && !0 === t,
            o = Math.max(0, 30 - (n ?? 0));
          let l = null;
          return (
            "free" !== e || t
              ? "free" === e && t
                ? (l = r.voiceCall.trialUsed)
                : "expert" === e
                  ? (l = r.voiceCall.minutesRemaining.replace(
                      "{count}",
                      String(o),
                    ))
                  : "pro" === e && (l = r.voiceCall.upgradeBadge)
              : (l = r.voiceCall.trialBadge),
            ft("button", {
              type: "button",
              className: i
                ? "voice-call-btn voice-call-btn-disabled"
                : "voice-call-btn",
              disabled: i,
              onClick: () => {
                i ||
                  vt.runtime
                    .sendMessage({
                      type: "OPEN_VOICE_CALL",
                      videoId: a,
                      videoTitle: s,
                      plan: e,
                    })
                    .catch(() => {});
              },
              title: i ? r.voiceCall.trialUsedTitle : void 0,
              "aria-label": r.voiceCall.buttonAriaLabel,
              "data-testid": "voice-call-btn",
              children: [
                ft("span", {
                  className: "voice-call-btn-label",
                  children: [
                    ft("span", { "aria-hidden": !0, children: "🎙️" }),
                    ft("span", { children: r.voiceCall.buttonLabel }),
                  ],
                }),
                l &&
                  ft("span", {
                    className: "voice-call-btn-badge",
                    children: l,
                  }),
              ],
            })
          );
        },
        hn = ({
          children: e,
          beamColor: t = "#d4a574",
          haloColor: n = "#d4a574",
          angle: a = 22,
          intensity: s = 0.4,
          haloIntensity: r = 0.35,
          haloOriginX: i = 15,
          haloOriginY: o = 25,
          className: l,
          style: c,
          onClick: d,
          ariaLabel: u,
          role: m,
          as: p = "div",
        }) => {
          const g = gt.useId().replace(/:/g, ""),
            h = `v3-halo-${g}`,
            f = `v3-beam-${g}`,
            _ = (a * Math.PI) / 180,
            v = i,
            y = o,
            b = i + 140 * Math.cos(_),
            A = o + 140 * Math.sin(_),
            x = "function" == typeof d;
          return ft("div", {
            className: "v3-card" + (l ? ` ${l}` : ""),
            style: c,
            onClick: d,
            role: m || (x ? "button" : void 0),
            tabIndex: x ? 0 : void 0,
            "aria-label": u,
            onKeyDown: x
              ? (e) => {
                  !x ||
                    ("Enter" !== e.key && " " !== e.key) ||
                    (e.preventDefault(), d?.());
                }
              : void 0,
            children: [
              ft("svg", {
                className: "v3-card-beam",
                viewBox: "0 0 100 100",
                preserveAspectRatio: "none",
                "aria-hidden": "true",
                focusable: "false",
                children: [
                  ft("defs", {
                    children: [
                      ft("radialGradient", {
                        id: h,
                        cx: `${i}%`,
                        cy: `${o}%`,
                        r: "40%",
                        children: [
                          ft("stop", {
                            offset: "0%",
                            stopColor: n,
                            stopOpacity: r,
                          }),
                          ft("stop", {
                            offset: "60%",
                            stopColor: n,
                            stopOpacity: 0.3 * r,
                          }),
                          ft("stop", {
                            offset: "100%",
                            stopColor: n,
                            stopOpacity: "0",
                          }),
                        ],
                      }),
                      ft("linearGradient", {
                        id: f,
                        x1: "0%",
                        y1: "0%",
                        x2: "100%",
                        y2: "0%",
                        children: [
                          ft("stop", {
                            offset: "0%",
                            stopColor: t,
                            stopOpacity: "0",
                          }),
                          ft("stop", {
                            offset: "15%",
                            stopColor: t,
                            stopOpacity: s,
                          }),
                          ft("stop", {
                            offset: "65%",
                            stopColor: t,
                            stopOpacity: 0.85 * s,
                          }),
                          ft("stop", {
                            offset: "100%",
                            stopColor: t,
                            stopOpacity: "0",
                          }),
                        ],
                      }),
                    ],
                  }),
                  ft("rect", {
                    width: "100",
                    height: "100",
                    fill: `url(#${h})`,
                  }),
                  ft("line", {
                    x1: v,
                    y1: y,
                    x2: b,
                    y2: A,
                    stroke: `url(#${f})`,
                    strokeWidth: "0.4",
                    strokeLinecap: "round",
                  }),
                ],
              }),
              ft("div", { className: "v3-card-content", children: e }),
            ],
          });
        },
        fn = ({ suggestions: e }) =>
          0 === e.length
            ? null
            : ft("div", {
                className: "v3-suggestion-pills",
                role: "group",
                "aria-label": "Suggestions",
                children: e.slice(0, 3).map((e) =>
                  ft(
                    hn,
                    {
                      className: "v3-suggestion-pill",
                      onClick: e.onTrigger,
                      ariaLabel: e.label,
                      intensity: 0.2,
                      haloIntensity: 0.15,
                      children: [
                        e.icon &&
                          ft("span", {
                            className: "v3-suggestion-pill-icon",
                            "aria-hidden": "true",
                            children: e.icon,
                          }),
                        ft("span", {
                          className: "v3-suggestion-pill-label",
                          children: e.label,
                        }),
                      ],
                    },
                    e.id,
                  ),
                ),
              }),
        _n = ({
          user: e,
          planInfo: t,
          isGuest: n,
          onLogout: a,
          onLoginRedirect: s,
          onError: r,
        }) => {
          const { t: i, language: o } = zt(),
            [l, c] = ue(null),
            [d, u] = ue(e?.default_mode || "standard"),
            [m, p] = ue(e?.default_lang || "fr"),
            [g, h] = ue({ phase: "idle" }),
            [f, _] = ue([]),
            [v, y] = ue(!1),
            [b, A] = ue(!1),
            [x, w] = ue(!1),
            [C, N] = ue(!1),
            M = he(null);
          async function S() {
            const e = await Bt();
            _(e);
          }
          (pe(() => {
            n &&
              Ht().then((e) => {
                e >= 3 && A(!0);
              });
          }, [n]),
            pe(() => {
              vt.storage.local.get("showYouTubeRecommendation").then((e) => {
                e.showYouTubeRecommendation && N(!0);
              });
            }, []),
            pe(() => {
              let e = !1;
              const t = async () => {
                const t = await vt.tabs.query({
                  active: !0,
                  lastFocusedWindow: !0,
                });
                if (e) return;
                const n = t[0]?.url || "",
                  a = (function (e) {
                    return (
                      (function (e) {
                        for (const t of Ut) {
                          const n = e.match(t);
                          if (n) return n[1];
                        }
                        return null;
                      })(e) ||
                      (function (e) {
                        for (const t of Ft) {
                          const n = e.match(t);
                          if (n) return n[1];
                        }
                        return null;
                      })(e)
                    );
                  })(n);
                if (a) {
                  const e =
                    "tiktok" === Vt(n) ? "TikTok Video" : "YouTube Video";
                  c({ url: n, videoId: a, title: t[0]?.title || e });
                } else c(null);
              };
              (t(), n || S());
              const a = () => {
                  t();
                },
                s = (e, n) => {
                  n.url && t();
                };
              return (
                vt.tabs.onActivated.addListener(a),
                vt.tabs.onUpdated.addListener(s),
                () => {
                  ((e = !0),
                    vt.tabs.onActivated.removeListener(a),
                    vt.tabs.onUpdated.removeListener(s),
                    M.current && clearInterval(M.current));
                }
              );
            }, [n]));
          const P = !!t && t.analyses_this_month >= t.monthly_analyses,
            E = t ? t.monthly_analyses - t.analyses_this_month : null,
            T =
              !!(t && t.monthly_analyses > 0) &&
              null !== E &&
              E / t.monthly_analyses < 0.2,
            I = t?.credits_monthly || e?.credits_monthly || 0,
            D = t?.credits ?? e?.credits ?? 0,
            L = I > 0 && D / I < 0.3,
            $ = I > 0 && D / I < 0.1,
            O = t?.plan_id || e?.plan || "free",
            z = i.upsell[O] || null,
            R = "expert" === O ? "expert" : "pro" === O ? "pro" : "free",
            U = t?.voice_quota?.trial_used ?? !1,
            F = t?.voice_quota?.monthly_minutes_used ?? 0,
            V = ve(async () => {
              if (l) {
                w(!0);
                try {
                  const e = await vt.runtime.sendMessage({
                    action: "QUICK_CHAT",
                    data: { url: l.url, lang: m },
                  });
                  if (!e.success)
                    throw new Error(e.error || "Quick Chat failed");
                  const t = e.result;
                  vt.tabs.create({ url: `${qt}/chat?summary=${t.summary_id}` });
                } catch (e) {
                  r(e.message);
                } finally {
                  w(!1);
                }
              }
            }, [l, m, r]),
            B = ve(async () => {
              if (l) {
                if (n && (await Ht()) >= 3) return void A(!0);
                h({
                  phase: "analyzing",
                  progress: 0,
                  message: i.analysis.starting,
                });
                try {
                  const e = await vt.runtime.sendMessage({
                    action: "START_ANALYSIS",
                    data: { url: l.url, options: { mode: d, lang: m } },
                  });
                  if (!e.success)
                    return void h({
                      phase: "error",
                      message: e.error || i.analysis.startFailed,
                    });
                  const t = e.result.task_id;
                  M.current = setInterval(async () => {
                    try {
                      const e = await vt.runtime.sendMessage({
                        action: "GET_TASK_STATUS",
                        data: { taskId: t },
                      });
                      if (!e.success || !e.status) return;
                      const a = e.status;
                      if ("completed" === a.status && a.result?.summary_id) {
                        (M.current && clearInterval(M.current),
                          n &&
                            (await (async function () {
                              const e = (await Ht()) + 1;
                              return (
                                await vt.storage.local.set({
                                  deepsight_free_analyses: e,
                                }),
                                e
                              );
                            })(),
                            A(!0)),
                          await (async function (e) {
                            const t = (await Bt()).filter(
                              (t) => t.videoId !== e.videoId,
                            );
                            (t.unshift({ ...e, timestamp: Date.now() }),
                              await vt.storage.local.set({
                                recentAnalyses: t.slice(0, 20),
                              }));
                          })({
                            videoId: l.videoId,
                            summaryId: a.result.summary_id,
                            title: a.result.video_title || l.title,
                          }));
                        const e = await vt.runtime.sendMessage({
                          action: "GET_SUMMARY",
                          data: { summaryId: a.result.summary_id },
                        });
                        e.success &&
                          e.summary &&
                          (h({
                            phase: "complete",
                            summaryId: a.result.summary_id,
                            summary: e.summary,
                          }),
                          S());
                      } else
                        "failed" === a.status
                          ? (M.current && clearInterval(M.current),
                            h({
                              phase: "error",
                              message: a.error || i.analysis.failed,
                            }))
                          : h({
                              phase: "analyzing",
                              progress: a.progress || 0,
                              message: a.message || i.analysis.processing,
                            });
                    } catch {}
                  }, 2500);
                } catch (e) {
                  h({ phase: "error", message: e.message });
                }
              }
            }, [l, d, m, n, i]);
          if (v && "complete" === g.phase)
            return ft(rn, {
              summaryId: g.summaryId,
              videoTitle: g.summary.video_title,
              onClose: () => y(!1),
              onSessionExpired: a,
              userPlan: t?.plan_id || e?.plan || "free",
            });
          const H = t ? i.plans[t.plan_id] || t.plan_name : null,
            q = !e || "free" === e.plan,
            j = n ? i.common.login : q ? H || i.plans.free : H || "",
            W = "tiktok" === (l ? Vt(l.url) : null),
            G =
              l && !W
                ? `https://img.youtube.com/vi/${l.videoId}/mqdefault.jpg`
                : null;
          return ft("div", {
            className: "v3-app",
            children: [
              ft("div", {
                className: "v3-app-scroll v3-stagger",
                children: [
                  ft("div", {
                    className: "v3-hero",
                    children: [
                      ft("img", {
                        src: vt.runtime.getURL(
                          "assets/deepsight-logo-cosmic.png",
                        ),
                        alt: "DeepSight",
                        width: 28,
                        height: 28,
                        className: "v3-brand-logo",
                        style: { borderRadius: "50%", objectFit: "cover" },
                      }),
                      ft("span", {
                        className: "v3-brand",
                        children: "DeepSight",
                      }),
                      ft("span", {
                        className:
                          "v3-plan-chip" + (q ? " v3-plan-chip-free" : ""),
                        children: j,
                      }),
                      ft("button", {
                        className: "v3-icon-btn",
                        onClick: () => vt.tabs.create({ url: qt }),
                        title: "Ouvrir DeepSight",
                        "aria-label": "Ouvrir DeepSight",
                        children: ft(wt, { size: 13 }),
                      }),
                      ft(
                        "button",
                        n
                          ? {
                              className: "v3-text-link",
                              onClick: s,
                              "aria-label": i.common.login,
                              children: i.common.login,
                            }
                          : {
                              className: "v3-icon-btn",
                              onClick: a,
                              title: i.common.logout,
                              "aria-label": i.common.logout,
                              children: ft(xt, { size: 14 }),
                            },
                      ),
                    ],
                  }),
                  !n &&
                    e &&
                    ft("div", {
                      className: "v3-quota",
                      children: [
                        ft(
                          "span",
                          t
                            ? {
                                className:
                                  "v3-quota-item" + (T ? " warning" : ""),
                                children: [
                                  t.analyses_this_month,
                                  "/",
                                  t.monthly_analyses,
                                  " ",
                                  i.common.analyses,
                                ],
                              }
                            : {
                                className: "v3-quota-item",
                                children: [e.credits, " ", i.common.credits],
                              },
                        ),
                        L &&
                          ft("span", {
                            className:
                              "v3-quota-item" + ($ ? " critical" : " warning"),
                            title: i.credits.remaining.replace(
                              "{count}",
                              String(D),
                            ),
                            children: [D, " ", i.credits.low],
                          }),
                      ],
                    }),
                  !n &&
                    $ &&
                    ft("div", {
                      className: "v3-banner error",
                      children: [
                        ft("div", {
                          className: "v3-banner-content",
                          children: ft("span", {
                            className: "v3-banner-title",
                            children: i.credits.critical.replace(
                              "{count}",
                              String(D),
                            ),
                          }),
                        }),
                        ft("a", {
                          className: "v3-banner-cta",
                          href: `${qt}/upgrade`,
                          onClick: (e) => {
                            (e.preventDefault(),
                              vt.tabs.create({ url: `${qt}/upgrade` }));
                          },
                          children: [i.credits.recharge, " ", "↗"],
                        }),
                      ],
                    }),
                  n &&
                    ft("div", {
                      className: "v3-banner",
                      children: ft("div", {
                        className: "v3-banner-content",
                        children: ft("span", {
                          className: "v3-banner-subtitle",
                          children: i.guest.banner,
                        }),
                      }),
                    }),
                  C &&
                    ft("div", {
                      className: "v3-banner",
                      children: [
                        ft("img", {
                          src: vt.runtime.getURL(
                            "platforms/youtube-icon-red.png",
                          ),
                          alt: "YouTube",
                          style: { height: 16, width: "auto", flexShrink: 0 },
                        }),
                        ft("div", {
                          className: "v3-banner-content",
                          children: [
                            ft("span", {
                              className: "v3-banner-title",
                              children: i.ytRecommend.title,
                            }),
                            ft("span", {
                              className: "v3-banner-subtitle",
                              children: i.ytRecommend.subtitle,
                            }),
                          ],
                        }),
                        ft("button", {
                          className: "v3-banner-dismiss",
                          onClick: () => {
                            (N(!1),
                              vt.storage.local.remove(
                                "showYouTubeRecommendation",
                              ));
                          },
                          title: i.ytRecommend.dismiss,
                          "aria-label": i.ytRecommend.dismiss,
                          children: "✕",
                        }),
                      ],
                    }),
                  l &&
                    ft(gn, {
                      plan: R,
                      trialUsed: U,
                      monthlyMinutesUsed: F,
                      videoId: l.videoId,
                      videoTitle: l.title,
                    }),
                  l &&
                    "idle" === g.phase &&
                    ft(k, {
                      children:
                        !n && P
                          ? ft(hn, {
                              children: [
                                ft("div", {
                                  className: "v3-card-eyebrow",
                                  children: i.analysis.quotaExceeded,
                                }),
                                ft("h3", {
                                  className: "v3-card-title",
                                  children: [
                                    t?.analyses_this_month,
                                    "/",
                                    t?.monthly_analyses,
                                  ],
                                }),
                                ft("p", {
                                  className: "v3-card-desc",
                                  children: i.analysis.quotaExceededText,
                                }),
                                ft("button", {
                                  className: "v3-button-secondary",
                                  onClick: V,
                                  disabled: x,
                                  style: { marginBottom: 8 },
                                  children: x
                                    ? i.analysis.quickChatPreparing
                                    : i.analysis.quickChatButton,
                                }),
                                ft("a", {
                                  className: "v3-button-primary",
                                  href: `${qt}/upgrade`,
                                  onClick: (e) => {
                                    (e.preventDefault(),
                                      vt.tabs.create({ url: `${qt}/upgrade` }));
                                  },
                                  children: [i.common.viewPlans, " ", "↗"],
                                }),
                              ],
                            })
                          : n && b
                            ? ft(hn, {
                                children: [
                                  ft("div", {
                                    className: "v3-card-eyebrow",
                                    children: i.guest.banner,
                                  }),
                                  ft("h3", {
                                    className: "v3-card-title",
                                    children: i.guest.exhaustedText,
                                  }),
                                  ft("button", {
                                    className: "v3-button-primary",
                                    onClick: () =>
                                      vt.tabs.create({ url: `${qt}/register` }),
                                    children: [
                                      i.common.createAccount,
                                      " ",
                                      "↗",
                                    ],
                                  }),
                                ],
                              })
                            : ft(k, {
                                children: [
                                  ft("div", {
                                    className: "v3-pill-row",
                                    children: [
                                      ft("div", {
                                        className: "v3-pill-group",
                                        children: [
                                          ft("span", {
                                            className: "v3-pill-label",
                                            children: i.analysis.mode,
                                          }),
                                          ft("div", {
                                            className: "v3-pill-toggle",
                                            children: [
                                              ft("button", {
                                                className:
                                                  "standard" === d
                                                    ? "active"
                                                    : "",
                                                onClick: () => u("standard"),
                                                children:
                                                  i.analysis.modes.standard,
                                              }),
                                              ft("button", {
                                                className:
                                                  "accessible" === d
                                                    ? "active"
                                                    : "",
                                                onClick: () => u("accessible"),
                                                children:
                                                  i.analysis.modes.accessible,
                                              }),
                                            ],
                                          }),
                                        ],
                                      }),
                                      ft("div", {
                                        className: "v3-pill-group",
                                        children: [
                                          ft("span", {
                                            className: "v3-pill-label",
                                            children: i.analysis.language,
                                          }),
                                          ft("div", {
                                            className: "v3-pill-toggle",
                                            children: [
                                              "fr",
                                              "en",
                                              "es",
                                              "de",
                                            ].map((e) =>
                                              ft(
                                                "button",
                                                {
                                                  className:
                                                    m === e ? "active" : "",
                                                  onClick: () => p(e),
                                                  "aria-label":
                                                    i.analysis.languages[e],
                                                  children: e.toUpperCase(),
                                                },
                                                e,
                                              ),
                                            ),
                                          }),
                                        ],
                                      }),
                                    ],
                                  }),
                                  ft(hn, {
                                    children: [
                                      G
                                        ? ft("img", {
                                            src: G,
                                            alt: "",
                                            className: "v3-video-card-thumb",
                                            onError: (e) => {
                                              e.target.style.display = "none";
                                            },
                                          })
                                        : ft("div", {
                                            className:
                                              "v3-video-card-thumb-fallback",
                                            children: W
                                              ? "TikTok"
                                              : i.analysis.noVideo,
                                          }),
                                      ft("span", {
                                        className: "v3-platform-pill",
                                        children: [
                                          ft("img", {
                                            src: vt.runtime.getURL(
                                              W
                                                ? "brand/tiktok.png"
                                                : "brand/youtube.svg",
                                            ),
                                            alt: "",
                                            width: 12,
                                            height: 12,
                                            className: "v3-platform-pill-icon",
                                          }),
                                          W ? "TIKTOK" : "YOUTUBE",
                                        ],
                                      }),
                                      ft("h3", {
                                        className: "v3-card-title",
                                        children: l.title,
                                      }),
                                      ft("p", {
                                        className: "v3-card-desc",
                                        children: i.mistral.badge,
                                      }),
                                      ft("button", {
                                        className: "v3-button-primary",
                                        onClick: B,
                                        children: [
                                          i.analysis.analyzeButton,
                                          " ",
                                          "→",
                                        ],
                                      }),
                                    ],
                                  }),
                                  l &&
                                    ft(fn, {
                                      suggestions: [
                                        {
                                          id: "flashcards",
                                          label: "Créer flashcards",
                                          icon: "🎴",
                                          onTrigger: () =>
                                            vt.tabs.create({
                                              url: `${qt}/study/${l.videoId}`,
                                            }),
                                        },
                                        {
                                          id: "sources",
                                          label: "Voir sources",
                                          icon: "🔍",
                                          onTrigger: () =>
                                            vt.tabs.create({
                                              url: `${qt}/library`,
                                            }),
                                        },
                                        {
                                          id: "openweb",
                                          label: "Ouvrir dans l'app",
                                          icon: "🌐",
                                          onTrigger: () =>
                                            vt.tabs.create({ url: `${qt}/` }),
                                        },
                                      ],
                                    }),
                                  ft(hn, {
                                    children: [
                                      ft("div", {
                                        className: "v3-card-eyebrow",
                                        children: i.analysis.quickChatButton,
                                      }),
                                      ft("h3", {
                                        className: "v3-card-title",
                                        children: i.analysis.quickChatButton,
                                      }),
                                      ft("p", {
                                        className: "v3-card-desc",
                                        children: i.analysis.quickChatPreparing,
                                      }),
                                      ft("button", {
                                        className: "v3-button-secondary",
                                        onClick: V,
                                        disabled: !l || x,
                                        children: x
                                          ? i.analysis.quickChatPreparing
                                          : i.analysis.quickChatButton,
                                      }),
                                    ],
                                  }),
                                ],
                              }),
                    }),
                  !l &&
                    "idle" === g.phase &&
                    ft(hn, {
                      children: [
                        ft("div", {
                          className: "v3-card-eyebrow",
                          children: i.analysis.noVideo,
                        }),
                        ft("h3", {
                          className: "v3-card-title",
                          children: i.analysis.analyzeButton,
                        }),
                        ft("p", {
                          className: "v3-card-desc",
                          children: i.mistral.badge,
                        }),
                      ],
                    }),
                  "analyzing" === g.phase &&
                    ft("div", {
                      className: "v3-progress-card",
                      children: [
                        ft(Lt, { size: "md", speed: "fast" }),
                        ft("div", {
                          className: "v3-progress-bar",
                          children: ft("div", {
                            className: "v3-progress-fill",
                            style: { width: `${g.progress}%` },
                          }),
                        }),
                        ft("p", {
                          className: "v3-progress-text",
                          children: g.message,
                        }),
                      ],
                    }),
                  "error" === g.phase &&
                    ft(hn, {
                      children: [
                        ft("div", {
                          className: "v3-card-eyebrow",
                          children: "Erreur",
                        }),
                        ft("h3", {
                          className: "v3-card-title",
                          style: { color: "#fca5a5" },
                          children: g.message,
                        }),
                        ft("button", {
                          className: "v3-button-primary",
                          onClick: () => h({ phase: "idle" }),
                          children: i.common.retry,
                        }),
                      ],
                    }),
                  "complete" === g.phase &&
                    ft(k, {
                      children: [
                        ft(nn, {
                          summary: g.summary,
                          summaryId: g.summaryId,
                          planInfo: t,
                          onOpenChat: () => y(!0),
                        }),
                        !n &&
                          z &&
                          "pro" !== O &&
                          ft(hn, {
                            children: [
                              ft("div", {
                                className: "v3-card-eyebrow",
                                children: z.label,
                              }),
                              ft("h3", {
                                className: "v3-card-title",
                                children: z.feature,
                              }),
                              ft("p", {
                                className: "v3-card-desc",
                                children: [
                                  z.price,
                                  "/",
                                  "fr" === o ? "mois" : "mo",
                                ],
                              }),
                              ft("a", {
                                className: "v3-button-primary",
                                href: `${qt}/upgrade`,
                                onClick: (e) => {
                                  (e.preventDefault(),
                                    vt.tabs.create({ url: `${qt}/upgrade` }));
                                },
                                children: [i.common.unlock, " ", "↗"],
                              }),
                            ],
                          }),
                        n &&
                          ft(hn, {
                            children: [
                              ft("div", {
                                className: "v3-card-eyebrow",
                                children: i.guest.banner,
                              }),
                              ft("p", {
                                className: "v3-card-desc",
                                children: i.guest.exhaustedText,
                              }),
                              ft("button", {
                                className: "v3-button-primary",
                                onClick: () =>
                                  vt.tabs.create({ url: `${qt}/register` }),
                                children: [i.common.createAccount, " ", "↗"],
                              }),
                            ],
                          }),
                      ],
                    }),
                  !n &&
                    "idle" === g.phase &&
                    f.length > 0 &&
                    ft(k, {
                      children: [
                        ft("h3", {
                          className: "v3-section-title",
                          children: i.analysis.recent,
                        }),
                        ft("ul", {
                          className: "v3-recents-list",
                          children: f.slice(0, 5).map((e) => {
                            return ft(
                              "li",
                              {
                                children: ft("a", {
                                  href: `${qt}/summary/${e.summaryId}`,
                                  target: "_blank",
                                  rel: "noreferrer",
                                  className: "v3-recent-item",
                                  children: [
                                    "tiktok" === e.platform
                                      ? ft("div", {
                                          className: "v3-recent-thumb-fallback",
                                          children: "TT",
                                        })
                                      : ft("img", {
                                          src:
                                            ((t = e.videoId),
                                            (n = "youtube"),
                                            ("tiktok" === n
                                              ? null
                                              : `https://img.youtube.com/vi/${t}/default.jpg`) ||
                                              ""),
                                          alt: "",
                                          loading: "lazy",
                                          className: "v3-recent-thumb",
                                        }),
                                    ft("div", {
                                      className: "v3-recent-meta",
                                      children: ft("div", {
                                        className: "v3-recent-title",
                                        children: e.title,
                                      }),
                                    }),
                                    ft("span", {
                                      className: "v3-recent-chevron",
                                      children: "›",
                                    }),
                                  ],
                                }),
                              },
                              e.videoId,
                            );
                            var t, n;
                          }),
                        }),
                      ],
                    }),
                  ft("div", {
                    className: "v3-platform-strip",
                    children: [
                      ft("img", {
                        src: vt.runtime.getURL(
                          "platforms/youtube-icon-red.png",
                        ),
                        alt: "YouTube",
                        className: "v3-platform-strip-icon",
                        style: { height: 16 },
                      }),
                      ft("span", { className: "v3-platform-strip-sep" }),
                      ft("img", {
                        src: vt.runtime.getURL(
                          "platforms/tiktok-note-white.png",
                        ),
                        alt: "TikTok",
                        className: "v3-platform-strip-icon",
                        style: { height: 14 },
                      }),
                      ft("span", { className: "v3-platform-strip-sep" }),
                      ft("img", {
                        src: vt.runtime.getURL(
                          "platforms/mistral-m-orange.svg",
                        ),
                        alt: "Mistral",
                        className: "v3-platform-strip-icon",
                        style: { height: 14 },
                      }),
                      ft("span", { className: "v3-platform-strip-sep" }),
                      ft("img", {
                        src: vt.runtime.getURL("platforms/tournesol-logo.png"),
                        alt: "Tournesol",
                        className: "v3-platform-strip-icon",
                        style: { height: 14 },
                      }),
                    ],
                  }),
                  ft("div", {
                    className: "v3-footer",
                    children: [
                      ft("span", {
                        style: { opacity: 0.5, fontSize: 10 },
                        children: "Propulsé par",
                      }),
                      ft("img", {
                        src: vt.runtime.getURL(
                          "brand/mistral-wordmark-white.svg",
                        ),
                        alt: "Mistral AI",
                        height: 12,
                        style: {
                          opacity: 0.7,
                          verticalAlign: "middle",
                          marginLeft: 6,
                        },
                      }),
                    ],
                  }),
                ],
              }),
              ft(pn, { planInfo: t }),
            ],
          });
        };
      function vn() {
        const { t: e } = zt();
        return ft("div", {
          className: "ds-connecting",
          "data-testid": "ds-connecting",
          role: "status",
          "aria-live": "polite",
          "aria-label": e.voiceCall.connecting.ariaStatus,
          children: [
            ft("div", {
              className: "ds-connecting__mic",
              "aria-hidden": !0,
              children: "🎙️",
            }),
            ft("h2", { children: e.voiceCall.connecting.title }),
            ft("p", { children: e.voiceCall.connecting.subtitle }),
            ft("div", {
              className: "ds-connecting__bar",
              "aria-hidden": !0,
              children: ft("div", {}),
            }),
          ],
        });
      }
      const yn = "VOICE_UPDATE_PREFERENCES",
        bn = [
          "voice_id",
          "voice_name",
          "tts_model",
          "voice_chat_model",
          "stability",
          "similarity_boost",
          "style",
          "use_speaker_boost",
          "gender",
          "language",
          "speed",
          "voice_chat_speed_preset",
        ],
        An = (e) => vt.runtime.sendMessage(e),
        xn = {
          speed: 1,
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: !0,
          tts_model: "eleven_multilingual_v2",
          voice_chat_model: "eleven_flash_v2_5",
          language: "fr",
          gender: "female",
          input_mode: "ptt",
          ptt_key: " ",
          interruptions_enabled: !0,
          turn_eagerness: 0.5,
          voice_chat_speed_preset: "1x",
          turn_timeout: 15,
          soft_timeout_seconds: 300,
        };
      function wn(e) {
        return bn.includes(e);
      }
      function kn(e = {}) {
        const { sendMessage: t = An, autoLoad: n = !0 } = e,
          [a, s] = ue(null),
          [r, i] = ue(null),
          [o, l] = ue({}),
          [c, d] = ue(n),
          [u, m] = ue(!1),
          [p, g] = ue(null),
          h = he(!1);
        pe(
          () => () => {
            h.current = !0;
          },
          [],
        );
        const f = ve(async () => {
          (d(!0), g(null));
          try {
            const [e, n] = await Promise.all([
              t({ action: "VOICE_GET_PREFERENCES" }),
              t({ action: "VOICE_GET_CATALOG" }),
            ]);
            if (h.current) return;
            if (!e.success || !e.result)
              throw new Error(e.error || "Préférences indisponibles.");
            if (!n.success || !n.result)
              throw new Error(n.error || "Catalogue indisponible.");
            (s(e.result), i(n.result));
          } catch (e) {
            if (h.current) return;
            g(e.message);
          } finally {
            h.current || d(!1);
          }
        }, [t]);
        pe(() => {
          n && f();
        }, [n, f]);
        const _ = ve(
            async (e) => {
              if (!a) return;
              const { live: n, hard: r } = (function (e) {
                const t = {},
                  n = {};
                for (const [a, s] of Object.entries(e))
                  wn(a) ? (n[a] = s) : (t[a] = s);
                return { live: t, hard: n };
              })(e);
              if (
                (Object.keys(r).length > 0 && l((e) => ({ ...e, ...r })),
                0 === Object.keys(n).length)
              )
                return;
              const i = a;
              (s({ ...a, ...n }), m(!0));
              try {
                const e = await t({ action: yn, data: n });
                if (h.current) return;
                if (!e.success || !e.result)
                  return (s(i), void g(e.error || "Sauvegarde échouée."));
                (s(e.result), g(null));
              } catch (e) {
                if (h.current) return;
                (s(i), g(e.message));
              } finally {
                h.current || m(!1);
              }
            },
            [a, t],
          ),
          v = ve((e) => {
            l((t) => ({ ...t, ...e }));
          }, []),
          y = ve(async () => {
            if (!a || 0 === Object.keys(o).length) return {};
            const e = a,
              n = o;
            (s({ ...a, ...o }), l({}), m(!0));
            try {
              const a = await t({ action: yn, data: n });
              return h.current
                ? n
                : a.success && a.result
                  ? (s(a.result), g(null), n)
                  : (s(e), l(n), g(a.error || "Sauvegarde échouée."), {});
            } catch (t) {
              return (h.current || (s(e), l(n), g(t.message)), {});
            } finally {
              h.current || m(!1);
            }
          }, [a, o, t]),
          b = ve(() => l({}), []),
          A = ve(async () => {
            (l({}), await _(xn));
          }, [_]),
          x = _e(() => (a ? { ...a, ...o } : null), [a, o]),
          w = Object.keys(o).length;
        return {
          prefs: a,
          effectivePrefs: x,
          catalog: r,
          loading: c,
          error: p,
          saving: u,
          stagedFields: o,
          stagedCount: w,
          setLive: _,
          setStaged: v,
          applyStaged: y,
          resetStaged: b,
          resetToDefaults: A,
          reload: f,
        };
      }
      const Cn = ({
          icon: e,
          title: t,
          badge: n,
          isOpen: a,
          onToggle: s,
          children: r,
        }) =>
          ft("section", {
            className: "dsp-vs-section " + (a ? "is-open" : ""),
            children: [
              ft("button", {
                type: "button",
                className: "dsp-vs-section-header",
                onClick: s,
                "aria-expanded": a,
                children: [
                  ft("span", {
                    className: "dsp-vs-section-icon",
                    "aria-hidden": "true",
                    children: e,
                  }),
                  ft("span", {
                    className: "dsp-vs-section-title",
                    children: t,
                  }),
                  n &&
                    ft("span", {
                      className: "dsp-vs-section-badge",
                      children: n,
                    }),
                  ft("span", {
                    className: "dsp-vs-chevron " + (a ? "is-open" : ""),
                    children: "›",
                  }),
                ],
              }),
              ft("div", {
                className: "dsp-vs-section-body",
                hidden: !a,
                children: r,
              }),
            ],
          }),
        Nn = ({
          label: e,
          hint: t,
          min: n,
          max: a,
          step: s,
          value: r,
          format: i,
          onLiveChange: o,
          onCommit: l,
          disabled: c,
        }) => {
          const [d, u] = ue(r);
          return (
            pe(() => u(r), [r]),
            ft("div", {
              className: "dsp-vs-field",
              children: [
                ft("div", {
                  className: "dsp-vs-field-row",
                  children: [
                    ft("label", { className: "dsp-vs-label", children: e }),
                    ft("span", {
                      className: "dsp-vs-value",
                      children: i ? i(d) : d.toFixed(2),
                    }),
                  ],
                }),
                ft("input", {
                  className: "dsp-vs-slider",
                  type: "range",
                  min: n,
                  max: a,
                  step: s,
                  value: d,
                  disabled: c,
                  onChange: (e) => {
                    const t = parseFloat(e.currentTarget.value);
                    (u(t), o?.(t));
                  },
                  onMouseUp: () => l(d),
                  onTouchEnd: () => l(d),
                  onKeyUp: (e) => {
                    ("ArrowLeft" !== e.key &&
                      "ArrowRight" !== e.key &&
                      "ArrowUp" !== e.key &&
                      "ArrowDown" !== e.key) ||
                      l(d);
                  },
                }),
                t && ft("p", { className: "dsp-vs-hint", children: t }),
              ],
            })
          );
        },
        Mn = ({
          label: e,
          description: t,
          checked: n,
          onChange: a,
          disabled: s,
        }) =>
          ft("div", {
            className: "dsp-vs-toggle-row",
            children: [
              ft("div", {
                className: "dsp-vs-toggle-label",
                children: [
                  ft("span", { className: "dsp-vs-label", children: e }),
                  t && ft("span", { className: "dsp-vs-hint", children: t }),
                ],
              }),
              ft("button", {
                type: "button",
                role: "switch",
                "aria-checked": n,
                disabled: s,
                className: "dsp-vs-toggle " + (n ? "is-on" : ""),
                onClick: () => a(!n),
                children: ft("span", { className: "dsp-vs-toggle-thumb" }),
              }),
            ],
          });
      function Sn({
        options: e,
        value: t,
        onChange: n,
        disabled: a,
        cols: s = 2,
      }) {
        return ft("div", {
          className: "dsp-vs-segmented",
          style: { gridTemplateColumns: `repeat(${s}, 1fr)` },
          children: e.map((e) =>
            ft(
              "button",
              {
                type: "button",
                disabled: a,
                className: "dsp-vs-seg " + (t === e.id ? "is-active" : ""),
                onClick: () => n(e.id),
                children: [
                  ft("span", {
                    className: "dsp-vs-seg-label",
                    children: e.label,
                  }),
                  e.description &&
                    ft("span", {
                      className: "dsp-vs-seg-desc",
                      children: e.description,
                    }),
                ],
              },
              e.id,
            ),
          ),
        });
      }
      const Pn = ({ s: e }) => {
          const [t, n] = ue("all"),
            [a, s] = ue(null),
            r = he(null);
          if (
            (pe(
              () => () => {
                (r.current?.pause(), (r.current = null));
              },
              [],
            ),
            !e.catalog || !e.effectivePrefs)
          )
            return null;
          const i =
            "all" === t
              ? e.catalog.voices
              : e.catalog.voices.filter((e) => e.gender === t);
          return ft("div", {
            className: "dsp-vs-stack",
            children: [
              ft("div", {
                className: "dsp-vs-pill-row",
                children: [
                  { id: "all", label: "Toutes" },
                  { id: "female", label: "♀" },
                  { id: "male", label: "♂" },
                  { id: "neutral", label: "⚧" },
                ].map((e) =>
                  ft(
                    "button",
                    {
                      type: "button",
                      className:
                        "dsp-vs-pill " + (t === e.id ? "is-active" : ""),
                      onClick: () => n(e.id),
                      children: e.label,
                    },
                    e.id,
                  ),
                ),
              }),
              ft("div", {
                className: "dsp-vs-voice-grid",
                children: i.map((t) => {
                  const n = e.effectivePrefs?.voice_id === t.voice_id,
                    i = a === t.voice_id;
                  return ft(
                    "div",
                    {
                      className:
                        "dsp-vs-voice-card " + (n ? "is-selected" : ""),
                      onClick: () =>
                        e.setStaged({
                          voice_id: t.voice_id,
                          voice_name: t.name,
                        }),
                      role: "button",
                      tabIndex: 0,
                      children: [
                        t.recommended &&
                          ft("span", {
                            className: "dsp-vs-voice-reco",
                            children: "Reco",
                          }),
                        ft("div", {
                          className: "dsp-vs-voice-head",
                          children: [
                            ft("span", {
                              className: "dsp-vs-voice-name",
                              children: t.name,
                            }),
                            ft("span", {
                              className: "dsp-vs-voice-tag",
                              children:
                                "male" === t.gender
                                  ? "♂"
                                  : "female" === t.gender
                                    ? "♀"
                                    : "⚧",
                            }),
                            "fr" === t.language &&
                              ft("span", {
                                className: "dsp-vs-voice-tag is-fr",
                                children: "FR",
                              }),
                          ],
                        }),
                        ft("p", {
                          className: "dsp-vs-voice-desc",
                          children: t.description_fr,
                        }),
                        ft("div", {
                          className: "dsp-vs-voice-meta",
                          children: [
                            ft("span", { children: t.accent }),
                            ft("span", { children: "·" }),
                            ft("span", { children: t.use_case }),
                          ],
                        }),
                        ft("button", {
                          type: "button",
                          className:
                            "dsp-vs-voice-play " + (i ? "is-playing" : ""),
                          onClick: (e) => {
                            (e.stopPropagation(),
                              ((e) => {
                                if (
                                  (r.current &&
                                    (r.current.pause(), (r.current = null)),
                                  a === e.voice_id)
                                )
                                  return void s(null);
                                if (!e.preview_url) return;
                                const t = new Audio(e.preview_url);
                                ((t.onended = () => s(null)),
                                  (t.onerror = () => s(null)),
                                  t.play(),
                                  (r.current = t),
                                  s(e.voice_id));
                              })(t));
                          },
                          "aria-label": i ? "Pause" : "Aperçu",
                          children: i ? "⏸" : "▶",
                        }),
                      ],
                    },
                    t.voice_id,
                  );
                }),
              }),
            ],
          });
        },
        En = ({ s: e }) => {
          const t = e.effectivePrefs;
          return e.catalog && t
            ? ft("div", {
                className: "dsp-vs-stack",
                children: [
                  ft("div", {
                    className: "dsp-vs-preset-grid",
                    children: e.catalog.speed_presets.map((n) =>
                      ft(
                        "button",
                        {
                          type: "button",
                          className:
                            "dsp-vs-preset " +
                            (t.speed === n.value ? "is-active" : ""),
                          onClick: () => e.setStaged({ speed: n.value }),
                          children: [
                            ft("span", {
                              className: "dsp-vs-preset-icon",
                              children: n.icon,
                            }),
                            ft("span", {
                              className: "dsp-vs-preset-value",
                              children: [n.value, "x"],
                            }),
                            ft("span", {
                              className: "dsp-vs-preset-label",
                              children: n.label_fr,
                            }),
                          ],
                        },
                        n.id,
                      ),
                    ),
                  }),
                  ft(Nn, {
                    label: "Vitesse personnalisée",
                    min: 0.25,
                    max: 4,
                    step: 0.05,
                    value: t.speed,
                    format: (e) => `${e.toFixed(2)}x`,
                    onLiveChange: (t) => e.setStaged({ speed: t }),
                    onCommit: (t) => e.setStaged({ speed: t }),
                  }),
                ],
              })
            : null;
        },
        Tn = ({ s: e }) => {
          const t = e.effectivePrefs;
          if (!e.catalog || !t) return null;
          const n = e.catalog.voice_chat_speed_presets.find(
            (e) => e.id === t.voice_chat_speed_preset,
          );
          return ft("div", {
            className: "dsp-vs-stack",
            children: [
              ft("p", {
                className: "dsp-vs-hint",
                children: "Vitesse de réponse de l'agent en appel",
              }),
              ft("div", {
                className: "dsp-vs-preset-grid is-compact",
                children: e.catalog.voice_chat_speed_presets.map((n) =>
                  ft(
                    "button",
                    {
                      type: "button",
                      className:
                        "dsp-vs-preset " +
                        (t.voice_chat_speed_preset === n.id ? "is-active" : ""),
                      onClick: () =>
                        e.setStaged({ voice_chat_speed_preset: n.id }),
                      children: [
                        ft("span", {
                          className: "dsp-vs-preset-value",
                          children: n.id,
                        }),
                        ft("span", {
                          className: "dsp-vs-preset-label",
                          children: n.label_fr,
                        }),
                        n.concise &&
                          ft("span", {
                            className: "dsp-vs-preset-tag",
                            children: "Concis",
                          }),
                      ],
                    },
                    n.id,
                  ),
                ),
              }),
              n?.concise &&
                ft("p", {
                  className: "dsp-vs-info",
                  children: "⚡ Mode concis — réponses ultra-courtes",
                }),
            ],
          });
        },
        In = ({ s: e }) => {
          const t = e.effectivePrefs;
          if (!e.catalog || !t) return null;
          const n = (t, n, a) =>
            ft("div", {
              className: "dsp-vs-model-block",
              children: [
                ft("p", { className: "dsp-vs-label", children: a }),
                ft("div", {
                  className: "dsp-vs-model-list",
                  children: e.catalog.models.map((a) => {
                    const s = t === a.id,
                      r =
                        "lowest" === a.latency
                          ? "Ultra-rapide"
                          : "low" === a.latency
                            ? "Rapide"
                            : "Haute qualité";
                    return ft(
                      "button",
                      {
                        type: "button",
                        className: "dsp-vs-model " + (s ? "is-active" : ""),
                        onClick: () => e.setStaged({ [n]: a.id }),
                        children: [
                          ft("div", {
                            className: "dsp-vs-model-head",
                            children: [
                              ft("span", {
                                className: "dsp-vs-model-name",
                                children: a.name,
                              }),
                              ft("span", {
                                className: `dsp-vs-model-latency lat-${a.latency}`,
                                children: r,
                              }),
                            ],
                          }),
                          ft("p", {
                            className: "dsp-vs-hint",
                            children: a.description_fr,
                          }),
                        ],
                      },
                      `${n}-${a.id}`,
                    );
                  }),
                }),
              ],
            });
          return ft("div", {
            className: "dsp-vs-stack",
            children: [
              n(t.tts_model, "tts_model", "TTS — résumés / synthèse"),
              n(
                t.voice_chat_model,
                "voice_chat_model",
                "Chat vocal — temps réel",
              ),
            ],
          });
        },
        Dn = ({ s: e }) => {
          const t = e.effectivePrefs;
          return t
            ? ft("div", {
                className: "dsp-vs-stack",
                children: [
                  ft(Nn, {
                    label: "Stabilité",
                    hint: "Variable ← → constant",
                    min: 0,
                    max: 1,
                    step: 0.05,
                    value: t.stability,
                    onLiveChange: (t) => e.setStaged({ stability: t }),
                    onCommit: (t) => e.setStaged({ stability: t }),
                  }),
                  ft(Nn, {
                    label: "Fidélité",
                    hint: "Diversifié ← → fidèle à l'original",
                    min: 0,
                    max: 1,
                    step: 0.05,
                    value: t.similarity_boost,
                    onLiveChange: (t) => e.setStaged({ similarity_boost: t }),
                    onCommit: (t) => e.setStaged({ similarity_boost: t }),
                  }),
                  ft(Nn, {
                    label: "Style",
                    hint: "Neutre ← → expressif",
                    min: 0,
                    max: 1,
                    step: 0.05,
                    value: t.style,
                    onLiveChange: (t) => e.setStaged({ style: t }),
                    onCommit: (t) => e.setStaged({ style: t }),
                  }),
                  ft(Mn, {
                    label: "Speaker Boost",
                    description:
                      "Améliore la clarté (consomme plus de crédits)",
                    checked: t.use_speaker_boost,
                    onChange: (t) => e.setStaged({ use_speaker_boost: t }),
                  }),
                ],
              })
            : null;
        },
        Ln = ({ s: e }) => {
          const t = e.effectivePrefs,
            [n, a] = ue(!1);
          return (
            pe(() => {
              if (!n) return;
              const t = (t) => {
                if (
                  (t.preventDefault(), t.stopPropagation(), "Escape" === t.key)
                )
                  return void a(!1);
                const n = " " === t.key ? " " : t.key;
                (e.setLive({ ptt_key: n }), a(!1));
              };
              return (
                window.addEventListener("keydown", t, { capture: !0 }),
                () => window.removeEventListener("keydown", t, { capture: !0 })
              );
            }, [n, e]),
            t
              ? ft("div", {
                  className: "dsp-vs-stack",
                  children: [
                    ft(Sn, {
                      options: [
                        {
                          id: "ptt",
                          label: "Push-to-talk",
                          description: "Maintenir une touche pour parler",
                        },
                        {
                          id: "vad",
                          label: "Détection vocale",
                          description: "Micro toujours ouvert",
                        },
                      ],
                      value: t.input_mode,
                      onChange: (t) => {
                        e.setLive({ input_mode: t });
                      },
                    }),
                    "ptt" === t.input_mode &&
                      ft("div", {
                        className: "dsp-vs-field",
                        children: [
                          ft("label", {
                            className: "dsp-vs-label",
                            children: "Touche pour parler",
                          }),
                          ft("button", {
                            type: "button",
                            className:
                              "dsp-vs-ptt-btn " + (n ? "is-listening" : ""),
                            onClick: () => a((e) => !e),
                            children: [
                              ft("kbd", {
                                className: "dsp-vs-kbd",
                                children: n
                                  ? "…"
                                  : ((s = t.ptt_key),
                                    " " === s ||
                                    "Space" === s ||
                                    "Spacebar" === s
                                      ? "Espace"
                                      : "Shift" === s
                                        ? "Shift"
                                        : "Control" === s
                                          ? "Ctrl"
                                          : "Alt" === s
                                            ? "Alt"
                                            : "Meta" === s
                                              ? "Meta"
                                              : "Enter" === s
                                                ? "Entrée"
                                                : 1 === s.length
                                                  ? s.toUpperCase()
                                                  : s),
                              }),
                              ft("span", {
                                className: "dsp-vs-hint",
                                children: n
                                  ? "Appuyez (Échap pour annuler)"
                                  : "Modifier",
                              }),
                            ],
                          }),
                        ],
                      }),
                    "vad" === t.input_mode &&
                      ft(Nn, {
                        label: "Réactivité",
                        hint: "Patient ← → réactif",
                        min: 0,
                        max: 1,
                        step: 0.05,
                        value: t.turn_eagerness,
                        onLiveChange: (t) => {
                          e.setLive({ turn_eagerness: t });
                        },
                        onCommit: (t) => {
                          e.setLive({ turn_eagerness: t });
                        },
                      }),
                    ft(Mn, {
                      label: "Interruptions",
                      description: "Couper la parole à l'agent en parlant",
                      checked: t.interruptions_enabled,
                      onChange: (t) => {
                        e.setLive({ interruptions_enabled: t });
                      },
                    }),
                  ],
                })
              : null
          );
          var s;
        },
        $n = ({ s: e }) => {
          const t = e.effectivePrefs;
          return t
            ? ft("div", {
                className: "dsp-vs-stack",
                children: [
                  ft(Nn, {
                    label: "Délai de relance",
                    hint: "Silence avant que l'agent relance",
                    min: 5,
                    max: 60,
                    step: 1,
                    value: t.turn_timeout,
                    format: (e) => `${Math.round(e)}s`,
                    onLiveChange: (t) => {
                      e.setLive({ turn_timeout: Math.round(t) });
                    },
                    onCommit: (t) => {
                      e.setLive({ turn_timeout: Math.round(t) });
                    },
                  }),
                  ft(Nn, {
                    label: "Alerte de session",
                    hint: "Avant déconnexion automatique",
                    min: 60,
                    max: 600,
                    step: 30,
                    value: t.soft_timeout_seconds,
                    format: (e) => `${Math.round(e / 60)} min`,
                    onLiveChange: (t) => {
                      e.setLive({ soft_timeout_seconds: Math.round(t) });
                    },
                    onCommit: (t) => {
                      e.setLive({ soft_timeout_seconds: Math.round(t) });
                    },
                  }),
                ],
              })
            : null;
        },
        On = ({ s: e }) => {
          const t = e.effectivePrefs;
          return t
            ? ft("div", {
                className: "dsp-vs-stack",
                children: [
                  ft("div", {
                    className: "dsp-vs-field",
                    children: [
                      ft("label", {
                        className: "dsp-vs-label",
                        children: "Langue par défaut",
                      }),
                      ft(Sn, {
                        options: [
                          { id: "fr", label: "🇫🇷 Français" },
                          { id: "en", label: "🇬🇧 English" },
                        ],
                        value: "en" === t.language ? "en" : "fr",
                        onChange: (t) => e.setStaged({ language: t }),
                      }),
                    ],
                  }),
                  ft("div", {
                    className: "dsp-vs-field",
                    children: [
                      ft("label", {
                        className: "dsp-vs-label",
                        children: "Genre par défaut",
                      }),
                      ft(Sn, {
                        options: [
                          { id: "female", label: "♀ Féminin" },
                          { id: "male", label: "♂ Masculin" },
                        ],
                        value: "male" === t.gender ? "male" : "female",
                        onChange: (t) => e.setStaged({ gender: t }),
                      }),
                    ],
                  }),
                ],
              })
            : null;
        },
        zn = ({ open: e, onClose: t, onApplyHardChanges: n, settings: a }) => {
          const s = kn({ autoLoad: !a }),
            r = a ?? s,
            [i, o] = ue({
              interaction: !0,
              chatSpeed: !0,
              voices: !1,
              readingSpeed: !1,
              models: !1,
              advanced: !1,
              timeouts: !1,
              defaults: !1,
            }),
            [l, c] = ue(100),
            [d, u] = ue(!1),
            m = ve((e) => {
              o((t) => ({ ...t, [e]: !t[e] }));
            }, []),
            p = (function (e, t) {
              if (!t) return 0;
              let n = 0;
              for (const a of Object.keys(e))
                bn.includes(a) && e[a] !== t[a] && (n += 1);
              return n;
            })(r.stagedFields, r.prefs),
            g = ve(async () => {
              const e = await r.applyStaged(),
                t = {};
              for (const n of Object.keys(e)) bn.includes(n) && (t[n] = e[n]);
              Object.keys(t).length > 0 && n?.(t);
            }, [r, n]);
          return ft("div", {
            className: "dsp-vs-drawer " + (e ? "is-open" : ""),
            role: "dialog",
            "aria-label": "Réglages voix",
            "aria-hidden": !e,
            children: [
              ft("header", {
                className: "dsp-vs-drawer-header",
                children: [
                  ft("span", {
                    className: "dsp-vs-drawer-title",
                    children: "Réglages voix",
                  }),
                  ft("button", {
                    type: "button",
                    className: "dsp-vs-icon-btn",
                    onClick: t,
                    "aria-label": "Fermer",
                    children: "✕",
                  }),
                ],
              }),
              ft("div", {
                className: "dsp-vs-drawer-body",
                children: [
                  r.loading &&
                    ft("p", {
                      className: "dsp-vs-hint",
                      children: "Chargement…",
                    }),
                  r.error &&
                    !r.loading &&
                    ft("p", {
                      className: "dsp-vs-error",
                      role: "alert",
                      children: r.error,
                    }),
                  !r.loading &&
                    !r.error &&
                    r.effectivePrefs &&
                    r.catalog &&
                    ft(k, {
                      children: [
                        ft("div", {
                          className: "dsp-vs-volume",
                          children: [
                            ft("div", {
                              className: "dsp-vs-field-row",
                              children: [
                                ft("label", {
                                  className: "dsp-vs-label",
                                  children: "🔊 Volume agent",
                                }),
                                ft("span", {
                                  className: "dsp-vs-value",
                                  children: l,
                                }),
                              ],
                            }),
                            ft("input", {
                              className: "dsp-vs-slider",
                              type: "range",
                              min: 0,
                              max: 100,
                              step: 1,
                              value: l,
                              onChange: (e) => {
                                const t = parseInt(e.currentTarget.value, 10);
                                (c(t),
                                  (function (e) {
                                    const t = Math.max(0, Math.min(1, e / 100));
                                    document
                                      .querySelectorAll("audio")
                                      .forEach((e) => {
                                        e.volume = t;
                                      });
                                  })(t));
                              },
                            }),
                            ft("p", {
                              className: "dsp-vs-hint",
                              children:
                                "Appliqué instantanément aux audio en cours",
                            }),
                          ],
                        }),
                        ft(Cn, {
                          icon: "🎙",
                          title: "Voix",
                          badge: "Hard",
                          isOpen: i.voices,
                          onToggle: () => m("voices"),
                          children: ft(Pn, { s: r }),
                        }),
                        ft(Cn, {
                          icon: "⚡",
                          title: "Vitesse chat vocal",
                          badge: "Hard",
                          isOpen: i.chatSpeed,
                          onToggle: () => m("chatSpeed"),
                          children: ft(Tn, { s: r }),
                        }),
                        ft(Cn, {
                          icon: "📖",
                          title: "Vitesse de lecture résumés",
                          badge: "Hard",
                          isOpen: i.readingSpeed,
                          onToggle: () => m("readingSpeed"),
                          children: ft(En, { s: r }),
                        }),
                        ft(Cn, {
                          icon: "🤖",
                          title: "Modèles",
                          badge: "Hard",
                          isOpen: i.models,
                          onToggle: () => m("models"),
                          children: ft(In, { s: r }),
                        }),
                        ft(Cn, {
                          icon: "🎚",
                          title: "Avancé",
                          badge: "Hard",
                          isOpen: i.advanced,
                          onToggle: () => m("advanced"),
                          children: ft(Dn, { s: r }),
                        }),
                        ft(Cn, {
                          icon: "🎮",
                          title: "Mode interaction",
                          badge: "Live",
                          isOpen: i.interaction,
                          onToggle: () => m("interaction"),
                          children: ft(Ln, { s: r }),
                        }),
                        ft(Cn, {
                          icon: "⏱",
                          title: "Timeouts",
                          badge: "Live",
                          isOpen: i.timeouts,
                          onToggle: () => m("timeouts"),
                          children: ft($n, { s: r }),
                        }),
                        ft(Cn, {
                          icon: "🌍",
                          title: "Préférences par défaut",
                          badge: "Hard",
                          isOpen: i.defaults,
                          onToggle: () => m("defaults"),
                          children: ft(On, { s: r }),
                        }),
                        ft("div", {
                          className: "dsp-vs-reset",
                          children: d
                            ? ft("div", {
                                className: "dsp-vs-confirm",
                                children: [
                                  ft("span", {
                                    className: "dsp-vs-hint",
                                    children: "Confirmer le reset ?",
                                  }),
                                  ft("button", {
                                    type: "button",
                                    className: "dsp-vs-btn-secondary",
                                    onClick: () => u(!1),
                                    children: "Annuler",
                                  }),
                                  ft("button", {
                                    type: "button",
                                    className: "dsp-vs-btn-danger",
                                    onClick: async () => {
                                      (await r.resetToDefaults(), u(!1));
                                    },
                                    children: "Reset",
                                  }),
                                ],
                              })
                            : ft("button", {
                                type: "button",
                                className: "dsp-vs-link-btn",
                                onClick: () => u(!0),
                                children:
                                  "↺ Réinitialiser les valeurs par défaut",
                              }),
                        }),
                      ],
                    }),
                ],
              }),
              ft("footer", {
                className: "dsp-vs-drawer-footer",
                children:
                  p > 0
                    ? ft(k, {
                        children: [
                          ft("button", {
                            type: "button",
                            className: "dsp-vs-btn-secondary",
                            onClick: () => r.resetStaged(),
                            disabled: r.saving,
                            children: "Annuler",
                          }),
                          ft("button", {
                            type: "button",
                            className: "dsp-vs-btn-primary",
                            onClick: () => {
                              g();
                            },
                            disabled: r.saving,
                            children: r.saving
                              ? "Application…"
                              : `Appliquer (${p})`,
                          }),
                        ],
                      })
                    : ft("span", {
                        className: "dsp-vs-footer-hint",
                        children:
                          "Les réglages live sont sauvegardés automatiquement.",
                      }),
              }),
            ],
          });
        };
      function Rn({
        elapsedSec: e,
        onMute: t,
        onHangup: n,
        onApplyHardChanges: a,
        restarting: s = !1,
      }) {
        const { t: r } = zt(),
          [i, o] = ue(!1),
          l = kn(),
          c = String(Math.floor(e / 60)).padStart(2, "0"),
          d = String(e % 60).padStart(2, "0");
        return ft("div", {
          className: "ds-call-active",
          "data-testid": "ds-call-active",
          children: [
            ft("header", {
              className: "ds-call-active__header",
              children: [
                ft("div", {
                  className: "ds-call-active__indicator",
                  "aria-hidden": !0,
                }),
                ft("span", {
                  className: "ds-call-active__label",
                  children: r.voiceCall.callActive.live,
                }),
                ft("span", {
                  className: "ds-call-active__elapsed",
                  role: "timer",
                  "aria-live": "off",
                  children: ["· ", c, ":", d],
                }),
                s &&
                  ft("span", {
                    className: "dsp-vs-restart-indicator",
                    "data-testid": "voice-restarting",
                    style: { marginLeft: 8 },
                    children:
                      r.voiceCall.callActive.applyingSettings ??
                      "Réapplication des réglages…",
                  }),
                ft("button", {
                  type: "button",
                  className: "dsp-voice-settings-btn",
                  onClick: () => o(!0),
                  "aria-label":
                    r.voiceCall.callActive.settingsAriaLabel ?? "Réglages voix",
                  title:
                    r.voiceCall.callActive.settingsAriaLabel ?? "Réglages voix",
                  "data-testid": "voice-settings-btn",
                  style: { marginLeft: "auto" },
                  children: "⚙",
                }),
              ],
            }),
            ft("div", {
              className: "ds-call-active__waveform",
              "aria-hidden": !0,
              children: [30, 80, 50, 90, 40, 70, 55].map((e, t) =>
                ft("span", { style: { height: `${e}%` } }, t),
              ),
            }),
            ft("footer", {
              className: "ds-call-active__footer",
              children: [
                ft("button", {
                  type: "button",
                  className: "ds-call-active__mute",
                  onClick: t,
                  "aria-label": r.voiceCall.callActive.muteAriaLabel,
                  children: r.voiceCall.callActive.mute,
                }),
                ft("button", {
                  type: "button",
                  onClick: n,
                  className: "ds-call-active__hangup ds-hangup",
                  "aria-label": r.voiceCall.callActive.hangupAriaLabel,
                  children: r.voiceCall.callActive.hangup,
                }),
              ],
            }),
            ft(zn, {
              open: i,
              onClose: () => o(!1),
              onApplyHardChanges: a,
              settings: l,
            }),
          ],
        });
      }
      function Un({ progress: e, complete: t }) {
        const { t: n } = zt(),
          a = Math.round(e),
          s = t
            ? n.voiceCall.ctxBar.complete
            : n.voiceCall.ctxBar.inProgress.replace("{percent}", String(a));
        return ft("div", {
          className: "ds-ctx-bar",
          "data-testid": "ds-ctx-bar",
          role: "progressbar",
          "aria-valuemin": 0,
          "aria-valuemax": 100,
          "aria-valuenow": a,
          "aria-label": t
            ? n.voiceCall.ctxBar.ariaComplete
            : n.voiceCall.ctxBar.ariaInProgress.replace("{percent}", String(a)),
          children: [
            ft("div", {
              className: "ds-ctx-bar__label",
              children: [
                ft("span", {
                  className: "ds-ctx-bar__dot " + (t ? "complete" : "live"),
                }),
                ft("span", { children: s }),
              ],
            }),
            ft("div", {
              className: "ds-ctx-bar__track",
              children: ft("div", {
                className: "ds-ctx-bar__fill",
                style: { width: `${Math.max(0, Math.min(100, e))}%` },
              }),
            }),
          ],
        });
      }
      function Fn({ reason: e, onUpgrade: t, onDismiss: n }) {
        const { t: a } = zt(),
          s = a.voiceCall.upgradeCta,
          r =
            "trial_used" === e
              ? s.trialUsedHeadline
              : "monthly_quota" === e
                ? s.monthlyQuotaHeadline
                : s.proNoVoiceHeadline,
          i =
            "trial_used" === e
              ? s.trialUsedBody
              : "monthly_quota" === e
                ? s.monthlyQuotaBody
                : s.proNoVoiceBody;
        return ft("div", {
          className: "ds-upgrade-cta",
          "data-testid": "ds-upgrade-cta",
          children: [
            ft("div", {
              className: "ds-upgrade-cta__emoji",
              "aria-hidden": !0,
              children: "✨",
            }),
            ft("h2", { children: [r, ft("br", {}), s.headlineSuffix] }),
            ft("p", { children: i }),
            ft("div", {
              className: "ds-upgrade-cta__plan",
              children: [
                ft("div", {
                  className: "ds-upgrade-cta__plan-header",
                  children: [
                    ft("span", {
                      className: "ds-upgrade-cta__plan-name",
                      children: s.planName,
                    }),
                    ft("span", {
                      className: "ds-upgrade-cta__plan-price",
                      children: [
                        s.planPrice,
                        ft("span", { children: s.planPeriod }),
                      ],
                    }),
                  ],
                }),
                ft("ul", {
                  children: [
                    ft("li", { children: s.feature1 }),
                    ft("li", { children: s.feature2 }),
                    ft("li", { children: s.feature3 }),
                  ],
                }),
              ],
            }),
            ft("button", {
              type: "button",
              className: "ds-upgrade-cta__primary",
              onClick: t,
              children: s.ctaPrimary,
            }),
            ft("button", {
              type: "button",
              className: "ds-upgrade-cta__dismiss",
              onClick: n,
              children: s.ctaDismiss,
            }),
          ],
        });
      }
      class Vn extends Error {
        constructor(e, t, n) {
          (super(e),
            (this.name = "VoiceQuotaError"),
            (this.status = t),
            (this.detail = n));
        }
      }
      const Bn = (e) => vt.runtime.sendMessage(e);
      let Hn = null,
        qn = null;
      async function jn() {
        return (
          Hn ||
          qn ||
          ((qn = (async () => {
            try {
              const e = await s
                .e(423)
                .then(s.bind(s, 611))
                .catch(() => null);
              if (!e) return null;
              const t = e.Conversation;
              if (!t) return null;
              let n = null;
              return (
                (Hn = {
                  connect: async (e) => {
                    n = await t.startSession({
                      signedUrl: e.signedUrl,
                      onMessage: ({ message: t, source: n }) => {
                        const a = "user" === n ? "user" : "agent";
                        e.onMessage({ source: a, text: t });
                      },
                    });
                  },
                  disconnect: async () => {
                    try {
                      await n?.endSession();
                    } catch {}
                    n = null;
                  },
                  sendUserMessage: (e) => {
                    try {
                      n?.sendUserMessage?.(e);
                    } catch {}
                  },
                  setMuted: (e) => {
                    try {
                      const t = n;
                      if ("function" == typeof t?.setMicMuted)
                        return (t.setMicMuted(e), !0);
                    } catch {}
                    return !1;
                  },
                }),
                Hn
              );
            } catch {
              return null;
            } finally {
              qn = null;
            }
          })()),
          qn)
        );
      }
      const Wn = [];
      function Gn(e, t = {}) {
        const n = { event: e, props: t, ts: Date.now() };
        (Wn.push(n), Wn.length > 100 && Wn.shift());
        const a = globalThis.posthog;
        if (a?.capture)
          try {
            a.capture(e, t);
          } catch {}
      }
      async function Yn(e) {
        if (!e) return "";
        const t = globalThis.crypto?.subtle;
        if (t)
          try {
            const n = new TextEncoder().encode(e),
              a = await t.digest("SHA-256", n),
              s = Array.from(new Uint8Array(a))
                .map((e) => e.toString(16).padStart(2, "0"))
                .join("");
            return s.slice(0, 8);
          } catch {}
        let n = 5381;
        for (let t = 0; t < e.length; t++)
          n = ((n << 5) + n + e.charCodeAt(t)) & 4294967295;
        return (n >>> 0).toString(16).padStart(8, "0").slice(0, 8);
      }
      const Kn = ({ context: e, pendingCall: t }) => {
          const { t: n } = zt(),
            [a, s] = ue({ phase: "idle" }),
            [r, i] = ue(0),
            o = he(!1),
            l = (function (e) {
              const { context: t, sendMessage: n = Bn } = e,
                [a, s] = ue("idle"),
                [r, i] = ue(null),
                [o, l] = ue([]),
                [c, d] = ue(null),
                u = he(0),
                m = he(!1);
              pe(
                () => () => {
                  m.current = !0;
                },
                [],
              );
              const p = ve(
                  async (e, t) => {
                    const a = t?.trim();
                    if (!a) return;
                    const s = Date.now();
                    if (
                      (l((t) => [...t, { speaker: e, content: a, ts: s }]), !c)
                    )
                      return;
                    const r = u.current ? (s - u.current) / 1e3 : 0;
                    try {
                      await n({
                        action: "VOICE_APPEND_TRANSCRIPT",
                        data: {
                          voice_session_id: c,
                          speaker: e,
                          content: a,
                          time_in_call_secs: r,
                        },
                      });
                    } catch {}
                  },
                  [n, c],
                ),
                g = ve(async () => {
                  if ("connecting" === a || "listening" === a) return;
                  var e;
                  (i(null), s("requesting"));
                  const r = {
                    agent_type:
                      (e = t) && "number" == typeof e.summaryId
                        ? "explorer"
                        : "companion",
                  };
                  let o;
                  (t?.summaryId && (r.summary_id = t.summaryId),
                    t?.videoId && (r.video_id = t.videoId),
                    t?.videoTitle && (r.video_title = t.videoTitle));
                  try {
                    o = await n({ action: "VOICE_CREATE_SESSION", data: r });
                  } catch (e) {
                    if (m.current) return;
                    return (
                      s("error"),
                      void i(e.message || "Voice session error")
                    );
                  }
                  if (!m.current) {
                    if (!o.success || !o.result?.voice_session_id)
                      return (
                        s("error"),
                        void i(
                          o.error || "Impossible de créer la session vocale.",
                        )
                      );
                    (d(o.result.voice_session_id),
                      (u.current = Date.now()),
                      s("connecting"));
                    try {
                      const e = await jn();
                      if (m.current) return;
                      (e &&
                        o.result.signed_url &&
                        (await e.connect({
                          signedUrl: o.result.signed_url,
                          onMessage: (e) => {
                            p(e.source, e.text);
                          },
                        })),
                        m.current || s("listening"));
                    } catch (e) {
                      if (m.current) return;
                      (s("error"),
                        i(e.message || "ElevenLabs connection failed"));
                    }
                  }
                }, [p, t, n, a]),
                h = ve(async () => {
                  s("ending");
                  try {
                    const e = await jn();
                    await e?.disconnect?.();
                  } catch {}
                  (s("ended"), d(null), (u.current = 0));
                }, []),
                [f, _] = ue(!1),
                [v, y] = ue(null),
                [b, A] = ue(!1),
                [x, w] = ue(!1),
                k = he(!1),
                C = he(null),
                N = ve(
                  async (e) => {
                    (i(null), s("requesting"), (C.current = e));
                    const t = { agent_type: e.agentType, video_id: e.videoId };
                    (e.videoTitle && (t.video_title = e.videoTitle),
                      e.isStreaming && (t.is_streaming = !0));
                    const a = await n({
                      action: "VOICE_CREATE_SESSION",
                      data: t,
                    });
                    if (m.current) throw new Error("aborted");
                    if (!a.success || !a.result) {
                      const e = a.status,
                        t = a.detail ?? {};
                      if (402 === e)
                        throw (
                          s("error"),
                          new Vn(a.error || "Quota voice atteint", 402, t)
                        );
                      throw (
                        s("error"),
                        i(a.error || "Impossible de créer la session vocale."),
                        new Error(a.error || "Voice session error")
                      );
                    }
                    const r = a.result;
                    (d(r.session_id),
                      _(Boolean(r.is_trial)),
                      (u.current = Date.now()),
                      s("connecting"));
                    try {
                      const e = await jn();
                      if (m.current) throw new Error("aborted");
                      (e &&
                        r.signed_url &&
                        (await e.connect({
                          signedUrl: r.signed_url,
                          onMessage: (e) => {
                            p(e.source, e.text);
                          },
                        }),
                        y({
                          sendUserMessage: (t) => {
                            e.sendUserMessage && e.sendUserMessage(t);
                          },
                        })),
                        m.current || s("listening"));
                    } catch (e) {
                      if (m.current) throw new Error("aborted");
                      throw (
                        s("error"),
                        i(e.message || "ElevenLabs connection failed"),
                        e
                      );
                    }
                    return r;
                  },
                  [p, n],
                ),
                M = ve(async () => {
                  s("ending");
                  try {
                    const e = await jn();
                    await e?.disconnect?.();
                  } catch {}
                  (s("ended"),
                    d(null),
                    (u.current = 0),
                    y(null),
                    (k.current = !1));
                }, []),
                S = ve(() => {
                  const e = !k.current;
                  ((k.current = e),
                    w(e),
                    (async () => {
                      try {
                        const t = await jn(),
                          n = t?.setMuted?.(e);
                        if (n) return;
                      } catch {}
                      const t = navigator.mediaDevices;
                      if (t?.getUserMedia)
                        try {
                          const n = await t.getUserMedia({ audio: !0 });
                          for (const t of n.getAudioTracks()) t.enabled = !e;
                        } catch {}
                    })());
                }, []),
                P = ve(async () => {
                  const e = C.current;
                  if (!e) return null;
                  if ("listening" !== a && "connecting" !== a) return null;
                  const t = u.current;
                  (A(!0), i(null));
                  try {
                    try {
                      const e = await jn();
                      await e?.disconnect?.();
                    } catch {}
                    if (m.current) return null;
                    y(null);
                    const n = await N(e);
                    return m.current ? null : ((u.current = t), n);
                  } catch (e) {
                    return (
                      m.current || i(e.message || "Restart échoué."),
                      null
                    );
                  } finally {
                    m.current || A(!1);
                  }
                }, [N, a]);
              return {
                status: a,
                error: r,
                transcripts: o,
                sessionId: c,
                isActive: "listening" === a || "connecting" === a,
                start: g,
                stop: h,
                appendTranscript: p,
                startSession: N,
                endSession: M,
                toggleMute: S,
                restartSession: P,
                lastSessionWasTrial: f,
                isRestarting: b,
                isMuted: x,
                conversation: v,
              };
            })({ context: e ?? null });
          (pe(() => {
            if (o.current) return;
            if (!t?.videoId) return;
            o.current = !0;
            let e = !1;
            const n = t;
            return (
              s({
                phase: "connecting",
                videoId: n.videoId,
                videoTitle: n.videoTitle ?? "",
              }),
              (async () => {
                const t = await Yn(n.videoId);
                try {
                  const a = await l.startSession({
                    videoId: n.videoId,
                    videoTitle: n.videoTitle,
                    agentType: "explorer_streaming",
                    isStreaming: !0,
                  });
                  if (e) return;
                  (chrome.runtime.sendMessage({ type: "VOICE_CALL_STARTED" }),
                    Gn("voice_call_started", {
                      videoIdHash: t,
                      plan: n.plan ?? "unknown",
                      agent_type: "explorer_streaming",
                      is_trial: Boolean(a.is_trial),
                      max_minutes: a.max_minutes ?? null,
                    }),
                    s({
                      phase: "live_streaming",
                      videoId: n.videoId,
                      sessionId: a.session_id,
                      startedAt: Date.now(),
                    }));
                } catch (a) {
                  if (e) return;
                  const r = a;
                  if (a instanceof Vn || 402 === r.status) {
                    const e = r.detail?.reason,
                      a = e ?? "trial_used";
                    (s({ phase: "error_quota", reason: a }),
                      Gn("voice_call_upgrade_cta_shown", {
                        reason: a,
                        videoIdHash: t,
                        plan: n.plan ?? "unknown",
                      }));
                  } else
                    "NotAllowedError" === r.name
                      ? s({ phase: "error_mic_permission" })
                      : s({
                          phase: "error_generic",
                          message: String(r?.message ?? a),
                        });
                }
              })(),
              () => {
                e = !0;
              }
            );
          }, [t?.videoId]),
            pe(() => {
              if ("connecting" !== a.phase) return;
              const e = n.voiceCall.errors.connectingTimeout,
                t = setTimeout(() => {
                  s((t) =>
                    "connecting" === t.phase
                      ? { phase: "error_generic", message: e }
                      : t,
                  );
                }, 15e3);
              return () => clearTimeout(t);
            }, [a.phase, n.voiceCall.errors.connectingTimeout]),
            pe(() => {
              if ("live_streaming" !== a.phase && "live_complete" !== a.phase)
                return;
              const e = a.startedAt,
                t = setInterval(() => {
                  i(Math.floor((Date.now() - e) / 1e3));
                }, 1e3);
              return () => clearInterval(t);
            }, [a]));
          const c =
              "live_streaming" === a.phase || "live_complete" === a.phase
                ? a.sessionId
                : null,
            { contextProgress: d, contextComplete: u } = (function (e, t) {
              const [n, a] = ue(0),
                [s, r] = ue(!1),
                i = he([]),
                o = he(null);
              pe(() => {
                if (((o.current = t), t && i.current.length > 0)) {
                  const e = [...i.current];
                  i.current = [];
                  for (const n of e)
                    try {
                      t.sendUserMessage(n);
                    } catch {}
                }
              }, [t]);
              const l = (e) => {
                const t = o.current;
                if (t)
                  try {
                    t.sendUserMessage(e);
                  } catch {}
                else i.current.push(e);
              };
              return (
                pe(() => {
                  if (!e) return;
                  let t = null,
                    n = !1;
                  return (
                    (async () => {
                      let s = "";
                      try {
                        const e = await vt.runtime.sendMessage({
                          action: "GET_AUTH_TOKEN",
                        });
                        s = e?.success ? (e.result?.token ?? "") : "";
                      } catch {}
                      if (n) return;
                      const i =
                        `https://api.deepsightsynthesis.com/api/voice/context/stream?session_id=${encodeURIComponent(e)}` +
                        (s ? `&token=${encodeURIComponent(s)}` : "");
                      var o;
                      ((t = new EventSource(i, { withCredentials: !0 })),
                        (o = t).addEventListener("transcript_chunk", (e) => {
                          try {
                            const t = JSON.parse(e.data);
                            (l(
                              `[CTX UPDATE: transcript chunk ${t.chunk_index}/${t.total_chunks}]\n${t.text}`,
                            ),
                              a(((t.chunk_index + 1) / t.total_chunks) * 100));
                          } catch {}
                        }),
                        o.addEventListener("analysis_partial", (e) => {
                          try {
                            const t = JSON.parse(e.data);
                            l(
                              `[CTX UPDATE: analysis ${t.section}]\n${t.content}`,
                            );
                          } catch {}
                        }),
                        o.addEventListener("ctx_complete", (e) => {
                          try {
                            const t = JSON.parse(e.data);
                            l(`[CTX COMPLETE]\n${t.final_digest_summary}`);
                          } catch {
                            l("[CTX COMPLETE]");
                          }
                          (r(!0), a(100));
                        }),
                        o.addEventListener("error", () => {}));
                    })(),
                    () => {
                      ((n = !0), t?.close(), (i.current = []));
                    }
                  );
                }, [e]),
                { contextProgress: n, contextComplete: s }
              );
            })(c, l.conversation);
          pe(() => {
            if (u && "live_streaming" === a.phase) {
              const e = Date.now() - a.startedAt,
                t = a.videoId;
              ((async () => {
                Gn("voice_call_context_complete_at_ms", {
                  videoIdHash: await Yn(t),
                  ms: e,
                });
              })(),
                s((e) =>
                  "live_streaming" === e.phase
                    ? {
                        phase: "live_complete",
                        videoId: e.videoId,
                        sessionId: e.sessionId,
                        startedAt: e.startedAt,
                      }
                    : e,
                ));
            }
          }, [u, a.phase]);
          const m = () => {
            Gn("voice_call_upgrade_cta_clicked", {
              reason: "error_quota" === a.phase ? a.reason : "trial_used",
            });
            const e = `${qt}/upgrade?plan=expert&source=voice_call`;
            window.open(e, "_blank", "noopener,noreferrer");
          };
          return "connecting" === a.phase
            ? ft(vn, {})
            : "live_streaming" === a.phase || "live_complete" === a.phase
              ? ft(k, {
                  children: [
                    ft(Rn, {
                      elapsedSec: r,
                      onMute: l.toggleMute,
                      onHangup: () => {
                        (l.endSession(),
                          chrome.runtime.sendMessage({
                            type: "VOICE_CALL_ENDED",
                          }));
                        const e =
                          "live_streaming" === a.phase ||
                          "live_complete" === a.phase
                            ? a.videoId
                            : void 0;
                        ((async () => {
                          const t = e ? await Yn(e) : "";
                          (("live_streaming" !== a.phase &&
                            "live_complete" !== a.phase) ||
                            Gn("voice_call_duration_seconds", {
                              videoIdHash: t,
                              durationSec: Math.floor(
                                (Date.now() - a.startedAt) / 1e3,
                              ),
                            }),
                            Gn("voice_call_ended_reason", {
                              reason: l.lastSessionWasTrial
                                ? "trial_used"
                                : "user_hangup",
                              videoIdHash: t,
                            }),
                            l.lastSessionWasTrial &&
                              Gn("voice_call_upgrade_cta_shown", {
                                reason: "trial_used",
                                videoIdHash: t,
                              }));
                        })(),
                          l.lastSessionWasTrial
                            ? s({
                                phase: "ended_free_cta",
                                reason: "trial_used",
                              })
                            : s({ phase: "ended_expert" }));
                      },
                      onApplyHardChanges: () => {
                        l.restartSession();
                      },
                      restarting: l.isRestarting,
                    }),
                    ft(Un, { progress: d, complete: u }),
                  ],
                })
              : "ended_free_cta" === a.phase || "error_quota" === a.phase
                ? ft(Fn, {
                    reason: "error_quota" === a.phase ? a.reason : "trial_used",
                    onUpgrade: m,
                    onDismiss: () => s({ phase: "idle" }),
                  })
                : "error_mic_permission" === a.phase
                  ? ft("div", {
                      className: "ds-error",
                      role: "alert",
                      children: [
                        ft("p", { children: n.voiceCall.errors.micPermission }),
                        ft("button", {
                          type: "button",
                          onClick: () => location.reload(),
                          children: n.common.retry,
                        }),
                      ],
                    })
                  : "error_generic" === a.phase
                    ? ft("div", {
                        className: "ds-error",
                        role: "alert",
                        children: [
                          ft("p", {
                            children: [
                              n.voiceCall.errors.genericPrefix,
                              " ",
                              a.message,
                            ],
                          }),
                          ft("button", {
                            type: "button",
                            onClick: () => s({ phase: "idle" }),
                            children: n.voiceCall.errors.close,
                          }),
                        ],
                      })
                    : "ended_expert" === a.phase
                      ? ft("div", {
                          className: "ds-call-ended",
                          children: ft("p", {
                            children: n.voiceCall.errors.callEnded,
                          }),
                        })
                      : null;
        },
        Qn = [
          "M6 4h4v16H6zm8 0h4v16h-4z",
          "M8 7c0-2 1-3 2-3s2 1 2 3v10c0 2-1 3-2 3s-2-1-2-3V7zm6 0c0-2 1-3 2-3s2 1 2 3v10c0 2-1 3-2 3s-2-1-2-3V7z",
          "M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z",
          "M6 9H3V4h3m12 5h3V4h-3M12 15a6 6 0 006-6V3H6v6a6 6 0 006 6zm0 0v4m-4 2h8",
          "M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5V4a2 2 0 012-2h14v14H6.5A2.5 2.5 0 004 18.5z",
          "M10 2v6l-2 4h8l-2-4V2zm-2 12v2m8-2v2M8 22h8",
          "M3 21c3 0 7-1 7-8V5M14 5c0 6.5 4 8 7 8",
          "M9 2h6v4H9zM16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2m1 9l2 2 4-4",
          "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8zm11-3a3 3 0 100 6 3 3 0 000-6z",
          "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
          "M22 2L11 13m11-11l-7 20-4-9-9-4z",
          "M4.9 19.1C1 15.2 1 8.8 4.9 4.9m14.2 0c3.9 3.9 3.9 10.3 0 14.2M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.4m8.4 0c2.3 2.3 2.3 6.1 0 8.4M12 12h.01",
          "M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5",
          "M5 5a2 2 0 100 4 2 2 0 000-4zm14 0a2 2 0 100 4 2 2 0 000-4zm-7 7a2 2 0 100 4 2 2 0 000-4zm-7 7a2 2 0 100 4 2 2 0 000-4zm14 0a2 2 0 100 4 2 2 0 000-4zM7 7l5 5m5-5l-5 5m-5 5l5-5m5 5l-5-5",
          "M12 12m-3 0a3 3 0 106 0 3 3 0 10-6 0M12 2c-5 0-8 5-8 10s3 10 8 10 8-5 8-10-3-10-8-10z",
          "M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5z",
          "M4 17l6-6-6-6m8 14h8",
          "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
        ],
        Xn = (e) => {
          const t = 1e4 * Math.sin(9999 * e);
          return t - Math.floor(t);
        },
        Zn = (e, t, n, a, s, r, i, o, l) => {
          const c = 24 * a;
          return `\n    <g transform="translate(${t - c / 2}, ${n - c / 2}) rotate(${s} ${c / 2} ${c / 2})">\n      <svg viewBox="0 0 24 24" width="${c}" height="${c}" overflow="visible">\n        ${l ? `<path d="${e}" fill="${r}" opacity="${i}" />` : `<path d="${e}" stroke="${r}" stroke-width="${o}" opacity="${i}" fill="none" stroke-linecap="round" stroke-linejoin="round" />`}\n      </svg>\n    </g>\n  `;
        },
        Jn = ({ variant: e = "default", className: t = "" }) => {
          const n = _e(() => {
            const t = ((e, t, n = !0, a = 1) => {
              const s = ((e) => {
                  const t = e || "default",
                    n = [...Pt, ...Qn],
                    a = n.slice(0, 5),
                    s = [n[5], n[6], n[7], n[8], ...Qn.slice(2, 8)],
                    r = [n[9], n[10], n[11], n[12], n[13], ...Qn.slice(8, 16)],
                    i = [n[14], n[15], ...Qn.slice(17, 20)],
                    o = [n[16], n[17], n[18], n[19], n[20]];
                  switch (t) {
                    case "video":
                      return [...n, ...a, ...a, ...a];
                    case "study":
                      return [...n, ...s, ...s, ...s];
                    case "tech":
                      return [...n, ...i, ...i, ...i];
                    case "AI":
                      return [...n, ...r, ...r, ...r];
                    case "creative":
                      return [...n, ...o, ...o, ...o];
                    default:
                      return n;
                  }
                })(t),
                r = n ? "#C8903A" : "#9B6B4A",
                i = n ? "#9B6B4A" : "#C8903A",
                o = n
                  ? [
                      "#A78BFA",
                      "#818CF8",
                      "#FBBF24",
                      "#34D399",
                      "#60A5FA",
                      "#F87171",
                      "#C084FC",
                    ]
                  : [
                      "#8B5CF6",
                      "#6366F1",
                      "#F59E0B",
                      "#10B981",
                      "#3B82F6",
                      "#EF4444",
                      "#A855F7",
                    ],
                l = (e, t = !1) =>
                  t ? (Xn(e) > 0.5 ? r : i) : o[Math.floor(Xn(e) * o.length)],
                c = (e, t) => e[Math.floor(Xn(t) * e.length)],
                d = (e) => {
                  const t = [0, 15, -15, 30, -30, 45, -45, 90, -90, 180];
                  return t[Math.floor(Xn(e) * t.length)];
                };
              let u = "";
              const m =
                {
                  video: 1e3,
                  study: 2e3,
                  tech: 3e3,
                  AI: 4e3,
                  creative: 5e3,
                  default: 0,
                }[t] ?? 0;
              for (let t = 0; t < 25; t++) {
                const n = m + 100 + 37 * t,
                  r = c(s, n),
                  i = Xn(n + 1) * e,
                  o = Xn(n + 2) * e,
                  p = d(n + 3),
                  g = 0.8 + 0.4 * Xn(n + 4),
                  h = (0.04 + 0.02 * Xn(n + 5)) * a,
                  f = l(n + 9),
                  _ = 1.2 + 0.6 * (Xn(n + 10) - 0.5);
                u += Zn(r, i, o, g, p, f, h, _, !1);
              }
              for (let t = 0; t < 30; t++) {
                const n = m + 300 + 23 * t,
                  r = c(s, n),
                  i = Xn(n + 1) * e,
                  o = Xn(n + 2) * e,
                  p = d(n + 3),
                  g = 0.5 + 0.3 * Xn(n + 4),
                  h = (0.08 + 0.04 * Xn(n + 5)) * a,
                  f = l(n + 9, Xn(n + 6) < 0.1),
                  _ = 1.4 + 0.6 * (Xn(n + 10) - 0.5);
                u += Zn(r, i, o, g, p, f, h, _, !1);
              }
              for (let t = 0; t < 15; t++) {
                const n = m + 600 + 41 * t,
                  s = Xn(n + 1) * e,
                  o = Xn(n + 2) * e,
                  l = 0.5 + 1.5 * Xn(n + 3),
                  c = (0.1 + 0.05 * Xn(n + 4)) * a;
                u += `<circle cx="${s}" cy="${o}" r="${l}" fill="${Xn(n + 5) > 0.5 ? r : i}" opacity="${c}" />`;
              }
              return `\n    <svg width="${e}" height="${e}" viewBox="0 0 ${e} ${e}" xmlns="http://www.w3.org/2000/svg" overflow="visible">\n      <defs>\n        <mask id="tileEdgeFade">\n          <rect width="${e}" height="${e}" fill="white" />\n          <radialGradient id="edgeFadeGrad" cx="50%" cy="50%" r="60%">\n            <stop offset="0%" stop-color="white" />\n            <stop offset="100%" stop-color="black" />\n          </radialGradient>\n          <circle cx="${e / 2}" cy="${e / 2}" r="${0.55 * e}" fill="url(#edgeFadeGrad)" />\n        </mask>\n      </defs>\n      <g mask="url(#tileEdgeFade)">\n        ${u}\n      </g>\n    </svg>\n  `;
            })(200, e, !0, 1);
            return `data:image/svg+xml,${encodeURIComponent(t)}`;
          }, [e]);
          return ft("div", {
            className: `fixed inset-0 pointer-events-none ${t}`,
            style: {
              ..._e(
                () => ({
                  backgroundImage: `url("${n}")`,
                  backgroundSize: "200px 200px",
                  backgroundRepeat: "repeat",
                  backgroundAttachment: "fixed",
                }),
                [n],
              ),
              zIndex: -1,
            },
            "aria-hidden": "true",
          });
        },
        ea = (
          e,
          t,
          n,
          a,
          s,
          r,
          i,
          o,
          l,
          c,
          d,
          u,
          m,
          p,
          g,
          h,
          f,
          _,
          v,
          y,
          b,
          A,
          x,
          w,
          k,
          C,
        ) => ({
          hour: e,
          mood: t,
          beamType: n,
          beamColor: a,
          beamAngleDeg: s,
          beamOpacity: r,
          sunVisible: i,
          sunOpacity: o,
          sunX: l,
          sunY: c,
          moonVisible: d,
          moonOpacity: u,
          moonX: m,
          moonY: p,
          ambientPrimary: g,
          ambientSecondary: h,
          ambientTertiary: f,
          starOpacityMul: _,
          starDensity: v,
          haloX: y,
          haloY: b,
          colors: { primary: A, secondary: x, tertiary: w, rays: k, accent: C },
        }),
        ta = Object.freeze([
          ea(
            0,
            "Minuit profond",
            "moon",
            [186, 230, 253],
            95,
            0.32,
            !1,
            0,
            50,
            50,
            !0,
            1,
            50,
            12,
            0.18,
            0.14,
            0.16,
            1.4,
            "dense",
            50,
            8,
            [99, 102, 241],
            [56, 189, 248],
            [139, 92, 246],
            [186, 230, 253],
            [196, 181, 253],
          ),
          ea(
            0.5,
            "Lueur de cristal",
            "moon",
            [191, 232, 252],
            96,
            0.31,
            !1,
            0,
            50,
            50,
            !0,
            0.98,
            47,
            13,
            0.18,
            0.14,
            0.16,
            1.4,
            "dense",
            49,
            9,
            [102, 105, 240],
            [56, 189, 248],
            [139, 92, 246],
            [191, 232, 252],
            [196, 181, 253],
          ),
          ea(
            1,
            "Heure des loups",
            "moon",
            [196, 234, 251],
            97,
            0.3,
            !1,
            0,
            50,
            50,
            !0,
            0.96,
            44,
            14,
            0.17,
            0.13,
            0.15,
            1.4,
            "dense",
            48,
            10,
            [105, 108, 240],
            [56, 189, 248],
            [139, 92, 246],
            [196, 234, 251],
            [196, 181, 253],
          ),
          ea(
            1.5,
            "Silence indigo",
            "moon",
            [200, 235, 251],
            98,
            0.3,
            !1,
            0,
            50,
            50,
            !0,
            0.94,
            41,
            15,
            0.17,
            0.13,
            0.15,
            1.4,
            "dense",
            46,
            10,
            [108, 110, 238],
            [56, 189, 248],
            [139, 92, 246],
            [200, 235, 251],
            [196, 181, 253],
          ),
          ea(
            2,
            "Heure bleue",
            "moon",
            [203, 237, 250],
            99,
            0.29,
            !1,
            0,
            50,
            50,
            !0,
            0.92,
            38,
            16,
            0.16,
            0.13,
            0.15,
            1.4,
            "dense",
            45,
            11,
            [110, 113, 236],
            [56, 189, 248],
            [139, 92, 246],
            [203, 237, 250],
            [196, 181, 253],
          ),
          ea(
            2.5,
            "Encre du cosmos",
            "moon",
            [206, 238, 250],
            100,
            0.28,
            !1,
            0,
            50,
            50,
            !0,
            0.9,
            35,
            18,
            0.16,
            0.12,
            0.14,
            1.35,
            "dense",
            43,
            12,
            [113, 116, 235],
            [56, 189, 248],
            [139, 92, 246],
            [206, 238, 250],
            [196, 181, 253],
          ),
          ea(
            3,
            "Cendre céleste",
            "moon",
            [210, 240, 249],
            101,
            0.27,
            !1,
            0,
            50,
            50,
            !0,
            0.88,
            32,
            20,
            0.15,
            0.12,
            0.14,
            1.3,
            "dense",
            42,
            13,
            [116, 119, 233],
            [56, 189, 248],
            [139, 92, 246],
            [210, 240, 249],
            [196, 181, 253],
          ),
          ea(
            3.5,
            "Brume de nuit",
            "moon",
            [213, 241, 248],
            102,
            0.26,
            !1,
            0,
            50,
            50,
            !0,
            0.85,
            28,
            22,
            0.15,
            0.12,
            0.14,
            1.25,
            "dense",
            40,
            14,
            [119, 122, 232],
            [56, 189, 248],
            [139, 92, 246],
            [213, 241, 248],
            [196, 181, 253],
          ),
          ea(
            4,
            "Hypnagogique",
            "moon",
            [216, 242, 247],
            103,
            0.25,
            !1,
            0,
            50,
            50,
            !0,
            0.8,
            24,
            25,
            0.14,
            0.11,
            0.13,
            1.2,
            "dense",
            38,
            15,
            [122, 125, 230],
            [56, 189, 248],
            [139, 92, 246],
            [216, 242, 247],
            [196, 181, 253],
          ),
          ea(
            4.5,
            "Premiers rais",
            "moon",
            [218, 235, 240],
            104,
            0.24,
            !1,
            0,
            50,
            50,
            !0,
            0.75,
            21,
            28,
            0.14,
            0.11,
            0.13,
            1.15,
            "dense",
            37,
            16,
            [125, 127, 226],
            [56, 189, 248],
            [139, 92, 246],
            [218, 235, 240],
            [196, 181, 253],
          ),
          ea(
            5,
            "Lueur du levant",
            "twilight",
            [221, 220, 220],
            106,
            0.24,
            !1,
            0,
            50,
            50,
            !0,
            0.65,
            18,
            32,
            0.14,
            0.11,
            0.13,
            1.1,
            "dense",
            35,
            18,
            [128, 130, 220],
            [167, 139, 250],
            [139, 92, 246],
            [221, 220, 220],
            [196, 181, 253],
          ),
          ea(
            5.5,
            "Aube naissante",
            "twilight",
            [240, 200, 180],
            108,
            0.28,
            !0,
            0.05,
            75,
            38,
            !0,
            0.5,
            16,
            36,
            0.16,
            0.12,
            0.14,
            0.95,
            "dense",
            33,
            22,
            [167, 130, 200],
            [196, 139, 220],
            [248, 113, 113],
            [240, 200, 180],
            [196, 181, 253],
          ),
          ea(
            6,
            "Aurore rosée",
            "twilight",
            [248, 198, 165],
            110,
            0.34,
            !0,
            0.3,
            73,
            35,
            !0,
            0.35,
            14,
            40,
            0.2,
            0.15,
            0.17,
            0.7,
            "sparse",
            30,
            25,
            [200, 130, 180],
            [251, 191, 36],
            [248, 113, 113],
            [251, 222, 195],
            [251, 191, 36],
          ),
          ea(
            6.5,
            "Premier rayon",
            "twilight",
            [251, 209, 165],
            112,
            0.4,
            !0,
            0.55,
            71,
            32,
            !0,
            0.2,
            12,
            44,
            0.24,
            0.17,
            0.19,
            0.55,
            "sparse",
            28,
            22,
            [220, 140, 165],
            [253, 200, 60],
            [248, 113, 113],
            [253, 215, 175],
            [251, 191, 36],
          ),
          ea(
            7,
            "Lever du jour",
            "sun",
            [253, 217, 161],
            115,
            0.46,
            !0,
            0.78,
            67,
            28,
            !1,
            0,
            50,
            50,
            0.28,
            0.18,
            0.2,
            0.4,
            "sparse",
            26,
            19,
            [240, 165, 145],
            [253, 211, 75],
            [251, 146, 60],
            [253, 217, 161],
            [251, 191, 36],
          ),
          ea(
            7.5,
            "Or matinal",
            "sun",
            [254, 224, 158],
            117,
            0.5,
            !0,
            0.92,
            62,
            25,
            !1,
            0,
            50,
            50,
            0.3,
            0.18,
            0.2,
            0.3,
            "sparse",
            30,
            17,
            [254, 175, 130],
            [253, 218, 95],
            [253, 168, 85],
            [254, 224, 158],
            [251, 191, 36],
          ),
          ea(
            8,
            "Matin clair",
            "sun",
            [255, 230, 153],
            119,
            0.54,
            !0,
            1,
            56,
            22,
            !1,
            0,
            50,
            50,
            0.32,
            0.18,
            0.2,
            0.2,
            "sparse",
            34,
            16,
            [255, 188, 117],
            [253, 224, 110],
            [255, 188, 110],
            [255, 230, 153],
            [251, 191, 36],
          ),
          ea(
            8.5,
            "Doré chaud",
            "sun",
            [255, 234, 148],
            121,
            0.56,
            !0,
            1,
            51,
            19,
            !1,
            0,
            50,
            50,
            0.34,
            0.19,
            0.21,
            0.15,
            "sparse",
            38,
            15,
            [255, 198, 110],
            [253, 226, 120],
            [255, 196, 120],
            [255, 234, 148],
            [251, 191, 36],
          ),
          ea(
            9,
            "Soleil ascendant",
            "sun",
            [255, 237, 145],
            123,
            0.58,
            !0,
            1,
            47,
            17,
            !1,
            0,
            50,
            50,
            0.36,
            0.19,
            0.21,
            0.1,
            "sparse",
            42,
            14,
            [255, 205, 105],
            [253, 228, 130],
            [255, 200, 125],
            [255, 237, 145],
            [251, 191, 36],
          ),
          ea(
            9.5,
            "Soleil bas",
            "sun",
            [255, 239, 142],
            125,
            0.59,
            !0,
            1,
            44,
            16,
            !1,
            0,
            50,
            50,
            0.37,
            0.19,
            0.21,
            0.08,
            "sparse",
            45,
            14,
            [255, 210, 100],
            [253, 230, 135],
            [255, 205, 130],
            [255, 239, 142],
            [251, 191, 36],
          ),
          ea(
            10,
            "Plein matin",
            "sun",
            [255, 241, 140],
            127,
            0.6,
            !0,
            1,
            41,
            15,
            !1,
            0,
            50,
            50,
            0.38,
            0.2,
            0.22,
            0.06,
            "sparse",
            47,
            13,
            [255, 215, 95],
            [253, 232, 140],
            [255, 210, 135],
            [255, 241, 140],
            [251, 191, 36],
          ),
          ea(
            10.5,
            "Or de l'avant-midi",
            "sun",
            [255, 242, 138],
            128,
            0.61,
            !0,
            1,
            38,
            14,
            !1,
            0,
            50,
            50,
            0.39,
            0.2,
            0.22,
            0.05,
            "sparse",
            49,
            13,
            [255, 220, 90],
            [253, 234, 145],
            [255, 215, 140],
            [255, 242, 138],
            [251, 191, 36],
          ),
          ea(
            11,
            "Lumière de cathédrale",
            "sun",
            [255, 243, 137],
            129,
            0.62,
            !0,
            1,
            35,
            14,
            !1,
            0,
            50,
            50,
            0.4,
            0.2,
            0.22,
            0.04,
            "sparse",
            49,
            12,
            [255, 222, 88],
            [253, 235, 148],
            [255, 218, 145],
            [255, 243, 137],
            [251, 191, 36],
          ),
          ea(
            11.5,
            "Avant zénith",
            "sun",
            [255, 244, 136],
            130,
            0.63,
            !0,
            1,
            32,
            13,
            !1,
            0,
            50,
            50,
            0.41,
            0.2,
            0.22,
            0.04,
            "sparse",
            50,
            12,
            [255, 224, 86],
            [253, 236, 150],
            [255, 220, 148],
            [255, 244, 136],
            [251, 191, 36],
          ),
          ea(
            12,
            "Zénith éclatant",
            "sun",
            [255, 245, 135],
            131,
            0.64,
            !0,
            1,
            50,
            14,
            !1,
            0,
            50,
            50,
            0.42,
            0.2,
            0.22,
            0.03,
            "sparse",
            50,
            11,
            [255, 226, 85],
            [253, 237, 152],
            [255, 222, 150],
            [255, 245, 135],
            [251, 191, 36],
          ),
          ea(
            12.5,
            "Plein soleil",
            "sun",
            [255, 245, 134],
            132,
            0.64,
            !0,
            1,
            47,
            14,
            !1,
            0,
            50,
            50,
            0.42,
            0.2,
            0.22,
            0.03,
            "sparse",
            50,
            11,
            [255, 226, 85],
            [253, 237, 152],
            [255, 222, 150],
            [255, 245, 134],
            [251, 191, 36],
          ),
          ea(
            13,
            "Après-midi or vif",
            "sun",
            [255, 244, 138],
            133,
            0.63,
            !0,
            1,
            44,
            14,
            !1,
            0,
            50,
            50,
            0.41,
            0.2,
            0.22,
            0.03,
            "sparse",
            50,
            12,
            [255, 224, 88],
            [253, 236, 150],
            [255, 220, 148],
            [255, 244, 138],
            [251, 191, 36],
          ),
          ea(
            13.5,
            "Brume dorée",
            "sun",
            [255, 242, 142],
            134,
            0.62,
            !0,
            1,
            41,
            15,
            !1,
            0,
            50,
            50,
            0.4,
            0.2,
            0.22,
            0.04,
            "sparse",
            49,
            12,
            [255, 222, 92],
            [253, 234, 148],
            [255, 218, 145],
            [255, 242, 142],
            [251, 191, 36],
          ),
          ea(
            14,
            "Lumière paisible",
            "sun",
            [255, 240, 145],
            135,
            0.61,
            !0,
            1,
            38,
            16,
            !1,
            0,
            50,
            50,
            0.39,
            0.2,
            0.22,
            0.04,
            "sparse",
            48,
            13,
            [255, 220, 95],
            [253, 232, 145],
            [255, 215, 142],
            [255, 240, 145],
            [251, 191, 36],
          ),
          ea(
            14.5,
            "Or velouté",
            "sun",
            [255, 237, 148],
            136,
            0.59,
            !0,
            1,
            35,
            17,
            !1,
            0,
            50,
            50,
            0.38,
            0.2,
            0.22,
            0.05,
            "sparse",
            46,
            13,
            [255, 217, 100],
            [253, 230, 142],
            [255, 213, 138],
            [255, 237, 148],
            [251, 191, 36],
          ),
          ea(
            15,
            "Cuivre tiède",
            "sun",
            [255, 233, 152],
            137,
            0.57,
            !0,
            1,
            32,
            18,
            !1,
            0,
            50,
            50,
            0.37,
            0.19,
            0.21,
            0.06,
            "sparse",
            44,
            14,
            [255, 213, 105],
            [253, 226, 138],
            [255, 209, 135],
            [255, 233, 152],
            [251, 191, 36],
          ),
          ea(
            15.5,
            "Ambre déclinant",
            "sun",
            [255, 228, 158],
            138,
            0.55,
            !0,
            1,
            29,
            20,
            !1,
            0,
            50,
            50,
            0.36,
            0.19,
            0.21,
            0.07,
            "sparse",
            42,
            15,
            [255, 208, 112],
            [253, 222, 132],
            [255, 203, 130],
            [255, 228, 158],
            [251, 191, 36],
          ),
          ea(
            16,
            "Soleil bas-déclinant",
            "sun",
            [255, 222, 165],
            139,
            0.52,
            !0,
            1,
            26,
            22,
            !1,
            0,
            50,
            50,
            0.35,
            0.19,
            0.21,
            0.08,
            "sparse",
            40,
            17,
            [255, 200, 120],
            [253, 215, 125],
            [255, 195, 120],
            [255, 222, 165],
            [251, 191, 36],
          ),
          ea(
            16.5,
            "Avant-magic",
            "sun",
            [255, 215, 165],
            140,
            0.49,
            !0,
            1,
            23,
            25,
            !1,
            0,
            50,
            50,
            0.34,
            0.19,
            0.21,
            0.1,
            "sparse",
            38,
            19,
            [255, 190, 120],
            [253, 200, 115],
            [255, 165, 95],
            [255, 215, 165],
            [251, 146, 60],
          ),
          ea(
            17,
            "Magic hour",
            "sun",
            [255, 195, 140],
            142,
            0.5,
            !0,
            0.98,
            21,
            28,
            !0,
            0.05,
            14,
            42,
            0.34,
            0.2,
            0.22,
            0.15,
            "sparse",
            35,
            22,
            [255, 165, 90],
            [253, 165, 100],
            [251, 113, 60],
            [255, 195, 140],
            [251, 146, 60],
          ),
          ea(
            17.5,
            "Embrasement",
            "sun",
            [255, 165, 110],
            144,
            0.55,
            !0,
            0.85,
            19,
            31,
            !0,
            0.18,
            16,
            40,
            0.36,
            0.22,
            0.24,
            0.25,
            "sparse",
            32,
            25,
            [255, 130, 75],
            [253, 130, 90],
            [220, 80, 90],
            [255, 165, 110],
            [251, 146, 60],
          ),
          ea(
            18,
            "Pourpre vespéral",
            "twilight",
            [240, 130, 100],
            146,
            0.58,
            !0,
            0.55,
            18,
            34,
            !0,
            0.4,
            18,
            38,
            0.36,
            0.24,
            0.26,
            0.4,
            "sparse",
            30,
            28,
            [220, 100, 90],
            [200, 100, 130],
            [180, 70, 130],
            [240, 130, 100],
            [196, 100, 200],
          ),
          ea(
            18.5,
            "Crépuscule violet",
            "twilight",
            [200, 130, 180],
            148,
            0.55,
            !0,
            0.3,
            17,
            38,
            !0,
            0.65,
            20,
            36,
            0.32,
            0.22,
            0.26,
            0.55,
            "sparse",
            32,
            30,
            [165, 90, 165],
            [120, 100, 200],
            [120, 60, 180],
            [200, 130, 180],
            [167, 139, 250],
          ),
          ea(
            19,
            "Tombée de la nuit",
            "twilight",
            [165, 145, 230],
            150,
            0.5,
            !0,
            0.1,
            16,
            42,
            !0,
            0.85,
            22,
            32,
            0.28,
            0.2,
            0.24,
            0.75,
            "dense",
            35,
            25,
            [125, 110, 220],
            [90, 110, 220],
            [99, 92, 230],
            [165, 145, 230],
            [167, 139, 250],
          ),
          ea(
            19.5,
            "Bleu nuit naissant",
            "moon",
            [180, 195, 240],
            145,
            0.42,
            !1,
            0,
            50,
            50,
            !0,
            0.95,
            25,
            28,
            0.24,
            0.18,
            0.22,
            0.95,
            "dense",
            40,
            20,
            [115, 115, 222],
            [80, 130, 230],
            [120, 100, 230],
            [180, 195, 240],
            [180, 160, 250],
          ),
          ea(
            20,
            "Soir nocturne",
            "moon",
            [186, 220, 248],
            140,
            0.36,
            !1,
            0,
            50,
            50,
            !0,
            1,
            28,
            24,
            0.2,
            0.16,
            0.2,
            1.1,
            "dense",
            43,
            16,
            [105, 110, 220],
            [70, 150, 240],
            [130, 100, 230],
            [186, 220, 248],
            [186, 170, 250],
          ),
          ea(
            20.5,
            "Soir profond",
            "moon",
            [186, 226, 251],
            137,
            0.34,
            !1,
            0,
            50,
            50,
            !0,
            1,
            32,
            20,
            0.19,
            0.15,
            0.19,
            1.2,
            "dense",
            45,
            14,
            [105, 108, 222],
            [62, 165, 245],
            [134, 99, 240],
            [186, 226, 251],
            [192, 175, 252],
          ),
          ea(
            21,
            "Soirée bleue",
            "moon",
            [186, 230, 253],
            134,
            0.33,
            !1,
            0,
            50,
            50,
            !0,
            1,
            36,
            17,
            0.18,
            0.15,
            0.18,
            1.3,
            "dense",
            47,
            12,
            [104, 106, 224],
            [56, 175, 250],
            [136, 96, 244],
            [186, 230, 253],
            [196, 178, 252],
          ),
          ea(
            21.5,
            "Calme stellaire",
            "moon",
            [186, 232, 254],
            130,
            0.33,
            !1,
            0,
            50,
            50,
            !0,
            1,
            40,
            14,
            0.18,
            0.14,
            0.17,
            1.35,
            "dense",
            48,
            11,
            [102, 104, 226],
            [56, 184, 250],
            [137, 95, 246],
            [186, 232, 254],
            [196, 180, 253],
          ),
          ea(
            22,
            "Nuit douce",
            "moon",
            [186, 230, 253],
            125,
            0.32,
            !1,
            0,
            50,
            50,
            !0,
            1,
            44,
            13,
            0.18,
            0.14,
            0.17,
            1.4,
            "dense",
            49,
            10,
            [101, 103, 228],
            [56, 189, 248],
            [138, 93, 246],
            [186, 230, 253],
            [196, 181, 253],
          ),
          ea(
            22.5,
            "Nuit étoilée",
            "moon",
            [186, 230, 253],
            120,
            0.32,
            !1,
            0,
            50,
            50,
            !0,
            1,
            47,
            12,
            0.18,
            0.14,
            0.16,
            1.4,
            "dense",
            50,
            9,
            [100, 102, 230],
            [56, 189, 248],
            [139, 92, 246],
            [186, 230, 253],
            [196, 181, 253],
          ),
          ea(
            23,
            "Avant-minuit",
            "moon",
            [186, 230, 253],
            110,
            0.32,
            !1,
            0,
            50,
            50,
            !0,
            1,
            49,
            12,
            0.18,
            0.14,
            0.16,
            1.4,
            "dense",
            50,
            9,
            [99, 102, 232],
            [56, 189, 248],
            [139, 92, 246],
            [186, 230, 253],
            [196, 181, 253],
          ),
          ea(
            23.5,
            "Approche minuit",
            "moon",
            [186, 230, 253],
            102,
            0.32,
            !1,
            0,
            50,
            50,
            !0,
            1,
            50,
            12,
            0.18,
            0.14,
            0.16,
            1.4,
            "dense",
            50,
            8,
            [99, 102, 235],
            [56, 189, 248],
            [139, 92, 246],
            [186, 230, 253],
            [196, 181, 253],
          ),
        ]);
      48 !== ta.length &&
        console.warn(
          `[lighting-engine] Expected 48 keyframes, got ${ta.length}`,
        );
      const na = [
        {
          hour: 0,
          mood: "midnight",
          beamColor: [220, 232, 255],
          beamAngleDeg: -10,
          beamOpacity: 0.65,
          haloPrimary: [199, 210, 254],
          haloAccentColor: "rgba(79,70,229,0.45)",
          intensity: 0.55,
          nightMode: "glowing",
        },
        {
          hour: 0.5,
          mood: "late-night",
          beamColor: [220, 232, 255],
          beamAngleDeg: -8,
          beamOpacity: 0.62,
          haloPrimary: [199, 210, 254],
          haloAccentColor: "rgba(79,70,229,0.42)",
          intensity: 0.52,
          nightMode: "glowing",
        },
        {
          hour: 1,
          mood: "late-night",
          beamColor: [218, 228, 252],
          beamAngleDeg: -6,
          beamOpacity: 0.6,
          haloPrimary: [196, 206, 250],
          haloAccentColor: "rgba(79,70,229,0.40)",
          intensity: 0.5,
          nightMode: "glowing",
        },
        {
          hour: 1.5,
          mood: "late-night",
          beamColor: [216, 224, 250],
          beamAngleDeg: -4,
          beamOpacity: 0.58,
          haloPrimary: [194, 202, 248],
          haloAccentColor: "rgba(79,70,229,0.38)",
          intensity: 0.48,
          nightMode: "glowing",
        },
        {
          hour: 2,
          mood: "deep-night",
          beamColor: [212, 220, 248],
          beamAngleDeg: -2,
          beamOpacity: 0.55,
          haloPrimary: [192, 200, 246],
          haloAccentColor: "rgba(67,56,202,0.40)",
          intensity: 0.46,
          nightMode: "glowing",
        },
        {
          hour: 2.5,
          mood: "deep-night",
          beamColor: [210, 218, 246],
          beamAngleDeg: 0,
          beamOpacity: 0.55,
          haloPrimary: [190, 198, 244],
          haloAccentColor: "rgba(67,56,202,0.40)",
          intensity: 0.46,
          nightMode: "glowing",
        },
        {
          hour: 3,
          mood: "deep-night",
          beamColor: [212, 220, 248],
          beamAngleDeg: 4,
          beamOpacity: 0.55,
          haloPrimary: [192, 200, 246],
          haloAccentColor: "rgba(67,56,202,0.40)",
          intensity: 0.46,
          nightMode: "glowing",
        },
        {
          hour: 3.5,
          mood: "deep-night",
          beamColor: [216, 224, 250],
          beamAngleDeg: 8,
          beamOpacity: 0.58,
          haloPrimary: [194, 202, 248],
          haloAccentColor: "rgba(67,56,202,0.42)",
          intensity: 0.48,
          nightMode: "glowing",
        },
        {
          hour: 4,
          mood: "pre-dawn",
          beamColor: [222, 230, 252],
          beamAngleDeg: 12,
          beamOpacity: 0.62,
          haloPrimary: [200, 208, 252],
          haloAccentColor: "rgba(99,102,241,0.45)",
          intensity: 0.52,
          nightMode: "glowing",
        },
        {
          hour: 4.5,
          mood: "pre-dawn",
          beamColor: [232, 220, 232],
          beamAngleDeg: 18,
          beamOpacity: 0.66,
          haloPrimary: [216, 200, 220],
          haloAccentColor: "rgba(165,180,252,0.50)",
          intensity: 0.58,
          nightMode: "glowing",
        },
        {
          hour: 5,
          mood: "dawn-blush",
          beamColor: [255, 198, 178],
          beamAngleDeg: 25,
          beamOpacity: 0.72,
          haloPrimary: [255, 200, 180],
          haloAccentColor: "rgba(165,180,252,0.55)",
          intensity: 0.68,
          nightMode: "glowing",
        },
        {
          hour: 5.5,
          mood: "dawn-rose",
          beamColor: [255, 192, 168],
          beamAngleDeg: -55,
          beamOpacity: 0.75,
          haloPrimary: [255, 198, 178],
          haloAccentColor: "rgba(165,180,252,0.50)",
          intensity: 0.74,
          nightMode: null,
        },
        {
          hour: 6,
          mood: "sunrise",
          beamColor: [255, 214, 153],
          beamAngleDeg: -50,
          beamOpacity: 0.8,
          haloPrimary: [255, 200, 140],
          haloAccentColor: "rgba(165,180,252,0.45)",
          intensity: 0.78,
          nightMode: null,
        },
        {
          hour: 6.5,
          mood: "sunrise-warming",
          beamColor: [255, 220, 168],
          beamAngleDeg: -45,
          beamOpacity: 0.84,
          haloPrimary: [255, 210, 158],
          haloAccentColor: "rgba(165,180,252,0.30)",
          intensity: 0.82,
          nightMode: null,
        },
        {
          hour: 7,
          mood: "morning-gold",
          beamColor: [255, 230, 184],
          beamAngleDeg: -38,
          beamOpacity: 0.86,
          haloPrimary: [255, 220, 174],
          intensity: 0.84,
          nightMode: null,
        },
        {
          hour: 7.5,
          mood: "morning",
          beamColor: [255, 234, 192],
          beamAngleDeg: -32,
          beamOpacity: 0.88,
          haloPrimary: [255, 226, 184],
          intensity: 0.86,
          nightMode: null,
        },
        {
          hour: 8,
          mood: "morning",
          beamColor: [255, 238, 200],
          beamAngleDeg: -28,
          beamOpacity: 0.9,
          haloPrimary: [255, 232, 196],
          intensity: 0.88,
          nightMode: null,
        },
        {
          hour: 8.5,
          mood: "morning-fresh",
          beamColor: [255, 242, 208],
          beamAngleDeg: -24,
          beamOpacity: 0.91,
          haloPrimary: [255, 238, 204],
          intensity: 0.89,
          nightMode: null,
        },
        {
          hour: 9,
          mood: "morning-fresh",
          beamColor: [255, 246, 216],
          beamAngleDeg: -20,
          beamOpacity: 0.92,
          haloPrimary: [255, 242, 212],
          intensity: 0.9,
          nightMode: null,
        },
        {
          hour: 9.5,
          mood: "morning-bright",
          beamColor: [255, 248, 220],
          beamAngleDeg: -16,
          beamOpacity: 0.93,
          haloPrimary: [255, 244, 218],
          intensity: 0.91,
          nightMode: null,
        },
        {
          hour: 10,
          mood: "morning-bright",
          beamColor: [255, 250, 224],
          beamAngleDeg: -12,
          beamOpacity: 0.94,
          haloPrimary: [255, 248, 224],
          intensity: 0.92,
          nightMode: null,
        },
        {
          hour: 10.5,
          mood: "pre-noon",
          beamColor: [255, 251, 225],
          beamAngleDeg: -8,
          beamOpacity: 0.95,
          haloPrimary: [255, 250, 226],
          intensity: 0.93,
          nightMode: null,
        },
        {
          hour: 11,
          mood: "pre-noon",
          beamColor: [255, 252, 226],
          beamAngleDeg: -6,
          beamOpacity: 0.95,
          haloPrimary: [255, 252, 228],
          intensity: 0.94,
          nightMode: null,
        },
        {
          hour: 11.5,
          mood: "almost-noon",
          beamColor: [255, 252, 226],
          beamAngleDeg: -4,
          beamOpacity: 0.95,
          haloPrimary: [255, 252, 228],
          intensity: 0.94,
          nightMode: null,
        },
        {
          hour: 12,
          mood: "noon-zenith",
          beamColor: [255, 250, 225],
          beamAngleDeg: -3,
          beamOpacity: 0.95,
          haloPrimary: [255, 244, 204],
          intensity: 0.95,
          nightMode: null,
        },
        {
          hour: 12.5,
          mood: "noon",
          beamColor: [255, 250, 224],
          beamAngleDeg: 0,
          beamOpacity: 0.95,
          haloPrimary: [255, 244, 204],
          intensity: 0.95,
          nightMode: null,
        },
        {
          hour: 13,
          mood: "after-noon",
          beamColor: [255, 248, 220],
          beamAngleDeg: 4,
          beamOpacity: 0.94,
          haloPrimary: [255, 240, 200],
          intensity: 0.94,
          nightMode: null,
        },
        {
          hour: 13.5,
          mood: "after-noon",
          beamColor: [255, 246, 216],
          beamAngleDeg: 8,
          beamOpacity: 0.94,
          haloPrimary: [255, 238, 196],
          intensity: 0.93,
          nightMode: null,
        },
        {
          hour: 14,
          mood: "afternoon",
          beamColor: [255, 240, 200],
          beamAngleDeg: 12,
          beamOpacity: 0.92,
          haloPrimary: [255, 230, 188],
          intensity: 0.91,
          nightMode: null,
        },
        {
          hour: 14.5,
          mood: "afternoon",
          beamColor: [255, 234, 188],
          beamAngleDeg: 16,
          beamOpacity: 0.91,
          haloPrimary: [255, 224, 178],
          intensity: 0.89,
          nightMode: null,
        },
        {
          hour: 15,
          mood: "afternoon-warm",
          beamColor: [255, 226, 172],
          beamAngleDeg: 22,
          beamOpacity: 0.89,
          haloPrimary: [255, 218, 166],
          intensity: 0.87,
          nightMode: null,
        },
        {
          hour: 15.5,
          mood: "afternoon-warm",
          beamColor: [255, 218, 156],
          beamAngleDeg: 28,
          beamOpacity: 0.88,
          haloPrimary: [255, 212, 154],
          intensity: 0.85,
          nightMode: null,
        },
        {
          hour: 16,
          mood: "late-afternoon",
          beamColor: [255, 208, 138],
          beamAngleDeg: 32,
          beamOpacity: 0.87,
          haloPrimary: [255, 204, 142],
          intensity: 0.83,
          nightMode: null,
        },
        {
          hour: 16.5,
          mood: "late-afternoon",
          beamColor: [255, 196, 118],
          beamAngleDeg: 36,
          beamOpacity: 0.86,
          haloPrimary: [255, 196, 128],
          intensity: 0.81,
          nightMode: null,
        },
        {
          hour: 17,
          mood: "sunset-approach",
          beamColor: [255, 168, 92],
          beamAngleDeg: 40,
          beamOpacity: 0.86,
          haloPrimary: [255, 178, 110],
          haloAccentColor: "rgba(216,180,254,0.30)",
          intensity: 0.83,
          nightMode: null,
        },
        {
          hour: 17.5,
          mood: "sunset-warm",
          beamColor: [255, 148, 78],
          beamAngleDeg: 44,
          beamOpacity: 0.86,
          haloPrimary: [255, 162, 94],
          haloAccentColor: "rgba(216,180,254,0.35)",
          intensity: 0.84,
          nightMode: null,
        },
        {
          hour: 18,
          mood: "sunset",
          beamColor: [255, 140, 80],
          beamAngleDeg: 48,
          beamOpacity: 0.85,
          haloPrimary: [255, 153, 102],
          haloAccentColor: "rgba(216,180,254,0.40)",
          intensity: 0.85,
          nightMode: null,
        },
        {
          hour: 18.5,
          mood: "sunset-fading",
          beamColor: [232, 124, 92],
          beamAngleDeg: 52,
          beamOpacity: 0.82,
          haloPrimary: [240, 142, 110],
          haloAccentColor: "rgba(216,180,254,0.42)",
          intensity: 0.8,
          nightMode: null,
        },
        {
          hour: 19,
          mood: "dusk",
          beamColor: [196, 144, 152],
          beamAngleDeg: 38,
          beamOpacity: 0.74,
          haloPrimary: [212, 158, 168],
          haloAccentColor: "rgba(165,180,252,0.55)",
          intensity: 0.72,
          nightMode: null,
        },
        {
          hour: 19.5,
          mood: "dusk-blue-hour",
          beamColor: [168, 152, 198],
          beamAngleDeg: 22,
          beamOpacity: 0.68,
          haloPrimary: [184, 168, 212],
          haloAccentColor: "rgba(165,180,252,0.60)",
          intensity: 0.65,
          nightMode: null,
        },
        {
          hour: 20,
          mood: "blue-hour",
          beamColor: [148, 152, 220],
          beamAngleDeg: 8,
          beamOpacity: 0.62,
          haloPrimary: [164, 166, 232],
          haloAccentColor: "rgba(99,102,241,0.55)",
          intensity: 0.58,
          nightMode: null,
        },
        {
          hour: 20.5,
          mood: "evening-violet",
          beamColor: [188, 196, 240],
          beamAngleDeg: -8,
          beamOpacity: 0.6,
          haloPrimary: [196, 204, 244],
          haloAccentColor: "rgba(99,102,241,0.50)",
          intensity: 0.58,
          nightMode: "glowing",
        },
        {
          hour: 21,
          mood: "early-night",
          beamColor: [196, 208, 248],
          beamAngleDeg: -14,
          beamOpacity: 0.62,
          haloPrimary: [200, 210, 248],
          haloAccentColor: "rgba(99,102,241,0.50)",
          intensity: 0.58,
          nightMode: "glowing",
        },
        {
          hour: 21.5,
          mood: "early-night",
          beamColor: [202, 214, 250],
          beamAngleDeg: -18,
          beamOpacity: 0.62,
          haloPrimary: [200, 210, 248],
          haloAccentColor: "rgba(99,102,241,0.48)",
          intensity: 0.56,
          nightMode: "glowing",
        },
        {
          hour: 22,
          mood: "night",
          beamColor: [216, 224, 250],
          beamAngleDeg: -22,
          beamOpacity: 0.62,
          haloPrimary: [199, 210, 254],
          haloAccentColor: "rgba(99,102,241,0.50)",
          intensity: 0.56,
          nightMode: "glowing",
        },
        {
          hour: 22.5,
          mood: "night",
          beamColor: [220, 228, 252],
          beamAngleDeg: -20,
          beamOpacity: 0.64,
          haloPrimary: [199, 210, 254],
          haloAccentColor: "rgba(99,102,241,0.48)",
          intensity: 0.56,
          nightMode: "glowing",
        },
        {
          hour: 23,
          mood: "late-night",
          beamColor: [222, 232, 254],
          beamAngleDeg: -16,
          beamOpacity: 0.65,
          haloPrimary: [199, 210, 254],
          haloAccentColor: "rgba(99,102,241,0.46)",
          intensity: 0.55,
          nightMode: "glowing",
        },
        {
          hour: 23.5,
          mood: "almost-midnight",
          beamColor: [222, 232, 254],
          beamAngleDeg: -12,
          beamOpacity: 0.65,
          haloPrimary: [199, 210, 254],
          haloAccentColor: "rgba(79,70,229,0.45)",
          intensity: 0.55,
          nightMode: "glowing",
        },
      ];
      function aa(e, t = 0, n = 1) {
        return Math.max(t, Math.min(n, e));
      }
      function sa(e, t, n) {
        return e + (t - e) * aa(n);
      }
      function ra(e, t, n) {
        const a = aa(n);
        return [
          Math.round(e[0] + (t[0] - e[0]) * a),
          Math.round(e[1] + (t[1] - e[1]) * a),
          Math.round(e[2] + (t[2] - e[2]) * a),
        ];
      }
      function ia(e, t = 1) {
        const n = aa(t);
        return `rgba(${e[0]},${e[1]},${e[2]},${n.toFixed(3)})`;
      }
      function oa(e) {
        return e.getHours();
      }
      function la(e, t = !1) {
        const n = t ? 0.3 : 0.5;
        return Math.min(e, n);
      }
      const ca = [99, 102, 241],
        da = [165, 180, 252];
      function ua(e, t = {}) {
        const n = t.forceTime ?? e,
          a = n.getHours() + n.getMinutes() / 60,
          {
            fromIdx: s,
            toIdx: r,
            factor: i,
          } = (function (e) {
            const t = na.findIndex((t) => t.hour === e);
            if (-1 !== t) return { fromIdx: t, toIdx: t, factor: 0 };
            const n = na.findIndex((t) => t.hour > e);
            if (-1 === n)
              return { fromIdx: 47, toIdx: 0, factor: (e - 23.5) / 0.5 };
            if (0 === n) return { fromIdx: 0, toIdx: 0, factor: 0 };
            const a = n - 1,
              s = na[a],
              r = na[n];
            return {
              fromIdx: a,
              toIdx: n,
              factor: (e - s.hour) / (r.hour - s.hour),
            };
          })(a),
          o = na[s],
          l = na[r],
          c = (function () {
            if ("undefined" == typeof window || !window.matchMedia) return !1;
            try {
              return window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches;
            } catch {
              return !1;
            }
          })(),
          d = (function () {
            if ("undefined" == typeof window || !window.matchMedia) return !1;
            try {
              return window.matchMedia("(prefers-contrast: more)").matches;
            } catch {
              return !1;
            }
          })(),
          u = c ? Math.round(i) : i,
          m = sa(o.beamAngleDeg, l.beamAngleDeg, u),
          p = ra(o.beamColor, l.beamColor, u),
          g = ra(o.haloPrimary, l.haloPrimary, u),
          h = sa(o.beamOpacity, l.beamOpacity, u) * (t.intensityMul ?? 1),
          f = sa(o.intensity, l.intensity, u) * (t.intensityMul ?? 1),
          _ = d ? Math.min(f, 0.3) : f,
          v = i < 0.5 ? o.nightMode : l.nightMode,
          y = void 0 !== t.forceNightMode ? t.forceNightMode : v,
          b = i < 0.5 ? o.haloAccentColor : l.haloAccentColor,
          A = t.skipCssStrings ?? !1;
        return {
          hour: a,
          mood: u < 0.5 ? o.mood : l.mood,
          beam: {
            type: "glowing" === y ? "moon" : "sun",
            color: p,
            cssColor: A ? void 0 : ia(p, h),
            angleDeg: m,
            opacity: h,
          },
          sun: {
            visible: null === y,
            opacity: null === y ? h : 0,
            x: 50,
            y: 20,
          },
          moon: {
            visible: null !== y,
            opacity: null !== y ? h : 0,
            x: 50,
            y: 20,
          },
          ambient: { primary: 0.3 * _, secondary: 0.2 * _, tertiary: 0.1 * _ },
          starOpacityMul: null !== y ? 1 : 0,
          starDensity: null !== y ? "dense" : "sparse",
          haloX: 50,
          haloY: 20,
          colors: {
            primary: g,
            secondary: p,
            tertiary: ca,
            rays: p,
            accent: da,
          },
          frameIndex: oa(n),
          nightMode: y,
          haloAccentColor: b,
          isReducedMotion: c,
          isHighContrast: d,
          readingZoneIntensityCap: la(f, d),
        };
      }
      const ma = Q(null);
      function pa({ enabled: e = !0, children: t }) {
        const [n, a] = ue(() => ua(new Date()));
        return (
          pe(() => {
            if (!e) return;
            const t = () => a(ua(new Date()));
            t();
            const n = setInterval(t, 3e4);
            return () => clearInterval(n);
          }, [e]),
          ft(ma.Provider, { value: { preset: n, enabled: e }, children: t })
        );
      }
      function ga() {
        return ye(ma) || { preset: ua(new Date()), enabled: !1 };
      }
      function ha() {
        const { preset: e, enabled: t } = ga();
        if (!t) return null;
        const n = ia(e.beam.color, e.beam.opacity),
          a = ia(e.colors.primary, 0.5 * e.beam.opacity),
          s = e.haloAccentColor;
        return ft("div", {
          "aria-hidden": "true",
          className: "ambient-light-layer",
          style: {
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            zIndex: 1,
            overflow: "hidden",
          },
          children: [
            ft("div", {
              style: {
                position: "absolute",
                top: -100,
                left: -100,
                width: 360,
                height: 360,
                background: s
                  ? `radial-gradient(circle, ${a} 0%, ${s} 40%, transparent 70%)`
                  : `radial-gradient(circle, ${a}, transparent 60%)`,
                filter: "blur(30px)",
                mixBlendMode: "screen",
                transition: "background 4s cubic-bezier(0.4,0,0.2,1)",
              },
            }),
            ft("div", {
              style: {
                position: "absolute",
                top: "50%",
                left: "-15%",
                width: "130%",
                height: 1.5,
                background: `linear-gradient(90deg, transparent, ${n} 50%, transparent)`,
                boxShadow: `0 0 12px ${n}, 0 0 32px ${n}`,
                transform: `rotate(${e.beam.angleDeg}deg)`,
                transition:
                  "transform 4s cubic-bezier(0.4,0,0.2,1), background 4s, box-shadow 4s",
              },
            }),
          ],
        });
      }
      function fa() {
        const { preset: e, enabled: t } = ga();
        return t
          ? ft("div", {
              "aria-hidden": "true",
              className: "sunflower-mascot",
              style: {
                position: "fixed",
                bottom: 14,
                right: 14,
                width: 56,
                height: 56,
                backgroundImage: `url(/assets/ambient/${"glowing" === e.nightMode ? "sunflower-night.webp" : "sunflower-day.webp"})`,
                backgroundSize: "336px auto",
                backgroundPosition: `-${((e.frameIndex ?? 0) % 6) * 56}px -${56 * Math.floor((e.frameIndex ?? 0) / 6)}px`,
                backgroundRepeat: "no-repeat",
                zIndex: 2,
                pointerEvents: "none",
                opacity: e.beam.opacity,
                transition:
                  "opacity 4s cubic-bezier(0.4,0,0.2,1), background-position 4s",
              },
            })
          : null;
      }
      const _a = "ambient_lighting_enabled";
      function va() {
        const e = vt.storage;
        if (!e) return null;
        const t = e.session;
        return t && "function" == typeof t.get ? t : null;
      }
      const ya = document.getElementById("root");
      ya &&
        (function (e) {
          return {
            render: function (t) {
              st(t, e);
            },
            unmount: function () {
              pt(e);
            },
          };
        })(ya).render(
          ft(() => {
            const [e, t] = ue(null),
              [n, a] = ue(null),
              [s, r] = ue(!1),
              [i, o] = ue("loading"),
              [l, c] = ue(null),
              [d, u] = ue(null),
              [m, p] = ue(!1),
              [g, h] = ue(null),
              [f, _] = ue(null),
              [v, y] = ue(!0);
            async function b() {
              try {
                const e = await vt.runtime.sendMessage({ action: "GET_PLAN" });
                e.success && e.plan && u(e.plan);
              } catch {}
            }
            (pe(() => {
              const e = vt.storage?.local;
              e?.get &&
                e
                  .get(_a)
                  .then((e) => {
                    const t = e?.[_a];
                    !1 === t && y(!1);
                  })
                  .catch(() => {});
            }, []),
              pe(() => {
                const e = va();
                e
                  ? Promise.all([
                      e
                        .get("voicePanelContext")
                        .then((e) => e?.voicePanelContext ?? null)
                        .catch(() => null),
                      e
                        .get("pendingVoiceCall")
                        .then((e) => e?.pendingVoiceCall ?? null)
                        .catch(() => null),
                    ])
                      .then(([n, s]) => {
                        (t(n),
                          s?.videoId &&
                            (a(s),
                            e.remove?.("pendingVoiceCall").catch(() => {})));
                      })
                      .finally(() => r(!0))
                  : r(!0);
              }, []),
              pe(() => {
                const e = (function () {
                    const e = vt.storage;
                    if (!e) return null;
                    const t = e.onChanged;
                    return t?.addListener ? t : null;
                  })(),
                  t = va();
                if (!e || !t) return;
                const n = (e, n) => {
                  if ("session" !== n) return;
                  const s = e.pendingVoiceCall;
                  if (!s) return;
                  const r = s.newValue;
                  r?.videoId &&
                    (a(r), t.remove?.("pendingVoiceCall").catch(() => {}));
                };
                return (
                  e.addListener(n),
                  () => {
                    e.removeListener?.(n);
                  }
                );
              }, []),
              pe(() => {
                !s ||
                  e ||
                  n ||
                  (async function () {
                    try {
                      const e = await vt.runtime.sendMessage({
                        action: "CHECK_AUTH",
                      });
                      e.authenticated && e.user
                        ? (c(e.user), p(!1), await b(), o("main"))
                        : o("login");
                    } catch {
                      o("login");
                    }
                  })();
              }, [s, e, n]),
              pe(() => {
                if (!f) return;
                const e = setTimeout(() => _(null), 3e3);
                return () => clearTimeout(e);
              }, [f]));
            const A = ve(async (e, t) => {
                h(null);
                const n = await vt.runtime.sendMessage({
                  action: "LOGIN",
                  data: { email: e, password: t },
                });
                if (!n.success || !n.user)
                  throw new Error(n.error || "Login failed");
                (c(n.user), p(!1), await b(), o("main"));
              }, []),
              x = ve(async () => {
                h(null);
                const e = await vt.runtime.sendMessage({
                  action: "GOOGLE_LOGIN",
                });
                if (!e.success || !e.user)
                  throw new Error(e.error || "Google login failed");
                (c(e.user), p(!1), await b(), o("main"));
              }, []),
              w = ve(() => {
                (p(!0), c(null), u(null), o("main"));
              }, []),
              k = ve(async () => {
                (await vt.runtime.sendMessage({ action: "LOGOUT" }),
                  c(null),
                  u(null),
                  p(!1),
                  o("login"));
              }, []),
              C = ve(() => {
                (p(!1), o("login"));
              }, []),
              N = ve((e) => {
                _({ message: e, type: "error" });
              }, []);
            return ft(
              pa,
              s
                ? e || n
                  ? {
                      enabled: v,
                      children: [
                        ft(ha, {}),
                        ft(fa, {}),
                        ft(Kn, { context: e, pendingCall: n }),
                      ],
                    }
                  : {
                      enabled: v,
                      children: [
                        ft(ha, {}),
                        ft(fa, {}),
                        ft("div", {
                          className: "app-container noise-overlay ambient-glow",
                          style: { position: "relative" },
                          children: [
                            ft(Jn, {
                              variant:
                                "loading" === i || "login" === i
                                  ? "default"
                                  : "main" === i
                                    ? "AI"
                                    : "default",
                            }),
                            ft("div", {
                              style: { position: "relative", zIndex: 1 },
                              children: [
                                f &&
                                  ft("div", {
                                    className: `ds-toast ds-toast-${f.type}`,
                                    onClick: () => _(null),
                                    children: f.message,
                                  }),
                                "loading" === i &&
                                  ft("div", {
                                    className: "loading-view",
                                    children: ft(Lt, {
                                      size: "md",
                                      speed: "normal",
                                      showLabel: !0,
                                      label: "DeepSight",
                                    }),
                                  }),
                                "login" === i &&
                                  ft(Rt, {
                                    onLogin: A,
                                    onGoogleLogin: x,
                                    onGuestMode: w,
                                    error: g,
                                  }),
                                "main" === i &&
                                  ft(_n, {
                                    user: l,
                                    planInfo: d,
                                    isGuest: m,
                                    onLogout: k,
                                    onLoginRedirect: C,
                                    onError: N,
                                  }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    }
                : {
                    enabled: v,
                    children: [
                      ft(ha, {}),
                      ft(fa, {}),
                      ft("div", {
                        className: "app-container",
                        children: ft("div", {
                          className: "loading-view",
                          children: ft(Lt, { size: "md", speed: "normal" }),
                        }),
                      }),
                    ],
                  },
            );
          }, {}),
        );
    })());
})();
