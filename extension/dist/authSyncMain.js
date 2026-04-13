/******/ (() => {
  // webpackBootstrap
  /******/ "use strict";
  /******/ // The require scope
  /******/ var __webpack_require__ = {};
  /******/
  /************************************************************************/
  /******/ /* webpack/runtime/make namespace object */
  /******/ (() => {
    /******/ // define __esModule on exports
    /******/ __webpack_require__.r = (exports) => {
      /******/ if (typeof Symbol !== "undefined" && Symbol.toStringTag) {
        /******/ Object.defineProperty(exports, Symbol.toStringTag, {
          value: "Module",
        });
        /******/
      }
      /******/ Object.defineProperty(exports, "__esModule", { value: true });
      /******/
    };
    /******/
  })();
  /******/
  /************************************************************************/
  var __webpack_exports__ = {};
  /*!***********************************!*\
  !*** ./src/authSyncMain/index.ts ***!
  \***********************************/
  __webpack_require__.r(__webpack_exports__);
  // This script runs in the MAIN world (page context).
  // It can access the page's localStorage but NOT chrome.* APIs.
  // It communicates with the isolated-world authSync script via postMessage.
  window.__DEEPSIGHT_EXTENSION_PRESENT__ = true;
  function syncAuth() {
    try {
      const accessToken = localStorage.getItem("accessToken");
      const refreshToken = localStorage.getItem("refreshToken");
      const userStr = localStorage.getItem("user");
      if (accessToken && refreshToken && userStr) {
        window.postMessage(
          {
            type: "DEEPSIGHT_AUTH_SUCCESS",
            payload: {
              accessToken,
              refreshToken,
              user: JSON.parse(userStr),
            },
          },
          window.location.origin,
        );
      }
    } catch (e) {
      console.error("[DeepSight] Failed to read localStorage:", e);
    }
  }
  // Wait for page to fully initialize localStorage
  setTimeout(syncAuth, 2000);

  /******/
})();
//# sourceMappingURL=authSyncMain.js.map
