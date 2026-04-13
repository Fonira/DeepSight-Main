/******/ (() => {
  // webpackBootstrap
  /******/ "use strict";
  /******/ var __webpack_modules__ = {
    /***/ "./src/utils/config.ts"(
      /*!*****************************!*\
  !*** ./src/utils/config.ts ***!
  \*****************************/
      __unused_webpack_module,
      __webpack_exports__,
      __webpack_require__,
    ) {
      __webpack_require__.r(__webpack_exports__);
      /* harmony export */ __webpack_require__.d(__webpack_exports__, {
        /* harmony export */ API_BASE_URL: () => /* binding */ API_BASE_URL,
        /* harmony export */ GOOGLE_CLIENT_ID: () =>
          /* binding */ GOOGLE_CLIENT_ID,
        /* harmony export */ WEBAPP_URL: () => /* binding */ WEBAPP_URL,
        /* harmony export */
      });
      const API_BASE_URL = "https://api.deepsightsynthesis.com/api";
      const WEBAPP_URL = "https://www.deepsightsynthesis.com";
      // Google OAuth Client ID (Web Application type)
      // Configure in Google Cloud Console: APIs & Services > Credentials
      // Add chrome-extension://<EXTENSION_ID>/ as authorized redirect URI
      const GOOGLE_CLIENT_ID =
        "763654536492-8hkdd3n31tqeodnhcak6ef8asu4v287j.apps.googleusercontent.com";
      // ⚠️ Après publication Chrome Web Store : ajouter chrome-extension://<EXTENSION_ID>/
      // comme redirect URI autorisé dans Google Cloud Console > APIs & Services > Credentials

      /***/
    },

    /******/
  };
  /************************************************************************/
  /******/ // The module cache
  /******/ var __webpack_module_cache__ = {};
  /******/
  /******/ // The require function
  /******/ function __webpack_require__(moduleId) {
    /******/ // Check if module is in cache
    /******/ var cachedModule = __webpack_module_cache__[moduleId];
    /******/ if (cachedModule !== undefined) {
      /******/ return cachedModule.exports;
      /******/
    }
    /******/ // Check if module exists (development only)
    /******/ if (__webpack_modules__[moduleId] === undefined) {
      /******/ var e = new Error("Cannot find module '" + moduleId + "'");
      /******/ e.code = "MODULE_NOT_FOUND";
      /******/ throw e;
      /******/
    }
    /******/ // Create a new module (and put it into the cache)
    /******/ var module = (__webpack_module_cache__[moduleId] = {
      /******/ // no module.id needed
      /******/ // no module.loaded needed
      /******/ exports: {},
      /******/
    });
    /******/
    /******/ // Execute the module function
    /******/ __webpack_modules__[moduleId](
      module,
      module.exports,
      __webpack_require__,
    );
    /******/
    /******/ // Return the exports of the module
    /******/ return module.exports;
    /******/
  }
  /******/
  /************************************************************************/
  /******/ /* webpack/runtime/define property getters */
  /******/ (() => {
    /******/ // define getter functions for harmony exports
    /******/ __webpack_require__.d = (exports, definition) => {
      /******/ for (var key in definition) {
        /******/ if (
          __webpack_require__.o(definition, key) &&
          !__webpack_require__.o(exports, key)
        ) {
          /******/ Object.defineProperty(exports, key, {
            enumerable: true,
            get: definition[key],
          });
          /******/
        }
        /******/
      }
      /******/
    };
    /******/
  })();
  /******/
  /******/ /* webpack/runtime/hasOwnProperty shorthand */
  /******/ (() => {
    /******/ __webpack_require__.o = (obj, prop) =>
      Object.prototype.hasOwnProperty.call(obj, prop);
    /******/
  })();
  /******/
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
  // This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
  (() => {
    /*!*******************************!*\
  !*** ./src/authSync/index.ts ***!
  \*******************************/
    __webpack_require__.r(__webpack_exports__);
    /* harmony import */ var _utils_config__WEBPACK_IMPORTED_MODULE_0__ =
      __webpack_require__(/*! ../utils/config */ "./src/utils/config.ts");

    // This script runs in the ISOLATED world.
    // It listens for messages from the MAIN world script (authSyncMain)
    // and forwards auth data to the background service worker.
    window.addEventListener("message", async (event) => {
      if (
        event.origin !==
        new URL(_utils_config__WEBPACK_IMPORTED_MODULE_0__.WEBAPP_URL).origin
      )
        return;
      const { type, payload } = event.data || {};
      if (type === "DEEPSIGHT_AUTH_SUCCESS") {
        try {
          const response = await chrome.runtime.sendMessage({
            action: "SYNC_AUTH_FROM_WEBSITE",
            data: payload,
          });
          if (response?.success) {
            window.postMessage(
              { type: "DEEPSIGHT_EXTENSION_AUTH_SYNCED" },
              _utils_config__WEBPACK_IMPORTED_MODULE_0__.WEBAPP_URL,
            );
          }
        } catch (e) {
          console.error("[DeepSight Extension] Failed to sync auth:", e);
        }
      }
    });
  })();

  /******/
})();
//# sourceMappingURL=authSync.js.map
