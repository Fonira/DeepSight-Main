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

    /***/ "./src/utils/storage.ts"(
      /*!******************************!*\
  !*** ./src/utils/storage.ts ***!
  \******************************/
      __unused_webpack_module,
      __webpack_exports__,
      __webpack_require__,
    ) {
      __webpack_require__.r(__webpack_exports__);
      /* harmony export */ __webpack_require__.d(__webpack_exports__, {
        /* harmony export */ addRecentAnalysis: () =>
          /* binding */ addRecentAnalysis,
        /* harmony export */ clearStoredAuth: () =>
          /* binding */ clearStoredAuth,
        /* harmony export */ getFreeAnalysisCount: () =>
          /* binding */ getFreeAnalysisCount,
        /* harmony export */ getRecentAnalyses: () =>
          /* binding */ getRecentAnalyses,
        /* harmony export */ getStorageItem: () => /* binding */ getStorageItem,
        /* harmony export */ getStoredSettings: () =>
          /* binding */ getStoredSettings,
        /* harmony export */ getStoredTokens: () =>
          /* binding */ getStoredTokens,
        /* harmony export */ getStoredUser: () => /* binding */ getStoredUser,
        /* harmony export */ incrementFreeAnalysisCount: () =>
          /* binding */ incrementFreeAnalysisCount,
        /* harmony export */ setStorageItem: () => /* binding */ setStorageItem,
        /* harmony export */ setStoredSettings: () =>
          /* binding */ setStoredSettings,
        /* harmony export */ setStoredTokens: () =>
          /* binding */ setStoredTokens,
        /* harmony export */ setStoredUser: () => /* binding */ setStoredUser,
        /* harmony export */
      });
      // ── Token Storage ──
      async function getStoredTokens() {
        try {
          const data = await chrome.storage.local.get([
            "accessToken",
            "refreshToken",
          ]);
          return {
            accessToken: data.accessToken || null,
            refreshToken: data.refreshToken || null,
          };
        } catch {
          return { accessToken: null, refreshToken: null };
        }
      }
      async function setStoredTokens(accessToken, refreshToken) {
        // Bug #10: guard against undefined values
        const payload = { accessToken };
        if (refreshToken) payload.refreshToken = refreshToken;
        try {
          await chrome.storage.local.set(payload);
        } catch {
          // Storage quota or permission error — fail silently
        }
      }
      async function clearStoredAuth() {
        try {
          await chrome.storage.local.remove([
            "accessToken",
            "refreshToken",
            "user",
          ]);
        } catch {
          // Ignore errors on clear
        }
      }
      // ── User Storage ──
      async function getStoredUser() {
        try {
          const data = await chrome.storage.local.get(["user"]);
          return data.user || null;
        } catch {
          return null;
        }
      }
      async function setStoredUser(user) {
        try {
          await chrome.storage.local.set({ user });
        } catch {
          // Storage quota or permission error — fail silently
        }
      }
      // ── Settings Storage ──
      async function getStoredSettings() {
        const data = await chrome.storage.local.get(["settings"]);
        return (
          data.settings || {
            defaultMode: "standard",
            defaultLang: "fr",
            showNotifications: true,
          }
        );
      }
      async function setStoredSettings(settings) {
        await chrome.storage.local.set({ settings });
      }
      // ── Recent Analyses Storage ──
      async function getRecentAnalyses() {
        const data = await chrome.storage.local.get(["recentAnalyses"]);
        return data.recentAnalyses || [];
      }
      async function addRecentAnalysis(analysis) {
        const existing = await getRecentAnalyses();
        const filtered = existing.filter((a) => a.videoId !== analysis.videoId);
        filtered.unshift({ ...analysis, timestamp: Date.now() });
        await chrome.storage.local.set({
          recentAnalyses: filtered.slice(0, 20),
        });
      }
      // ── Free (Guest) Analysis Counter ──
      async function getFreeAnalysisCount() {
        const data = await chrome.storage.local.get([
          "deepsight_free_analyses",
        ]);
        return data.deepsight_free_analyses || 0;
      }
      async function incrementFreeAnalysisCount() {
        const current = await getFreeAnalysisCount();
        const next = current + 1;
        await chrome.storage.local.set({ deepsight_free_analyses: next });
        return next;
      }
      // ── Generic Helpers ──
      async function getStorageItem(key) {
        const data = await chrome.storage.local.get([key]);
        return data[key] ?? null;
      }
      async function setStorageItem(key, value) {
        await chrome.storage.local.set({ [key]: value });
      }

      /***/
    },

    /***/ "./src/utils/video.ts"(
      /*!****************************!*\
  !*** ./src/utils/video.ts ***!
  \****************************/
      __unused_webpack_module,
      __webpack_exports__,
      __webpack_require__,
    ) {
      __webpack_require__.r(__webpack_exports__);
      /* harmony export */ __webpack_require__.d(__webpack_exports__, {
        /* harmony export */ detectCurrentPagePlatform: () =>
          /* binding */ detectCurrentPagePlatform,
        /* harmony export */ detectPlatform: () => /* binding */ detectPlatform,
        /* harmony export */ extractTikTokVideoId: () =>
          /* binding */ extractTikTokVideoId,
        /* harmony export */ extractVideoId: () => /* binding */ extractVideoId,
        /* harmony export */ extractYouTubeVideoId: () =>
          /* binding */ extractYouTubeVideoId,
        /* harmony export */ getThumbnailUrl: () =>
          /* binding */ getThumbnailUrl,
        /* harmony export */ getVideoUrl: () => /* binding */ getVideoUrl,
        /* harmony export */ getYouTubeThumbnailUrl: () =>
          /* binding */ getYouTubeThumbnailUrl,
        /* harmony export */ isTikTokUrl: () => /* binding */ isTikTokUrl,
        /* harmony export */ isYouTubeUrl: () => /* binding */ isYouTubeUrl,
        /* harmony export */
      });
      /**
       * 🎬 VIDEO UTILS — YouTube + TikTok detection & extraction
       */
      // ── YouTube ──
      const YOUTUBE_ID_PATTERNS = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&?\s]+)/,
        /youtube\.com\/shorts\/([^&?\s]+)/,
      ];
      function extractYouTubeVideoId(url) {
        for (const pattern of YOUTUBE_ID_PATTERNS) {
          const match = url.match(pattern);
          if (match) return match[1];
        }
        return null;
      }
      function getYouTubeThumbnailUrl(videoId) {
        return `https://img.youtube.com/vi/${videoId}/default.jpg`;
      }
      // ── TikTok ──
      const TIKTOK_PATTERNS = [
        /tiktok\.com\/@[\w.-]+\/video\/(\d+)/i,
        /vm\.tiktok\.com\/([\w-]+)/i,
        /m\.tiktok\.com\/v\/(\d+)/i,
        /tiktok\.com\/t\/([\w-]+)/i,
        /tiktok\.com\/video\/(\d+)/i,
      ];
      function extractTikTokVideoId(url) {
        for (const pattern of TIKTOK_PATTERNS) {
          const match = url.match(pattern);
          if (match) return match[1];
        }
        return null;
      }
      function isTikTokUrl(url) {
        return TIKTOK_PATTERNS.some((p) => p.test(url));
      }
      function isYouTubeUrl(url) {
        return YOUTUBE_ID_PATTERNS.some((p) => p.test(url));
      }
      // ── Multi-platform ──
      function detectPlatform(url) {
        if (isYouTubeUrl(url)) return "youtube";
        if (isTikTokUrl(url)) return "tiktok";
        return null;
      }
      function extractVideoId(url) {
        return extractYouTubeVideoId(url) || extractTikTokVideoId(url);
      }
      function getThumbnailUrl(videoId, platform) {
        if (platform === "tiktok") return null; // TikTok thumbnails come from backend
        return `https://img.youtube.com/vi/${videoId}/default.jpg`;
      }
      function getVideoUrl(videoId, platform = "youtube") {
        if (platform === "tiktok")
          return `https://www.tiktok.com/video/${videoId}`;
        return `https://www.youtube.com/watch?v=${videoId}`;
      }
      function detectCurrentPagePlatform() {
        const hostname = window.location.hostname;
        if (hostname.includes("youtube.com") || hostname.includes("youtu.be"))
          return "youtube";
        if (hostname.includes("tiktok.com")) return "tiktok";
        return null;
      }

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
    /*!***************************!*\
  !*** ./src/background.ts ***!
  \***************************/
    __webpack_require__.r(__webpack_exports__);
    /* harmony import */ var _utils_config__WEBPACK_IMPORTED_MODULE_0__ =
      __webpack_require__(/*! ./utils/config */ "./src/utils/config.ts");
    /* harmony import */ var _utils_storage__WEBPACK_IMPORTED_MODULE_1__ =
      __webpack_require__(/*! ./utils/storage */ "./src/utils/storage.ts");
    /* harmony import */ var _utils_video__WEBPACK_IMPORTED_MODULE_2__ =
      __webpack_require__(/*! ./utils/video */ "./src/utils/video.ts");

    // ── Core API Request ──
    async function apiRequest(endpoint, options = {}) {
      const { accessToken } = await (0,
      _utils_storage__WEBPACK_IMPORTED_MODULE_1__.getStoredTokens)();
      const headers = {
        "Content-Type": "application/json",
        ...options.headers,
      };
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }
      const response = await fetch(
        `${_utils_config__WEBPACK_IMPORTED_MODULE_0__.API_BASE_URL}${endpoint}`,
        {
          ...options,
          headers,
        },
      );
      if (response.status === 401) {
        const refreshed = await tryRefreshToken();
        if (refreshed) {
          const { accessToken: newToken } = await (0,
          _utils_storage__WEBPACK_IMPORTED_MODULE_1__.getStoredTokens)();
          headers["Authorization"] = `Bearer ${newToken}`;
          const retryResponse = await fetch(
            `${_utils_config__WEBPACK_IMPORTED_MODULE_0__.API_BASE_URL}${endpoint}`,
            {
              ...options,
              headers,
            },
          );
          if (!retryResponse.ok) {
            throw new Error(`API Error: ${retryResponse.status}`);
          }
          return retryResponse.json();
        }
        await (0,
        _utils_storage__WEBPACK_IMPORTED_MODULE_1__.clearStoredAuth)();
        throw new Error("SESSION_EXPIRED");
      }
      if (!response.ok) {
        const errorBody = await response
          .json()
          .catch(() => ({ detail: "Unknown error" }));
        throw new Error(errorBody.detail || `API Error: ${response.status}`);
      }
      return response.json();
    }
    // ── Auth API ──
    async function tryRefreshToken() {
      const { refreshToken } = await (0,
      _utils_storage__WEBPACK_IMPORTED_MODULE_1__.getStoredTokens)();
      if (!refreshToken) {
        return false;
      }
      try {
        const response = await fetch(
          `${_utils_config__WEBPACK_IMPORTED_MODULE_0__.API_BASE_URL}/auth/refresh`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
          },
        );
        if (!response.ok) {
          return false;
        }
        const data = await response.json();
        if (!data.access_token) {
          return false;
        }
        // Bug #10: keep existing refresh_token if server doesn't send a new one
        const newRefreshToken = data.refresh_token || refreshToken;
        await (0, _utils_storage__WEBPACK_IMPORTED_MODULE_1__.setStoredTokens)(
          data.access_token,
          newRefreshToken,
        );
        await (0, _utils_storage__WEBPACK_IMPORTED_MODULE_1__.setStoredUser)(
          data.user,
        );
        return true;
      } catch {
        return false;
      }
    }
    async function login(email, password) {
      const response = await fetch(
        `${_utils_config__WEBPACK_IMPORTED_MODULE_0__.API_BASE_URL}/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        },
      );
      if (!response.ok) {
        const errorBody = await response
          .json()
          .catch(() => ({ detail: "Login failed" }));
        throw new Error(errorBody.detail || "Login failed");
      }
      const data = await response.json();
      await (0, _utils_storage__WEBPACK_IMPORTED_MODULE_1__.setStoredTokens)(
        data.access_token,
        data.refresh_token,
      );
      await (0, _utils_storage__WEBPACK_IMPORTED_MODULE_1__.setStoredUser)(
        data.user,
      );
      return data.user;
    }
    async function loginWithGoogle() {
      if (!_utils_config__WEBPACK_IMPORTED_MODULE_0__.GOOGLE_CLIENT_ID) {
        throw new Error(
          "Google OAuth not configured. Use email/password login.",
        );
      }
      const redirectUrl = chrome.identity.getRedirectURL();
      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth` +
        `?client_id=${encodeURIComponent(_utils_config__WEBPACK_IMPORTED_MODULE_0__.GOOGLE_CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
        `&response_type=token` +
        `&scope=${encodeURIComponent("email profile")}` +
        `&prompt=select_account`;
      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true,
      });
      if (!responseUrl) throw new Error("Google login cancelled");
      const hashParams = new URLSearchParams(responseUrl.split("#")[1]);
      const googleAccessToken = hashParams.get("access_token");
      if (!googleAccessToken)
        throw new Error("No access token received from Google");
      const response = await fetch(
        `${_utils_config__WEBPACK_IMPORTED_MODULE_0__.API_BASE_URL}/auth/google/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: googleAccessToken }),
        },
      );
      if (!response.ok) {
        const errorBody = await response
          .json()
          .catch(() => ({ detail: "Google login failed" }));
        throw new Error(errorBody.detail || "Google login failed on server");
      }
      const data = await response.json();
      await (0, _utils_storage__WEBPACK_IMPORTED_MODULE_1__.setStoredTokens)(
        data.access_token,
        data.refresh_token,
      );
      await (0, _utils_storage__WEBPACK_IMPORTED_MODULE_1__.setStoredUser)(
        data.user,
      );
      return data.user;
    }
    async function logout() {
      try {
        await apiRequest("/auth/logout", { method: "POST" });
      } catch {
        // Ignore errors on logout
      }
      await (0, _utils_storage__WEBPACK_IMPORTED_MODULE_1__.clearStoredAuth)();
    }
    async function getCurrentUser() {
      const user = await apiRequest("/auth/me");
      await (0, _utils_storage__WEBPACK_IMPORTED_MODULE_1__.setStoredUser)(
        user,
      );
      return user;
    }
    // ── Plan API ──
    async function fetchPlan() {
      return apiRequest("/billing/my-plan?platform=extension");
    }
    // ── Video API ──
    async function analyzeVideo(url, options = {}) {
      return apiRequest("/videos/analyze", {
        method: "POST",
        body: JSON.stringify({
          url,
          mode: options.mode || "standard",
          lang: options.lang || "fr",
          category: options.category || "auto",
          model: options.model,
          force_refresh: options.force_refresh || false,
        }),
      });
    }
    async function getTaskStatus(taskId) {
      return apiRequest(`/videos/status/${taskId}`);
    }
    async function cancelTask(taskId) {
      return apiRequest(`/videos/cancel/${taskId}`, {
        method: "POST",
      });
    }
    async function getSummary(summaryId) {
      const summary = await apiRequest(`/videos/summary/${summaryId}`);
      // Enrichir avec le score Tournesol (non-bloquant)
      if (summary.video_url && !summary.tournesol) {
        try {
          const videoIdMatch = summary.video_url.match(/[?&]v=([^&]+)/);
          const videoId = videoIdMatch?.[1];
          if (videoId) {
            const tournesolData = await apiRequest(
              `/tournesol/video/${videoId}`,
            );
            if (tournesolData.found && tournesolData.data) {
              summary.tournesol = {
                found: true,
                tournesol_score: tournesolData.data.tournesol_score,
                n_comparisons: tournesolData.data.n_comparisons,
                n_contributors: tournesolData.data.n_contributors,
                criteria_scores: tournesolData.data.criteria_scores,
              };
            }
          }
        } catch {
          // Tournesol fetch failed — silently continue without score
        }
      }
      return summary;
    }
    // ── Share API ──
    async function shareAnalysis(videoId) {
      return apiRequest("/share", {
        method: "POST",
        body: JSON.stringify({ video_id: videoId }),
      });
    }
    // ── Quick Chat API ──
    async function quickChat(url, lang = "fr") {
      return apiRequest("/videos/quick-chat", {
        method: "POST",
        body: JSON.stringify({ url, lang }),
      });
    }
    // ── Chat API ──
    async function askQuestion(summaryId, question, options = {}) {
      return apiRequest("/chat/ask", {
        method: "POST",
        body: JSON.stringify({
          question,
          summary_id: summaryId,
          mode: options.mode || "standard",
          use_web_search: options.use_web_search || false,
        }),
      });
    }
    async function getChatHistory(summaryId) {
      try {
        const result = await apiRequest(`/chat/${summaryId}/history`);
        return result.messages || [];
      } catch {
        return [];
      }
    }
    // ── Helpers ──
    async function isAuthenticated() {
      const { accessToken } = await (0,
      _utils_storage__WEBPACK_IMPORTED_MODULE_1__.getStoredTokens)();
      return !!accessToken;
    }
    async function pollAnalysis(taskId, originTabId) {
      const MAX_DURATION_MS = 30 * 60 * 1000;
      const startTime = Date.now();
      let pollInterval = 2000;
      while (Date.now() - startTime < MAX_DURATION_MS) {
        const status = await getTaskStatus(taskId);
        if (
          status.status === "completed" ||
          status.status === "failed" ||
          status.status === "cancelled"
        ) {
          return status;
        }
        // Send progress only to the originating tab (Bug #8 fix)
        if (originTabId !== undefined) {
          chrome.tabs
            .sendMessage(originTabId, {
              action: "ANALYSIS_PROGRESS",
              data: {
                taskId,
                progress: status.progress,
                message: status.message,
              },
            })
            .catch(() => {});
        }
        const elapsed = Date.now() - startTime;
        if (elapsed > 5 * 60 * 1000) pollInterval = 8000;
        else if (elapsed > 2 * 60 * 1000) pollInterval = 5000;
        else if (elapsed > 30 * 1000) pollInterval = 3000;
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
      throw new Error("Analysis timeout — video may be too long");
    }
    // ── Message Handler ──
    async function handleMessage(message, senderTabId) {
      switch (message.action) {
        case "CHECK_AUTH": {
          if (await isAuthenticated()) {
            try {
              return {
                authenticated: true,
                user:
                  (await (0,
                  _utils_storage__WEBPACK_IMPORTED_MODULE_1__.getStoredUser)()) ??
                  undefined,
              };
            } catch {
              return { authenticated: false };
            }
          }
          return { authenticated: false };
        }
        case "GET_USER": {
          try {
            const user = await getCurrentUser();
            return { success: true, user };
          } catch (e) {
            return { success: false, error: e.message };
          }
        }
        case "LOGIN": {
          const { email, password } = message.data;
          try {
            const user = await login(email, password);
            return { success: true, user };
          } catch (e) {
            return { success: false, error: e.message };
          }
        }
        case "GOOGLE_LOGIN": {
          try {
            const user = await loginWithGoogle();
            return { success: true, user };
          } catch (e) {
            return { success: false, error: e.message };
          }
        }
        case "START_ANALYSIS": {
          const { url, options } = message.data;
          try {
            const { task_id } = await analyzeVideo(url, options);
            return { success: true, result: { task_id } };
          } catch (e) {
            return { success: false, error: e.message };
          }
        }
        case "ANALYZE_VIDEO": {
          const { url, options } = message.data;
          try {
            const { task_id } = await analyzeVideo(url, options);
            const result = await pollAnalysis(task_id, senderTabId);
            if (result.status === "completed" && result.result?.summary_id) {
              const videoId = (0,
              _utils_video__WEBPACK_IMPORTED_MODULE_2__.extractVideoId)(url);
              if (videoId) {
                await (0,
                _utils_storage__WEBPACK_IMPORTED_MODULE_1__.addRecentAnalysis)({
                  videoId,
                  summaryId: result.result.summary_id,
                  title: result.result.video_title || "Unknown",
                });
              }
            }
            return { success: true, result };
          } catch (e) {
            return { success: false, error: e.message };
          }
        }
        case "GET_TASK_STATUS": {
          const { taskId } = message.data;
          try {
            const status = await getTaskStatus(taskId);
            return { success: true, status };
          } catch (e) {
            return { success: false, error: e.message };
          }
        }
        case "CANCEL_ANALYSIS": {
          const { taskId } = message.data;
          try {
            const result = await cancelTask(taskId);
            return { success: true, result };
          } catch (e) {
            return { success: false, error: e.message };
          }
        }
        case "GET_SUMMARY": {
          const { summaryId } = message.data;
          try {
            const summary = await getSummary(summaryId);
            return { success: true, summary };
          } catch (e) {
            return { success: false, error: e.message };
          }
        }
        case "ASK_QUESTION": {
          const { summaryId, question, options } = message.data;
          try {
            const result = await askQuestion(summaryId, question, options);
            return { success: true, result };
          } catch (e) {
            return { success: false, error: e.message };
          }
        }
        case "GET_CHAT_HISTORY": {
          const { summaryId } = message.data;
          try {
            const messages = await getChatHistory(summaryId);
            return { success: true, result: messages };
          } catch (e) {
            return { success: false, error: e.message };
          }
        }
        case "GET_PLAN": {
          try {
            const plan = await fetchPlan();
            return { success: true, plan };
          } catch (e) {
            return { success: false, error: e.message };
          }
        }
        case "SHARE_ANALYSIS": {
          const { videoId } = message.data;
          try {
            const result = await shareAnalysis(videoId);
            return { success: true, share_url: result.share_url };
          } catch (e) {
            return { success: false, error: e.message };
          }
        }
        case "QUICK_CHAT": {
          const { url, lang } = message.data;
          try {
            const result = await quickChat(url, lang || "fr");
            return { success: true, result };
          } catch (e) {
            return { success: false, error: e.message };
          }
        }
        case "LOGOUT": {
          await logout();
          return { success: true };
        }
        case "OPEN_POPUP": {
          chrome.action.setBadgeText({ text: "!" });
          chrome.action.setBadgeBackgroundColor({ color: "#6366f1" });
          return { success: true };
        }
        case "SYNC_AUTH_FROM_WEBSITE": {
          const { accessToken, refreshToken: rt, user } = message.data;
          // Bug #9: validate before storing
          if (!accessToken || typeof accessToken !== "string") {
            return { success: false, error: "Invalid accessToken" };
          }
          if (
            !user ||
            typeof user.id === "undefined" ||
            typeof user.plan !== "string"
          ) {
            return { success: false, error: "Invalid user data" };
          }
          try {
            await (0,
            _utils_storage__WEBPACK_IMPORTED_MODULE_1__.setStoredTokens)(
              accessToken,
              rt,
            );
            await (0,
            _utils_storage__WEBPACK_IMPORTED_MODULE_1__.setStoredUser)(user);
            chrome.action.setBadgeText({ text: "" });
            return { success: true };
          } catch (e) {
            return { success: false, error: e.message };
          }
        }
        default:
          return { error: "Unknown action" };
      }
    }
    // ── Message Listener ──
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const senderTabId = sender.tab?.id;
      handleMessage(message, senderTabId)
        .then(sendResponse)
        .catch((e) => sendResponse({ error: e.message }));
      return true;
    });
    // ── Lifecycle Events ──
    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === "install") {
        chrome.tabs.create({
          url: _utils_config__WEBPACK_IMPORTED_MODULE_0__.WEBAPP_URL,
        });
        chrome.storage.local.set({ showYouTubeRecommendation: true });
      }
    });
    // ── Alarms ──
    chrome.alarms.create("keepAlive", { periodInMinutes: 0.5 });
    chrome.alarms.create("refreshToken", { periodInMinutes: 50 }); // Refresh avant expiration (access_token = 60min)
    chrome.alarms.onAlarm.addListener(async (alarm) => {
      if (alarm.name === "refreshToken" && (await isAuthenticated())) {
        await tryRefreshToken();
      }
    });
    // ── Badge Updates ──
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && changes.accessToken) {
        if (changes.accessToken.newValue) {
          chrome.action.setBadgeText({ text: "" });
        } else {
          chrome.action.setBadgeText({ text: "!" });
          chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
        }
      }
    });
  })();

  /******/
})();
//# sourceMappingURL=background.js.map
