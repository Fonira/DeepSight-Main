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
                  const o =
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
                    a = (e, n, t) =>
                      new Proxy(n, { apply: (n, r, o) => t.call(r, e, ...o) });
                  let s = Function.call.bind(Object.prototype.hasOwnProperty);
                  const l = (e, n = {}, t = {}) => {
                      let r = Object.create(null),
                        c = {
                          has: (n, t) => t in e || t in r,
                          get(c, u, m) {
                            if (u in r) return r[u];
                            if (!(u in e)) return;
                            let _ = e[u];
                            if ("function" == typeof _)
                              if ("function" == typeof n[u])
                                _ = a(e, e[u], n[u]);
                              else if (s(t, u)) {
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
                                    return new Promise((i, a) => {
                                      if (n.fallbackToNoCallback)
                                        try {
                                          t[e](
                                            ...r,
                                            o({ resolve: i, reject: a }, n),
                                          );
                                        } catch (o) {
                                          (console.warn(
                                            `${e} API method doesn't seem to support the callback parameter, falling back to call it without a callback: `,
                                            o,
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
                                              o({ resolve: i, reject: a }, n),
                                            );
                                    });
                                  })(u, t[u]);
                                _ = a(e, e[u], n);
                              } else _ = _.bind(e);
                            else if (
                              "object" == typeof _ &&
                              null !== _ &&
                              (s(n, u) || s(t, u))
                            )
                              _ = l(_, n[u], t[u]);
                            else {
                              if (!s(t, "*"))
                                return (
                                  Object.defineProperty(r, u, {
                                    configurable: !0,
                                    enumerable: !0,
                                    get: () => e[u],
                                    set(n) {
                                      e[u] = n;
                                    },
                                  }),
                                  _
                                );
                              _ = l(_, n[u], t["*"]);
                            }
                            return ((r[u] = _), _);
                          },
                          set: (n, t, o, i) => (
                            t in r ? (r[t] = o) : (e[t] = o),
                            !0
                          ),
                          defineProperty: (e, n, t) =>
                            Reflect.defineProperty(r, n, t),
                          deleteProperty: (e, n) =>
                            Reflect.deleteProperty(r, n),
                        },
                        u = Object.create(e);
                      return new Proxy(u, c);
                    },
                    c = (e) => ({
                      addListener(n, t, ...r) {
                        n.addListener(e.get(t), ...r);
                      },
                      hasListener: (n, t) => n.hasListener(e.get(t)),
                      removeListener(n, t) {
                        n.removeListener(e.get(t));
                      },
                    }),
                    u = new r((e) =>
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
                    m = new r((e) =>
                      "function" != typeof e
                        ? e
                        : function (n, t, r) {
                            let o,
                              i,
                              a = !1,
                              s = new Promise((e) => {
                                o = function (n) {
                                  ((a = !0), e(n));
                                };
                              });
                            try {
                              i = e(n, t, o);
                            } catch (e) {
                              i = Promise.reject(e);
                            }
                            const l =
                              !0 !== i &&
                              (c = i) &&
                              "object" == typeof c &&
                              "function" == typeof c.then;
                            var c;
                            if (!0 !== i && !l && !a) return !1;
                            return (
                              (l ? i : s)
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
                    _ = ({ reject: t, resolve: r }, o) => {
                      e.runtime.lastError
                        ? e.runtime.lastError.message === n
                          ? r()
                          : t(new Error(e.runtime.lastError.message))
                        : o && o.__mozWebExtensionPolyfillReject__
                          ? t(new Error(o.message))
                          : r(o);
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
                        const o = _.bind(null, { resolve: e, reject: n });
                        (r.push(o), t.sendMessage(...r));
                      });
                    },
                    d = {
                      devtools: { network: { onRequestFinished: c(u) } },
                      runtime: {
                        onMessage: c(m),
                        onMessageExternal: c(m),
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
                    h = {
                      clear: { minArgs: 1, maxArgs: 1 },
                      get: { minArgs: 1, maxArgs: 1 },
                      set: { minArgs: 1, maxArgs: 1 },
                    };
                  return (
                    (t.privacy = {
                      network: { "*": h },
                      services: { "*": h },
                      websites: { "*": h },
                    }),
                    l(e, d, t)
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
    var o = n[r];
    if (void 0 !== o) return o.exports;
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
        o,
        i,
        a,
        s,
        l,
        c,
        u,
        m,
        _,
        g,
        d,
        h,
        p = {},
        f = [],
        A = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,
        b = Array.isArray;
      function y(e, n) {
        for (var t in n) e[t] = n[t];
        return e;
      }
      function v(e) {
        e && e.parentNode && e.parentNode.removeChild(e);
      }
      function x(n, t, r) {
        var o,
          i,
          a,
          s = {};
        for (a in t)
          "key" == a ? (o = t[a]) : "ref" == a ? (i = t[a]) : (s[a] = t[a]);
        if (
          (arguments.length > 2 &&
            (s.children = arguments.length > 3 ? e.call(arguments, 2) : r),
          "function" == typeof n && null != n.defaultProps)
        )
          for (a in n.defaultProps)
            void 0 === s[a] && (s[a] = n.defaultProps[a]);
        return w(n, s, o, i, null);
      }
      function w(e, t, o, i, a) {
        var s = {
          type: e,
          props: t,
          key: o,
          ref: i,
          __k: null,
          __: null,
          __b: 0,
          __e: null,
          __c: null,
          constructor: void 0,
          __v: null == a ? ++r : a,
          __i: -1,
          __u: 0,
        };
        return (null == a && null != n.vnode && n.vnode(s), s);
      }
      function k(e) {
        return e.children;
      }
      function C(e, n) {
        ((this.props = e), (this.context = n));
      }
      function P(e, n) {
        if (null == n) return e.__ ? P(e.__, e.__i + 1) : null;
        for (var t; n < e.__k.length; n++)
          if (null != (t = e.__k[n]) && null != t.__e) return t.__e;
        return "function" == typeof e.type ? P(e) : null;
      }
      function M(e) {
        if (e.__P && e.__d) {
          var t = e.__v,
            r = t.__e,
            o = [],
            i = [],
            a = y({}, t);
          ((a.__v = t.__v + 1),
            n.vnode && n.vnode(a),
            U(
              e.__P,
              a,
              t,
              e.__n,
              e.__P.namespaceURI,
              32 & t.__u ? [r] : null,
              o,
              null == r ? P(t) : r,
              !!(32 & t.__u),
              i,
            ),
            (a.__v = t.__v),
            (a.__.__k[a.__i] = a),
            B(o, a, i),
            (t.__e = t.__ = null),
            a.__e != r && O(a));
        }
      }
      function O(e) {
        if (null != (e = e.__) && null != e.__c)
          return (
            (e.__e = e.__c.base = null),
            e.__k.some(function (n) {
              if (null != n && null != n.__e)
                return (e.__e = e.__c.base = n.__e);
            }),
            O(e)
          );
      }
      function N(e) {
        ((!e.__d && (e.__d = !0) && o.push(e) && !S.__r++) ||
          i != n.debounceRendering) &&
          ((i = n.debounceRendering) || a)(S);
      }
      function S() {
        try {
          for (var e, n = 1; o.length; )
            (o.length > n && o.sort(s), (e = o.shift()), (n = o.length), M(e));
        } finally {
          o.length = S.__r = 0;
        }
      }
      function D(e, n, t, r, o, i, a, s, l, c, u) {
        var m,
          _,
          g,
          d,
          h,
          A,
          b,
          y = (r && r.__k) || f,
          v = n.length;
        for (l = I(t, n, y, l, v), m = 0; m < v; m++)
          null != (g = t.__k[m]) &&
            ((_ = (-1 != g.__i && y[g.__i]) || p),
            (g.__i = m),
            (A = U(e, g, _, o, i, a, s, l, c, u)),
            (d = g.__e),
            g.ref &&
              _.ref != g.ref &&
              (_.ref && V(_.ref, null, g), u.push(g.ref, g.__c || d, g)),
            null == h && null != d && (h = d),
            (b = !!(4 & g.__u)) || _.__k === g.__k
              ? ((l = E(g, l, e, b)), b && _.__e && (_.__e = null))
              : "function" == typeof g.type && void 0 !== A
                ? (l = A)
                : d && (l = d.nextSibling),
            (g.__u &= -7));
        return ((t.__e = h), l);
      }
      function I(e, n, t, r, o) {
        var i,
          a,
          s,
          l,
          c,
          u = t.length,
          m = u,
          _ = 0;
        for (e.__k = new Array(o), i = 0; i < o; i++)
          null != (a = n[i]) && "boolean" != typeof a && "function" != typeof a
            ? ("string" == typeof a ||
              "number" == typeof a ||
              "bigint" == typeof a ||
              a.constructor == String
                ? (a = e.__k[i] = w(null, a, null, null, null))
                : b(a)
                  ? (a = e.__k[i] = w(k, { children: a }, null, null, null))
                  : void 0 === a.constructor && a.__b > 0
                    ? (a = e.__k[i] =
                        w(a.type, a.props, a.key, a.ref ? a.ref : null, a.__v))
                    : (e.__k[i] = a),
              (l = i + _),
              (a.__ = e),
              (a.__b = e.__b + 1),
              (s = null),
              -1 != (c = a.__i = T(a, t, l, m)) &&
                (m--, (s = t[c]) && (s.__u |= 2)),
              null == s || null == s.__v
                ? (-1 == c && (o > u ? _-- : o < u && _++),
                  "function" != typeof a.type && (a.__u |= 4))
                : c != l &&
                  (c == l - 1
                    ? _--
                    : c == l + 1
                      ? _++
                      : (c > l ? _-- : _++, (a.__u |= 4))))
            : (e.__k[i] = null);
        if (m)
          for (i = 0; i < u; i++)
            null != (s = t[i]) &&
              !(2 & s.__u) &&
              (s.__e == r && (r = P(s)), z(s, s));
        return r;
      }
      function E(e, n, t, r) {
        var o, i;
        if ("function" == typeof e.type) {
          for (o = e.__k, i = 0; o && i < o.length; i++)
            o[i] && ((o[i].__ = e), (n = E(o[i], n, t, r)));
          return n;
        }
        e.__e != n &&
          (r &&
            (n && e.type && !n.parentNode && (n = P(e)),
            t.insertBefore(e.__e, n || null)),
          (n = e.__e));
        do {
          n = n && n.nextSibling;
        } while (null != n && 8 == n.nodeType);
        return n;
      }
      function $(e, n) {
        return (
          (n = n || []),
          null == e ||
            "boolean" == typeof e ||
            (b(e)
              ? e.some(function (e) {
                  $(e, n);
                })
              : n.push(e)),
          n
        );
      }
      function T(e, n, t, r) {
        var o,
          i,
          a,
          s = e.key,
          l = e.type,
          c = n[t],
          u = null != c && !(2 & c.__u);
        if ((null === c && null == s) || (u && s == c.key && l == c.type))
          return t;
        if (r > (u ? 1 : 0))
          for (o = t - 1, i = t + 1; o >= 0 || i < n.length; )
            if (
              null != (c = n[(a = o >= 0 ? o-- : i++)]) &&
              !(2 & c.__u) &&
              s == c.key &&
              l == c.type
            )
              return a;
        return -1;
      }
      function F(e, n, t) {
        "-" == n[0]
          ? e.setProperty(n, null == t ? "" : t)
          : (e[n] =
              null == t
                ? ""
                : "number" != typeof t || A.test(n)
                  ? t
                  : t + "px");
      }
      function L(e, n, t, r, o) {
        var i, a;
        e: if ("style" == n)
          if ("string" == typeof t) e.style.cssText = t;
          else {
            if (("string" == typeof r && (e.style.cssText = r = ""), r))
              for (n in r) (t && n in t) || F(e.style, n, "");
            if (t) for (n in t) (r && t[n] == r[n]) || F(e.style, n, t[n]);
          }
        else if ("o" == n[0] && "n" == n[1])
          ((i = n != (n = n.replace(m, "$1"))),
            (a = n.toLowerCase()),
            (n =
              a in e || "onFocusOut" == n || "onFocusIn" == n
                ? a.slice(2)
                : n.slice(2)),
            e.l || (e.l = {}),
            (e.l[n + i] = t),
            t
              ? r
                ? (t[u] = r[u])
                : ((t[u] = _), e.addEventListener(n, i ? d : g, i))
              : e.removeEventListener(n, i ? d : g, i));
        else {
          if ("http://www.w3.org/2000/svg" == o)
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
      function R(e) {
        return function (t) {
          if (this.l) {
            var r = this.l[t.type + e];
            if (null == t[c]) t[c] = _++;
            else if (t[c] < r[u]) return;
            return r(n.event ? n.event(t) : t);
          }
        };
      }
      function U(e, t, r, o, i, a, s, l, c, u) {
        var m,
          _,
          g,
          d,
          h,
          p,
          A,
          x,
          w,
          P,
          M,
          O,
          N,
          S,
          I,
          E = t.type;
        if (void 0 !== t.constructor) return null;
        (128 & r.__u && ((c = !!(32 & r.__u)), (a = [(l = t.__e = r.__e)])),
          (m = n.__b) && m(t));
        e: if ("function" == typeof E)
          try {
            if (
              ((x = t.props),
              (w = E.prototype && E.prototype.render),
              (P = (m = E.contextType) && o[m.__c]),
              (M = m ? (P ? P.props.value : m.__) : o),
              r.__c
                ? (A = (_ = t.__c = r.__c).__ = _.__E)
                : (w
                    ? (t.__c = _ = new E(x, M))
                    : ((t.__c = _ = new C(x, M)),
                      (_.constructor = E),
                      (_.render = q)),
                  P && P.sub(_),
                  _.state || (_.state = {}),
                  (_.__n = o),
                  (g = _.__d = !0),
                  (_.__h = []),
                  (_._sb = [])),
              w && null == _.__s && (_.__s = _.state),
              w &&
                null != E.getDerivedStateFromProps &&
                (_.__s == _.state && (_.__s = y({}, _.__s)),
                y(_.__s, E.getDerivedStateFromProps(x, _.__s))),
              (d = _.props),
              (h = _.state),
              (_.__v = t),
              g)
            )
              (w &&
                null == E.getDerivedStateFromProps &&
                null != _.componentWillMount &&
                _.componentWillMount(),
                w &&
                  null != _.componentDidMount &&
                  _.__h.push(_.componentDidMount));
            else {
              if (
                (w &&
                  null == E.getDerivedStateFromProps &&
                  x !== d &&
                  null != _.componentWillReceiveProps &&
                  _.componentWillReceiveProps(x, M),
                t.__v == r.__v ||
                  (!_.__e &&
                    null != _.shouldComponentUpdate &&
                    !1 === _.shouldComponentUpdate(x, _.__s, M)))
              ) {
                (t.__v != r.__v &&
                  ((_.props = x), (_.state = _.__s), (_.__d = !1)),
                  (t.__e = r.__e),
                  (t.__k = r.__k),
                  t.__k.some(function (e) {
                    e && (e.__ = t);
                  }),
                  f.push.apply(_.__h, _._sb),
                  (_._sb = []),
                  _.__h.length && s.push(_));
                break e;
              }
              (null != _.componentWillUpdate &&
                _.componentWillUpdate(x, _.__s, M),
                w &&
                  null != _.componentDidUpdate &&
                  _.__h.push(function () {
                    _.componentDidUpdate(d, h, p);
                  }));
            }
            if (
              ((_.context = M),
              (_.props = x),
              (_.__P = e),
              (_.__e = !1),
              (O = n.__r),
              (N = 0),
              w)
            )
              ((_.state = _.__s),
                (_.__d = !1),
                O && O(t),
                (m = _.render(_.props, _.state, _.context)),
                f.push.apply(_.__h, _._sb),
                (_._sb = []));
            else
              do {
                ((_.__d = !1),
                  O && O(t),
                  (m = _.render(_.props, _.state, _.context)),
                  (_.state = _.__s));
              } while (_.__d && ++N < 25);
            ((_.state = _.__s),
              null != _.getChildContext &&
                (o = y(y({}, o), _.getChildContext())),
              w &&
                !g &&
                null != _.getSnapshotBeforeUpdate &&
                (p = _.getSnapshotBeforeUpdate(d, h)),
              (S =
                null != m && m.type === k && null == m.key
                  ? j(m.props.children)
                  : m),
              (l = D(e, b(S) ? S : [S], t, r, o, i, a, s, l, c, u)),
              (_.base = t.__e),
              (t.__u &= -161),
              _.__h.length && s.push(_),
              A && (_.__E = _.__ = null));
          } catch (e) {
            if (((t.__v = null), c || null != a))
              if (e.then) {
                for (
                  t.__u |= c ? 160 : 128;
                  l && 8 == l.nodeType && l.nextSibling;
                )
                  l = l.nextSibling;
                ((a[a.indexOf(l)] = null), (t.__e = l));
              } else {
                for (I = a.length; I--; ) v(a[I]);
                H(t);
              }
            else ((t.__e = r.__e), (t.__k = r.__k), e.then || H(t));
            n.__e(e, t, r);
          }
        else
          null == a && t.__v == r.__v
            ? ((t.__k = r.__k), (t.__e = r.__e))
            : (l = t.__e = W(r.__e, t, r, o, i, a, s, c, u));
        return ((m = n.diffed) && m(t), 128 & t.__u ? void 0 : l);
      }
      function H(e) {
        e && (e.__c && (e.__c.__e = !0), e.__k && e.__k.some(H));
      }
      function B(e, t, r) {
        for (var o = 0; o < r.length; o++) V(r[o], r[++o], r[++o]);
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
      function j(e) {
        return "object" != typeof e || null == e || e.__b > 0
          ? e
          : b(e)
            ? e.map(j)
            : y({}, e);
      }
      function W(t, r, o, i, a, s, l, c, u) {
        var m,
          _,
          g,
          d,
          h,
          f,
          A,
          y = o.props || p,
          x = r.props,
          w = r.type;
        if (
          ("svg" == w
            ? (a = "http://www.w3.org/2000/svg")
            : "math" == w
              ? (a = "http://www.w3.org/1998/Math/MathML")
              : a || (a = "http://www.w3.org/1999/xhtml"),
          null != s)
        )
          for (m = 0; m < s.length; m++)
            if (
              (h = s[m]) &&
              "setAttribute" in h == !!w &&
              (w ? h.localName == w : 3 == h.nodeType)
            ) {
              ((t = h), (s[m] = null));
              break;
            }
        if (null == t) {
          if (null == w) return document.createTextNode(x);
          ((t = document.createElementNS(a, w, x.is && x)),
            c && (n.__m && n.__m(r, s), (c = !1)),
            (s = null));
        }
        if (null == w) y === x || (c && t.data == x) || (t.data = x);
        else {
          if (((s = s && e.call(t.childNodes)), !c && null != s))
            for (y = {}, m = 0; m < t.attributes.length; m++)
              y[(h = t.attributes[m]).name] = h.value;
          for (m in y)
            ((h = y[m]),
              "dangerouslySetInnerHTML" == m
                ? (g = h)
                : "children" == m ||
                  m in x ||
                  ("value" == m && "defaultValue" in x) ||
                  ("checked" == m && "defaultChecked" in x) ||
                  L(t, m, null, h, a));
          for (m in x)
            ((h = x[m]),
              "children" == m
                ? (d = h)
                : "dangerouslySetInnerHTML" == m
                  ? (_ = h)
                  : "value" == m
                    ? (f = h)
                    : "checked" == m
                      ? (A = h)
                      : (c && "function" != typeof h) ||
                        y[m] === h ||
                        L(t, m, h, y[m], a));
          if (_)
            (c ||
              (g && (_.__html == g.__html || _.__html == t.innerHTML)) ||
              (t.innerHTML = _.__html),
              (r.__k = []));
          else if (
            (g && (t.innerHTML = ""),
            D(
              "template" == r.type ? t.content : t,
              b(d) ? d : [d],
              r,
              o,
              i,
              "foreignObject" == w ? "http://www.w3.org/1999/xhtml" : a,
              s,
              l,
              s ? s[0] : o.__k && P(o, 0),
              c,
              u,
            ),
            null != s)
          )
            for (m = s.length; m--; ) v(s[m]);
          c ||
            ((m = "value"),
            "progress" == w && null == f
              ? t.removeAttribute("value")
              : null != f &&
                (f !== t[m] ||
                  ("progress" == w && !f) ||
                  ("option" == w && f != y[m])) &&
                L(t, m, f, y[m], a),
            (m = "checked"),
            null != A && A != t[m] && L(t, m, A, y[m], a));
        }
        return t;
      }
      function V(e, t, r) {
        try {
          if ("function" == typeof e) {
            var o = "function" == typeof e.__u;
            (o && e.__u(), (o && null == t) || (e.__u = e(t)));
          } else e.current = t;
        } catch (e) {
          n.__e(e, r);
        }
      }
      function z(e, t, r) {
        var o, i;
        if (
          (n.unmount && n.unmount(e),
          (o = e.ref) && ((o.current && o.current != e.__e) || V(o, null, t)),
          null != (o = e.__c))
        ) {
          if (o.componentWillUnmount)
            try {
              o.componentWillUnmount();
            } catch (e) {
              n.__e(e, t);
            }
          o.base = o.__P = null;
        }
        if ((o = e.__k))
          for (i = 0; i < o.length; i++)
            o[i] && z(o[i], t, r || "function" != typeof e.type);
        (r || v(e.__e), (e.__c = e.__ = e.__e = void 0));
      }
      function q(e, n, t) {
        return this.constructor(e, t);
      }
      function Z(t, r, o) {
        var i, a, s, l;
        (r == document && (r = document.documentElement),
          n.__ && n.__(t, r),
          (a = (i = "function" == typeof o) ? null : (o && o.__k) || r.__k),
          (s = []),
          (l = []),
          U(
            r,
            (t = ((!i && o) || r).__k = x(k, null, [t])),
            a || p,
            p,
            r.namespaceURI,
            !i && o
              ? [o]
              : a
                ? null
                : r.firstChild
                  ? e.call(r.childNodes)
                  : null,
            s,
            !i && o ? o : a ? a.__e : r.firstChild,
            i,
            l,
          ),
          B(s, t, l));
      }
      ((e = f.slice),
        (n = {
          __e: function (e, n, t, r) {
            for (var o, i, a; (n = n.__); )
              if ((o = n.__c) && !o.__)
                try {
                  if (
                    ((i = o.constructor) &&
                      null != i.getDerivedStateFromError &&
                      (o.setState(i.getDerivedStateFromError(e)), (a = o.__d)),
                    null != o.componentDidCatch &&
                      (o.componentDidCatch(e, r || {}), (a = o.__d)),
                    a)
                  )
                    return (o.__E = o);
                } catch (n) {
                  e = n;
                }
            throw e;
          },
        }),
        (r = 0),
        (C.prototype.setState = function (e, n) {
          var t;
          ((t =
            null != this.__s && this.__s != this.state
              ? this.__s
              : (this.__s = y({}, this.state))),
            "function" == typeof e && (e = e(y({}, t), this.props)),
            e && y(t, e),
            null != e && this.__v && (n && this._sb.push(n), N(this)));
        }),
        (C.prototype.forceUpdate = function (e) {
          this.__v && ((this.__e = !0), e && this.__h.push(e), N(this));
        }),
        (C.prototype.render = k),
        (o = []),
        (a =
          "function" == typeof Promise
            ? Promise.prototype.then.bind(Promise.resolve())
            : setTimeout),
        (s = function (e, n) {
          return e.__v.__b - n.__v.__b;
        }),
        (S.__r = 0),
        (l = Math.random().toString(8)),
        (c = "__d" + l),
        (u = "__a" + l),
        (m = /(PointerCapture)$|Capture$/i),
        (_ = 0),
        (g = R(!1)),
        (d = R(!0)),
        (h = 0));
      var Y,
        K,
        X,
        Q,
        G = 0,
        J = [],
        ee = n,
        ne = ee.__b,
        te = ee.__r,
        re = ee.diffed,
        oe = ee.__c,
        ie = ee.unmount,
        ae = ee.__;
      function se(e, n) {
        (ee.__h && ee.__h(K, e, G || n), (G = 0));
        var t = K.__H || (K.__H = { __: [], __h: [] });
        return (e >= t.__.length && t.__.push({}), t.__[e]);
      }
      function le(e) {
        return (
          (G = 1),
          (function (e, n, t) {
            var r = se(Y++, 2);
            if (
              ((r.t = e),
              !r.__c &&
                ((r.__ = [
                  t ? t(n) : Ae(void 0, n),
                  function (e) {
                    var n = r.__N ? r.__N[0] : r.__[0],
                      t = r.t(n, e);
                    n !== t && ((r.__N = [t, r.__[1]]), r.__c.setState({}));
                  },
                ]),
                (r.__c = K),
                !K.__f))
            ) {
              var o = function (e, n, t) {
                if (!r.__c.__H) return !0;
                var o = r.__c.__H.__.filter(function (e) {
                  return e.__c;
                });
                if (
                  o.every(function (e) {
                    return !e.__N;
                  })
                )
                  return !i || i.call(this, e, n, t);
                var a = r.__c.props !== e;
                return (
                  o.some(function (e) {
                    if (e.__N) {
                      var n = e.__[0];
                      ((e.__ = e.__N),
                        (e.__N = void 0),
                        n !== e.__[0] && (a = !0));
                    }
                  }),
                  (i && i.call(this, e, n, t)) || a
                );
              };
              K.__f = !0;
              var i = K.shouldComponentUpdate,
                a = K.componentWillUpdate;
              ((K.componentWillUpdate = function (e, n, t) {
                if (this.__e) {
                  var r = i;
                  ((i = void 0), o(e, n, t), (i = r));
                }
                a && a.call(this, e, n, t);
              }),
                (K.shouldComponentUpdate = o));
            }
            return r.__N || r.__;
          })(Ae, e)
        );
      }
      function ce(e, n) {
        var t = se(Y++, 3);
        !ee.__s && fe(t.__H, n) && ((t.__ = e), (t.u = n), K.__H.__h.push(t));
      }
      function ue(e, n) {
        var t = se(Y++, 7);
        return (fe(t.__H, n) && ((t.__ = e()), (t.__H = n), (t.__h = e)), t.__);
      }
      function me(e, n) {
        return (
          (G = 8),
          ue(function () {
            return e;
          }, n)
        );
      }
      function _e() {
        for (var e; (e = J.shift()); ) {
          var n = e.__H;
          if (e.__P && n)
            try {
              (n.__h.some(he), n.__h.some(pe), (n.__h = []));
            } catch (t) {
              ((n.__h = []), ee.__e(t, e.__v));
            }
        }
      }
      ((ee.__b = function (e) {
        ((K = null), ne && ne(e));
      }),
        (ee.__ = function (e, n) {
          (e && n.__k && n.__k.__m && (e.__m = n.__k.__m), ae && ae(e, n));
        }),
        (ee.__r = function (e) {
          (te && te(e), (Y = 0));
          var n = (K = e.__c).__H;
          (n &&
            (X === K
              ? ((n.__h = []),
                (K.__h = []),
                n.__.some(function (e) {
                  (e.__N && (e.__ = e.__N), (e.u = e.__N = void 0));
                }))
              : (n.__h.some(he), n.__h.some(pe), (n.__h = []), (Y = 0))),
            (X = K));
        }),
        (ee.diffed = function (e) {
          re && re(e);
          var n = e.__c;
          (n &&
            n.__H &&
            (n.__H.__h.length &&
              ((1 !== J.push(n) && Q === ee.requestAnimationFrame) ||
                ((Q = ee.requestAnimationFrame) || de)(_e)),
            n.__H.__.some(function (e) {
              (e.u && (e.__H = e.u), (e.u = void 0));
            })),
            (X = K = null));
        }),
        (ee.__c = function (e, n) {
          (n.some(function (e) {
            try {
              (e.__h.some(he),
                (e.__h = e.__h.filter(function (e) {
                  return !e.__ || pe(e);
                })));
            } catch (t) {
              (n.some(function (e) {
                e.__h && (e.__h = []);
              }),
                (n = []),
                ee.__e(t, e.__v));
            }
          }),
            oe && oe(e, n));
        }),
        (ee.unmount = function (e) {
          ie && ie(e);
          var n,
            t = e.__c;
          t &&
            t.__H &&
            (t.__H.__.some(function (e) {
              try {
                he(e);
              } catch (e) {
                n = e;
              }
            }),
            (t.__H = void 0),
            n && ee.__e(n, t.__v));
        }));
      var ge = "function" == typeof requestAnimationFrame;
      function de(e) {
        var n,
          t = function () {
            (clearTimeout(r), ge && cancelAnimationFrame(n), setTimeout(e));
          },
          r = setTimeout(t, 35);
        ge && (n = requestAnimationFrame(t));
      }
      function he(e) {
        var n = K,
          t = e.__c;
        ("function" == typeof t && ((e.__c = void 0), t()), (K = n));
      }
      function pe(e) {
        var n = K;
        ((e.__c = e.__()), (K = n));
      }
      function fe(e, n) {
        return (
          !e ||
          e.length !== n.length ||
          n.some(function (n, t) {
            return n !== e[t];
          })
        );
      }
      function Ae(e, n) {
        return "function" == typeof n ? n(e) : n;
      }
      function be(e, n) {
        for (var t in e) if ("__source" !== t && !(t in n)) return !0;
        for (var r in n) if ("__source" !== r && e[r] !== n[r]) return !0;
        return !1;
      }
      function ye(e, n) {
        ((this.props = e), (this.context = n));
      }
      (((ye.prototype = new C()).isPureReactComponent = !0),
        (ye.prototype.shouldComponentUpdate = function (e, n) {
          return be(this.props, e) || be(this.state, n);
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
      var xe = n.__e;
      n.__e = function (e, n, t, r) {
        if (e.then)
          for (var o, i = n; (i = i.__); )
            if ((o = i.__c) && o.__c)
              return (
                null == n.__e && ((n.__e = t.__e), (n.__k = t.__k)),
                o.__c(e, n)
              );
        xe(e, n, t, r);
      };
      var we = n.unmount;
      function ke(e, n, t) {
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
                return ke(e, n, t);
              }))),
          e
        );
      }
      function Ce(e, n, t) {
        return (
          e &&
            t &&
            ((e.__v = null),
            (e.__k =
              e.__k &&
              e.__k.map(function (e) {
                return Ce(e, n, t);
              })),
            e.__c &&
              e.__c.__P === n &&
              (e.__e && t.appendChild(e.__e),
              (e.__c.__e = !0),
              (e.__c.__P = t))),
          e
        );
      }
      function Pe() {
        ((this.__u = 0), (this.o = null), (this.__b = null));
      }
      function Me(e) {
        var n = e.__ && e.__.__c;
        return n && n.__a && n.__a(e);
      }
      function Oe() {
        ((this.i = null), (this.l = null));
      }
      ((n.unmount = function (e) {
        var n = e.__c;
        (n && (n.__z = !0),
          n && n.__R && n.__R(),
          n && 32 & e.__u && (e.type = null),
          we && we(e));
      }),
        ((Pe.prototype = new C()).__c = function (e, n) {
          var t = n.__c,
            r = this;
          (null == r.o && (r.o = []), r.o.push(t));
          var o = Me(r.__v),
            i = !1,
            a = function () {
              i || r.__z || ((i = !0), (t.__R = null), o ? o(l) : l());
            };
          t.__R = a;
          var s = t.__P;
          t.__P = null;
          var l = function () {
            if (!--r.__u) {
              if (r.state.__a) {
                var e = r.state.__a;
                r.__v.__k[0] = Ce(e, e.__c.__P, e.__c.__O);
              }
              var n;
              for (r.setState({ __a: (r.__b = null) }); (n = r.o.pop()); )
                ((n.__P = s), n.forceUpdate());
            }
          };
          (r.__u++ || 32 & n.__u || r.setState({ __a: (r.__b = r.__v.__k[0]) }),
            e.then(a, a));
        }),
        (Pe.prototype.componentWillUnmount = function () {
          this.o = [];
        }),
        (Pe.prototype.render = function (e, n) {
          if (this.__b) {
            if (this.__v.__k) {
              var t = document.createElement("div"),
                r = this.__v.__k[0].__c;
              this.__v.__k[0] = ke(this.__b, t, (r.__O = r.__P));
            }
            this.__b = null;
          }
          var o = n.__a && x(k, null, e.fallback);
          return (
            o && (o.__u &= -33),
            [x(k, null, n.__a ? null : e.children), o]
          );
        }));
      var Ne = function (e, n, t) {
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
      (((Oe.prototype = new C()).__a = function (e) {
        var n = this,
          t = Me(n.__v),
          r = n.l.get(e);
        return (
          r[0]++,
          function (o) {
            var i = function () {
              n.props.revealOrder ? (r.push(o), Ne(n, e, r)) : o();
            };
            t ? t(i) : i();
          }
        );
      }),
        (Oe.prototype.render = function (e) {
          ((this.i = null), (this.l = new Map()));
          var n = $(e.children);
          e.revealOrder && "b" === e.revealOrder[0] && n.reverse();
          for (var t = n.length; t--; )
            this.l.set(n[t], (this.i = [1, 0, this.i]));
          return e.children;
        }),
        (Oe.prototype.componentDidUpdate = Oe.prototype.componentDidMount =
          function () {
            var e = this;
            this.l.forEach(function (n, t) {
              Ne(e, t, n);
            });
          }));
      var Se =
          ("undefined" != typeof Symbol &&
            Symbol.for &&
            Symbol.for("react.element")) ||
          60103,
        De =
          /^(?:accent|alignment|arabic|baseline|cap|clip(?!PathU)|color|dominant|fill|flood|font|glyph(?!R)|horiz|image(!S)|letter|lighting|marker(?!H|W|U)|overline|paint|pointer|shape|stop|strikethrough|stroke|text(?!L)|transform|underline|unicode|units|v|vector|vert|word|writing|x(?!C))[A-Z]/,
        Ie = /^on(Ani|Tra|Tou|BeforeInp|Compo)/,
        Ee = /[A-Z0-9]/g,
        $e = "undefined" != typeof document,
        Te = function (e) {
          return (
            "undefined" != typeof Symbol && "symbol" == typeof Symbol()
              ? /fil|che|rad/
              : /fil|che|ra/
          ).test(e);
        };
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
            set: function (n) {
              Object.defineProperty(this, e, {
                configurable: !0,
                writable: !0,
                value: n,
              });
            },
          });
        }));
      var Fe = n.event;
      n.event = function (e) {
        return (
          Fe && (e = Fe(e)),
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
      var Le = {
          configurable: !0,
          get: function () {
            return this.class;
          },
        },
        Re = n.vnode;
      n.vnode = function (e) {
        ("string" == typeof e.type &&
          (function (e) {
            var n = e.props,
              t = e.type,
              r = {},
              o = -1 == t.indexOf("-");
            for (var i in n) {
              var a = n[i];
              if (
                !(
                  ("value" === i && "defaultValue" in n && null == a) ||
                  ($e && "children" === i && "noscript" === t) ||
                  "class" === i ||
                  "className" === i
                )
              ) {
                var s = i.toLowerCase();
                ("defaultValue" === i && "value" in n && null == n.value
                  ? (i = "value")
                  : "download" === i && !0 === a
                    ? (a = "")
                    : "translate" === s && "no" === a
                      ? (a = !1)
                      : "o" === s[0] && "n" === s[1]
                        ? "ondoubleclick" === s
                          ? (i = "ondblclick")
                          : "onchange" !== s ||
                              ("input" !== t && "textarea" !== t) ||
                              Te(n.type)
                            ? "onfocus" === s
                              ? (i = "onfocusin")
                              : "onblur" === s
                                ? (i = "onfocusout")
                                : Ie.test(i) && (i = s)
                            : (s = i = "oninput")
                        : o && De.test(i)
                          ? (i = i.replace(Ee, "-$&").toLowerCase())
                          : null === a && (a = void 0),
                  "oninput" === s && r[(i = s)] && (i = "oninputCapture"),
                  (r[i] = a));
              }
            }
            ("select" == t &&
              (r.multiple &&
                Array.isArray(r.value) &&
                (r.value = $(n.children).forEach(function (e) {
                  e.props.selected = -1 != r.value.indexOf(e.props.value);
                })),
              null != r.defaultValue &&
                (r.value = $(n.children).forEach(function (e) {
                  e.props.selected = r.multiple
                    ? -1 != r.defaultValue.indexOf(e.props.value)
                    : r.defaultValue == e.props.value;
                }))),
              n.class && !n.className
                ? ((r.class = n.class),
                  Object.defineProperty(r, "className", Le))
                : n.className && (r.class = r.className = n.className),
              (e.props = r));
          })(e),
          (e.$$typeof = Se),
          Re && Re(e));
      };
      var Ue = n.__r;
      n.__r = function (e) {
        (Ue && Ue(e), e.__c);
      };
      var He = n.diffed;
      n.diffed = function (e) {
        He && He(e);
        var n = e.props,
          t = e.__e;
        null != t &&
          "textarea" === e.type &&
          "value" in n &&
          n.value !== t.value &&
          (t.value = null == n.value ? "" : n.value);
      };
      var Be = 0;
      function je(e, t, r, o, i, a) {
        t || (t = {});
        var s,
          l,
          c = t;
        if ("ref" in c)
          for (l in ((c = {}), t)) "ref" == l ? (s = t[l]) : (c[l] = t[l]);
        var u = {
          type: e,
          props: c,
          key: r,
          ref: s,
          __k: null,
          __: null,
          __b: 0,
          __e: null,
          __c: null,
          constructor: void 0,
          __v: --Be,
          __i: -1,
          __u: 0,
          __source: i,
          __self: a,
        };
        if ("function" == typeof e && (s = e.defaultProps))
          for (l in s) void 0 === c[l] && (c[l] = s[l]);
        return (n.vnode && n.vnode(u), u);
      }
      Array.isArray;
      var We = t(815);
      const Ve = t.n(We)(),
        ze = {
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
      function qe(e) {
        const n = e.toLowerCase().trim();
        for (const [e, t] of Object.entries(ze)) if (n.includes(e)) return t;
        return "📌";
      }
      function Ze(e) {
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
      function Ye(e) {
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
      function Ke(e, n) {
        if (e.length <= n) return e;
        const t = e.substring(0, n),
          r = t.lastIndexOf(" ");
        return (r > 0.6 * n ? t.substring(0, r) : t) + "...";
      }
      const Xe = {
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
      function Qe(e) {
        return e >= 80
          ? "v-badge v-badge-score"
          : e >= 60
            ? "v-badge v-badge-score warn"
            : "v-badge v-badge-score low";
      }
      function Ge(e) {
        return e >= 80 ? "✅" : e >= 60 ? "⚠️" : "❓";
      }
      const Je = ({ summary: e }) => {
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
            r = Xe[e.category] ?? "📋",
            o = e.reliability_score,
            i =
              o >= 80
                ? "Source fiable"
                : o >= 60
                  ? "Fiabilité modérée"
                  : "À vérifier",
            a = o >= 80 ? "#10b981" : o >= 60 ? "#f59e0b" : "#ef4444";
          return je("header", {
            className: "v-header",
            children: [
              t &&
                je("div", {
                  className: "v-header-thumb",
                  children: je("img", {
                    src: t,
                    alt: e.video_title,
                    loading: "lazy",
                    onError: (e) => {
                      e.currentTarget.style.display = "none";
                    },
                  }),
                }),
              je("div", {
                className: "v-header-body",
                children: [
                  je("h1", {
                    className: "v-header-title",
                    children: e.video_title,
                  }),
                  e.video_channel &&
                    je("p", {
                      className: "v-header-channel",
                      children: e.video_channel,
                    }),
                  je("div", {
                    className: "v-header-badges",
                    children: [
                      je("span", {
                        className: "v-badge",
                        children: [r, " ", e.category],
                      }),
                      je("span", {
                        className: Qe(o),
                        children: [Ge(o), " ", o, "%"],
                      }),
                      e.tournesol?.found &&
                        null !== e.tournesol.tournesol_score &&
                        je("span", {
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
                  je("div", {
                    className: "v-header-reliability",
                    children: [
                      je("div", {
                        className: "v-reliability-label",
                        children: [
                          je("span", { children: ["Fiabilité — ", i] }),
                          je("span", {
                            className: "v-reliability-value",
                            children: [o, "%"],
                          }),
                        ],
                      }),
                      je("div", {
                        className: "v-reliability-bar",
                        children: je("div", {
                          className: "v-reliability-fill",
                          style: {
                            width: `${Math.max(0, Math.min(100, o))}%`,
                            background: a,
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
        en = ({ verdict: e }) =>
          e
            ? je("section", {
                className: "v-section v-section-verdict",
                children: [
                  je("h2", {
                    className: "v-section-title",
                    children: "Verdict",
                  }),
                  je("div", { className: "v-verdict", children: e }),
                ],
              })
            : null;
      function nn(e) {
        switch (e) {
          case "solid":
            return "✅";
          case "weak":
            return "⚠️";
          case "insight":
            return "💡";
        }
      }
      function tn(e) {
        switch (e) {
          case "solid":
            return "v-kp v-kp-solid";
          case "weak":
            return "v-kp v-kp-weak";
          case "insight":
            return "v-kp v-kp-default";
        }
      }
      const rn = ({ points: e }) =>
          e && 0 !== e.length
            ? je("section", {
                className: "v-section",
                children: [
                  je("h2", {
                    className: "v-section-title",
                    children: "Points clés",
                  }),
                  je("div", {
                    className: "v-kp-list",
                    children: e.map((e, n) =>
                      je(
                        "div",
                        {
                          className: tn(e.type),
                          children: [
                            je("span", {
                              className: "v-kp-icon",
                              "aria-hidden": "true",
                              children: nn(e.type),
                            }),
                            je("span", {
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
        on = ({ content: e }) => {
          const n = ue(() => {
            if (!e) return "";
            const n = (function (e) {
              const n = e.split("\n"),
                t = [];
              let r = !1,
                o = !1;
              for (let e = 0; e < n.length; e++) {
                let i = n[e];
                if (/^-{3,}$/.test(i.trim()) || /^\*{3,}$/.test(i.trim())) {
                  (r && (t.push("</ul>"), (r = !1)),
                    o && (t.push("</ol>"), (o = !1)),
                    t.push('<hr class="ds-md-hr">'));
                  continue;
                }
                const a = i.match(/^(#{1,4})\s+(.+)$/);
                if (a) {
                  (r && (t.push("</ul>"), (r = !1)),
                    o && (t.push("</ol>"), (o = !1)));
                  const e = a[1].length,
                    n = a[2],
                    i = e <= 2 ? qe(n) : "",
                    s = Ze(n),
                    l = i ? `${i}&nbsp;&nbsp;` : "";
                  t.push(`<h${e} class="ds-md-h${e}">${l}${s}</h${e}>`);
                  continue;
                }
                if (i.startsWith("&gt; ") || "&gt;" === i) {
                  (r && (t.push("</ul>"), (r = !1)),
                    o && (t.push("</ol>"), (o = !1)));
                  const e = Ze(i.replace(/^&gt;\s?/, ""));
                  t.push(
                    `<blockquote class="ds-md-blockquote">${e}</blockquote>`,
                  );
                  continue;
                }
                const s = i.match(/^(\s*)[-*]\s+(.+)$/);
                if (s) {
                  (o && (t.push("</ol>"), (o = !1)),
                    r || (t.push('<ul class="ds-md-ul">'), (r = !0)),
                    t.push(`<li>${Ze(s[2])}</li>`));
                  continue;
                }
                const l = i.match(/^(\s*)\d+\.\s+(.+)$/);
                l
                  ? (r && (t.push("</ul>"), (r = !1)),
                    o || (t.push('<ol class="ds-md-ol">'), (o = !0)),
                    t.push(`<li>${Ze(l[2])}</li>`))
                  : (r && (t.push("</ul>"), (r = !1)),
                    o && (t.push("</ol>"), (o = !1)),
                    "" !== i.trim()
                      ? t.push(`<p class="ds-md-p">${Ze(i)}</p>`)
                      : t.push('<div class="ds-md-spacer"></div>'));
              }
              return (r && t.push("</ul>"), o && t.push("</ol>"), t.join("\n"));
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
            ? je("section", {
                className: "v-section",
                children: [
                  je("h2", {
                    className: "v-section-title",
                    children: "Analyse détaillée",
                  }),
                  je("div", {
                    className: "v-markdown",
                    dangerouslySetInnerHTML: { __html: n },
                  }),
                ],
              })
            : null;
        },
        an = ({ facts: e }) =>
          e && 0 !== e.length
            ? je("section", {
                className: "v-section",
                children: [
                  je("h2", {
                    className: "v-section-title",
                    children: "Faits à vérifier",
                  }),
                  je("div", {
                    className: "v-facts",
                    children: e.map((e, n) =>
                      je(
                        "div",
                        {
                          className: "v-fact",
                          children: [
                            je("span", {
                              className: "v-fact-icon",
                              "aria-hidden": "true",
                              children: "🔍",
                            }),
                            je("span", {
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
        ln = ({ summary: e, summaryId: n }) => {
          const [t, r] = le(null),
            o = (function (e) {
              if (!e) return null;
              const n = e.match(/[?&]v=([^&]+)/);
              if (n) return n[1];
              const t = e.match(/youtu\.be\/([^?&]+)/);
              if (t) return t[1];
              const r = e.match(/tiktok\.com\/[^/]+\/video\/(\d+)/);
              return r ? r[1] : null;
            })(e.video_url),
            i = me(async () => {
              let e = `${sn}/summary/${n}`;
              if (o)
                try {
                  const n = await Ve.runtime.sendMessage({
                    action: "SHARE_ANALYSIS",
                    data: { videoId: o },
                  });
                  n?.success && n.share_url && (e = n.share_url);
                } catch {}
              try {
                (await navigator.clipboard.writeText(e), r("Lien copié !"));
              } catch {
                r("Erreur de copie");
              }
              setTimeout(() => r(null), 2200);
            }, [o, n]),
            a = me(() => {
              Ve.tabs.create({ url: `${sn}/summary/${n}` });
            }, [n]),
            s = me(() => {
              Ve.tabs.create({ url: "https://www.youtube.com" });
            }, []);
          return je("div", {
            className: "v-actions",
            role: "toolbar",
            "aria-label": "Actions",
            children: [
              je("button", {
                type: "button",
                className: "v-btn v-btn-primary",
                onClick: i,
                children: [
                  je("span", { "aria-hidden": "true", children: "🔗" }),
                  je("span", { children: t ?? "Partager cette analyse" }),
                ],
              }),
              je("button", {
                type: "button",
                className: "v-btn v-btn-secondary",
                onClick: a,
                children: [
                  je("span", { "aria-hidden": "true", children: "🌐" }),
                  je("span", { children: "Ouvrir sur DeepSight Web" }),
                ],
              }),
              je("button", {
                type: "button",
                className: "v-btn v-btn-secondary",
                onClick: s,
                children: [
                  je("span", { "aria-hidden": "true", children: "🎬" }),
                  je("span", { children: "Analyser une autre vidéo" }),
                ],
              }),
            ],
          });
        },
        cn = (
          e,
          n,
          t,
          r,
          o,
          i,
          a,
          s,
          l,
          c,
          u,
          m,
          _,
          g,
          d,
          h,
          p,
          f,
          A,
          b,
          y,
          v,
          x,
          w,
          k,
          C,
        ) => ({
          hour: e,
          mood: n,
          beamType: t,
          beamColor: r,
          beamAngleDeg: o,
          beamOpacity: i,
          sunVisible: a,
          sunOpacity: s,
          sunX: l,
          sunY: c,
          moonVisible: u,
          moonOpacity: m,
          moonX: _,
          moonY: g,
          ambientPrimary: d,
          ambientSecondary: h,
          ambientTertiary: p,
          starOpacityMul: f,
          starDensity: A,
          haloX: b,
          haloY: y,
          colors: { primary: v, secondary: x, tertiary: w, rays: k, accent: C },
        }),
        un = Object.freeze([
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
          cn(
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
      48 !== un.length &&
        console.warn(
          `[lighting-engine] Expected 48 keyframes, got ${un.length}`,
        );
      const mn = [
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
      function _n(e, n = 0, t = 1) {
        return Math.max(n, Math.min(t, e));
      }
      function gn(e, n, t) {
        return e + (n - e) * _n(t);
      }
      function dn(e, n, t) {
        const r = _n(t);
        return [
          Math.round(e[0] + (n[0] - e[0]) * r),
          Math.round(e[1] + (n[1] - e[1]) * r),
          Math.round(e[2] + (n[2] - e[2]) * r),
        ];
      }
      function hn(e, n = 1) {
        const t = _n(n);
        return `rgba(${e[0]},${e[1]},${e[2]},${t.toFixed(3)})`;
      }
      function pn(e) {
        return e.getHours();
      }
      function fn(e, n = !1) {
        const t = n ? 0.3 : 0.5;
        return Math.min(e, t);
      }
      const An = [99, 102, 241],
        bn = [165, 180, 252];
      function yn(e, n = {}) {
        const t = n.forceTime ?? e,
          r = t.getHours() + t.getMinutes() / 60,
          {
            fromIdx: o,
            toIdx: i,
            factor: a,
          } = (function (e) {
            const n = mn.findIndex((n) => n.hour === e);
            if (-1 !== n) return { fromIdx: n, toIdx: n, factor: 0 };
            const t = mn.findIndex((n) => n.hour > e);
            if (-1 === t)
              return { fromIdx: 47, toIdx: 0, factor: (e - 23.5) / 0.5 };
            if (0 === t) return { fromIdx: 0, toIdx: 0, factor: 0 };
            const r = t - 1,
              o = mn[r],
              i = mn[t];
            return {
              fromIdx: r,
              toIdx: t,
              factor: (e - o.hour) / (i.hour - o.hour),
            };
          })(r),
          s = mn[o],
          l = mn[i],
          c = (function () {
            if ("undefined" == typeof window || !window.matchMedia) return !1;
            try {
              return window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches;
            } catch {
              return !1;
            }
          })(),
          u = (function () {
            if ("undefined" == typeof window || !window.matchMedia) return !1;
            try {
              return window.matchMedia("(prefers-contrast: more)").matches;
            } catch {
              return !1;
            }
          })(),
          m = c ? Math.round(a) : a,
          _ = gn(s.beamAngleDeg, l.beamAngleDeg, m),
          g = dn(s.beamColor, l.beamColor, m),
          d = dn(s.haloPrimary, l.haloPrimary, m),
          h = gn(s.beamOpacity, l.beamOpacity, m) * (n.intensityMul ?? 1),
          p = gn(s.intensity, l.intensity, m) * (n.intensityMul ?? 1),
          f = u ? Math.min(p, 0.3) : p,
          A = a < 0.5 ? s.nightMode : l.nightMode,
          b = void 0 !== n.forceNightMode ? n.forceNightMode : A,
          y = a < 0.5 ? s.haloAccentColor : l.haloAccentColor,
          v = n.skipCssStrings ?? !1;
        return {
          hour: r,
          mood: m < 0.5 ? s.mood : l.mood,
          beam: {
            type: "glowing" === b ? "moon" : "sun",
            color: g,
            cssColor: v ? void 0 : hn(g, h),
            angleDeg: _,
            opacity: h,
          },
          sun: {
            visible: null === b,
            opacity: null === b ? h : 0,
            x: 50,
            y: 20,
          },
          moon: {
            visible: null !== b,
            opacity: null !== b ? h : 0,
            x: 50,
            y: 20,
          },
          ambient: { primary: 0.3 * f, secondary: 0.2 * f, tertiary: 0.1 * f },
          starOpacityMul: null !== b ? 1 : 0,
          starDensity: null !== b ? "dense" : "sparse",
          haloX: 50,
          haloY: 20,
          colors: {
            primary: d,
            secondary: g,
            tertiary: An,
            rays: g,
            accent: bn,
          },
          frameIndex: pn(t),
          nightMode: b,
          haloAccentColor: y,
          isReducedMotion: c,
          isHighContrast: u,
          readingZoneIntensityCap: fn(p, u),
        };
      }
      const vn = {
          dawn: {
            petalOuter: "#FFB347",
            petalInner: "#FFD580",
            core: "#A0522D",
            coreShadow: "#7A3D1F",
            seed: "#1A1A1A",
            stroke: "#1A1A1A",
          },
          day: {
            petalOuter: "#F3BE00",
            petalInner: "#FFD60A",
            core: "#BF5F06",
            coreShadow: "#9C4A00",
            seed: "#1A1A1A",
            stroke: "#1A1A1A",
          },
          dusk: {
            petalOuter: "#FF8C42",
            petalInner: "#FFA76B",
            core: "#8B3A0F",
            coreShadow: "#6B2A08",
            seed: "#1A1A1A",
            stroke: "#1A1A1A",
          },
          night: {
            petalOuter: "#6B5A1F",
            petalInner: "#8A7220",
            core: "#3D1E02",
            coreShadow: "#2A1402",
            seed: "#0A0A0A",
            stroke: "#0F0F0F",
          },
        },
        xn = { dawn: 0.88, day: 1, dusk: 0.88, night: 0.6 },
        wn = {
          dawn: {
            gradient:
              "radial-gradient(circle, rgba(255,179,71,0.32) 0%, rgba(255,179,71,0.1) 40%, transparent 70%)",
            pulse: !1,
          },
          day: { gradient: "transparent", pulse: !1 },
          dusk: {
            gradient:
              "radial-gradient(circle, rgba(255,140,66,0.32) 0%, rgba(244,114,182,0.18) 40%, transparent 70%)",
            pulse: !1,
          },
          night: {
            gradient:
              "radial-gradient(circle, rgba(139,92,246,0.45) 0%, rgba(99,102,241,0.28) 35%, rgba(99,102,241,0.08) 60%, transparent 80%)",
            pulse: !0,
          },
        };
      function kn(e) {
        const n = ((e % 24) + 24) % 24;
        return n >= 5 && n < 7
          ? "dawn"
          : n >= 7 && n < 17
            ? "day"
            : n >= 17 && n < 20
              ? "dusk"
              : "night";
      }
      const Cn = 100;
      function Pn({ size: e = 90, phase: n }) {
        const t = vn[n],
          r = xn[n],
          o = [];
        for (let e = 0; e < 13; e++) {
          const n = (360 * e) / 13;
          o.push(
            `<g transform="rotate(${n} 100 100)"><path d="M 100 68 C 87 60, 87 34, 100 28 C 113 34, 113 60, 100 68 Z" fill="${t.petalOuter}" stroke="${t.stroke}" stroke-width="3" stroke-linejoin="round"/></g>`,
          );
        }
        const i = [],
          a = 360 / 13 / 2;
        for (let e = 0; e < 13; e++) {
          const n = (360 * e) / 13 + a;
          i.push(
            `<g transform="rotate(${n} 100 100)"><path d="M 100 70 C 91 64, 91 40, 100 36 C 109 40, 109 64, 100 70 Z" fill="${t.petalInner}" stroke="${t.stroke}" stroke-width="2.5" stroke-linejoin="round" opacity="0.92"/></g>`,
          );
        }
        const s = [`<circle cx="100" cy="100" r="3" fill="${t.seed}"/>`];
        for (let e = 0; e < 6; e++) {
          const n = (60 * e * Math.PI) / 180,
            r = Cn + 11 * Math.cos(n),
            o = Cn + 11 * Math.sin(n);
          s.push(
            `<circle cx="${r.toFixed(2)}" cy="${o.toFixed(2)}" r="3" fill="${t.seed}"/>`,
          );
        }
        for (let e = 0; e < 6; e++) {
          const n = ((60 * e + 30) * Math.PI) / 180,
            r = Cn + 21 * Math.cos(n),
            o = Cn + 21 * Math.sin(n);
          s.push(
            `<circle cx="${r.toFixed(2)}" cy="${o.toFixed(2)}" r="3" fill="${t.seed}"/>`,
          );
        }
        return (
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${e}" height="${e}" aria-hidden="true" style="display:block"><g style="transform-origin:100px 100px;transform:scale(${r});transition:transform 1.5s cubic-bezier(0.4,0,0.2,1)">` +
          i.join("") +
          o.join("") +
          "</g>" +
          `<circle cx="100" cy="100" r="32" fill="${t.core}" stroke="${t.stroke}" stroke-width="3"/>` +
          `<circle cx="100" cy="100" r="28" fill="${t.coreShadow}" opacity="0.6"/>` +
          s.join("") +
          "</svg>"
        );
      }
      const Mn = (function (e) {
        function n(e) {
          var t, r;
          return (
            this.getChildContext ||
              ((t = new Set()),
              ((r = {})[n.__c] = this),
              (this.getChildContext = function () {
                return r;
              }),
              (this.componentWillUnmount = function () {
                t = null;
              }),
              (this.shouldComponentUpdate = function (e) {
                this.props.value != e.value &&
                  t.forEach(function (e) {
                    ((e.__e = !0), N(e));
                  });
              }),
              (this.sub = function (e) {
                t.add(e);
                var n = e.componentWillUnmount;
                e.componentWillUnmount = function () {
                  (t && t.delete(e), n && n.call(e));
                };
              })),
            e.children
          );
        }
        return (
          (n.__c = "__cC" + h++),
          (n.__ = e),
          (n.Provider =
            n.__l =
            (n.Consumer = function (e, n) {
              return e.children(n);
            }).contextType =
              n),
          n
        );
      })(null);
      function On({ enabled: e = !0, children: n }) {
        const [t, r] = le(() => yn(new Date()));
        return (
          ce(() => {
            if (!e) return;
            const n = () => r(yn(new Date()));
            n();
            const t = setInterval(n, 3e4);
            return () => clearInterval(t);
          }, [e]),
          je(Mn.Provider, { value: { preset: t, enabled: e }, children: n })
        );
      }
      const Nn = Math.round(56 * 1.6);
      function Sn() {
        const { preset: e, enabled: n } = (function () {
          const e = (function (e) {
            var n = K.context[e.__c],
              t = se(Y++, 9);
            return (
              (t.c = e),
              n
                ? (null == t.__ && ((t.__ = !0), n.sub(K)), n.props.value)
                : e.__
            );
          })(Mn);
          return e || { preset: yn(new Date()), enabled: !1 };
        })();
        if (!n) return null;
        const t = kn(e.frameIndex),
          r = (function (e) {
            const n = ((e % 24) + 24) % 24;
            return n < 5 || n >= 20
              ? 175
              : n < 7
                ? 175 - ((n - 5) / 2) * 260
                : n >= 17
                  ? 85 + ((n - 17) / 3) * 90
                  : ((n - 12) / 5) * 85;
          })(e.frameIndex),
          o = (function (e) {
            const n = ((e % 24) + 24) % 24,
              t = kn(n);
            if ("night" === t) return 0.55;
            if ("dawn" === t) return 0.6 + ((n - 5) / 2) * 0.3;
            if ("dusk" === t) return 0.9 - ((n - 17) / 3) * 0.4;
            const r = Math.abs(n - 12);
            return Math.max(0.85, 1 - 0.03 * r);
          })(e.frameIndex),
          i = wn[t],
          a =
            ((s = e.sun.x),
            (l = e.sun.visible),
            (c = e.moon.x),
            (l ? s : c) > 50 ? "left" : "right");
        var s, l, c;
        const u = 14 - (Nn - 56) / 2;
        return je("div", {
          "aria-hidden": "true",
          className: "sunflower-mascot",
          "data-sunflower-phase": t,
          "data-sunflower-corner": a,
          style: {
            position: "fixed",
            bottom: u,
            ...("left" === a ? { left: u } : { right: u }),
            width: Nn,
            height: Nn,
            pointerEvents: "none",
            zIndex: 2,
            transition:
              "left 2s cubic-bezier(0.4,0,0.2,1), right 2s cubic-bezier(0.4,0,0.2,1)",
          },
          children: [
            je("div", {
              className: i.pulse
                ? "ds-sunflower-halo ds-sunflower-halo--pulse"
                : "ds-sunflower-halo",
              style: {
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: i.gradient,
                transition: "background 1.5s cubic-bezier(0.4,0,0.2,1)",
              },
            }),
            je("div", {
              style: {
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: `translate(-50%, -50%) rotate(${r}deg)`,
                opacity: o * e.beam.opacity,
                transition:
                  "transform 1.5s cubic-bezier(0.4,0,0.2,1), opacity 1.5s cubic-bezier(0.4,0,0.2,1)",
              },
              dangerouslySetInnerHTML: { __html: Pn({ size: 56, phase: t }) },
            }),
          ],
        });
      }
      const Dn = "ambient_lighting_enabled",
        In = ({ summaryId: e }) => {
          const [n, t] = le(null),
            [r, o] = le(!0),
            [i, a] = le(null),
            [s, l] = le(!0);
          if (
            (ce(() => {
              const e = Ve.storage?.local;
              e?.get &&
                e
                  .get(Dn)
                  .then((e) => {
                    const n = e?.[Dn];
                    !1 === n && l(!1);
                  })
                  .catch(() => {});
            }, []),
            ce(() => {
              if (!e) return (a("ID d'analyse manquant"), void o(!1));
              let n = !1;
              return (
                Ve.runtime
                  .sendMessage({
                    action: "GET_SUMMARY",
                    data: { summaryId: e },
                  })
                  .then((e) => {
                    if (n) return;
                    const r = e;
                    r?.success && r.summary
                      ? t(r.summary)
                      : a(r?.error || "Analyse introuvable");
                  })
                  .catch((e) => {
                    n || a(e.message);
                  })
                  .finally(() => {
                    n || o(!1);
                  }),
                () => {
                  n = !0;
                }
              );
            }, [e]),
            r)
          )
            return je(On, {
              enabled: s,
              children: [
                je(Sn, {}),
                je("div", {
                  className: "viewer-loading",
                  children: [
                    je("div", {
                      className: "viewer-spinner",
                      "aria-hidden": "true",
                    }),
                    je("p", { children: "Chargement de l'analyse…" }),
                  ],
                }),
              ],
            });
          if (i || !n)
            return je(On, {
              enabled: s,
              children: [
                je(Sn, {}),
                je("div", {
                  className: "viewer-error",
                  children: [
                    je("h1", { children: "Analyse introuvable" }),
                    je("p", { children: i ?? "Aucune donnée retournée." }),
                    je("button", {
                      type: "button",
                      className: "v-btn v-btn-primary",
                      onClick: () => window.close(),
                      children: "Fermer",
                    }),
                  ],
                }),
              ],
            });
          const c = (function (e) {
            const n = (function (e) {
                const n = [
                  /#+\s*(?:Conclusion|Verdict|Synthèse|Résumé|Summary|En résumé|Final Assessment|Overall Assessment)[^\n]*\n([\s\S]*?)(?=\n#|\n---|\n\*{3,}|$)/i,
                  /\*\*(?:Conclusion|Verdict|Synthèse|En résumé|Summary)\*\*[:\s]*([\s\S]*?)(?=\n\n|\n#|\n---|\n\*{3,}|$)/i,
                ];
                for (const t of n) {
                  const n = e.match(t);
                  if (n && n[1]) {
                    const e = Ye(n[1]).trim();
                    if (e.length > 20) return Ke(e, 200);
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
                  ? Ke(Ye(t[t.length - 1]), 200)
                  : "Analysis complete. See detailed view for full results.";
              })(e),
              t = (function (e) {
                const n = [],
                  t = e.split("\n"),
                  r = [/\b(?:SOLIDE|SOLID)\b/i, /\u2705\s*\*\*/, /\u2705/],
                  o = [
                    /\b(?:A VERIFIER|TO VERIFY|QUESTIONABLE|WEAK|INCERTAIN|UNCERTAIN)\b/i,
                    /\u26A0\uFE0F\s*\*\*/,
                    /\u2753/,
                    /\u26A0/,
                  ],
                  i = [/\b(?:PLAUSIBLE)\b/i, /\uD83D\uDCA1/];
                for (const e of t) {
                  const t = e.replace(/^[\s\-*]+/, "").trim();
                  if (t.length < 10) continue;
                  let a = null;
                  if (
                    (r.some((n) => n.test(e))
                      ? (a = "solid")
                      : o.some((n) => n.test(e))
                        ? (a = "weak")
                        : i.some((n) => n.test(e)) && (a = "insight"),
                    a && n.filter((e) => e.type === a).length < 2)
                  ) {
                    const e = Ye(t)
                      .replace(
                        /\b(?:SOLIDE|SOLID|PLAUSIBLE|INCERTAIN|UNCERTAIN|A VERIFIER|TO VERIFY|QUESTIONABLE|WEAK)\b\s*[:—\-–]?\s*/gi,
                        "",
                      )
                      .replace(/^[✅⚠️❓💡🔍🔬]\s*/u, "")
                      .trim();
                    e.length > 10 && n.push({ type: a, text: Ke(e, 120) });
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
                        const e = Ye(t.replace(/^[\s]*[-*]\s+/, ""));
                        e.length > 10 &&
                          !n.some((n) => n.text === Ke(e, 120)) &&
                          n.push({ type: "insight", text: Ke(e, 120) });
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
                      const e = Ye(t.replace(/^[-*]\s+/, "")).trim();
                      e.length > 0 && e.length < 30 && n.push(e);
                    }
                }
                if (0 === n.length) {
                  const t = e.match(/^#{2,3}\s+(.+)$/gm);
                  if (t) {
                    const e =
                      /^(?:Conclusion|Summary|Résumé|Synthèse|Introduction|Verdict|Analysis|Points?\s+(?:clés?|forts?|faibles?)|Key\s+(?:Points?|Findings?)|Strengths?|Weaknesses?|Overview)/i;
                    for (const r of t) {
                      const t = Ye(r.replace(/^#{2,3}\s+/, "")).trim();
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
          return je(On, {
            enabled: s,
            children: [
              je(Sn, {}),
              je("div", {
                className: "viewer-container",
                children: [
                  je(Je, { summary: n }),
                  je(en, { verdict: c.verdict }),
                  je(rn, { points: c.keyPoints }),
                  je(an, { facts: n.facts_to_verify ?? [] }),
                  je(on, { content: n.summary_content }),
                  je(ln, { summary: n, summaryId: n.id }),
                ],
              }),
            ],
          });
        },
        En = new URLSearchParams(window.location.search),
        $n = parseInt(En.get("id") || "0", 10),
        Tn = document.getElementById("viewer-root");
      var Fn;
      Tn &&
        ((Fn = Tn),
        {
          render: function (e) {
            !(function (e, n, t) {
              (null == n.__k && (n.textContent = ""),
                Z(e, n),
                "function" == typeof t && t(),
                e && e.__c);
            })(e, Fn);
          },
          unmount: function () {
            !(function (e) {
              e.__k && Z(null, e);
            })(Fn);
          },
        }).render(je(In, { summaryId: $n }));
    })());
})();
