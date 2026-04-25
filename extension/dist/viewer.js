(() => {
  var e = {
      815(e, n) {
        var t, r;
        ("undefined" != typeof globalThis
          ? globalThis
          : "undefined" != typeof self && self,
          (t = function (e) {
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
              const n =
                  "The message port closed before a response was received.",
                t = (e) => {
                  const t = {
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
                  if (0 === Object.keys(t).length)
                    throw new Error(
                      "api-metadata.json has not been included in browser-polyfill",
                    );
                  class r extends WeakMap {
                    constructor(e, n = void 0) {
                      (super(n), (this.createItem = e));
                    }
                    get(e) {
                      return (
                        this.has(e) || this.set(e, this.createItem(e)),
                        super.get(e)
                      );
                    }
                  }
                  const s =
                      (n, t) =>
                      (...r) => {
                        e.runtime.lastError
                          ? n.reject(new Error(e.runtime.lastError.message))
                          : t.singleCallbackArg ||
                              (r.length <= 1 && !1 !== t.singleCallbackArg)
                            ? n.resolve(r[0])
                            : n.resolve(r);
                      },
                    i = (e) => (1 == e ? "argument" : "arguments"),
                    o = (e, n, t) =>
                      new Proxy(n, { apply: (n, r, s) => t.call(r, e, ...s) });
                  let a = Function.call.bind(Object.prototype.hasOwnProperty);
                  const l = (e, n = {}, t = {}) => {
                      let r = Object.create(null),
                        _ = {
                          has: (n, t) => t in e || t in r,
                          get(_, c, u) {
                            if (c in r) return r[c];
                            if (!(c in e)) return;
                            let m = e[c];
                            if ("function" == typeof m)
                              if ("function" == typeof n[c])
                                m = o(e, e[c], n[c]);
                              else if (a(t, c)) {
                                let n = ((e, n) =>
                                  function (t, ...r) {
                                    if (r.length < n.minArgs)
                                      throw new Error(
                                        `Expected at least ${n.minArgs} ${i(n.minArgs)} for ${e}(), got ${r.length}`,
                                      );
                                    if (r.length > n.maxArgs)
                                      throw new Error(
                                        `Expected at most ${n.maxArgs} ${i(n.maxArgs)} for ${e}(), got ${r.length}`,
                                      );
                                    return new Promise((i, o) => {
                                      if (n.fallbackToNoCallback)
                                        try {
                                          t[e](
                                            ...r,
                                            s({ resolve: i, reject: o }, n),
                                          );
                                        } catch (s) {
                                          (console.warn(
                                            `${e} API method doesn't seem to support the callback parameter, falling back to call it without a callback: `,
                                            s,
                                          ),
                                            t[e](...r),
                                            (n.fallbackToNoCallback = !1),
                                            (n.noCallback = !0),
                                            i());
                                        }
                                      else
                                        n.noCallback
                                          ? (t[e](...r), i())
                                          : t[e](
                                              ...r,
                                              s({ resolve: i, reject: o }, n),
                                            );
                                    });
                                  })(c, t[c]);
                                m = o(e, e[c], n);
                              } else m = m.bind(e);
                            else if (
                              "object" == typeof m &&
                              null !== m &&
                              (a(n, c) || a(t, c))
                            )
                              m = l(m, n[c], t[c]);
                            else {
                              if (!a(t, "*"))
                                return (
                                  Object.defineProperty(r, c, {
                                    configurable: !0,
                                    enumerable: !0,
                                    get: () => e[c],
                                    set(n) {
                                      e[c] = n;
                                    },
                                  }),
                                  m
                                );
                              m = l(m, n[c], t["*"]);
                            }
                            return ((r[c] = m), m);
                          },
                          set: (n, t, s, i) => (
                            t in r ? (r[t] = s) : (e[t] = s),
                            !0
                          ),
                          defineProperty: (e, n, t) =>
                            Reflect.defineProperty(r, n, t),
                          deleteProperty: (e, n) =>
                            Reflect.deleteProperty(r, n),
                        },
                        c = Object.create(e);
                      return new Proxy(c, _);
                    },
                    _ = (e) => ({
                      addListener(n, t, ...r) {
                        n.addListener(e.get(t), ...r);
                      },
                      hasListener: (n, t) => n.hasListener(e.get(t)),
                      removeListener(n, t) {
                        n.removeListener(e.get(t));
                      },
                    }),
                    c = new r((e) =>
                      "function" != typeof e
                        ? e
                        : function (n) {
                            const t = l(
                              n,
                              {},
                              { getContent: { minArgs: 0, maxArgs: 0 } },
                            );
                            e(t);
                          },
                    ),
                    u = new r((e) =>
                      "function" != typeof e
                        ? e
                        : function (n, t, r) {
                            let s,
                              i,
                              o = !1,
                              a = new Promise((e) => {
                                s = function (n) {
                                  ((o = !0), e(n));
                                };
                              });
                            try {
                              i = e(n, t, s);
                            } catch (e) {
                              i = Promise.reject(e);
                            }
                            const l =
                              !0 !== i &&
                              (_ = i) &&
                              "object" == typeof _ &&
                              "function" == typeof _.then;
                            var _;
                            if (!0 !== i && !l && !o) return !1;
                            return (
                              (l ? i : a)
                                .then(
                                  (e) => {
                                    r(e);
                                  },
                                  (e) => {
                                    let n;
                                    ((n =
                                      e &&
                                      (e instanceof Error ||
                                        "string" == typeof e.message)
                                        ? e.message
                                        : "An unexpected error occurred"),
                                      r({
                                        __mozWebExtensionPolyfillReject__: !0,
                                        message: n,
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
                    m = ({ reject: t, resolve: r }, s) => {
                      e.runtime.lastError
                        ? e.runtime.lastError.message === n
                          ? r()
                          : t(new Error(e.runtime.lastError.message))
                        : s && s.__mozWebExtensionPolyfillReject__
                          ? t(new Error(s.message))
                          : r(s);
                    },
                    g = (e, n, t, ...r) => {
                      if (r.length < n.minArgs)
                        throw new Error(
                          `Expected at least ${n.minArgs} ${i(n.minArgs)} for ${e}(), got ${r.length}`,
                        );
                      if (r.length > n.maxArgs)
                        throw new Error(
                          `Expected at most ${n.maxArgs} ${i(n.maxArgs)} for ${e}(), got ${r.length}`,
                        );
                      return new Promise((e, n) => {
                        const s = m.bind(null, { resolve: e, reject: n });
                        (r.push(s), t.sendMessage(...r));
                      });
                    },
                    f = {
                      devtools: { network: { onRequestFinished: _(c) } },
                      runtime: {
                        onMessage: _(u),
                        onMessageExternal: _(u),
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
                    d = {
                      clear: { minArgs: 1, maxArgs: 1 },
                      get: { minArgs: 1, maxArgs: 1 },
                      set: { minArgs: 1, maxArgs: 1 },
                    };
                  return (
                    (t.privacy = {
                      network: { "*": d },
                      services: { "*": d },
                      websites: { "*": d },
                    }),
                    l(e, f, t)
                  );
                };
              e.exports = t(chrome);
            }
          }),
          void 0 === (r = t.apply(n, [e])) || (e.exports = r));
      },
    },
    n = {};
  function t(r) {
    var s = n[r];
    if (void 0 !== s) return s.exports;
    var i = (n[r] = { exports: {} });
    return (e[r].call(i.exports, i, i.exports, t), i.exports);
  }
  ((t.n = (e) => {
    var n = e && e.__esModule ? () => e.default : () => e;
    return (t.d(n, { a: n }), n);
  }),
    (t.d = (e, n) => {
      for (var r in n)
        t.o(n, r) &&
          !t.o(e, r) &&
          Object.defineProperty(e, r, { enumerable: !0, get: n[r] });
    }),
    (t.o = (e, n) => Object.prototype.hasOwnProperty.call(e, n)),
    (() => {
      "use strict";
      var e,
        n,
        r,
        s,
        i,
        o,
        a,
        l,
        _,
        c,
        u,
        m,
        g,
        f,
        d = {},
        p = [],
        h = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,
        A = Array.isArray;
      function v(e, n) {
        for (var t in n) e[t] = n[t];
        return e;
      }
      function b(e) {
        e && e.parentNode && e.parentNode.removeChild(e);
      }
      function y(n, t, r) {
        var s,
          i,
          o,
          a = {};
        for (o in t)
          "key" == o ? (s = t[o]) : "ref" == o ? (i = t[o]) : (a[o] = t[o]);
        if (
          (arguments.length > 2 &&
            (a.children = arguments.length > 3 ? e.call(arguments, 2) : r),
          "function" == typeof n && null != n.defaultProps)
        )
          for (o in n.defaultProps)
            void 0 === a[o] && (a[o] = n.defaultProps[o]);
        return x(n, a, s, i, null);
      }
      function x(e, t, s, i, o) {
        var a = {
          type: e,
          props: t,
          key: s,
          ref: i,
          __k: null,
          __: null,
          __b: 0,
          __e: null,
          __c: null,
          constructor: void 0,
          __v: null == o ? ++r : o,
          __i: -1,
          __u: 0,
        };
        return (null == o && null != n.vnode && n.vnode(a), a);
      }
      function k(e) {
        return e.children;
      }
      function w(e, n) {
        ((this.props = e), (this.context = n));
      }
      function N(e, n) {
        if (null == n) return e.__ ? N(e.__, e.__i + 1) : null;
        for (var t; n < e.__k.length; n++)
          if (null != (t = e.__k[n]) && null != t.__e) return t.__e;
        return "function" == typeof e.type ? N(e) : null;
      }
      function S(e) {
        if (e.__P && e.__d) {
          var t = e.__v,
            r = t.__e,
            s = [],
            i = [],
            o = v({}, t);
          ((o.__v = t.__v + 1),
            n.vnode && n.vnode(o),
            M(
              e.__P,
              o,
              t,
              e.__n,
              e.__P.namespaceURI,
              32 & t.__u ? [r] : null,
              s,
              null == r ? N(t) : r,
              !!(32 & t.__u),
              i,
            ),
            (o.__v = t.__v),
            (o.__.__k[o.__i] = o),
            H(s, o, i),
            (t.__e = t.__ = null),
            o.__e != r && P(o));
        }
      }
      function P(e) {
        if (null != (e = e.__) && null != e.__c)
          return (
            (e.__e = e.__c.base = null),
            e.__k.some(function (n) {
              if (null != n && null != n.__e)
                return (e.__e = e.__c.base = n.__e);
            }),
            P(e)
          );
      }
      function C(e) {
        ((!e.__d && (e.__d = !0) && s.push(e) && !E.__r++) ||
          i != n.debounceRendering) &&
          ((i = n.debounceRendering) || o)(E);
      }
      function E() {
        try {
          for (var e, n = 1; s.length; )
            (s.length > n && s.sort(a), (e = s.shift()), (n = s.length), S(e));
        } finally {
          s.length = E.__r = 0;
        }
      }
      function T(e, n, t, r, s, i, o, a, l, _, c) {
        var u,
          m,
          g,
          f,
          h,
          A,
          v,
          b = (r && r.__k) || p,
          y = n.length;
        for (l = I(t, n, b, l, y), u = 0; u < y; u++)
          null != (g = t.__k[u]) &&
            ((m = (-1 != g.__i && b[g.__i]) || d),
            (g.__i = u),
            (A = M(e, g, m, s, i, o, a, l, _, c)),
            (f = g.__e),
            g.ref &&
              m.ref != g.ref &&
              (m.ref && B(m.ref, null, g), c.push(g.ref, g.__c || f, g)),
            null == h && null != f && (h = f),
            (v = !!(4 & g.__u)) || m.__k === g.__k
              ? ((l = $(g, l, e, v)), v && m.__e && (m.__e = null))
              : "function" == typeof g.type && void 0 !== A
                ? (l = A)
                : f && (l = f.nextSibling),
            (g.__u &= -7));
        return ((t.__e = h), l);
      }
      function I(e, n, t, r, s) {
        var i,
          o,
          a,
          l,
          _,
          c = t.length,
          u = c,
          m = 0;
        for (e.__k = new Array(s), i = 0; i < s; i++)
          null != (o = n[i]) && "boolean" != typeof o && "function" != typeof o
            ? ("string" == typeof o ||
              "number" == typeof o ||
              "bigint" == typeof o ||
              o.constructor == String
                ? (o = e.__k[i] = x(null, o, null, null, null))
                : A(o)
                  ? (o = e.__k[i] = x(k, { children: o }, null, null, null))
                  : void 0 === o.constructor && o.__b > 0
                    ? (o = e.__k[i] =
                        x(o.type, o.props, o.key, o.ref ? o.ref : null, o.__v))
                    : (e.__k[i] = o),
              (l = i + m),
              (o.__ = e),
              (o.__b = e.__b + 1),
              (a = null),
              -1 != (_ = o.__i = R(o, t, l, u)) &&
                (u--, (a = t[_]) && (a.__u |= 2)),
              null == a || null == a.__v
                ? (-1 == _ && (s > c ? m-- : s < c && m++),
                  "function" != typeof o.type && (o.__u |= 4))
                : _ != l &&
                  (_ == l - 1
                    ? m--
                    : _ == l + 1
                      ? m++
                      : (_ > l ? m-- : m++, (o.__u |= 4))))
            : (e.__k[i] = null);
        if (u)
          for (i = 0; i < c; i++)
            null != (a = t[i]) &&
              !(2 & a.__u) &&
              (a.__e == r && (r = N(a)), V(a, a));
        return r;
      }
      function $(e, n, t, r) {
        var s, i;
        if ("function" == typeof e.type) {
          for (s = e.__k, i = 0; s && i < s.length; i++)
            s[i] && ((s[i].__ = e), (n = $(s[i], n, t, r)));
          return n;
        }
        e.__e != n &&
          (r &&
            (n && e.type && !n.parentNode && (n = N(e)),
            t.insertBefore(e.__e, n || null)),
          (n = e.__e));
        do {
          n = n && n.nextSibling;
        } while (null != n && 8 == n.nodeType);
        return n;
      }
      function L(e, n) {
        return (
          (n = n || []),
          null == e ||
            "boolean" == typeof e ||
            (A(e)
              ? e.some(function (e) {
                  L(e, n);
                })
              : n.push(e)),
          n
        );
      }
      function R(e, n, t, r) {
        var s,
          i,
          o,
          a = e.key,
          l = e.type,
          _ = n[t],
          c = null != _ && !(2 & _.__u);
        if ((null === _ && null == a) || (c && a == _.key && l == _.type))
          return t;
        if (r > (c ? 1 : 0))
          for (s = t - 1, i = t + 1; s >= 0 || i < n.length; )
            if (
              null != (_ = n[(o = s >= 0 ? s-- : i++)]) &&
              !(2 & _.__u) &&
              a == _.key &&
              l == _.type
            )
              return o;
        return -1;
      }
      function U(e, n, t) {
        "-" == n[0]
          ? e.setProperty(n, null == t ? "" : t)
          : (e[n] =
              null == t
                ? ""
                : "number" != typeof t || h.test(n)
                  ? t
                  : t + "px");
      }
      function O(e, n, t, r, s) {
        var i, o;
        e: if ("style" == n)
          if ("string" == typeof t) e.style.cssText = t;
          else {
            if (("string" == typeof r && (e.style.cssText = r = ""), r))
              for (n in r) (t && n in t) || U(e.style, n, "");
            if (t) for (n in t) (r && t[n] == r[n]) || U(e.style, n, t[n]);
          }
        else if ("o" == n[0] && "n" == n[1])
          ((i = n != (n = n.replace(u, "$1"))),
            (o = n.toLowerCase()),
            (n =
              o in e || "onFocusOut" == n || "onFocusIn" == n
                ? o.slice(2)
                : n.slice(2)),
            e.l || (e.l = {}),
            (e.l[n + i] = t),
            t
              ? r
                ? (t[c] = r[c])
                : ((t[c] = m), e.addEventListener(n, i ? f : g, i))
              : e.removeEventListener(n, i ? f : g, i));
        else {
          if ("http://www.w3.org/2000/svg" == s)
            n = n.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
          else if (
            "width" != n &&
            "height" != n &&
            "href" != n &&
            "list" != n &&
            "form" != n &&
            "tabIndex" != n &&
            "download" != n &&
            "rowSpan" != n &&
            "colSpan" != n &&
            "role" != n &&
            "popover" != n &&
            n in e
          )
            try {
              e[n] = null == t ? "" : t;
              break e;
            } catch (e) {}
          "function" == typeof t ||
            (null == t || (!1 === t && "-" != n[4])
              ? e.removeAttribute(n)
              : e.setAttribute(n, "popover" == n && 1 == t ? "" : t));
        }
      }
      function F(e) {
        return function (t) {
          if (this.l) {
            var r = this.l[t.type + e];
            if (null == t[_]) t[_] = m++;
            else if (t[_] < r[c]) return;
            return r(n.event ? n.event(t) : t);
          }
        };
      }
      function M(e, t, r, s, i, o, a, l, _, c) {
        var u,
          m,
          g,
          f,
          d,
          h,
          y,
          x,
          N,
          S,
          P,
          C,
          E,
          I,
          $,
          L = t.type;
        if (void 0 !== t.constructor) return null;
        (128 & r.__u && ((_ = !!(32 & r.__u)), (o = [(l = t.__e = r.__e)])),
          (u = n.__b) && u(t));
        e: if ("function" == typeof L)
          try {
            if (
              ((x = t.props),
              (N = L.prototype && L.prototype.render),
              (S = (u = L.contextType) && s[u.__c]),
              (P = u ? (S ? S.props.value : u.__) : s),
              r.__c
                ? (y = (m = t.__c = r.__c).__ = m.__E)
                : (N
                    ? (t.__c = m = new L(x, P))
                    : ((t.__c = m = new w(x, P)),
                      (m.constructor = L),
                      (m.render = q)),
                  S && S.sub(m),
                  m.state || (m.state = {}),
                  (m.__n = s),
                  (g = m.__d = !0),
                  (m.__h = []),
                  (m._sb = [])),
              N && null == m.__s && (m.__s = m.state),
              N &&
                null != L.getDerivedStateFromProps &&
                (m.__s == m.state && (m.__s = v({}, m.__s)),
                v(m.__s, L.getDerivedStateFromProps(x, m.__s))),
              (f = m.props),
              (d = m.state),
              (m.__v = t),
              g)
            )
              (N &&
                null == L.getDerivedStateFromProps &&
                null != m.componentWillMount &&
                m.componentWillMount(),
                N &&
                  null != m.componentDidMount &&
                  m.__h.push(m.componentDidMount));
            else {
              if (
                (N &&
                  null == L.getDerivedStateFromProps &&
                  x !== f &&
                  null != m.componentWillReceiveProps &&
                  m.componentWillReceiveProps(x, P),
                t.__v == r.__v ||
                  (!m.__e &&
                    null != m.shouldComponentUpdate &&
                    !1 === m.shouldComponentUpdate(x, m.__s, P)))
              ) {
                (t.__v != r.__v &&
                  ((m.props = x), (m.state = m.__s), (m.__d = !1)),
                  (t.__e = r.__e),
                  (t.__k = r.__k),
                  t.__k.some(function (e) {
                    e && (e.__ = t);
                  }),
                  p.push.apply(m.__h, m._sb),
                  (m._sb = []),
                  m.__h.length && a.push(m));
                break e;
              }
              (null != m.componentWillUpdate &&
                m.componentWillUpdate(x, m.__s, P),
                N &&
                  null != m.componentDidUpdate &&
                  m.__h.push(function () {
                    m.componentDidUpdate(f, d, h);
                  }));
            }
            if (
              ((m.context = P),
              (m.props = x),
              (m.__P = e),
              (m.__e = !1),
              (C = n.__r),
              (E = 0),
              N)
            )
              ((m.state = m.__s),
                (m.__d = !1),
                C && C(t),
                (u = m.render(m.props, m.state, m.context)),
                p.push.apply(m.__h, m._sb),
                (m._sb = []));
            else
              do {
                ((m.__d = !1),
                  C && C(t),
                  (u = m.render(m.props, m.state, m.context)),
                  (m.state = m.__s));
              } while (m.__d && ++E < 25);
            ((m.state = m.__s),
              null != m.getChildContext &&
                (s = v(v({}, s), m.getChildContext())),
              N &&
                !g &&
                null != m.getSnapshotBeforeUpdate &&
                (h = m.getSnapshotBeforeUpdate(f, d)),
              (I =
                null != u && u.type === k && null == u.key
                  ? W(u.props.children)
                  : u),
              (l = T(e, A(I) ? I : [I], t, r, s, i, o, a, l, _, c)),
              (m.base = t.__e),
              (t.__u &= -161),
              m.__h.length && a.push(m),
              y && (m.__E = m.__ = null));
          } catch (e) {
            if (((t.__v = null), _ || null != o))
              if (e.then) {
                for (
                  t.__u |= _ ? 160 : 128;
                  l && 8 == l.nodeType && l.nextSibling;
                )
                  l = l.nextSibling;
                ((o[o.indexOf(l)] = null), (t.__e = l));
              } else {
                for ($ = o.length; $--; ) b(o[$]);
                D(t);
              }
            else ((t.__e = r.__e), (t.__k = r.__k), e.then || D(t));
            n.__e(e, t, r);
          }
        else
          null == o && t.__v == r.__v
            ? ((t.__k = r.__k), (t.__e = r.__e))
            : (l = t.__e = j(r.__e, t, r, s, i, o, a, _, c));
        return ((u = n.diffed) && u(t), 128 & t.__u ? void 0 : l);
      }
      function D(e) {
        e && (e.__c && (e.__c.__e = !0), e.__k && e.__k.some(D));
      }
      function H(e, t, r) {
        for (var s = 0; s < r.length; s++) B(r[s], r[++s], r[++s]);
        (n.__c && n.__c(t, e),
          e.some(function (t) {
            try {
              ((e = t.__h),
                (t.__h = []),
                e.some(function (e) {
                  e.call(t);
                }));
            } catch (e) {
              n.__e(e, t.__v);
            }
          }));
      }
      function W(e) {
        return "object" != typeof e || null == e || e.__b > 0
          ? e
          : A(e)
            ? e.map(W)
            : v({}, e);
      }
      function j(t, r, s, i, o, a, l, _, c) {
        var u,
          m,
          g,
          f,
          p,
          h,
          v,
          y = s.props || d,
          x = r.props,
          k = r.type;
        if (
          ("svg" == k
            ? (o = "http://www.w3.org/2000/svg")
            : "math" == k
              ? (o = "http://www.w3.org/1998/Math/MathML")
              : o || (o = "http://www.w3.org/1999/xhtml"),
          null != a)
        )
          for (u = 0; u < a.length; u++)
            if (
              (p = a[u]) &&
              "setAttribute" in p == !!k &&
              (k ? p.localName == k : 3 == p.nodeType)
            ) {
              ((t = p), (a[u] = null));
              break;
            }
        if (null == t) {
          if (null == k) return document.createTextNode(x);
          ((t = document.createElementNS(o, k, x.is && x)),
            _ && (n.__m && n.__m(r, a), (_ = !1)),
            (a = null));
        }
        if (null == k) y === x || (_ && t.data == x) || (t.data = x);
        else {
          if (((a = a && e.call(t.childNodes)), !_ && null != a))
            for (y = {}, u = 0; u < t.attributes.length; u++)
              y[(p = t.attributes[u]).name] = p.value;
          for (u in y)
            ((p = y[u]),
              "dangerouslySetInnerHTML" == u
                ? (g = p)
                : "children" == u ||
                  u in x ||
                  ("value" == u && "defaultValue" in x) ||
                  ("checked" == u && "defaultChecked" in x) ||
                  O(t, u, null, p, o));
          for (u in x)
            ((p = x[u]),
              "children" == u
                ? (f = p)
                : "dangerouslySetInnerHTML" == u
                  ? (m = p)
                  : "value" == u
                    ? (h = p)
                    : "checked" == u
                      ? (v = p)
                      : (_ && "function" != typeof p) ||
                        y[u] === p ||
                        O(t, u, p, y[u], o));
          if (m)
            (_ ||
              (g && (m.__html == g.__html || m.__html == t.innerHTML)) ||
              (t.innerHTML = m.__html),
              (r.__k = []));
          else if (
            (g && (t.innerHTML = ""),
            T(
              "template" == r.type ? t.content : t,
              A(f) ? f : [f],
              r,
              s,
              i,
              "foreignObject" == k ? "http://www.w3.org/1999/xhtml" : o,
              a,
              l,
              a ? a[0] : s.__k && N(s, 0),
              _,
              c,
            ),
            null != a)
          )
            for (u = a.length; u--; ) b(a[u]);
          _ ||
            ((u = "value"),
            "progress" == k && null == h
              ? t.removeAttribute("value")
              : null != h &&
                (h !== t[u] ||
                  ("progress" == k && !h) ||
                  ("option" == k && h != y[u])) &&
                O(t, u, h, y[u], o),
            (u = "checked"),
            null != v && v != t[u] && O(t, u, v, y[u], o));
        }
        return t;
      }
      function B(e, t, r) {
        try {
          if ("function" == typeof e) {
            var s = "function" == typeof e.__u;
            (s && e.__u(), (s && null == t) || (e.__u = e(t)));
          } else e.current = t;
        } catch (e) {
          n.__e(e, r);
        }
      }
      function V(e, t, r) {
        var s, i;
        if (
          (n.unmount && n.unmount(e),
          (s = e.ref) && ((s.current && s.current != e.__e) || B(s, null, t)),
          null != (s = e.__c))
        ) {
          if (s.componentWillUnmount)
            try {
              s.componentWillUnmount();
            } catch (e) {
              n.__e(e, t);
            }
          s.base = s.__P = null;
        }
        if ((s = e.__k))
          for (i = 0; i < s.length; i++)
            s[i] && V(s[i], t, r || "function" != typeof e.type);
        (r || b(e.__e), (e.__c = e.__ = e.__e = void 0));
      }
      function q(e, n, t) {
        return this.constructor(e, t);
      }
      function z(t, r, s) {
        var i, o, a, l;
        (r == document && (r = document.documentElement),
          n.__ && n.__(t, r),
          (o = (i = "function" == typeof s) ? null : (s && s.__k) || r.__k),
          (a = []),
          (l = []),
          M(
            r,
            (t = ((!i && s) || r).__k = y(k, null, [t])),
            o || d,
            d,
            r.namespaceURI,
            !i && s
              ? [s]
              : o
                ? null
                : r.firstChild
                  ? e.call(r.childNodes)
                  : null,
            a,
            !i && s ? s : o ? o.__e : r.firstChild,
            i,
            l,
          ),
          H(a, t, l));
      }
      ((e = p.slice),
        (n = {
          __e: function (e, n, t, r) {
            for (var s, i, o; (n = n.__); )
              if ((s = n.__c) && !s.__)
                try {
                  if (
                    ((i = s.constructor) &&
                      null != i.getDerivedStateFromError &&
                      (s.setState(i.getDerivedStateFromError(e)), (o = s.__d)),
                    null != s.componentDidCatch &&
                      (s.componentDidCatch(e, r || {}), (o = s.__d)),
                    o)
                  )
                    return (s.__E = s);
                } catch (n) {
                  e = n;
                }
            throw e;
          },
        }),
        (r = 0),
        (w.prototype.setState = function (e, n) {
          var t;
          ((t =
            null != this.__s && this.__s != this.state
              ? this.__s
              : (this.__s = v({}, this.state))),
            "function" == typeof e && (e = e(v({}, t), this.props)),
            e && v(t, e),
            null != e && this.__v && (n && this._sb.push(n), C(this)));
        }),
        (w.prototype.forceUpdate = function (e) {
          this.__v && ((this.__e = !0), e && this.__h.push(e), C(this));
        }),
        (w.prototype.render = k),
        (s = []),
        (o =
          "function" == typeof Promise
            ? Promise.prototype.then.bind(Promise.resolve())
            : setTimeout),
        (a = function (e, n) {
          return e.__v.__b - n.__v.__b;
        }),
        (E.__r = 0),
        (l = Math.random().toString(8)),
        (_ = "__d" + l),
        (c = "__a" + l),
        (u = /(PointerCapture)$|Capture$/i),
        (m = 0),
        (g = F(!1)),
        (f = F(!0)));
      var Z,
        K,
        Y,
        Q,
        G = 0,
        J = [],
        X = n,
        ee = X.__b,
        ne = X.__r,
        te = X.diffed,
        re = X.__c,
        se = X.unmount,
        ie = X.__;
      function oe(e, n) {
        (X.__h && X.__h(K, e, G || n), (G = 0));
        var t = K.__H || (K.__H = { __: [], __h: [] });
        return (e >= t.__.length && t.__.push({}), t.__[e]);
      }
      function ae(e) {
        return (
          (G = 1),
          (function (e, n, t) {
            var r = oe(Z++, 2);
            if (
              ((r.t = e),
              !r.__c &&
                ((r.__ = [
                  t ? t(n) : pe(void 0, n),
                  function (e) {
                    var n = r.__N ? r.__N[0] : r.__[0],
                      t = r.t(n, e);
                    n !== t && ((r.__N = [t, r.__[1]]), r.__c.setState({}));
                  },
                ]),
                (r.__c = K),
                !K.__f))
            ) {
              var s = function (e, n, t) {
                if (!r.__c.__H) return !0;
                var s = r.__c.__H.__.filter(function (e) {
                  return e.__c;
                });
                if (
                  s.every(function (e) {
                    return !e.__N;
                  })
                )
                  return !i || i.call(this, e, n, t);
                var o = r.__c.props !== e;
                return (
                  s.some(function (e) {
                    if (e.__N) {
                      var n = e.__[0];
                      ((e.__ = e.__N),
                        (e.__N = void 0),
                        n !== e.__[0] && (o = !0));
                    }
                  }),
                  (i && i.call(this, e, n, t)) || o
                );
              };
              K.__f = !0;
              var i = K.shouldComponentUpdate,
                o = K.componentWillUpdate;
              ((K.componentWillUpdate = function (e, n, t) {
                if (this.__e) {
                  var r = i;
                  ((i = void 0), s(e, n, t), (i = r));
                }
                o && o.call(this, e, n, t);
              }),
                (K.shouldComponentUpdate = s));
            }
            return r.__N || r.__;
          })(pe, e)
        );
      }
      function le(e, n) {
        var t = oe(Z++, 7);
        return (de(t.__H, n) && ((t.__ = e()), (t.__H = n), (t.__h = e)), t.__);
      }
      function _e(e, n) {
        return (
          (G = 8),
          le(function () {
            return e;
          }, n)
        );
      }
      function ce() {
        for (var e; (e = J.shift()); ) {
          var n = e.__H;
          if (e.__P && n)
            try {
              (n.__h.some(ge), n.__h.some(fe), (n.__h = []));
            } catch (t) {
              ((n.__h = []), X.__e(t, e.__v));
            }
        }
      }
      ((X.__b = function (e) {
        ((K = null), ee && ee(e));
      }),
        (X.__ = function (e, n) {
          (e && n.__k && n.__k.__m && (e.__m = n.__k.__m), ie && ie(e, n));
        }),
        (X.__r = function (e) {
          (ne && ne(e), (Z = 0));
          var n = (K = e.__c).__H;
          (n &&
            (Y === K
              ? ((n.__h = []),
                (K.__h = []),
                n.__.some(function (e) {
                  (e.__N && (e.__ = e.__N), (e.u = e.__N = void 0));
                }))
              : (n.__h.some(ge), n.__h.some(fe), (n.__h = []), (Z = 0))),
            (Y = K));
        }),
        (X.diffed = function (e) {
          te && te(e);
          var n = e.__c;
          (n &&
            n.__H &&
            (n.__H.__h.length &&
              ((1 !== J.push(n) && Q === X.requestAnimationFrame) ||
                ((Q = X.requestAnimationFrame) || me)(ce)),
            n.__H.__.some(function (e) {
              (e.u && (e.__H = e.u), (e.u = void 0));
            })),
            (Y = K = null));
        }),
        (X.__c = function (e, n) {
          (n.some(function (e) {
            try {
              (e.__h.some(ge),
                (e.__h = e.__h.filter(function (e) {
                  return !e.__ || fe(e);
                })));
            } catch (t) {
              (n.some(function (e) {
                e.__h && (e.__h = []);
              }),
                (n = []),
                X.__e(t, e.__v));
            }
          }),
            re && re(e, n));
        }),
        (X.unmount = function (e) {
          se && se(e);
          var n,
            t = e.__c;
          t &&
            t.__H &&
            (t.__H.__.some(function (e) {
              try {
                ge(e);
              } catch (e) {
                n = e;
              }
            }),
            (t.__H = void 0),
            n && X.__e(n, t.__v));
        }));
      var ue = "function" == typeof requestAnimationFrame;
      function me(e) {
        var n,
          t = function () {
            (clearTimeout(r), ue && cancelAnimationFrame(n), setTimeout(e));
          },
          r = setTimeout(t, 35);
        ue && (n = requestAnimationFrame(t));
      }
      function ge(e) {
        var n = K,
          t = e.__c;
        ("function" == typeof t && ((e.__c = void 0), t()), (K = n));
      }
      function fe(e) {
        var n = K;
        ((e.__c = e.__()), (K = n));
      }
      function de(e, n) {
        return (
          !e ||
          e.length !== n.length ||
          n.some(function (n, t) {
            return n !== e[t];
          })
        );
      }
      function pe(e, n) {
        return "function" == typeof n ? n(e) : n;
      }
      function he(e, n) {
        for (var t in e) if ("__source" !== t && !(t in n)) return !0;
        for (var r in n) if ("__source" !== r && e[r] !== n[r]) return !0;
        return !1;
      }
      function Ae(e, n) {
        ((this.props = e), (this.context = n));
      }
      (((Ae.prototype = new w()).isPureReactComponent = !0),
        (Ae.prototype.shouldComponentUpdate = function (e, n) {
          return he(this.props, e) || he(this.state, n);
        }));
      var ve = n.__b;
      ((n.__b = function (e) {
        (e.type &&
          e.type.__f &&
          e.ref &&
          ((e.props.ref = e.ref), (e.ref = null)),
          ve && ve(e));
      }),
        "undefined" != typeof Symbol &&
          Symbol.for &&
          Symbol.for("react.forward_ref"));
      var be = n.__e;
      n.__e = function (e, n, t, r) {
        if (e.then)
          for (var s, i = n; (i = i.__); )
            if ((s = i.__c) && s.__c)
              return (
                null == n.__e && ((n.__e = t.__e), (n.__k = t.__k)),
                s.__c(e, n)
              );
        be(e, n, t, r);
      };
      var ye = n.unmount;
      function xe(e, n, t) {
        return (
          e &&
            (e.__c &&
              e.__c.__H &&
              (e.__c.__H.__.forEach(function (e) {
                "function" == typeof e.__c && e.__c();
              }),
              (e.__c.__H = null)),
            null !=
              (e = (function (e, n) {
                for (var t in n) e[t] = n[t];
                return e;
              })({}, e)).__c &&
              (e.__c.__P === t && (e.__c.__P = n),
              (e.__c.__e = !0),
              (e.__c = null)),
            (e.__k =
              e.__k &&
              e.__k.map(function (e) {
                return xe(e, n, t);
              }))),
          e
        );
      }
      function ke(e, n, t) {
        return (
          e &&
            t &&
            ((e.__v = null),
            (e.__k =
              e.__k &&
              e.__k.map(function (e) {
                return ke(e, n, t);
              })),
            e.__c &&
              e.__c.__P === n &&
              (e.__e && t.appendChild(e.__e),
              (e.__c.__e = !0),
              (e.__c.__P = t))),
          e
        );
      }
      function we() {
        ((this.__u = 0), (this.o = null), (this.__b = null));
      }
      function Ne(e) {
        var n = e.__ && e.__.__c;
        return n && n.__a && n.__a(e);
      }
      function Se() {
        ((this.i = null), (this.l = null));
      }
      ((n.unmount = function (e) {
        var n = e.__c;
        (n && (n.__z = !0),
          n && n.__R && n.__R(),
          n && 32 & e.__u && (e.type = null),
          ye && ye(e));
      }),
        ((we.prototype = new w()).__c = function (e, n) {
          var t = n.__c,
            r = this;
          (null == r.o && (r.o = []), r.o.push(t));
          var s = Ne(r.__v),
            i = !1,
            o = function () {
              i || r.__z || ((i = !0), (t.__R = null), s ? s(l) : l());
            };
          t.__R = o;
          var a = t.__P;
          t.__P = null;
          var l = function () {
            if (!--r.__u) {
              if (r.state.__a) {
                var e = r.state.__a;
                r.__v.__k[0] = ke(e, e.__c.__P, e.__c.__O);
              }
              var n;
              for (r.setState({ __a: (r.__b = null) }); (n = r.o.pop()); )
                ((n.__P = a), n.forceUpdate());
            }
          };
          (r.__u++ || 32 & n.__u || r.setState({ __a: (r.__b = r.__v.__k[0]) }),
            e.then(o, o));
        }),
        (we.prototype.componentWillUnmount = function () {
          this.o = [];
        }),
        (we.prototype.render = function (e, n) {
          if (this.__b) {
            if (this.__v.__k) {
              var t = document.createElement("div"),
                r = this.__v.__k[0].__c;
              this.__v.__k[0] = xe(this.__b, t, (r.__O = r.__P));
            }
            this.__b = null;
          }
          var s = n.__a && y(k, null, e.fallback);
          return (
            s && (s.__u &= -33),
            [y(k, null, n.__a ? null : e.children), s]
          );
        }));
      var Pe = function (e, n, t) {
        if (
          (++t[1] === t[0] && e.l.delete(n),
          e.props.revealOrder && ("t" !== e.props.revealOrder[0] || !e.l.size))
        )
          for (t = e.i; t; ) {
            for (; t.length > 3; ) t.pop()();
            if (t[1] < t[0]) break;
            e.i = t = t[2];
          }
      };
      (((Se.prototype = new w()).__a = function (e) {
        var n = this,
          t = Ne(n.__v),
          r = n.l.get(e);
        return (
          r[0]++,
          function (s) {
            var i = function () {
              n.props.revealOrder ? (r.push(s), Pe(n, e, r)) : s();
            };
            t ? t(i) : i();
          }
        );
      }),
        (Se.prototype.render = function (e) {
          ((this.i = null), (this.l = new Map()));
          var n = L(e.children);
          e.revealOrder && "b" === e.revealOrder[0] && n.reverse();
          for (var t = n.length; t--; )
            this.l.set(n[t], (this.i = [1, 0, this.i]));
          return e.children;
        }),
        (Se.prototype.componentDidUpdate = Se.prototype.componentDidMount =
          function () {
            var e = this;
            this.l.forEach(function (n, t) {
              Pe(e, t, n);
            });
          }));
      var Ce =
          ("undefined" != typeof Symbol &&
            Symbol.for &&
            Symbol.for("react.element")) ||
          60103,
        Ee =
          /^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image(!S)|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/,
        Te = /^on(Ani|Tra|Tou|BeforeInp|Compo)/,
        Ie = /[A-Z0-9]/g,
        $e = "undefined" != typeof document,
        Le = function (e) {
          return (
            "undefined" != typeof Symbol && "symbol" == typeof Symbol()
              ? /fil|che|rad/
              : /fil|che|ra/
          ).test(e);
        };
      ((w.prototype.isReactComponent = !0),
        [
          "componentWillMount",
          "componentWillReceiveProps",
          "componentWillUpdate",
        ].forEach(function (e) {
          Object.defineProperty(w.prototype, e, {
            configurable: !0,
            get: function () {
              return this["UNSAFE_" + e];
            },
            set: function (n) {
              Object.defineProperty(this, e, {
                configurable: !0,
                writable: !0,
                value: n,
              });
            },
          });
        }));
      var Re = n.event;
      n.event = function (e) {
        return (
          Re && (e = Re(e)),
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
      var Ue = {
          configurable: !0,
          get: function () {
            return this.class;
          },
        },
        Oe = n.vnode;
      n.vnode = function (e) {
        ("string" == typeof e.type &&
          (function (e) {
            var n = e.props,
              t = e.type,
              r = {},
              s = -1 == t.indexOf("-");
            for (var i in n) {
              var o = n[i];
              if (
                !(
                  ("value" === i && "defaultValue" in n && null == o) ||
                  ($e && "children" === i && "noscript" === t) ||
                  "class" === i ||
                  "className" === i
                )
              ) {
                var a = i.toLowerCase();
                ("defaultValue" === i && "value" in n && null == n.value
                  ? (i = "value")
                  : "download" === i && !0 === o
                    ? (o = "")
                    : "translate" === a && "no" === o
                      ? (o = !1)
                      : "o" === a[0] && "n" === a[1]
                        ? "ondoubleclick" === a
                          ? (i = "ondblclick")
                          : "onchange" !== a ||
                              ("input" !== t && "textarea" !== t) ||
                              Le(n.type)
                            ? "onfocus" === a
                              ? (i = "onfocusin")
                              : "onblur" === a
                                ? (i = "onfocusout")
                                : Te.test(i) && (i = a)
                            : (a = i = "oninput")
                        : s && Ee.test(i)
                          ? (i = i.replace(Ie, "-$&").toLowerCase())
                          : null === o && (o = void 0),
                  "oninput" === a && r[(i = a)] && (i = "oninputCapture"),
                  (r[i] = o));
              }
            }
            ("select" == t &&
              (r.multiple &&
                Array.isArray(r.value) &&
                (r.value = L(n.children).forEach(function (e) {
                  e.props.selected = -1 != r.value.indexOf(e.props.value);
                })),
              null != r.defaultValue &&
                (r.value = L(n.children).forEach(function (e) {
                  e.props.selected = r.multiple
                    ? -1 != r.defaultValue.indexOf(e.props.value)
                    : r.defaultValue == e.props.value;
                }))),
              n.class && !n.className
                ? ((r.class = n.class),
                  Object.defineProperty(r, "className", Ue))
                : n.className && (r.class = r.className = n.className),
              (e.props = r));
          })(e),
          (e.$$typeof = Ce),
          Oe && Oe(e));
      };
      var Fe = n.__r;
      n.__r = function (e) {
        (Fe && Fe(e), e.__c);
      };
      var Me = n.diffed;
      n.diffed = function (e) {
        Me && Me(e);
        var n = e.props,
          t = e.__e;
        null != t &&
          "textarea" === e.type &&
          "value" in n &&
          n.value !== t.value &&
          (t.value = null == n.value ? "" : n.value);
      };
      var De = 0;
      function He(e, t, r, s, i, o) {
        t || (t = {});
        var a,
          l,
          _ = t;
        if ("ref" in _)
          for (l in ((_ = {}), t)) "ref" == l ? (a = t[l]) : (_[l] = t[l]);
        var c = {
          type: e,
          props: _,
          key: r,
          ref: a,
          __k: null,
          __: null,
          __b: 0,
          __e: null,
          __c: null,
          constructor: void 0,
          __v: --De,
          __i: -1,
          __u: 0,
          __source: i,
          __self: o,
        };
        if ("function" == typeof e && (a = e.defaultProps))
          for (l in a) void 0 === _[l] && (_[l] = a[l]);
        return (n.vnode && n.vnode(c), c);
      }
      Array.isArray;
      var We = t(815);
      const je = t.n(We)(),
        Be = {
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
      function Ve(e) {
        const n = e.toLowerCase().trim();
        for (const [e, t] of Object.entries(Be)) if (n.includes(e)) return t;
        return "📌";
      }
      function qe(e) {
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
      function ze(e) {
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
      function Ze(e, n) {
        if (e.length <= n) return e;
        const t = e.substring(0, n),
          r = t.lastIndexOf(" ");
        return (r > 0.6 * n ? t.substring(0, r) : t) + "...";
      }
      const Ke = {
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
      function Ye(e) {
        return e >= 80
          ? "v-badge v-badge-score"
          : e >= 60
            ? "v-badge v-badge-score warn"
            : "v-badge v-badge-score low";
      }
      function Qe(e) {
        return e >= 80 ? "✅" : e >= 60 ? "⚠️" : "❓";
      }
      const Ge = ({ summary: e }) => {
          const n = (function (e) {
              if (!e) return { id: null, platform: "unknown" };
              const n = e.match(/[?&]v=([^&]+)/);
              if (n) return { id: n[1], platform: "youtube" };
              const t = e.match(/youtu\.be\/([^?&]+)/);
              if (t) return { id: t[1], platform: "youtube" };
              const r = e.match(/tiktok\.com\/[^/]+\/video\/(\d+)/);
              return r
                ? { id: r[1], platform: "tiktok" }
                : { id: null, platform: "unknown" };
            })(e.video_url),
            t = e.thumbnail_url
              ? e.thumbnail_url
              : "youtube" === n.platform && n.id
                ? `https://img.youtube.com/vi/${n.id}/maxresdefault.jpg`
                : null,
            r = Ke[e.category] ?? "📋",
            s = e.reliability_score,
            i =
              s >= 80
                ? "Source fiable"
                : s >= 60
                  ? "Fiabilité modérée"
                  : "À vérifier",
            o = s >= 80 ? "#10b981" : s >= 60 ? "#f59e0b" : "#ef4444";
          return He("header", {
            className: "v-header",
            children: [
              t &&
                He("div", {
                  className: "v-header-thumb",
                  children: He("img", {
                    src: t,
                    alt: e.video_title,
                    loading: "lazy",
                    onError: (e) => {
                      e.currentTarget.style.display = "none";
                    },
                  }),
                }),
              He("div", {
                className: "v-header-body",
                children: [
                  He("h1", {
                    className: "v-header-title",
                    children: e.video_title,
                  }),
                  e.video_channel &&
                    He("p", {
                      className: "v-header-channel",
                      children: e.video_channel,
                    }),
                  He("div", {
                    className: "v-header-badges",
                    children: [
                      He("span", {
                        className: "v-badge",
                        children: [r, " ", e.category],
                      }),
                      He("span", {
                        className: Ye(s),
                        children: [Qe(s), " ", s, "%"],
                      }),
                      e.tournesol?.found &&
                        null !== e.tournesol.tournesol_score &&
                        He("span", {
                          className: "v-badge",
                          children: [
                            "🌻",
                            " Tournesol",
                            " ",
                            e.tournesol.tournesol_score > 0 ? "+" : "",
                            Math.round(e.tournesol.tournesol_score),
                          ],
                        }),
                    ],
                  }),
                  He("div", {
                    className: "v-header-reliability",
                    children: [
                      He("div", {
                        className: "v-reliability-label",
                        children: [
                          He("span", { children: ["Fiabilité — ", i] }),
                          He("span", {
                            className: "v-reliability-value",
                            children: [s, "%"],
                          }),
                        ],
                      }),
                      He("div", {
                        className: "v-reliability-bar",
                        children: He("div", {
                          className: "v-reliability-fill",
                          style: {
                            width: `${Math.max(0, Math.min(100, s))}%`,
                            background: o,
                          },
                        }),
                      }),
                    ],
                  }),
                ],
              }),
            ],
          });
        },
        Je = ({ verdict: e }) =>
          e
            ? He("section", {
                className: "v-section v-section-verdict",
                children: [
                  He("h2", {
                    className: "v-section-title",
                    children: "Verdict",
                  }),
                  He("div", { className: "v-verdict", children: e }),
                ],
              })
            : null;
      function Xe(e) {
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
            return "v-kp v-kp-solid";
          case "weak":
            return "v-kp v-kp-weak";
          case "insight":
            return "v-kp v-kp-default";
        }
      }
      const nn = ({ points: e }) =>
          e && 0 !== e.length
            ? He("section", {
                className: "v-section",
                children: [
                  He("h2", {
                    className: "v-section-title",
                    children: "Points clés",
                  }),
                  He("div", {
                    className: "v-kp-list",
                    children: e.map((e, n) =>
                      He(
                        "div",
                        {
                          className: en(e.type),
                          children: [
                            He("span", {
                              className: "v-kp-icon",
                              "aria-hidden": "true",
                              children: Xe(e.type),
                            }),
                            He("span", {
                              className: "v-kp-text",
                              children: e.text,
                            }),
                          ],
                        },
                        n,
                      ),
                    ),
                  }),
                ],
              })
            : null,
        tn = ({ content: e }) => {
          const n = le(() => {
            if (!e) return "";
            const n = (function (e) {
              const n = e.split("\n"),
                t = [];
              let r = !1,
                s = !1;
              for (let e = 0; e < n.length; e++) {
                let i = n[e];
                if (/^-{3,}$/.test(i.trim()) || /^\*{3,}$/.test(i.trim())) {
                  (r && (t.push("</ul>"), (r = !1)),
                    s && (t.push("</ol>"), (s = !1)),
                    t.push('<hr class="ds-md-hr">'));
                  continue;
                }
                const o = i.match(/^(#{1,4})\s+(.+)$/);
                if (o) {
                  (r && (t.push("</ul>"), (r = !1)),
                    s && (t.push("</ol>"), (s = !1)));
                  const e = o[1].length,
                    n = o[2],
                    i = e <= 2 ? Ve(n) : "",
                    a = qe(n),
                    l = i ? `${i}&nbsp;&nbsp;` : "";
                  t.push(`<h${e} class="ds-md-h${e}">${l}${a}</h${e}>`);
                  continue;
                }
                if (i.startsWith("&gt; ") || "&gt;" === i) {
                  (r && (t.push("</ul>"), (r = !1)),
                    s && (t.push("</ol>"), (s = !1)));
                  const e = qe(i.replace(/^&gt;\s?/, ""));
                  t.push(
                    `<blockquote class="ds-md-blockquote">${e}</blockquote>`,
                  );
                  continue;
                }
                const a = i.match(/^(\s*)[-*]\s+(.+)$/);
                if (a) {
                  (s && (t.push("</ol>"), (s = !1)),
                    r || (t.push('<ul class="ds-md-ul">'), (r = !0)),
                    t.push(`<li>${qe(a[2])}</li>`));
                  continue;
                }
                const l = i.match(/^(\s*)\d+\.\s+(.+)$/);
                l
                  ? (r && (t.push("</ul>"), (r = !1)),
                    s || (t.push('<ol class="ds-md-ol">'), (s = !0)),
                    t.push(`<li>${qe(l[2])}</li>`))
                  : (r && (t.push("</ul>"), (r = !1)),
                    s && (t.push("</ol>"), (s = !1)),
                    "" !== i.trim()
                      ? t.push(`<p class="ds-md-p">${qe(i)}</p>`)
                      : t.push('<div class="ds-md-spacer"></div>'));
              }
              return (r && t.push("</ul>"), s && t.push("</ol>"), t.join("\n"));
            })(
              (function (e) {
                const n = document.createElement("div");
                return ((n.textContent = e), n.innerHTML);
              })(e),
            );
            return (function (e) {
              return e.replace(
                /\[((?:\d{1,2}:){1,2}\d{2})\]/g,
                (e, n) =>
                  `<span class="v-timestamp" data-ts="${n}" role="button" tabindex="0">${n}</span>`,
              );
            })(n);
          }, [e]);
          return n
            ? He("section", {
                className: "v-section",
                children: [
                  He("h2", {
                    className: "v-section-title",
                    children: "Analyse détaillée",
                  }),
                  He("div", {
                    className: "v-markdown",
                    dangerouslySetInnerHTML: { __html: n },
                  }),
                ],
              })
            : null;
        },
        rn = ({ facts: e }) =>
          e && 0 !== e.length
            ? He("section", {
                className: "v-section",
                children: [
                  He("h2", {
                    className: "v-section-title",
                    children: "Faits à vérifier",
                  }),
                  He("div", {
                    className: "v-facts",
                    children: e.map((e, n) =>
                      He(
                        "div",
                        {
                          className: "v-fact",
                          children: [
                            He("span", {
                              className: "v-fact-icon",
                              "aria-hidden": "true",
                              children: "🔍",
                            }),
                            He("span", {
                              className: "v-fact-text",
                              children: e,
                            }),
                          ],
                        },
                        n,
                      ),
                    ),
                  }),
                ],
              })
            : null,
        sn = "https://www.deepsightsynthesis.com",
        on = ({ summary: e, summaryId: n }) => {
          const [t, r] = ae(null),
            s = (function (e) {
              if (!e) return null;
              const n = e.match(/[?&]v=([^&]+)/);
              if (n) return n[1];
              const t = e.match(/youtu\.be\/([^?&]+)/);
              if (t) return t[1];
              const r = e.match(/tiktok\.com\/[^/]+\/video\/(\d+)/);
              return r ? r[1] : null;
            })(e.video_url),
            i = _e(async () => {
              let e = `${sn}/summary/${n}`;
              if (s)
                try {
                  const n = await je.runtime.sendMessage({
                    action: "SHARE_ANALYSIS",
                    data: { videoId: s },
                  });
                  n?.success && n.share_url && (e = n.share_url);
                } catch {}
              try {
                (await navigator.clipboard.writeText(e), r("Lien copié !"));
              } catch {
                r("Erreur de copie");
              }
              setTimeout(() => r(null), 2200);
            }, [s, n]),
            o = _e(() => {
              je.tabs.create({ url: `${sn}/summary/${n}` });
            }, [n]),
            a = _e(() => {
              je.tabs.create({ url: "https://www.youtube.com" });
            }, []);
          return He("div", {
            className: "v-actions",
            role: "toolbar",
            "aria-label": "Actions",
            children: [
              He("button", {
                type: "button",
                className: "v-btn v-btn-primary",
                onClick: i,
                children: [
                  He("span", { "aria-hidden": "true", children: "🔗" }),
                  He("span", { children: t ?? "Partager cette analyse" }),
                ],
              }),
              He("button", {
                type: "button",
                className: "v-btn v-btn-secondary",
                onClick: o,
                children: [
                  He("span", { "aria-hidden": "true", children: "🌐" }),
                  He("span", { children: "Ouvrir sur DeepSight Web" }),
                ],
              }),
              He("button", {
                type: "button",
                className: "v-btn v-btn-secondary",
                onClick: a,
                children: [
                  He("span", { "aria-hidden": "true", children: "🎬" }),
                  He("span", { children: "Analyser une autre vidéo" }),
                ],
              }),
            ],
          });
        },
        an = ({ summaryId: e }) => {
          const [n, t] = ae(null),
            [r, s] = ae(!0),
            [i, o] = ae(null);
          if (
            ((function (e, n) {
              var t = oe(Z++, 3);
              !X.__s &&
                de(t.__H, n) &&
                ((t.__ = e), (t.u = n), K.__H.__h.push(t));
            })(() => {
              if (!e) return (o("ID d'analyse manquant"), void s(!1));
              let n = !1;
              return (
                je.runtime
                  .sendMessage({
                    action: "GET_SUMMARY",
                    data: { summaryId: e },
                  })
                  .then((e) => {
                    if (n) return;
                    const r = e;
                    r?.success && r.summary
                      ? t(r.summary)
                      : o(r?.error || "Analyse introuvable");
                  })
                  .catch((e) => {
                    n || o(e.message);
                  })
                  .finally(() => {
                    n || s(!1);
                  }),
                () => {
                  n = !0;
                }
              );
            }, [e]),
            r)
          )
            return He("div", {
              className: "viewer-loading",
              children: [
                He("div", {
                  className: "viewer-spinner",
                  "aria-hidden": "true",
                }),
                He("p", { children: "Chargement de l'analyse…" }),
              ],
            });
          if (i || !n)
            return He("div", {
              className: "viewer-error",
              children: [
                He("h1", { children: "Analyse introuvable" }),
                He("p", { children: i ?? "Aucune donnée retournée." }),
                He("button", {
                  type: "button",
                  className: "v-btn v-btn-primary",
                  onClick: () => window.close(),
                  children: "Fermer",
                }),
              ],
            });
          const a = (function (e) {
            const n = (function (e) {
                const n = [
                  /#+\s*(?:Conclusion|Verdict|Synthèse|Résumé|Summary|En résumé|Final Assessment|Overall Assessment)[^\n]*\n([\s\S]*?)(?=\n#|\n---|\n\*{3,}|$)/i,
                  /\*\*(?:Conclusion|Verdict|Synthèse|En résumé|Summary)\*\*[:\s]*([\s\S]*?)(?=\n\n|\n#|\n---|\n\*{3,}|$)/i,
                ];
                for (const t of n) {
                  const n = e.match(t);
                  if (n && n[1]) {
                    const e = ze(n[1]).trim();
                    if (e.length > 20) return Ze(e, 200);
                  }
                }
                const t = e.split(/\n\n+/).filter((e) => {
                  const n = e.trim();
                  return (
                    n.length > 30 &&
                    !n.startsWith("#") &&
                    !n.startsWith("-") &&
                    !n.startsWith("*")
                  );
                });
                return t.length > 0
                  ? Ze(ze(t[t.length - 1]), 200)
                  : "Analysis complete. See detailed view for full results.";
              })(e),
              t = (function (e) {
                const n = [],
                  t = e.split("\n"),
                  r = [/\b(?:SOLIDE|SOLID)\b/i, /\u2705\s*\*\*/, /\u2705/],
                  s = [
                    /\b(?:A VERIFIER|TO VERIFY|QUESTIONABLE|WEAK|INCERTAIN|UNCERTAIN)\b/i,
                    /\u26A0\uFE0F\s*\*\*/,
                    /\u2753/,
                    /\u26A0/,
                  ],
                  i = [/\b(?:PLAUSIBLE)\b/i, /\uD83D\uDCA1/];
                for (const e of t) {
                  const t = e.replace(/^[\s\-*]+/, "").trim();
                  if (t.length < 10) continue;
                  let o = null;
                  if (
                    (r.some((n) => n.test(e))
                      ? (o = "solid")
                      : s.some((n) => n.test(e))
                        ? (o = "weak")
                        : i.some((n) => n.test(e)) && (o = "insight"),
                    o && n.filter((e) => e.type === o).length < 2)
                  ) {
                    const e = ze(t)
                      .replace(
                        /\b(?:SOLIDE|SOLID|PLAUSIBLE|INCERTAIN|UNCERTAIN|A VERIFIER|TO VERIFY|QUESTIONABLE|WEAK)\b\s*[:—\-–]?\s*/gi,
                        "",
                      )
                      .replace(/^[✅⚠️❓💡🔍🔬]\s*/u, "")
                      .trim();
                    e.length > 10 && n.push({ type: o, text: Ze(e, 120) });
                  }
                  if (n.length >= 4) break;
                }
                if (n.length < 2) {
                  const t =
                    /#+\s*(?:Points?\s+(?:forts?|clés?|faibles?)|Key\s+(?:Points?|Findings?|Takeaways?)|Strengths?|Weaknesses?|Main\s+Points?)[^\n]*\n([\s\S]*?)(?=\n#|$)/gi;
                  let r;
                  for (; null !== (r = t.exec(e)) && n.length < 4; ) {
                    const e = r[1].match(/^[\s]*[-*]\s+(.+)$/gm);
                    if (e)
                      for (const t of e.slice(0, 4 - n.length)) {
                        const e = ze(t.replace(/^[\s]*[-*]\s+/, ""));
                        e.length > 10 &&
                          !n.some((n) => n.text === Ze(e, 120)) &&
                          n.push({ type: "insight", text: Ze(e, 120) });
                      }
                  }
                }
                return n.slice(0, 4);
              })(e),
              r = (function (e) {
                const n = [],
                  t = e.match(
                    /#+\s*(?:Tags?|Thèmes?|Themes?|Topics?|Catégories?|Categories?)[^\n]*\n([\s\S]*?)(?=\n#|$)/i,
                  );
                if (t) {
                  const e = t[1].match(/[-*]\s+(.+)/g);
                  if (e)
                    for (const t of e.slice(0, 3)) {
                      const e = ze(t.replace(/^[-*]\s+/, "")).trim();
                      e.length > 0 && e.length < 30 && n.push(e);
                    }
                }
                if (0 === n.length) {
                  const t = e.match(/^#{2,3}\s+(.+)$/gm);
                  if (t) {
                    const e =
                      /^(?:Conclusion|Summary|Résumé|Synthèse|Introduction|Verdict|Analysis|Points?\s+(?:clés?|forts?|faibles?)|Key\s+(?:Points?|Findings?)|Strengths?|Weaknesses?|Overview)/i;
                    for (const r of t) {
                      const t = ze(r.replace(/^#{2,3}\s+/, "")).trim();
                      if (
                        t.length > 2 &&
                        t.length < 35 &&
                        !e.test(t) &&
                        (n.push(t), n.length >= 3)
                      )
                        break;
                    }
                  }
                }
                return n.slice(0, 3);
              })(e);
            return { verdict: n, keyPoints: t, tags: r };
          })(n.summary_content);
          return He("div", {
            className: "viewer-container",
            children: [
              He(Ge, { summary: n }),
              He(Je, { verdict: a.verdict }),
              He(nn, { points: a.keyPoints }),
              He(rn, { facts: n.facts_to_verify ?? [] }),
              He(tn, { content: n.summary_content }),
              He(on, { summary: n, summaryId: n.id }),
            ],
          });
        },
        ln = new URLSearchParams(window.location.search),
        _n = parseInt(ln.get("id") || "0", 10),
        cn = document.getElementById("viewer-root");
      var un;
      cn &&
        ((un = cn),
        {
          render: function (e) {
            !(function (e, n, t) {
              (null == n.__k && (n.textContent = ""),
                z(e, n),
                "function" == typeof t && t(),
                e && e.__c);
            })(e, un);
          },
          unmount: function () {
            !(function (e) {
              e.__k && z(null, e);
            })(un);
          },
        }).render(He(an, { summaryId: _n }));
    })());
})();
