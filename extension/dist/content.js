/******/ (() => {
  // webpackBootstrap
  /******/ "use strict";
  /******/ var __webpack_modules__ = {
    /***/ "./src/content/factcheck.ts"(
      /*!**********************************!*\
  !*** ./src/content/factcheck.ts ***!
  \**********************************/
      __unused_webpack_module,
      __webpack_exports__,
      __webpack_require__,
    ) {
      __webpack_require__.r(__webpack_exports__);
      /* harmony export */ __webpack_require__.d(__webpack_exports__, {
        /* harmony export */ parseFactsToVerify: () =>
          /* binding */ parseFactsToVerify,
        /* harmony export */ renderFactCheckList: () =>
          /* binding */ renderFactCheckList,
        /* harmony export */
      });
      // ── Fact-check helpers ──
      function parseFactsToVerify(facts) {
        return facts
          .filter((f) => f.trim().length > 0)
          .map((f) => ({ text: f.trim(), icon: "🔍" }));
      }
      function renderFactCheckList(items, maxVisible = 3) {
        if (items.length === 0) return "";
        const visible = items.slice(0, maxVisible);
        const rows = visible
          .map(
            (item) =>
              `<div class="ds-fact-item"><span class="ds-fact-icon">${item.icon}</span><span class="ds-fact-text">${item.text}</span></div>`,
          )
          .join("");
        return `<div class="ds-factcheck-list">${rows}</div>`;
      }

      /***/
    },

    /***/ "./src/content/navigation.ts"(
      /*!***********************************!*\
  !*** ./src/content/navigation.ts ***!
  \***********************************/
      __unused_webpack_module,
      __webpack_exports__,
      __webpack_require__,
    ) {
      __webpack_require__.r(__webpack_exports__);
      /* harmony export */ __webpack_require__.d(__webpack_exports__, {
        /* harmony export */ getCurrentVideoId: () =>
          /* binding */ getCurrentVideoId,
        /* harmony export */ isVideoPage: () => /* binding */ isVideoPage,
        /* harmony export */ watchNavigation: () =>
          /* binding */ watchNavigation,
        /* harmony export */
      });
      /* harmony import */ var _utils_video__WEBPACK_IMPORTED_MODULE_0__ =
        __webpack_require__(/*! ../utils/video */ "./src/utils/video.ts");
      // ── Navigation helpers for YouTube SPA ──

      function isVideoPage() {
        const url = window.location.href;
        return url.includes("youtube.com/watch") || url.includes("tiktok.com/");
      }
      function getCurrentVideoId() {
        return (0, _utils_video__WEBPACK_IMPORTED_MODULE_0__.extractVideoId)(
          window.location.href,
        );
      }
      function watchNavigation(callback) {
        let lastVideoId = getCurrentVideoId();
        function handleNav() {
          const newVideoId = getCurrentVideoId();
          if (newVideoId !== lastVideoId) {
            lastVideoId = newVideoId;
            setTimeout(() => callback(newVideoId), 500);
          }
        }
        const originalPushState = history.pushState;
        history.pushState = function (...args) {
          originalPushState.apply(history, args);
          handleNav();
        };
        window.addEventListener("popstate", handleNav);
        document.addEventListener("yt-navigate-finish", handleNav);
        document.addEventListener("yt-page-data-updated", handleNav);
      }

      /***/
    },

    /***/ "./src/content/observer.ts"(
      /*!*********************************!*\
  !*** ./src/content/observer.ts ***!
  \*********************************/
      __unused_webpack_module,
      __webpack_exports__,
      __webpack_require__,
    ) {
      __webpack_require__.r(__webpack_exports__);
      /* harmony export */ __webpack_require__.d(__webpack_exports__, {
        /* harmony export */ startWidgetObserver: () =>
          /* binding */ startWidgetObserver,
        /* harmony export */ stopWidgetObserver: () =>
          /* binding */ stopWidgetObserver,
        /* harmony export */
      });
      // ── Widget DOM observer ──
      // Watches for SPA-driven DOM rewrites that detach the widget host.
      const HOST_ID = "deepsight-host";
      let _observer = null;
      function startWidgetObserver(onDetached) {
        stopWidgetObserver();
        const target =
          document.querySelector("ytd-watch-flexy") ||
          document.querySelector("#content");
        if (!target) return;
        _observer = new MutationObserver(() => {
          if (!document.getElementById(HOST_ID)) onDetached();
        });
        _observer.observe(target, { childList: true, subtree: false });
      }
      function stopWidgetObserver() {
        _observer?.disconnect();
        _observer = null;
      }

      /***/
    },

    /***/ "./src/content/shadow.ts"(
      /*!*******************************!*\
  !*** ./src/content/shadow.ts ***!
  \*******************************/
      __unused_webpack_module,
      __webpack_exports__,
      __webpack_require__,
    ) {
      __webpack_require__.r(__webpack_exports__);
      /* harmony export */ __webpack_require__.d(__webpack_exports__, {
        /* harmony export */ $id: () => /* binding */ $id,
        /* harmony export */ $qs: () => /* binding */ $qs,
        /* harmony export */ $qsa: () => /* binding */ $qsa,
        /* harmony export */ getShadowRoot: () => /* binding */ getShadowRoot,
        /* harmony export */ setShadowRoot: () => /* binding */ setShadowRoot,
        /* harmony export */
      });
      // ── Shadow DOM encapsulation ──
      // Provides isolated DOM for the DeepSight widget.
      // All DOM queries within the widget MUST use these helpers instead of document.*.
      let _shadowRoot = null;
      function getShadowRoot() {
        return _shadowRoot;
      }
      function setShadowRoot(root) {
        _shadowRoot = root;
      }
      /** Query by ID within the shadow root. Falls back to null if shadow not ready. */
      function $id(id) {
        return _shadowRoot?.getElementById(id) ?? null;
      }
      /** querySelector within the shadow root. */
      function $qs(selector) {
        return _shadowRoot?.querySelector(selector) ?? null;
      }
      /** querySelectorAll within the shadow root. */
      function $qsa(selector) {
        if (!_shadowRoot)
          return document.createDocumentFragment().querySelectorAll(selector); // empty list
        return _shadowRoot.querySelectorAll(selector);
      }

      /***/
    },

    /***/ "./src/content/states/analyzing.ts"(
      /*!*****************************************!*\
  !*** ./src/content/states/analyzing.ts ***!
  \*****************************************/
      __unused_webpack_module,
      __webpack_exports__,
      __webpack_require__,
    ) {
      __webpack_require__.r(__webpack_exports__);
      /* harmony export */ __webpack_require__.d(__webpack_exports__, {
        /* harmony export */ renderAnalyzingState: () =>
          /* binding */ renderAnalyzingState,
        /* harmony export */ updateAnalyzingProgress: () =>
          /* binding */ updateAnalyzingProgress,
        /* harmony export */
      });
      /* harmony import */ var _widget__WEBPACK_IMPORTED_MODULE_0__ =
        __webpack_require__(/*! ../widget */ "./src/content/widget.ts");
      /* harmony import */ var _utils_sanitize__WEBPACK_IMPORTED_MODULE_1__ =
        __webpack_require__(
          /*! ../../utils/sanitize */ "./src/utils/sanitize.ts",
        );
      // ── État: analyse en cours ──

      function spinnerHtml() {
        return `
    <div class="ds-gouvernail-spinner" style="width:48px;height:48px;">
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
        <circle cx="24" cy="24" r="20" opacity="0.3"/>
        <circle cx="24" cy="24" r="3"/>
        <line x1="24" y1="4" x2="24" y2="11"/>
        <line x1="38.1" y1="9.9" x2="33.2" y2="14.8"/>
        <line x1="44" y1="24" x2="37" y2="24"/>
        <line x1="38.1" y1="38.1" x2="33.2" y2="33.2"/>
        <line x1="24" y1="44" x2="24" y2="37"/>
        <line x1="9.9" y1="38.1" x2="14.8" y2="33.2"/>
        <line x1="4" y1="24" x2="11" y2="24"/>
        <line x1="9.9" y1="9.9" x2="14.8" y2="14.8"/>
      </svg>
    </div>`;
      }
      function renderAnalyzingState(message, progress, onCancel) {
        const html = `
    <div class="ds-analyzing-container">
      <div class="ds-loading" style="text-align:center;padding:16px 0">
        ${spinnerHtml()}
        <p class="ds-loading-text" id="ds-progress-text">${(0, _utils_sanitize__WEBPACK_IMPORTED_MODULE_1__.escapeHtml)(message)}</p>
      </div>
      <div class="ds-progress" style="margin:8px 0">
        <div class="ds-progress-bar" id="ds-progress-bar" style="width:${progress}%"></div>
      </div>
      <button id="ds-cancel-btn" style="
        display:block;margin:12px auto 0;padding:6px 16px;
        background:transparent;border:1px solid rgba(255,255,255,0.15);
        border-radius:8px;color:rgba(255,255,255,0.5);font-size:12px;
        cursor:pointer;transition:all 0.2s;
      ">Annuler</button>
    </div>
  `;
        (0, _widget__WEBPACK_IMPORTED_MODULE_0__.setWidgetBody)(html);
        // Bind cancel button
        if (onCancel) {
          const body = (0,
          _widget__WEBPACK_IMPORTED_MODULE_0__.getWidgetBody)();
          const btn = body?.querySelector("#ds-cancel-btn");
          if (btn) {
            btn.addEventListener("click", onCancel);
            btn.addEventListener("mouseenter", () => {
              btn.style.color = "#ef4444";
              btn.style.borderColor = "rgba(239,68,68,0.3)";
              btn.style.background = "rgba(239,68,68,0.1)";
            });
            btn.addEventListener("mouseleave", () => {
              btn.style.color = "rgba(255,255,255,0.5)";
              btn.style.borderColor = "rgba(255,255,255,0.15)";
              btn.style.background = "transparent";
            });
          }
        }
      }
      function updateAnalyzingProgress(message, progress) {
        const body = (0, _widget__WEBPACK_IMPORTED_MODULE_0__.getWidgetBody)();
        if (!body) return;
        const bar = body.querySelector("#ds-progress-bar");
        const text = body.querySelector("#ds-progress-text");
        if (bar) bar.style.width = `${progress}%`;
        if (text) text.textContent = message;
      }

      /***/
    },

    /***/ "./src/content/states/chat.ts"(
      /*!************************************!*\
  !*** ./src/content/states/chat.ts ***!
  \************************************/
      __unused_webpack_module,
      __webpack_exports__,
      __webpack_require__,
    ) {
      __webpack_require__.r(__webpack_exports__);
      /* harmony export */ __webpack_require__.d(__webpack_exports__, {
        /* harmony export */ renderChatState: () =>
          /* binding */ renderChatState,
        /* harmony export */
      });
      /* harmony import */ var _utils_config__WEBPACK_IMPORTED_MODULE_0__ =
        __webpack_require__(/*! ../../utils/config */ "./src/utils/config.ts");
      /* harmony import */ var _widget__WEBPACK_IMPORTED_MODULE_1__ =
        __webpack_require__(/*! ../widget */ "./src/content/widget.ts");
      /* harmony import */ var _utils_sanitize__WEBPACK_IMPORTED_MODULE_2__ =
        __webpack_require__(
          /*! ../../utils/sanitize */ "./src/utils/sanitize.ts",
        );
      /* harmony import */ var _suggestions__WEBPACK_IMPORTED_MODULE_3__ =
        __webpack_require__(
          /*! ../suggestions */ "./src/content/suggestions.ts",
        );
      /* harmony import */ var _tts__WEBPACK_IMPORTED_MODULE_4__ =
        __webpack_require__(/*! ../tts */ "./src/content/tts.ts");
      /* harmony import */ var _shadow__WEBPACK_IMPORTED_MODULE_5__ =
        __webpack_require__(/*! ../shadow */ "./src/content/shadow.ts");
      // ── État: chat inline ──

      let _chatHasTTS = false; // Cached TTS premium state for this chat session
      function spinnerSmall() {
        return `<svg class="ds-gouvernail-spinner ds-gouvernail-spinner-sm" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" width="14" height="14"><circle cx="24" cy="24" r="20" opacity="0.3"/><circle cx="24" cy="24" r="3"/><line x1="24" y1="4" x2="24" y2="11"/></svg>`;
      }
      function renderMessage(msg) {
        const cls =
          msg.role === "user" ? "ds-chat-msg-user" : "ds-chat-msg-assistant";
        const content =
          msg.role === "assistant"
            ? (0,
              _utils_sanitize__WEBPACK_IMPORTED_MODULE_2__.markdownToSafeHtml)(
                (0, _utils_sanitize__WEBPACK_IMPORTED_MODULE_2__.escapeHtml)(
                  msg.content,
                ),
              )
            : (0, _utils_sanitize__WEBPACK_IMPORTED_MODULE_2__.escapeHtml)(
                msg.content,
              );
        const webBadge = msg.web_search_used
          ? `<span style="font-size:10px;color:var(--ds-info);display:block;margin-top:3px">🌐 Recherche web utilisée</span>`
          : "";
        // TTS button for assistant messages
        const ttsHtml =
          msg.role === "assistant" && msg.content.length > 20
            ? `<div style="margin-top:4px">${_chatHasTTS ? (0, _tts__WEBPACK_IMPORTED_MODULE_4__.ttsButtonHtml)(msg.content) : (0, _tts__WEBPACK_IMPORTED_MODULE_4__.ttsLockedButtonHtml)()}</div>`
            : "";
        return `<div class="ds-chat-msg ${cls}">${content}${webBadge}${ttsHtml}</div>`;
      }
      async function renderChatState(opts) {
        const {
          summaryId,
          videoTitle,
          category = "default",
          messages = [],
          onBack,
        } = opts;
        const suggestions = (0,
        _suggestions__WEBPACK_IMPORTED_MODULE_3__.getSuggestions)(category, 4);
        // Check TTS premium once per chat render
        _chatHasTTS = await (0,
        _tts__WEBPACK_IMPORTED_MODULE_4__.isTTSPremium)();
        const messagesHtml = messages.map(renderMessage).join("");
        const backBtn = onBack
          ? `<button class="ds-link-btn" id="ds-chat-back" type="button" style="font-size:11px;margin-bottom:4px">← Retour aux résultats</button>`
          : "";
        const html = `
    <div class="ds-chat-container ds-animate-fadeIn">
      ${backBtn}
      <div style="font-size:11px;color:var(--ds-text-muted);margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${(0, _utils_sanitize__WEBPACK_IMPORTED_MODULE_2__.escapeHtml)(videoTitle)}">
        💬 Chat — ${(0, _utils_sanitize__WEBPACK_IMPORTED_MODULE_2__.escapeHtml)(videoTitle)}
      </div>

      <div class="ds-chat-messages" id="ds-chat-messages">
        ${messagesHtml || `<div style="text-align:center;color:var(--ds-text-muted);font-size:11px;padding:16px 0">Posez une question sur cette vidéo</div>`}
      </div>

      ${
        messages.length === 0
          ? `
        <div class="ds-chat-suggestions" id="ds-chat-suggestions">
          ${suggestions.map((s, i) => `<button class="ds-chat-suggestion" data-index="${i}" type="button">${(0, _utils_sanitize__WEBPACK_IMPORTED_MODULE_2__.escapeHtml)(s)}</button>`).join("")}
        </div>
      `
          : ""
      }

      <div class="ds-chat-input-row">
        <input
          type="text"
          id="ds-chat-input"
          class="ds-chat-input"
          placeholder="Posez une question..."
          autocomplete="off"
          maxlength="500"
        />
        <button class="ds-chat-send-btn" id="ds-chat-send" type="button" title="Envoyer">➤</button>
      </div>

      <div class="ds-card-footer" style="margin-top:6px">
        <a href="${_utils_config__WEBPACK_IMPORTED_MODULE_0__.WEBAPP_URL}/summary/${summaryId}" target="_blank" rel="noreferrer" style="font-size:11px">
          📖 Voir l'analyse complète
        </a>
        <span style="font-size:11px;color:var(--ds-text-muted)">Alt+C pour ouvrir</span>
      </div>
    </div>
  `;
        (0, _widget__WEBPACK_IMPORTED_MODULE_1__.setWidgetBody)(html);
        bindChatHandlers(summaryId, suggestions, onBack);
        (0, _tts__WEBPACK_IMPORTED_MODULE_4__.bindTTSButtons)();
        scrollChatToBottom();
      }
      function bindChatHandlers(summaryId, suggestions, onBack) {
        onBack &&
          (0, _shadow__WEBPACK_IMPORTED_MODULE_5__.$id)(
            "ds-chat-back",
          )?.addEventListener("click", onBack);
        (0, _suggestions__WEBPACK_IMPORTED_MODULE_3__.bindSuggestionClicks)(
          "ds-chat-suggestions",
          suggestions,
          (q) => {
            const input = (0, _shadow__WEBPACK_IMPORTED_MODULE_5__.$id)(
              "ds-chat-input",
            );
            if (input) {
              input.value = q;
              sendMessage(summaryId);
            }
          },
        );
        const input = (0, _shadow__WEBPACK_IMPORTED_MODULE_5__.$id)(
          "ds-chat-input",
        );
        const sendBtn = (0, _shadow__WEBPACK_IMPORTED_MODULE_5__.$id)(
          "ds-chat-send",
        );
        sendBtn?.addEventListener("click", () => sendMessage(summaryId));
        input?.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(summaryId);
          }
        });
      }
      function appendMessage(msg) {
        const container = (0, _shadow__WEBPACK_IMPORTED_MODULE_5__.$id)(
          "ds-chat-messages",
        );
        if (!container) return;
        // Supprimer le message vide si présent
        const empty = container.querySelector('[style*="text-align:center"]');
        empty?.remove();
        const el = document.createElement("div");
        el.innerHTML = renderMessage(msg);
        const node = el.firstElementChild;
        if (node) container.appendChild(node);
        scrollChatToBottom();
      }
      function scrollChatToBottom() {
        requestAnimationFrame(() => {
          const container = (0, _shadow__WEBPACK_IMPORTED_MODULE_5__.$id)(
            "ds-chat-messages",
          );
          if (container) container.scrollTop = container.scrollHeight;
        });
      }
      function setInputDisabled(disabled) {
        const input = (0, _shadow__WEBPACK_IMPORTED_MODULE_5__.$id)(
          "ds-chat-input",
        );
        const btn = (0, _shadow__WEBPACK_IMPORTED_MODULE_5__.$id)(
          "ds-chat-send",
        );
        if (input) input.disabled = disabled;
        if (btn) {
          btn.disabled = disabled;
          btn.innerHTML = disabled ? spinnerSmall() : "➤";
        }
      }
      async function sendMessage(summaryId) {
        const input = (0, _shadow__WEBPACK_IMPORTED_MODULE_5__.$id)(
          "ds-chat-input",
        );
        if (!input) return;
        const question = input.value.trim();
        if (!question) return;
        input.value = "";
        setInputDisabled(true);
        // Masquer les suggestions après premier message
        (0, _shadow__WEBPACK_IMPORTED_MODULE_5__.$id)(
          "ds-chat-suggestions",
        )?.remove();
        appendMessage({ role: "user", content: question });
        // Loading bubble
        const container = (0, _shadow__WEBPACK_IMPORTED_MODULE_5__.$id)(
          "ds-chat-messages",
        );
        const loadingId = `ds-loading-${Date.now()}`;
        if (container) {
          const loadingEl = document.createElement("div");
          loadingEl.id = loadingId;
          loadingEl.className = "ds-chat-msg ds-chat-msg-assistant";
          loadingEl.innerHTML = `${spinnerSmall()} En train de répondre...`;
          container.appendChild(loadingEl);
          scrollChatToBottom();
        }
        try {
          const resp = await chrome.runtime.sendMessage({
            action: "ASK_QUESTION",
            data: { summaryId, question, options: {} },
          });
          (0, _shadow__WEBPACK_IMPORTED_MODULE_5__.$id)(loadingId)?.remove();
          if (!resp?.success) throw new Error(resp?.error || "Erreur de chat");
          const result = resp.result;
          appendMessage({
            role: "assistant",
            content: result.response,
            web_search_used: result.web_search_used,
          });
          (0, _tts__WEBPACK_IMPORTED_MODULE_4__.bindTTSButtons)(); // Bind TTS on new assistant message
        } catch (e) {
          (0, _shadow__WEBPACK_IMPORTED_MODULE_5__.$id)(loadingId)?.remove();
          appendMessage({ role: "assistant", content: `❌ ${e.message}` });
        } finally {
          setInputDisabled(false);
          (0, _shadow__WEBPACK_IMPORTED_MODULE_5__.$id)(
            "ds-chat-input",
          )?.focus();
        }
      }

      /***/
    },

    /***/ "./src/content/states/login.ts"(
      /*!*************************************!*\
  !*** ./src/content/states/login.ts ***!
  \*************************************/
      __unused_webpack_module,
      __webpack_exports__,
      __webpack_require__,
    ) {
      __webpack_require__.r(__webpack_exports__);
      /* harmony export */ __webpack_require__.d(__webpack_exports__, {
        /* harmony export */ renderLoginState: () =>
          /* binding */ renderLoginState,
        /* harmony export */
      });
      /* harmony import */ var _utils_config__WEBPACK_IMPORTED_MODULE_0__ =
        __webpack_require__(/*! ../../utils/config */ "./src/utils/config.ts");
      /* harmony import */ var _widget__WEBPACK_IMPORTED_MODULE_1__ =
        __webpack_require__(/*! ../widget */ "./src/content/widget.ts");
      /* harmony import */ var _utils_sanitize__WEBPACK_IMPORTED_MODULE_2__ =
        __webpack_require__(
          /*! ../../utils/sanitize */ "./src/utils/sanitize.ts",
        );
      /* harmony import */ var _shadow__WEBPACK_IMPORTED_MODULE_3__ =
        __webpack_require__(/*! ../shadow */ "./src/content/shadow.ts");
      // ── État: login ──

      function spinnerSmall() {
        return `<svg class="ds-gouvernail-spinner ds-gouvernail-spinner-sm" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" width="14" height="14"><circle cx="24" cy="24" r="20" opacity="0.3"/><circle cx="24" cy="24" r="3"/><line x1="24" y1="4" x2="24" y2="11"/></svg>`;
      }
      function renderLoginState(onLogin) {
        const html = `
    <div class="ds-login-container">
      <p class="ds-subtitle">Analysez cette vidéo avec l'IA</p>

      <button class="ds-btn ds-btn-google" id="ds-google-login" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Connexion avec Google
      </button>

      <div class="ds-divider"><span>ou</span></div>

      <form id="ds-login-form" class="ds-login-form">
        <input type="email" id="ds-email" placeholder="Email" required autocomplete="email" />
        <input type="password" id="ds-password" placeholder="Mot de passe" required autocomplete="current-password" />
        <div id="ds-login-error" class="ds-error-msg hidden"></div>
        <button type="submit" class="ds-btn ds-btn-primary" id="ds-login-btn">Connexion</button>
      </form>

      <div class="ds-card-footer">
        <a href="${_utils_config__WEBPACK_IMPORTED_MODULE_0__.WEBAPP_URL}/register" target="_blank" rel="noreferrer">Créer un compte</a>
        <span>·</span>
        <a href="${_utils_config__WEBPACK_IMPORTED_MODULE_0__.WEBAPP_URL}" target="_blank" rel="noreferrer">deepsightsynthesis.com</a>
      </div>
    </div>
  `;
        (0, _widget__WEBPACK_IMPORTED_MODULE_1__.setWidgetBody)(html);
        (0, _shadow__WEBPACK_IMPORTED_MODULE_3__.$id)(
          "ds-google-login",
        )?.addEventListener("click", async () => {
          const btn = (0, _shadow__WEBPACK_IMPORTED_MODULE_3__.$id)(
            "ds-google-login",
          );
          if (btn) {
            btn.disabled = true;
            btn.innerHTML = `${spinnerSmall()} Connexion...`;
          }
          try {
            const resp = await chrome.runtime.sendMessage({
              action: "GOOGLE_LOGIN",
            });
            if (resp?.success && resp.user) {
              onLogin();
            } else {
              showError(resp?.error || "Connexion Google échouée");
              if (btn) {
                btn.disabled = false;
                btn.textContent = "Connexion avec Google";
              }
            }
          } catch (e) {
            showError(e.message);
            if (btn) {
              btn.disabled = false;
              btn.textContent = "Connexion avec Google";
            }
          }
        });
        (0, _shadow__WEBPACK_IMPORTED_MODULE_3__.$id)(
          "ds-login-form",
        )?.addEventListener("submit", async (e) => {
          e.preventDefault();
          const email = (0, _shadow__WEBPACK_IMPORTED_MODULE_3__.$id)(
            "ds-email",
          ).value;
          const password = (0, _shadow__WEBPACK_IMPORTED_MODULE_3__.$id)(
            "ds-password",
          ).value;
          const btn = (0, _shadow__WEBPACK_IMPORTED_MODULE_3__.$id)(
            "ds-login-btn",
          );
          if (btn) {
            btn.disabled = true;
            btn.textContent = "Connexion...";
          }
          try {
            const resp = await chrome.runtime.sendMessage({
              action: "LOGIN",
              data: { email, password },
            });
            if (resp?.success && resp.user) {
              onLogin();
            } else {
              showError(resp?.error || "Connexion échouée");
              if (btn) {
                btn.disabled = false;
                btn.textContent = "Connexion";
              }
            }
          } catch (err) {
            showError(
              (0, _utils_sanitize__WEBPACK_IMPORTED_MODULE_2__.escapeHtml)(
                err.message,
              ),
            );
            if (btn) {
              btn.disabled = false;
              btn.textContent = "Connexion";
            }
          }
        });
      }
      function showError(msg) {
        const el = (0, _shadow__WEBPACK_IMPORTED_MODULE_3__.$id)(
          "ds-login-error",
        );
        if (el) {
          el.textContent = msg;
          el.classList.remove("hidden");
        }
      }

      /***/
    },

    /***/ "./src/content/states/ready.ts"(
      /*!*************************************!*\
  !*** ./src/content/states/ready.ts ***!
  \*************************************/
      __unused_webpack_module,
      __webpack_exports__,
      __webpack_require__,
    ) {
      __webpack_require__.r(__webpack_exports__);
      /* harmony export */ __webpack_require__.d(__webpack_exports__, {
        /* harmony export */ renderReadyState: () =>
          /* binding */ renderReadyState,
        /* harmony export */
      });
      /* harmony import */ var _utils_config__WEBPACK_IMPORTED_MODULE_0__ =
        __webpack_require__(/*! ../../utils/config */ "./src/utils/config.ts");
      /* harmony import */ var _widget__WEBPACK_IMPORTED_MODULE_1__ =
        __webpack_require__(/*! ../widget */ "./src/content/widget.ts");
      /* harmony import */ var _utils_sanitize__WEBPACK_IMPORTED_MODULE_2__ =
        __webpack_require__(
          /*! ../../utils/sanitize */ "./src/utils/sanitize.ts",
        );
      /* harmony import */ var _shadow__WEBPACK_IMPORTED_MODULE_3__ =
        __webpack_require__(/*! ../shadow */ "./src/content/shadow.ts");
      /* harmony import */ var _tournesol__WEBPACK_IMPORTED_MODULE_4__ =
        __webpack_require__(/*! ../tournesol */ "./src/content/tournesol.ts");
      // ── État: ready (authentifié, en attente d'analyse) ──

      function spinnerSmall() {
        return `<svg class="ds-gouvernail-spinner ds-gouvernail-spinner-sm" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" width="14" height="14"><circle cx="24" cy="24" r="20" opacity="0.3"/><circle cx="24" cy="24" r="3"/><line x1="24" y1="4" x2="24" y2="11"/></svg>`;
      }
      function tournesolBadgeHtml(tournesol) {
        if (!tournesol?.found || tournesol.tournesol_score === null) return "";
        const score = Math.round(tournesol.tournesol_score);
        const color =
          score >= 50
            ? "var(--ds-success)"
            : score >= 0
              ? "var(--ds-warning)"
              : "var(--ds-error)";
        const topMargin = (0,
        _tournesol__WEBPACK_IMPORTED_MODULE_4__.detectTournesolExtension)()
          ? "32px"
          : "4px";
        return `<div class="ds-tournesol-badge" style="font-size:10px;color:${color};margin-top:${topMargin}">🌻 Tournesol: ${score > 0 ? "+" : ""}${score}</div>`;
      }
      function renderReadyState(opts) {
        const { user, tournesol, onAnalyze, onQuickChat, onLogout } = opts;
        const html = `
    <div class="ds-ready-container">
      <div class="ds-user-bar">
        <span class="ds-user-name">${(0, _utils_sanitize__WEBPACK_IMPORTED_MODULE_2__.escapeHtml)(user.username)}</span>
        <span class="ds-user-plan ds-plan-${(0, _utils_sanitize__WEBPACK_IMPORTED_MODULE_2__.escapeHtml)(user.plan)}">${(0, _utils_sanitize__WEBPACK_IMPORTED_MODULE_2__.escapeHtml)(user.plan)}</span>
        <span class="ds-user-credits">${user.credits} crédits</span>
      </div>
      ${tournesolBadgeHtml(tournesol)}

      <button class="ds-btn ds-btn-analyze" id="ds-analyze-btn" type="button">
        🚀 Analyser cette vidéo
      </button>

      <button class="ds-btn ds-btn-quickchat" id="ds-quickchat-btn" type="button">
        💬 Quick Chat IA
      </button>

      <div class="ds-options-row">
        <select id="ds-mode" class="ds-select" title="Mode d'analyse">
          <option value="standard">📋 Standard</option>
          <option value="accessible">📖 Accessible</option>
        </select>
        <select id="ds-lang" class="ds-select" title="Langue">
          <option value="fr">🇫🇷 FR</option>
          <option value="en">🇬🇧 EN</option>
          <option value="es">🇪🇸 ES</option>
          <option value="de">🇩🇪 DE</option>
        </select>
      </div>

      <div class="ds-card-footer">
        <a href="${_utils_config__WEBPACK_IMPORTED_MODULE_0__.WEBAPP_URL}" target="_blank" rel="noreferrer">🌐 deepsightsynthesis.com</a>
        <button id="ds-logout" class="ds-link-btn" type="button">Déconnexion</button>
      </div>
    </div>
  `;
        (0, _widget__WEBPACK_IMPORTED_MODULE_1__.setWidgetBody)(html);
        (0, _shadow__WEBPACK_IMPORTED_MODULE_3__.$id)(
          "ds-analyze-btn",
        )?.addEventListener("click", () => {
          const mode = (0, _shadow__WEBPACK_IMPORTED_MODULE_3__.$id)(
            "ds-mode",
          ).value;
          const lang = (0, _shadow__WEBPACK_IMPORTED_MODULE_3__.$id)(
            "ds-lang",
          ).value;
          onAnalyze(mode, lang);
        });
        (0, _shadow__WEBPACK_IMPORTED_MODULE_3__.$id)(
          "ds-quickchat-btn",
        )?.addEventListener("click", async () => {
          const btn = (0, _shadow__WEBPACK_IMPORTED_MODULE_3__.$id)(
            "ds-quickchat-btn",
          );
          const lang =
            (0, _shadow__WEBPACK_IMPORTED_MODULE_3__.$id)("ds-lang")?.value ||
            "fr";
          if (btn) {
            btn.disabled = true;
            btn.innerHTML = `${spinnerSmall()} Préparation...`;
          }
          onQuickChat(lang);
        });
        (0, _shadow__WEBPACK_IMPORTED_MODULE_3__.$id)(
          "ds-logout",
        )?.addEventListener("click", onLogout);
      }

      /***/
    },

    /***/ "./src/content/states/results.ts"(
      /*!***************************************!*\
  !*** ./src/content/states/results.ts ***!
  \***************************************/
      __unused_webpack_module,
      __webpack_exports__,
      __webpack_require__,
    ) {
      __webpack_require__.r(__webpack_exports__);
      /* harmony export */ __webpack_require__.d(__webpack_exports__, {
        /* harmony export */ renderResultsState: () =>
          /* binding */ renderResultsState,
        /* harmony export */
      });
      /* harmony import */ var _utils_config__WEBPACK_IMPORTED_MODULE_0__ =
        __webpack_require__(/*! ../../utils/config */ "./src/utils/config.ts");
      /* harmony import */ var _widget__WEBPACK_IMPORTED_MODULE_1__ =
        __webpack_require__(/*! ../widget */ "./src/content/widget.ts");
      /* harmony import */ var _utils_sanitize__WEBPACK_IMPORTED_MODULE_2__ =
        __webpack_require__(
          /*! ../../utils/sanitize */ "./src/utils/sanitize.ts",
        );
      /* harmony import */ var _factcheck__WEBPACK_IMPORTED_MODULE_3__ =
        __webpack_require__(/*! ../factcheck */ "./src/content/factcheck.ts");
      /* harmony import */ var _suggestions__WEBPACK_IMPORTED_MODULE_4__ =
        __webpack_require__(
          /*! ../suggestions */ "./src/content/suggestions.ts",
        );
      /* harmony import */ var _tts__WEBPACK_IMPORTED_MODULE_5__ =
        __webpack_require__(/*! ../tts */ "./src/content/tts.ts");
      /* harmony import */ var _shadow__WEBPACK_IMPORTED_MODULE_6__ =
        __webpack_require__(/*! ../shadow */ "./src/content/shadow.ts");
      // ── État: résultats d'analyse ──

      const PLAN_RANK = {
        free: 0,
        decouverte: 0,
        plus: 1,
        pro: 2,
        expert: 2,
        etudiant: 1,
        student: 1,
        starter: 1,
      };
      const CATEGORY_ICON = {
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
      function scoreClass(score) {
        return score >= 80
          ? "ds-score-high"
          : score >= 60
            ? "ds-score-mid"
            : "ds-score-low";
      }
      function scoreIcon(score) {
        return score >= 80 ? "✅" : score >= 60 ? "⚠️" : "❓";
      }
      function parseTimestamp(ts) {
        const parts = ts.split(":").map(Number);
        if (parts.length === 3)
          return parts[0] * 3600 + parts[1] * 60 + parts[2];
        return parts[0] * 60 + parts[1];
      }
      function processTimestamps(html) {
        return html.replace(
          /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g,
          (_m, ts) =>
            `<a href="#" class="ds-timestamp" data-time="${parseTimestamp(ts)}">[${ts}]</a>`,
        );
      }
      function keyPointIcon(type) {
        return type === "solid" ? "✅" : type === "weak" ? "⚠️" : "💡";
      }
      function buildPremiumTeasers(userPlan) {
        const userRank = PLAN_RANK[userPlan] ?? 0;
        const teasers = [
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
        ].filter((t) => (PLAN_RANK[t.minPlan] ?? 0) > userRank);
        if (teasers.length === 0) {
          return `<div class="ds-teaser-pro-cta"><span>📱 Révisez sur mobile —</span><a href="${_utils_config__WEBPACK_IMPORTED_MODULE_0__.WEBAPP_URL}/mobile" target="_blank" rel="noreferrer" class="ds-teaser-link">Télécharger l'app</a></div>`;
        }
        const items = teasers
          .slice(0, 3)
          .map(
            (t) => `
    <a href="${_utils_config__WEBPACK_IMPORTED_MODULE_0__.WEBAPP_URL}/upgrade" target="_blank" rel="noreferrer" class="ds-teaser-item" title="Dès ${t.price}/mois">
      <span class="ds-teaser-icon">${t.icon}</span>
      <span class="ds-teaser-label">${t.label}</span>
      <span class="ds-teaser-lock">🔒</span>
      <span class="ds-teaser-price">${t.price}/m</span>
    </a>
  `,
          )
          .join("");
        return `
    <div class="ds-teasers-section">
      <div class="ds-teasers-title">✨ Débloquez plus</div>
      <div class="ds-teasers-grid">${items}</div>
      <a href="${_utils_config__WEBPACK_IMPORTED_MODULE_0__.WEBAPP_URL}/upgrade" target="_blank" rel="noreferrer" class="ds-teasers-all">Voir tous les plans →</a>
    </div>
  `;
      }
      function buildEcosystemBridge(summaryId) {
        return `
    <div class="ds-ecosystem-bridge">
      <a href="${_utils_config__WEBPACK_IMPORTED_MODULE_0__.WEBAPP_URL}/summary/${summaryId}" target="_blank" rel="noreferrer" class="ds-bridge-link" title="Voir l'analyse complète sur le web">
        🌐 Web
      </a>
      <a href="https://apps.apple.com/app/deepsight/id6744066498" target="_blank" rel="noreferrer" class="ds-bridge-link" title="App iOS">
        🍎 iOS
      </a>
      <a href="https://play.google.com/store/apps/details?id=com.deepsight.app" target="_blank" rel="noreferrer" class="ds-bridge-link" title="App Android">
        🤖 Android
      </a>
      <a href="${_utils_config__WEBPACK_IMPORTED_MODULE_0__.WEBAPP_URL}/upgrade" target="_blank" rel="noreferrer" class="ds-bridge-link ds-bridge-upgrade">
        ⚡ Upgrade
      </a>
    </div>
  `;
      }
      async function renderResultsState(opts) {
        const { summary, userPlan, onChat } = opts;
        const parsed = (0,
        _utils_sanitize__WEBPACK_IMPORTED_MODULE_2__.parseAnalysisToSummary)(
          summary.summary_content,
        );
        const detailedHtml = processTimestamps(
          (0, _utils_sanitize__WEBPACK_IMPORTED_MODULE_2__.markdownToFullHtml)(
            (0, _utils_sanitize__WEBPACK_IMPORTED_MODULE_2__.escapeHtml)(
              summary.summary_content,
            ),
          ),
        );
        const catIcon = CATEGORY_ICON[summary.category] ?? "📋";
        const sc = scoreClass(summary.reliability_score);
        const si = scoreIcon(summary.reliability_score);
        // TTS: check premium + build button
        const hasTTS = await (0,
        _tts__WEBPACK_IMPORTED_MODULE_5__.isTTSPremium)();
        const ttsBtn = hasTTS
          ? (0, _tts__WEBPACK_IMPORTED_MODULE_5__.ttsButtonHtml)(
              parsed.verdict || summary.summary_content.slice(0, 2000),
              "md",
            )
          : (0, _tts__WEBPACK_IMPORTED_MODULE_5__.ttsLockedButtonHtml)();
        const ttsToolbar = hasTTS
          ? (0, _tts__WEBPACK_IMPORTED_MODULE_5__.ttsToolbarHtml)()
          : "";
        const keyPointsHtml = parsed.keyPoints
          .map(
            (kp) => `<div class="ds-kp ds-kp-${kp.type}">
      <span class="ds-kp-icon">${keyPointIcon(kp.type)}</span>
      <span class="ds-kp-text">${(0, _utils_sanitize__WEBPACK_IMPORTED_MODULE_2__.escapeHtml)(kp.text)}</span>
    </div>`,
          )
          .join("");
        const tagsHtml =
          parsed.tags.length > 0
            ? `<div class="ds-tags">${parsed.tags.map((t) => `<span class="ds-tag-pill">${(0, _utils_sanitize__WEBPACK_IMPORTED_MODULE_2__.escapeHtml)(t)}</span>`).join("")}</div>`
            : "";
        const factItems = (0,
        _factcheck__WEBPACK_IMPORTED_MODULE_3__.parseFactsToVerify)(
          summary.facts_to_verify ?? [],
        );
        const factCheckHtml =
          factItems.length > 0
            ? `<div style="margin-top:8px">${(0, _factcheck__WEBPACK_IMPORTED_MODULE_3__.renderFactCheckList)(factItems, 2)}</div>`
            : "";
        const suggestions = (0,
        _suggestions__WEBPACK_IMPORTED_MODULE_4__.getSuggestions)(
          summary.category,
          4,
        );
        const suggestionsHtml = (0,
        _suggestions__WEBPACK_IMPORTED_MODULE_4__.renderSuggestions)(
          suggestions,
          () => {},
          "ds-results-suggestions",
        );
        const premiumHtml = buildPremiumTeasers(userPlan);
        const bridgeHtml = buildEcosystemBridge(summary.id);
        const html = `
    <div class="ds-results-container">
      <div class="ds-status-bar">
        <span class="ds-done">✅ Analyse complète</span>
        <div class="ds-status-badges">
          <span class="ds-tag">${catIcon} ${(0, _utils_sanitize__WEBPACK_IMPORTED_MODULE_2__.escapeHtml)(summary.category)}</span>
          <span class="ds-tag ${sc}">${si} ${summary.reliability_score}%</span>
        </div>
      </div>

      <div class="ds-reliability-bar">
        <div class="ds-reliability-header">
          <span style="color:var(--ds-text-muted)">Fiabilité</span>
          <span class="${sc}" style="font-weight:600">${summary.reliability_score}/100</span>
        </div>
        <div class="ds-progress" style="height:6px">
          <div class="ds-progress-bar ds-fill-bar" data-score="${sc.replace("ds-score-", "")}"
               style="width:${summary.reliability_score}%;background:${summary.reliability_score >= 80 ? "var(--ds-success)" : summary.reliability_score >= 60 ? "var(--ds-warning)" : "var(--ds-error)"}">
          </div>
        </div>
      </div>

      <div class="ds-verdict">
        <div class="ds-summary-tts-row">
          <p class="ds-verdict-text" style="flex:1;margin:0">${(0, _utils_sanitize__WEBPACK_IMPORTED_MODULE_2__.escapeHtml)(parsed.verdict)}</p>
          ${ttsBtn}
        </div>
      </div>
      ${ttsToolbar}

      ${keyPointsHtml ? `<div class="ds-keypoints ds-stagger">${keyPointsHtml}</div>` : ""}
      ${tagsHtml}
      ${factCheckHtml}

      <button class="ds-toggle-detail" id="ds-toggle-detail" type="button">
        <span class="ds-toggle-text">Voir l'analyse détaillée</span>
        <span class="ds-toggle-arrow">▼</span>
      </button>
      <div class="ds-detail-panel hidden" id="ds-detail-panel">
        <div class="ds-detail-content">${detailedHtml}</div>
      </div>

      <div class="ds-share-actions">
        <button class="ds-btn-outline" id="ds-copy-btn" type="button">📋 Copier</button>
        <button class="ds-btn-outline" id="ds-share-btn" type="button">🔗 Partager</button>
      </div>

      <div class="ds-summary-actions">
        <a href="${_utils_config__WEBPACK_IMPORTED_MODULE_0__.WEBAPP_URL}/summary/${summary.id}" target="_blank" rel="noreferrer" class="ds-btn-primary-link">
          📖 Analyse complète sur DeepSight
        </a>
        <button class="ds-btn-secondary-action" id="ds-chat-btn" type="button">
          💬 Chatter avec la vidéo
        </button>
      </div>

      ${suggestionsHtml}
      <div class="ds-premium-teasers">${premiumHtml}</div>
      ${bridgeHtml}

      <div class="ds-card-footer">
        <a href="${_utils_config__WEBPACK_IMPORTED_MODULE_0__.WEBAPP_URL}" target="_blank" rel="noreferrer">🌐 deepsightsynthesis.com</a>
      </div>
    </div>
  `;
        (0, _widget__WEBPACK_IMPORTED_MODULE_1__.setWidgetBody)(html);
        bindResultsHandlers(summary, opts, suggestions);
        (0, _tts__WEBPACK_IMPORTED_MODULE_5__.bindTTSButtons)();
        if (hasTTS) (0, _tts__WEBPACK_IMPORTED_MODULE_5__.bindTTSToolbar)();
      }
      function bindResultsHandlers(summary, opts, suggestions) {
        // Toggle détail
        (0, _shadow__WEBPACK_IMPORTED_MODULE_6__.$id)(
          "ds-toggle-detail",
        )?.addEventListener("click", () => {
          const panel = (0, _shadow__WEBPACK_IMPORTED_MODULE_6__.$id)(
            "ds-detail-panel",
          );
          const btn = (0, _shadow__WEBPACK_IMPORTED_MODULE_6__.$id)(
            "ds-toggle-detail",
          );
          if (!panel || !btn) return;
          const isHidden = panel.classList.contains("hidden");
          panel.classList.toggle("hidden");
          const arrow = btn.querySelector(".ds-toggle-arrow");
          const text = btn.querySelector(".ds-toggle-text");
          if (arrow) arrow.textContent = isHidden ? "▲" : "▼";
          if (text)
            text.textContent = isHidden
              ? "Masquer l'analyse"
              : "Voir l'analyse détaillée";
        });
        // Timestamps — note: video element is in the main document, not shadow
        (0, _shadow__WEBPACK_IMPORTED_MODULE_6__.$qsa)(".ds-timestamp").forEach(
          (el) => {
            el.addEventListener("click", (e) => {
              e.preventDefault();
              const t = parseInt(el.dataset.time ?? "0", 10);
              const video = document.querySelector("video");
              if (video) {
                video.currentTime = t;
                video.play();
              }
            });
          },
        );
        // Chat button
        (0, _shadow__WEBPACK_IMPORTED_MODULE_6__.$id)(
          "ds-chat-btn",
        )?.addEventListener("click", () => {
          opts.onChat(summary.id, summary.video_title);
        });
        // Suggestions → open chat
        (0, _suggestions__WEBPACK_IMPORTED_MODULE_4__.bindSuggestionClicks)(
          "ds-results-suggestions",
          suggestions,
          (q) => {
            opts.onChat(summary.id, summary.video_title);
            // Message auto envoyé dans renderChatState
            setTimeout(() => {
              const input = (0, _shadow__WEBPACK_IMPORTED_MODULE_6__.$id)(
                "ds-chat-input",
              );
              if (input) {
                input.value = q;
                (0, _shadow__WEBPACK_IMPORTED_MODULE_6__.$id)(
                  "ds-chat-send",
                )?.click();
              }
            }, 100);
          },
        );
        // Copy
        (0, _shadow__WEBPACK_IMPORTED_MODULE_6__.$id)(
          "ds-copy-btn",
        )?.addEventListener("click", opts.onCopyLink);
        // Share
        (0, _shadow__WEBPACK_IMPORTED_MODULE_6__.$id)(
          "ds-share-btn",
        )?.addEventListener("click", opts.onShare);
      }

      /***/
    },

    /***/ "./src/content/suggestions.ts"(
      /*!************************************!*\
  !*** ./src/content/suggestions.ts ***!
  \************************************/
      __unused_webpack_module,
      __webpack_exports__,
      __webpack_require__,
    ) {
      __webpack_require__.r(__webpack_exports__);
      /* harmony export */ __webpack_require__.d(__webpack_exports__, {
        /* harmony export */ bindSuggestionClicks: () =>
          /* binding */ bindSuggestionClicks,
        /* harmony export */ getSuggestions: () => /* binding */ getSuggestions,
        /* harmony export */ renderSuggestions: () =>
          /* binding */ renderSuggestions,
        /* harmony export */
      });
      /* harmony import */ var _shadow__WEBPACK_IMPORTED_MODULE_0__ =
        __webpack_require__(/*! ./shadow */ "./src/content/shadow.ts");
      // ── Chat suggestions (context-aware question starters) ──

      const SUGGESTIONS_BY_CATEGORY = {
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
      // Bug #7: guard against concurrent suggestion loads
      let _suggestionsLoading = false;
      function getSuggestions(category, count) {
        const pool =
          SUGGESTIONS_BY_CATEGORY[category] ??
          SUGGESTIONS_BY_CATEGORY["default"];
        return pool.slice(0, count);
      }
      function renderSuggestions(suggestions, _onSelect, id) {
        if (suggestions.length === 0) return "";
        const items = suggestions
          .map(
            (s, i) =>
              `<button class="ds-chat-suggestion" data-index="${i}" type="button">${s}</button>`,
          )
          .join("");
        return `<div class="ds-chat-suggestions" id="${id}">${items}</div>`;
      }
      function bindSuggestionClicks(containerId, suggestions, callback) {
        if (_suggestionsLoading) return;
        const container = (0, _shadow__WEBPACK_IMPORTED_MODULE_0__.$id)(
          containerId,
        );
        if (!container) return;
        _suggestionsLoading = true;
        container.querySelectorAll(".ds-chat-suggestion").forEach((btn) => {
          const idx = parseInt(btn.dataset.index ?? "0", 10);
          btn.addEventListener("click", () => {
            _suggestionsLoading = false;
            if (suggestions[idx]) callback(suggestions[idx]);
          });
        });
        _suggestionsLoading = false;
      }

      /***/
    },

    /***/ "./src/content/theater.ts"(
      /*!********************************!*\
  !*** ./src/content/theater.ts ***!
  \********************************/
      __unused_webpack_module,
      __webpack_exports__,
      __webpack_require__,
    ) {
      __webpack_require__.r(__webpack_exports__);
      /* harmony export */ __webpack_require__.d(__webpack_exports__, {
        /* harmony export */ detectLayoutMode: () =>
          /* binding */ detectLayoutMode,
        /* harmony export */ stopWatchingLayout: () =>
          /* binding */ stopWatchingLayout,
        /* harmony export */ watchLayoutMode: () =>
          /* binding */ watchLayoutMode,
        /* harmony export */
      });
      // ── Theater / fullscreen layout detection ──
      function detectLayoutMode() {
        if (document.fullscreenElement) return "fullscreen";
        const flexy = document.querySelector("ytd-watch-flexy");
        if (flexy?.hasAttribute("theater")) return "theater";
        return "default";
      }
      let _observer = null;
      let _fsHandler = null;
      function watchLayoutMode(callback) {
        stopWatchingLayout();
        const flexy = document.querySelector("ytd-watch-flexy");
        if (flexy) {
          _observer = new MutationObserver(() => callback(detectLayoutMode()));
          _observer.observe(flexy, {
            attributes: true,
            attributeFilter: ["theater"],
          });
        }
        _fsHandler = () => callback(detectLayoutMode());
        document.addEventListener("fullscreenchange", _fsHandler);
      }
      function stopWatchingLayout() {
        _observer?.disconnect();
        _observer = null;
        if (_fsHandler)
          document.removeEventListener("fullscreenchange", _fsHandler);
        _fsHandler = null;
      }

      /***/
    },

    /***/ "./src/content/theme.ts"(
      /*!******************************!*\
  !*** ./src/content/theme.ts ***!
  \******************************/
      __unused_webpack_module,
      __webpack_exports__,
      __webpack_require__,
    ) {
      __webpack_require__.r(__webpack_exports__);
      /* harmony export */ __webpack_require__.d(__webpack_exports__, {
        /* harmony export */ detectTheme: () => /* binding */ detectTheme,
        /* harmony export */ watchTheme: () => /* binding */ watchTheme,
        /* harmony export */
      });
      // ── Theme detection ──
      function detectTheme() {
        const html = document.documentElement;
        const isDark =
          html.getAttribute("dark") === "true" ||
          html.hasAttribute("dark") ||
          document.body.classList.contains("dark") ||
          getComputedStyle(document.body).backgroundColor.includes("rgb(15,") ||
          getComputedStyle(html)
            .getPropertyValue("--yt-spec-base-background")
            .includes("#0f");
        return isDark ? "dark" : "light";
      }
      function watchTheme(callback) {
        const observer = new MutationObserver(() => {
          callback(detectTheme());
        });
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["dark", "class"],
        });
      }

      /***/
    },

    /***/ "./src/content/tournesol.ts"(
      /*!**********************************!*\
  !*** ./src/content/tournesol.ts ***!
  \**********************************/
      __unused_webpack_module,
      __webpack_exports__,
      __webpack_require__,
    ) {
      __webpack_require__.r(__webpack_exports__);
      /* harmony export */ __webpack_require__.d(__webpack_exports__, {
        /* harmony export */ detectTournesolExtension: () =>
          /* binding */ detectTournesolExtension,
        /* harmony export */ fetchTournesolScore: () =>
          /* binding */ fetchTournesolScore,
        /* harmony export */
      });
      // ── Tournesol score fetch + extension detection ──
      function detectTournesolExtension() {
        return !!document.querySelector(
          'tournesol-entity-context, [class*="tournesol"], #tournesol-rate',
        );
      }
      async function fetchTournesolScore(videoId) {
        try {
          const resp = await chrome.runtime.sendMessage({
            action: "GET_TOURNESOL",
            data: { videoId },
          });
          if (resp?.success && resp.data) return resp.data;
          return null;
        } catch {
          return null;
        }
      }

      /***/
    },

    /***/ "./src/content/tts.ts"(
      /*!****************************!*\
  !*** ./src/content/tts.ts ***!
  \****************************/
      __unused_webpack_module,
      __webpack_exports__,
      __webpack_require__,
    ) {
      __webpack_require__.r(__webpack_exports__);
      /* harmony export */ __webpack_require__.d(__webpack_exports__, {
        /* harmony export */ bindTTSButtons: () => /* binding */ bindTTSButtons,
        /* harmony export */ bindTTSToolbar: () => /* binding */ bindTTSToolbar,
        /* harmony export */ getState: () => /* binding */ getState,
        /* harmony export */ isTTSPremium: () => /* binding */ isTTSPremium,
        /* harmony export */ ttsButtonHtml: () => /* binding */ ttsButtonHtml,
        /* harmony export */ ttsCycleSpeed: () => /* binding */ ttsCycleSpeed,
        /* harmony export */ ttsLockedButtonHtml: () =>
          /* binding */ ttsLockedButtonHtml,
        /* harmony export */ ttsPauseResume: () => /* binding */ ttsPauseResume,
        /* harmony export */ ttsPlay: () => /* binding */ ttsPlay,
        /* harmony export */ ttsSetGender: () => /* binding */ ttsSetGender,
        /* harmony export */ ttsSetLanguage: () => /* binding */ ttsSetLanguage,
        /* harmony export */ ttsStop: () => /* binding */ ttsStop,
        /* harmony export */ ttsToolbarHtml: () => /* binding */ ttsToolbarHtml,
        /* harmony export */
      });
      /* harmony import */ var _utils_storage__WEBPACK_IMPORTED_MODULE_0__ =
        __webpack_require__(/*! ../utils/storage */ "./src/utils/storage.ts");
      /* harmony import */ var _shadow__WEBPACK_IMPORTED_MODULE_1__ =
        __webpack_require__(/*! ./shadow */ "./src/content/shadow.ts");
      // ── TTS Module — Text-to-Speech pour l'extension Chrome ──
      // Utilise le backend /api/tts (ElevenLabs) avec gestion plan premium

      // ═══════════════════════════════════════════════════════════════════════════════
      // Types & Config
      // ═══════════════════════════════════════════════════════════════════════════════
      const API_BASE = "https://api.deepsightsynthesis.com/api";
      const SPEED_CYCLE = [1, 1.5, 2, 3];
      const PLAN_RANK = {
        free: 0,
        decouverte: 0,
        plus: 1,
        pro: 2,
        expert: 2,
        etudiant: 1,
        student: 1,
        starter: 1,
      };
      // ═══════════════════════════════════════════════════════════════════════════════
      // Singleton state
      // ═══════════════════════════════════════════════════════════════════════════════
      let state = {
        isPlaying: false,
        isLoading: false,
        isPaused: false,
        currentText: "",
        currentTime: 0,
        duration: 0,
        speed: 1,
        language: "fr",
        gender: "female",
      };
      let audio = null;
      let blobUrl = null;
      let abortController = null;
      let activeButtonId = null;
      // Load persisted settings
      function loadSettings() {
        chrome.storage.local.get(
          ["tts_speed", "tts_lang", "tts_gender"],
          (data) => {
            if (data.tts_speed) state.speed = data.tts_speed;
            if (data.tts_lang) state.language = data.tts_lang;
            if (data.tts_gender) state.gender = data.tts_gender;
          },
        );
      }
      loadSettings();
      function saveSettings() {
        chrome.storage.local.set({
          tts_speed: state.speed,
          tts_lang: state.language,
          tts_gender: state.gender,
        });
      }
      // ═══════════════════════════════════════════════════════════════════════════════
      // Premium check
      // ═══════════════════════════════════════════════════════════════════════════════
      async function isTTSPremium() {
        const user = await (0,
        _utils_storage__WEBPACK_IMPORTED_MODULE_0__.getStoredUser)();
        const plan = user?.plan || "free";
        return (PLAN_RANK[plan] ?? 0) >= 1; // pro+ = TTS enabled
      }
      // ═══════════════════════════════════════════════════════════════════════════════
      // Core playback
      // ═══════════════════════════════════════════════════════════════════════════════
      function cleanup() {
        if (audio) {
          audio.pause();
          audio.removeAttribute("src");
          audio = null;
        }
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
          blobUrl = null;
        }
      }
      function ttsStop() {
        abortController?.abort();
        abortController = null;
        cleanup();
        activeButtonId = null;
        state.isPlaying = false;
        state.isPaused = false;
        state.isLoading = false;
        state.currentText = "";
        state.currentTime = 0;
        state.duration = 0;
        updateAllButtons();
      }
      function ttsPauseResume() {
        if (!audio) return;
        if (audio.paused) {
          audio.play().catch(() => {});
          state.isPaused = false;
          state.isPlaying = true;
        } else {
          audio.pause();
          state.isPaused = true;
          state.isPlaying = false;
        }
        updateAllButtons();
      }
      async function ttsPlay(text, buttonId) {
        if (!text?.trim()) return;
        // If same text is playing, toggle pause
        if (state.currentText === text && (state.isPlaying || state.isPaused)) {
          if (state.isPaused) {
            ttsPauseResume();
          } else {
            ttsStop();
          }
          return;
        }
        // Stop any current playback
        ttsStop();
        activeButtonId = buttonId;
        state.isLoading = true;
        state.currentText = text;
        updateAllButtons();
        abortController = new AbortController();
        try {
          const tokens = await (0,
          _utils_storage__WEBPACK_IMPORTED_MODULE_0__.getStoredTokens)();
          if (!tokens.accessToken) throw new Error("Auth required");
          const response = await fetch(`${API_BASE}/tts`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tokens.accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text,
              language: state.language,
              gender: state.gender,
              speed: state.speed,
              strip_questions: true,
            }),
            signal: abortController.signal,
          });
          if (abortController.signal.aborted) return;
          if (response.status === 403) {
            throw new Error("TTS réservé aux abonnés Étudiant+");
          }
          if (!response.ok) {
            throw new Error(`TTS erreur (${response.status})`);
          }
          const blob = await response.blob();
          if (blob.size === 0) throw new Error("Audio vide");
          if (abortController.signal.aborted) return;
          cleanup();
          blobUrl = URL.createObjectURL(blob);
          audio = new Audio(blobUrl);
          audio.playbackRate = state.speed;
          audio.onloadedmetadata = () => {
            state.duration = audio.duration;
            updateAllButtons();
          };
          audio.ontimeupdate = () => {
            state.currentTime = audio.currentTime;
            updateProgressBar();
          };
          audio.onended = () => {
            state.isPlaying = false;
            state.isPaused = false;
            state.currentTime = 0;
            activeButtonId = null;
            updateAllButtons();
          };
          audio.onerror = () => ttsStop();
          await audio.play();
          state.isPlaying = true;
          state.isPaused = false;
          state.isLoading = false;
          updateAllButtons();
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          console.warn("[DeepSight TTS]", err);
          cleanup();
          state.isLoading = false;
          state.isPlaying = false;
          state.currentText = "";
          activeButtonId = null;
          updateAllButtons();
        }
      }
      // ═══════════════════════════════════════════════════════════════════════════════
      // Speed cycling
      // ═══════════════════════════════════════════════════════════════════════════════
      function ttsCycleSpeed() {
        const idx = SPEED_CYCLE.indexOf(state.speed);
        state.speed = SPEED_CYCLE[(idx + 1) % SPEED_CYCLE.length];
        if (audio) audio.playbackRate = state.speed;
        saveSettings();
        updateAllButtons();
      }
      function ttsSetLanguage(lang) {
        state.language = lang;
        saveSettings();
      }
      function ttsSetGender(g) {
        state.gender = g;
        saveSettings();
      }
      // ═══════════════════════════════════════════════════════════════════════════════
      // UI helpers — Format time
      // ═══════════════════════════════════════════════════════════════════════════════
      function formatTime(t) {
        if (!isFinite(t) || isNaN(t)) return "0:00";
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
      }
      // ═══════════════════════════════════════════════════════════════════════════════
      // DOM update helpers
      // ═══════════════════════════════════════════════════════════════════════════════
      function updateProgressBar() {
        if (!activeButtonId) return;
        const bar = (0, _shadow__WEBPACK_IMPORTED_MODULE_1__.$id)(
          `${activeButtonId}-progress-fill`,
        );
        const time = (0, _shadow__WEBPACK_IMPORTED_MODULE_1__.$id)(
          `${activeButtonId}-time`,
        );
        if (bar && state.duration > 0) {
          bar.style.width = `${(state.currentTime / state.duration) * 100}%`;
        }
        if (time) {
          time.textContent = `${formatTime(state.currentTime)}/${formatTime(state.duration)}`;
        }
      }
      function updateAllButtons() {
        (0, _shadow__WEBPACK_IMPORTED_MODULE_1__.$qsa)(".ds-tts-btn").forEach(
          (el) => {
            const btn = el;
            const btnId = btn.dataset.ttsId;
            const btnText = btn.dataset.ttsText || "";
            const isActive =
              activeButtonId === btnId &&
              (state.isPlaying || state.isPaused || state.isLoading);
            if (isActive) {
              btn.classList.add("ds-tts-active");
              btn.innerHTML = buildActivePlayerHtml(btnId || "");
              bindActivePlayerEvents(btn, btnText, btnId || "");
            } else {
              btn.classList.remove("ds-tts-active");
              btn.innerHTML = `<span class="ds-tts-icon">🔊</span>`;
            }
          },
        );
      }
      function buildActivePlayerHtml(btnId) {
        const icon = state.isLoading
          ? `<svg class="ds-tts-spinner" width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
          : state.isPlaying
            ? "⏸️"
            : "▶️";
        return `
    <span class="ds-tts-play-icon">${icon}</span>
    <div class="ds-tts-progress" id="${btnId}-progress">
      <div class="ds-tts-progress-fill" id="${btnId}-progress-fill" style="width:${state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0}%"></div>
    </div>
    <span class="ds-tts-time" id="${btnId}-time">${formatTime(state.currentTime)}/${formatTime(state.duration)}</span>
    <span class="ds-tts-stop" title="Stop">⏹️</span>
    <span class="ds-tts-speed" title="Vitesse">${state.speed}x</span>
  `;
      }
      function bindActivePlayerEvents(container, text, btnId) {
        const playIcon = container.querySelector(".ds-tts-play-icon");
        const stopBtn = container.querySelector(".ds-tts-stop");
        const speedBtn = container.querySelector(".ds-tts-speed");
        const progressBar = container.querySelector(".ds-tts-progress");
        playIcon?.addEventListener("click", (e) => {
          e.stopPropagation();
          ttsPauseResume();
        });
        stopBtn?.addEventListener("click", (e) => {
          e.stopPropagation();
          ttsStop();
        });
        speedBtn?.addEventListener("click", (e) => {
          e.stopPropagation();
          ttsCycleSpeed();
        });
        progressBar?.addEventListener("click", (e) => {
          e.stopPropagation();
          if (!audio || !state.duration) return;
          const rect = progressBar.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          audio.currentTime = pct * state.duration;
        });
      }
      // ═══════════════════════════════════════════════════════════════════════════════
      // Public: render TTS button HTML (inline, for results/chat)
      // ═══════════════════════════════════════════════════════════════════════════════
      let ttsCounter = 0;
      /**
       * Returns HTML for a TTS play button.
       * Call `bindTTSButtons()` after inserting the HTML into the DOM.
       */
      function ttsButtonHtml(text, size = "sm") {
        const id = `ds-tts-${++ttsCounter}`;
        const escapedText = text.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        const sizeClass = size === "md" ? "ds-tts-btn-md" : "";
        return `<button class="ds-tts-btn ${sizeClass}" data-tts-id="${id}" data-tts-text="${escapedText}" type="button" title="Écouter"><span class="ds-tts-icon">🔊</span></button>`;
      }
      /**
       * Returns HTML for a locked TTS button (free users).
       */
      function ttsLockedButtonHtml() {
        return `<button class="ds-tts-btn ds-tts-locked" type="button" title="Lecture vocale — Plan Étudiant+"><span class="ds-tts-icon">🔒</span></button>`;
      }
      /**
       * Bind click handlers on all .ds-tts-btn elements.
       * Call after inserting TTS button HTML into the DOM.
       */
      function bindTTSButtons() {
        (0, _shadow__WEBPACK_IMPORTED_MODULE_1__.$qsa)(
          ".ds-tts-btn:not([data-bound])",
        ).forEach((el) => {
          const btn = el;
          btn.setAttribute("data-bound", "1");
          if (btn.classList.contains("ds-tts-locked")) return;
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const text = btn.dataset.ttsText || "";
            const id = btn.dataset.ttsId || "";
            if (text && id) ttsPlay(text, id);
          });
        });
      }
      // ═══════════════════════════════════════════════════════════════════════════════
      // Public: TTS settings bar (language/gender/speed toggles)
      // ═══════════════════════════════════════════════════════════════════════════════
      function ttsToolbarHtml() {
        return `
    <div class="ds-tts-toolbar">
      <span class="ds-tts-toolbar-label">🔊 Voix</span>
      <button class="ds-tts-toolbar-btn" id="ds-tts-lang" title="Langue">${state.language === "fr" ? "🇫🇷" : "🇬🇧"}</button>
      <button class="ds-tts-toolbar-btn" id="ds-tts-gender" title="Genre">${state.gender === "female" ? "♀" : "♂"}</button>
      <button class="ds-tts-toolbar-btn" id="ds-tts-speed-global" title="Vitesse">${state.speed}x</button>
    </div>
  `;
      }
      function bindTTSToolbar() {
        (0, _shadow__WEBPACK_IMPORTED_MODULE_1__.$id)(
          "ds-tts-lang",
        )?.addEventListener("click", () => {
          state.language = state.language === "fr" ? "en" : "fr";
          saveSettings();
          const el = (0, _shadow__WEBPACK_IMPORTED_MODULE_1__.$id)(
            "ds-tts-lang",
          );
          if (el) el.textContent = state.language === "fr" ? "🇫🇷" : "🇬🇧";
        });
        (0, _shadow__WEBPACK_IMPORTED_MODULE_1__.$id)(
          "ds-tts-gender",
        )?.addEventListener("click", () => {
          state.gender = state.gender === "female" ? "male" : "female";
          saveSettings();
          const el = (0, _shadow__WEBPACK_IMPORTED_MODULE_1__.$id)(
            "ds-tts-gender",
          );
          if (el) el.textContent = state.gender === "female" ? "♀" : "♂";
        });
        (0, _shadow__WEBPACK_IMPORTED_MODULE_1__.$id)(
          "ds-tts-speed-global",
        )?.addEventListener("click", () => {
          ttsCycleSpeed();
          const el = (0, _shadow__WEBPACK_IMPORTED_MODULE_1__.$id)(
            "ds-tts-speed-global",
          );
          if (el) el.textContent = `${state.speed}x`;
        });
      }
      function getState() {
        return { ...state };
      }

      /***/
    },

    /***/ "./src/content/widget.ts"(
      /*!*******************************!*\
  !*** ./src/content/widget.ts ***!
  \*******************************/
      __unused_webpack_module,
      __webpack_exports__,
      __webpack_require__,
    ) {
      __webpack_require__.r(__webpack_exports__);
      /* harmony export */ __webpack_require__.d(__webpack_exports__, {
        /* harmony export */ bindMinimizeButton: () =>
          /* binding */ bindMinimizeButton,
        /* harmony export */ buildWidgetHeader: () =>
          /* binding */ buildWidgetHeader,
        /* harmony export */ createWidgetShell: () =>
          /* binding */ createWidgetShell,
        /* harmony export */ getExistingWidget: () =>
          /* binding */ getExistingWidget,
        /* harmony export */ getWidgetBody: () => /* binding */ getWidgetBody,
        /* harmony export */ injectWidget: () => /* binding */ injectWidget,
        /* harmony export */ isFloatingMode: () => /* binding */ isFloatingMode,
        /* harmony export */ isWidgetDetached: () =>
          /* binding */ isWidgetDetached,
        /* harmony export */ removeWidget: () => /* binding */ removeWidget,
        /* harmony export */ setWidgetBody: () => /* binding */ setWidgetBody,
        /* harmony export */ setWidgetInnerHTML: () =>
          /* binding */ setWidgetInnerHTML,
        /* harmony export */
      });
      /* harmony import */ var _shadow__WEBPACK_IMPORTED_MODULE_0__ =
        __webpack_require__(/*! ./shadow */ "./src/content/shadow.ts");
      // ── Widget DOM management (Shadow DOM) ──

      const WIDGET_ID = "deepsight-card";
      const HOST_ID = "deepsight-host";
      const BODY_CLASS = "ds-card-body";
      const INJECTION_STRATEGIES = [
        { selector: "#secondary-inner", position: "prepend" },
        { selector: "#secondary", position: "prepend" },
        {
          selector: "ytd-watch-next-secondary-results-renderer",
          position: "prepend",
        },
        { selector: "#below", position: "prepend" },
        { selector: "ytd-watch-metadata", position: "afterend" },
      ];
      const TIKTOK_ANCHORS = [
        '[class*="DivBrowserModeContainer"]',
        '[class*="DivVideoDetailContainer"]',
        "#app",
        "body",
      ];
      function createWidgetShell(theme, isTikTok) {
        // Create the outer host element (lives in the page DOM)
        const host = document.createElement("div");
        host.id = HOST_ID;
        // Minimal host styles — just sizing, no visual styles that could be overridden
        host.style.cssText =
          "all:initial;display:block;width:100%;max-width:420px;margin-bottom:12px;";
        if (isTikTok) {
          host.style.cssText =
            "all:initial;position:fixed;bottom:20px;right:20px;width:360px;max-height:80vh;z-index:99999;";
        }
        // Attach closed shadow root for full encapsulation
        const shadow = host.attachShadow({ mode: "closed" });
        (0, _shadow__WEBPACK_IMPORTED_MODULE_0__.setShadowRoot)(shadow);
        // Inject styles into the shadow root (fully isolated from page)
        // tokens.css uses :host selector so variables work inside the shadow boundary
        const tokensLink = document.createElement("link");
        tokensLink.rel = "stylesheet";
        tokensLink.href = chrome.runtime.getURL("tokens.css");
        shadow.appendChild(tokensLink);
        const widgetStyleLink = document.createElement("link");
        widgetStyleLink.rel = "stylesheet";
        widgetStyleLink.href = chrome.runtime.getURL("widget.css");
        shadow.appendChild(widgetStyleLink);
        const contentStyleLink = document.createElement("link");
        contentStyleLink.rel = "stylesheet";
        contentStyleLink.href = chrome.runtime.getURL("content.css");
        shadow.appendChild(contentStyleLink);
        // Create the actual widget card inside shadow
        const el = document.createElement("div");
        el.id = WIDGET_ID;
        el.className = `ds-widget deepsight-card ${theme}`;
        if (isTikTok) {
          el.classList.add("deepsight-card-floating");
          el.style.cssText =
            "overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.5);border-radius:12px;";
        }
        shadow.appendChild(el);
        // Return host — callers insert this into the page DOM
        return host;
      }
      function buildWidgetHeader(logoHtml) {
        return `
    <div class="ds-card-header">
      <div class="ds-card-logo">${logoHtml}<span>Deep Sight</span></div>
      <div style="display:flex;align-items:center;gap:4px">
        <span class="ds-card-badge">AI</span>
        <button class="ds-minimize-btn" id="ds-minimize-btn" type="button" title="Réduire">−</button>
      </div>
    </div>
  `;
      }
      function isSidebarVisible(el) {
        return el.offsetHeight > 0 && getComputedStyle(el).display !== "none";
      }
      let _floatingMode = false;
      function isWidgetDetached() {
        return !document.getElementById(HOST_ID);
      }
      function isFloatingMode() {
        return _floatingMode;
      }
      function injectWidget(host, isTikTok) {
        // Check if already injected
        if (document.getElementById(HOST_ID)) return true;
        _floatingMode = false;
        if (isTikTok) {
          for (const sel of TIKTOK_ANCHORS) {
            const anchor = document.querySelector(sel);
            if (anchor) {
              document.body.appendChild(host);
              return true;
            }
          }
          return false;
        }
        // Try each strategy in order, skipping invisible elements
        for (const { selector, position } of INJECTION_STRATEGIES) {
          const el = document.querySelector(selector);
          if (!(el instanceof HTMLElement) || !isSidebarVisible(el)) continue;
          if (position === "prepend") {
            el.insertBefore(host, el.firstChild);
          } else {
            // afterend — insert after the element
            el.parentElement?.insertBefore(host, el.nextSibling);
          }
          return true;
        }
        // Floating fallback — no sidebar found
        _floatingMode = true;
        host.style.cssText =
          "all:initial;position:fixed;bottom:20px;right:20px;width:380px;max-height:80vh;z-index:99999;";
        document.body.appendChild(host);
        return true;
      }
      function removeWidget() {
        document.getElementById(HOST_ID)?.remove();
      }
      function getExistingWidget() {
        // The widget card is inside the shadow root
        return (0, _shadow__WEBPACK_IMPORTED_MODULE_0__.$id)(WIDGET_ID);
      }
      function setWidgetBody(html) {
        const body = getWidgetBody();
        if (body) body.innerHTML = html;
      }
      function getWidgetBody() {
        return (0, _shadow__WEBPACK_IMPORTED_MODULE_0__.$qs)(
          `#${WIDGET_ID} .${BODY_CLASS}`,
        );
      }
      function setWidgetInnerHTML(html) {
        const widget = getExistingWidget();
        if (widget) widget.innerHTML = html;
      }
      function collapseWidget() {
        const widget = getExistingWidget();
        const btn = (0, _shadow__WEBPACK_IMPORTED_MODULE_0__.$id)(
          "ds-minimize-btn",
        );
        if (!widget) return;
        widget.classList.add("ds-collapsed");
        if (btn) btn.textContent = "+";
      }
      function expandWidget() {
        const widget = getExistingWidget();
        const btn = (0, _shadow__WEBPACK_IMPORTED_MODULE_0__.$id)(
          "ds-minimize-btn",
        );
        if (!widget) return;
        widget.classList.remove("ds-collapsed");
        if (btn) btn.textContent = "−";
      }
      function bindMinimizeButton() {
        const btn = (0, _shadow__WEBPACK_IMPORTED_MODULE_0__.$id)(
          "ds-minimize-btn",
        );
        const widget = getExistingWidget();
        if (!btn || !widget) return;
        // Restore persisted state
        chrome.storage.local.get(["ds_minimized"]).then((data) => {
          if (data.ds_minimized) collapseWidget();
        });
        btn.addEventListener("click", () => {
          const isCollapsed = widget.classList.contains("ds-collapsed");
          if (isCollapsed) {
            expandWidget();
            chrome.storage.local.set({ ds_minimized: false });
          } else {
            collapseWidget();
            chrome.storage.local.set({ ds_minimized: true });
          }
        });
      }

      /***/
    },

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

    /***/ "./src/utils/sanitize.ts"(
      /*!*******************************!*\
  !*** ./src/utils/sanitize.ts ***!
  \*******************************/
      __unused_webpack_module,
      __webpack_exports__,
      __webpack_require__,
    ) {
      __webpack_require__.r(__webpack_exports__);
      /* harmony export */ __webpack_require__.d(__webpack_exports__, {
        /* harmony export */ escapeHtml: () => /* binding */ escapeHtml,
        /* harmony export */ markdownToFullHtml: () =>
          /* binding */ markdownToFullHtml,
        /* harmony export */ markdownToSafeHtml: () =>
          /* binding */ markdownToSafeHtml,
        /* harmony export */ parseAnalysisToSummary: () =>
          /* binding */ parseAnalysisToSummary,
        /* harmony export */
      });
      /**
       * Escapes HTML special characters to prevent XSS.
       */
      function escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
      }
      /**
       * Converts basic markdown-like syntax to safe HTML.
       * Only handles bold, italic, and newlines.
       * The input MUST be escaped first with escapeHtml.
       */
      function markdownToSafeHtml(escaped) {
        return escaped
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.*?)\*/g, "<em>$1</em>")
          .replace(/\n/g, "<br>");
      }
      /**
       * Converts full markdown to safe HTML for detailed view rendering.
       * Handles headings, lists, bold, italic, code, blockquotes, and horizontal rules.
       * The input MUST be escaped first with escapeHtml.
       */
      function markdownToFullHtml(escaped) {
        const lines = escaped.split("\n");
        const htmlLines = [];
        let inList = false;
        let inOrderedList = false;
        for (let i = 0; i < lines.length; i++) {
          let line = lines[i];
          // Horizontal rule
          if (/^-{3,}$/.test(line.trim()) || /^\*{3,}$/.test(line.trim())) {
            if (inList) {
              htmlLines.push("</ul>");
              inList = false;
            }
            if (inOrderedList) {
              htmlLines.push("</ol>");
              inOrderedList = false;
            }
            htmlLines.push('<hr class="ds-md-hr">');
            continue;
          }
          // Headings — with auto-emoji
          const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
          if (headingMatch) {
            if (inList) {
              htmlLines.push("</ul>");
              inList = false;
            }
            if (inOrderedList) {
              htmlLines.push("</ol>");
              inOrderedList = false;
            }
            const level = headingMatch[1].length;
            const rawText = headingMatch[2];
            const emoji = level <= 2 ? getHeaderEmoji(rawText) : "";
            const text = inlineFormat(rawText);
            const emojiPrefix = emoji ? `${emoji}&nbsp;&nbsp;` : "";
            htmlLines.push(
              `<h${level} class="ds-md-h${level}">${emojiPrefix}${text}</h${level}>`,
            );
            continue;
          }
          // Blockquote
          if (line.startsWith("&gt; ") || line === "&gt;") {
            if (inList) {
              htmlLines.push("</ul>");
              inList = false;
            }
            if (inOrderedList) {
              htmlLines.push("</ol>");
              inOrderedList = false;
            }
            const text = inlineFormat(line.replace(/^&gt;\s?/, ""));
            htmlLines.push(
              `<blockquote class="ds-md-blockquote">${text}</blockquote>`,
            );
            continue;
          }
          // Unordered list item
          const ulMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
          if (ulMatch) {
            if (inOrderedList) {
              htmlLines.push("</ol>");
              inOrderedList = false;
            }
            if (!inList) {
              htmlLines.push('<ul class="ds-md-ul">');
              inList = true;
            }
            htmlLines.push(`<li>${inlineFormat(ulMatch[2])}</li>`);
            continue;
          }
          // Ordered list item
          const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
          if (olMatch) {
            if (inList) {
              htmlLines.push("</ul>");
              inList = false;
            }
            if (!inOrderedList) {
              htmlLines.push('<ol class="ds-md-ol">');
              inOrderedList = true;
            }
            htmlLines.push(`<li>${inlineFormat(olMatch[2])}</li>`);
            continue;
          }
          // Close open lists on non-list lines
          if (inList) {
            htmlLines.push("</ul>");
            inList = false;
          }
          if (inOrderedList) {
            htmlLines.push("</ol>");
            inOrderedList = false;
          }
          // Empty line = paragraph break
          if (line.trim() === "") {
            htmlLines.push('<div class="ds-md-spacer"></div>');
            continue;
          }
          // Regular paragraph
          htmlLines.push(`<p class="ds-md-p">${inlineFormat(line)}</p>`);
        }
        if (inList) htmlLines.push("</ul>");
        if (inOrderedList) htmlLines.push("</ol>");
        return htmlLines.join("\n");
      }
      // ── Section emojis (auto-detected from header text) ──
      const SECTION_EMOJIS = {
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
      function getHeaderEmoji(text) {
        const lower = text.toLowerCase().trim();
        for (const [keyword, emoji] of Object.entries(SECTION_EMOJIS)) {
          if (lower.includes(keyword)) return emoji;
        }
        return "📌";
      }
      /** Inline formatting: bold, italic, inline code, epistemic markers */
      function inlineFormat(text) {
        return (
          text
            // Inline code
            .replace(/`([^`]+)`/g, '<code class="ds-md-code">$1</code>')
            // Bold
            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
            // Italic
            .replace(/\*(.+?)\*/g, "<em>$1</em>")
            // Epistemic markers — with or without brackets [SOLIDE] or SOLIDE
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
            )
        );
      }
      /**
       * Parses markdown analysis content into structured summary data.
       * Extracts verdict, key points by epistemic marker, and thematic tags.
       */
      function parseAnalysisToSummary(markdown) {
        const verdict = extractVerdict(markdown);
        const keyPoints = extractKeyPoints(markdown);
        const tags = extractTags(markdown);
        return { verdict, keyPoints, tags };
      }
      /** Extract verdict from Conclusion section or last substantial paragraph */
      function extractVerdict(md) {
        // Try to find a Conclusion/Verdict/Summary section
        const conclusionPatterns = [
          /#+\s*(?:Conclusion|Verdict|Synthèse|Résumé|Summary|En résumé|Final Assessment|Overall Assessment)[^\n]*\n([\s\S]*?)(?=\n#|\n---|\n\*{3,}|$)/i,
          /\*\*(?:Conclusion|Verdict|Synthèse|En résumé|Summary)\*\*[:\s]*([\s\S]*?)(?=\n\n|\n#|\n---|\n\*{3,}|$)/i,
        ];
        for (const pattern of conclusionPatterns) {
          const match = md.match(pattern);
          if (match && match[1]) {
            const text = cleanMarkdownText(match[1]).trim();
            if (text.length > 20) {
              return truncateText(text, 200);
            }
          }
        }
        // Fallback: take the last non-empty paragraph that isn't a heading or list
        const paragraphs = md.split(/\n\n+/).filter((p) => {
          const trimmed = p.trim();
          return (
            trimmed.length > 30 &&
            !trimmed.startsWith("#") &&
            !trimmed.startsWith("-") &&
            !trimmed.startsWith("*")
          );
        });
        if (paragraphs.length > 0) {
          const last = cleanMarkdownText(paragraphs[paragraphs.length - 1]);
          return truncateText(last, 200);
        }
        return "Analysis complete. See detailed view for full results.";
      }
      /** Extract key points from epistemic markers */
      function extractKeyPoints(md) {
        const points = [];
        const lines = md.split("\n");
        // Patterns for epistemic markers
        const solidPatterns = [
          /\b(?:SOLIDE|SOLID)\b/i,
          /\u2705\s*\*\*/,
          /\u2705/,
        ];
        const weakPatterns = [
          /\b(?:A VERIFIER|TO VERIFY|QUESTIONABLE|WEAK|INCERTAIN|UNCERTAIN)\b/i,
          /\u26A0\uFE0F\s*\*\*/,
          /\u2753/,
          /\u26A0/,
        ];
        const insightPatterns = [/\b(?:PLAUSIBLE)\b/i, /\uD83D\uDCA1/];
        for (const line of lines) {
          const trimmed = line.replace(/^[\s\-*]+/, "").trim();
          if (trimmed.length < 10) continue;
          let type = null;
          if (solidPatterns.some((p) => p.test(line))) {
            type = "solid";
          } else if (weakPatterns.some((p) => p.test(line))) {
            type = "weak";
          } else if (insightPatterns.some((p) => p.test(line))) {
            type = "insight";
          }
          if (type && points.filter((p) => p.type === type).length < 2) {
            const cleanText = cleanMarkdownText(trimmed)
              .replace(
                /\b(?:SOLIDE|SOLID|PLAUSIBLE|INCERTAIN|UNCERTAIN|A VERIFIER|TO VERIFY|QUESTIONABLE|WEAK)\b\s*[:—\-–]?\s*/gi,
                "",
              )
              .replace(/^[✅⚠️❓💡🔍🔬]\s*/u, "")
              .trim();
            if (cleanText.length > 10) {
              points.push({ type, text: truncateText(cleanText, 120) });
            }
          }
          if (points.length >= 4) break;
        }
        // If we found fewer than 2 points, try extracting from list items in key sections
        if (points.length < 2) {
          const sectionPattern =
            /#+\s*(?:Points?\s+(?:forts?|clés?|faibles?)|Key\s+(?:Points?|Findings?|Takeaways?)|Strengths?|Weaknesses?|Main\s+Points?)[^\n]*\n([\s\S]*?)(?=\n#|$)/gi;
          let sectionMatch;
          while (
            (sectionMatch = sectionPattern.exec(md)) !== null &&
            points.length < 4
          ) {
            const sectionContent = sectionMatch[1];
            const items = sectionContent.match(/^[\s]*[-*]\s+(.+)$/gm);
            if (items) {
              for (const item of items.slice(0, 4 - points.length)) {
                const text = cleanMarkdownText(
                  item.replace(/^[\s]*[-*]\s+/, ""),
                );
                if (
                  text.length > 10 &&
                  !points.some((p) => p.text === truncateText(text, 120))
                ) {
                  points.push({
                    type: "insight",
                    text: truncateText(text, 120),
                  });
                }
              }
            }
          }
        }
        return points.slice(0, 4);
      }
      /** Extract thematic tags from the content */
      function extractTags(md) {
        const tags = [];
        // Look for explicit tags/themes section
        const tagsMatch = md.match(
          /#+\s*(?:Tags?|Thèmes?|Themes?|Topics?|Catégories?|Categories?)[^\n]*\n([\s\S]*?)(?=\n#|$)/i,
        );
        if (tagsMatch) {
          const tagItems = tagsMatch[1].match(/[-*]\s+(.+)/g);
          if (tagItems) {
            for (const item of tagItems.slice(0, 3)) {
              const text = cleanMarkdownText(
                item.replace(/^[-*]\s+/, ""),
              ).trim();
              if (text.length > 0 && text.length < 30) {
                tags.push(text);
              }
            }
          }
        }
        // Fallback: extract from headings if no explicit tags found
        if (tags.length === 0) {
          const headings = md.match(/^#{2,3}\s+(.+)$/gm);
          if (headings) {
            const skipWords =
              /^(?:Conclusion|Summary|Résumé|Synthèse|Introduction|Verdict|Analysis|Points?\s+(?:clés?|forts?|faibles?)|Key\s+(?:Points?|Findings?)|Strengths?|Weaknesses?|Overview)/i;
            for (const h of headings) {
              const text = cleanMarkdownText(
                h.replace(/^#{2,3}\s+/, ""),
              ).trim();
              if (
                text.length > 2 &&
                text.length < 35 &&
                !skipWords.test(text)
              ) {
                tags.push(text);
                if (tags.length >= 3) break;
              }
            }
          }
        }
        return tags.slice(0, 3);
      }
      /** Remove markdown formatting characters */
      function cleanMarkdownText(text) {
        return text
          .replace(/\*\*(.+?)\*\*/g, "$1")
          .replace(/\*(.+?)\*/g, "$1")
          .replace(/`([^`]+)`/g, "$1")
          .replace(/#{1,6}\s+/g, "")
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
          .replace(/^>\s+/gm, "")
          .replace(/\n+/g, " ")
          .trim();
      }
      /** Truncate text at word boundary */
      function truncateText(text, maxLen) {
        if (text.length <= maxLen) return text;
        const truncated = text.substring(0, maxLen);
        const lastSpace = truncated.lastIndexOf(" ");
        return (
          (lastSpace > maxLen * 0.6
            ? truncated.substring(0, lastSpace)
            : truncated) + "..."
        );
      }

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
    /*!******************************!*\
  !*** ./src/content/index.ts ***!
  \******************************/
    __webpack_require__.r(__webpack_exports__);
    /* harmony import */ var _utils_video__WEBPACK_IMPORTED_MODULE_0__ =
      __webpack_require__(/*! ../utils/video */ "./src/utils/video.ts");
    /* harmony import */ var _utils_storage__WEBPACK_IMPORTED_MODULE_1__ =
      __webpack_require__(/*! ../utils/storage */ "./src/utils/storage.ts");
    /* harmony import */ var _utils_config__WEBPACK_IMPORTED_MODULE_2__ =
      __webpack_require__(/*! ../utils/config */ "./src/utils/config.ts");
    /* harmony import */ var _tts__WEBPACK_IMPORTED_MODULE_3__ =
      __webpack_require__(/*! ./tts */ "./src/content/tts.ts");
    /* harmony import */ var _navigation__WEBPACK_IMPORTED_MODULE_4__ =
      __webpack_require__(/*! ./navigation */ "./src/content/navigation.ts");
    /* harmony import */ var _theme__WEBPACK_IMPORTED_MODULE_5__ =
      __webpack_require__(/*! ./theme */ "./src/content/theme.ts");
    /* harmony import */ var _widget__WEBPACK_IMPORTED_MODULE_6__ =
      __webpack_require__(/*! ./widget */ "./src/content/widget.ts");
    /* harmony import */ var _shadow__WEBPACK_IMPORTED_MODULE_7__ =
      __webpack_require__(/*! ./shadow */ "./src/content/shadow.ts");
    /* harmony import */ var _tournesol__WEBPACK_IMPORTED_MODULE_8__ =
      __webpack_require__(/*! ./tournesol */ "./src/content/tournesol.ts");
    /* harmony import */ var _observer__WEBPACK_IMPORTED_MODULE_9__ =
      __webpack_require__(/*! ./observer */ "./src/content/observer.ts");
    /* harmony import */ var _theater__WEBPACK_IMPORTED_MODULE_10__ =
      __webpack_require__(/*! ./theater */ "./src/content/theater.ts");
    /* harmony import */ var _states_login__WEBPACK_IMPORTED_MODULE_11__ =
      __webpack_require__(
        /*! ./states/login */ "./src/content/states/login.ts",
      );
    /* harmony import */ var _states_ready__WEBPACK_IMPORTED_MODULE_12__ =
      __webpack_require__(
        /*! ./states/ready */ "./src/content/states/ready.ts",
      );
    /* harmony import */ var _states_analyzing__WEBPACK_IMPORTED_MODULE_13__ =
      __webpack_require__(
        /*! ./states/analyzing */ "./src/content/states/analyzing.ts",
      );
    /* harmony import */ var _states_results__WEBPACK_IMPORTED_MODULE_14__ =
      __webpack_require__(
        /*! ./states/results */ "./src/content/states/results.ts",
      );
    /* harmony import */ var _states_chat__WEBPACK_IMPORTED_MODULE_15__ =
      __webpack_require__(/*! ./states/chat */ "./src/content/states/chat.ts");
    // ── Content Script — Point d'entrée modulaire ──
    // Remplace l'ancien content.ts monolithique (852 lignes)

    const ctx = {
      state: "login",
      videoId: null,
      currentTaskId: null,
      user: null,
      planInfo: null,
      summary: null,
      tournesol: null,
      injected: false,
      injectionAttempts: 0,
    };
    function assetUrl(p) {
      return chrome.runtime.getURL(`assets/${p}`);
    }
    function logoImgHtml(size = 22) {
      return `<img src="${assetUrl("deepsight-logo-cosmic.png")}" alt="DeepSight" width="${size}" height="${size}" style="object-fit:contain;border-radius:50%;" />`;
    }
    // ── Widget injection avec retry ──
    function tryInjectWidget() {
      if (
        ctx.injected &&
        (0, _widget__WEBPACK_IMPORTED_MODULE_6__.getExistingWidget)()
      )
        return;
      if (ctx.injectionAttempts > 30) return;
      ctx.injectionAttempts++;
      const platform = (0,
      _utils_video__WEBPACK_IMPORTED_MODULE_0__.detectCurrentPagePlatform)();
      const isTikTok = platform === "tiktok";
      const theme = (0, _theme__WEBPACK_IMPORTED_MODULE_5__.detectTheme)();
      const host = (0, _widget__WEBPACK_IMPORTED_MODULE_6__.createWidgetShell)(
        theme,
        isTikTok,
      );
      // The widget card is inside the shadow root — set its content
      const widgetCard = (0,
      _widget__WEBPACK_IMPORTED_MODULE_6__.getExistingWidget)();
      if (widgetCard) {
        widgetCard.innerHTML = (0,
        _widget__WEBPACK_IMPORTED_MODULE_6__.buildWidgetHeader)(
          logoImgHtml(22),
        );
        const body = document.createElement("div");
        body.className = "ds-card-body";
        body.innerHTML = `<div class="ds-loading"><div style="color:var(--ds-gold-mid)">⏳</div><p class="ds-loading-text">Chargement...</p></div>`;
        widgetCard.appendChild(body);
      }
      const success = (0, _widget__WEBPACK_IMPORTED_MODULE_6__.injectWidget)(
        host,
        isTikTok,
      );
      if (success) {
        ctx.injected = true;
        ctx.injectionAttempts = 0;
        (0, _widget__WEBPACK_IMPORTED_MODULE_6__.bindMinimizeButton)();
        // Watch theme changes
        (0, _theme__WEBPACK_IMPORTED_MODULE_5__.watchTheme)((t) => {
          const w = (0,
          _widget__WEBPACK_IMPORTED_MODULE_6__.getExistingWidget)();
          if (w) {
            w.classList.remove("dark", "light");
            w.classList.add(t);
          }
        });
        // Re-inject if YouTube SPA removes the widget
        (0, _observer__WEBPACK_IMPORTED_MODULE_9__.startWidgetObserver)(() => {
          ctx.injected = false;
          tryInjectWidget();
        });
        // Adjust layout when theater/fullscreen toggles
        (0, _theater__WEBPACK_IMPORTED_MODULE_10__.watchLayoutMode)((mode) => {
          const hostEl = document.getElementById("deepsight-host");
          if (!hostEl) return;
          if (mode === "fullscreen") {
            hostEl.style.display = "none";
          } else if (mode === "theater") {
            hostEl.style.cssText =
              "all:initial;position:fixed;bottom:20px;right:20px;width:380px;max-height:80vh;z-index:99999;";
            hostEl.style.display = "";
          } else {
            hostEl.style.cssText =
              "all:initial;display:block;width:100%;max-width:420px;margin-bottom:12px;";
          }
        });
        initCard();
      } else {
        // Adaptive interval: 300ms for first 10, then 1000ms
        const delay = ctx.injectionAttempts <= 10 ? 300 : 1000;
        setTimeout(tryInjectWidget, delay);
      }
    }
    // ── Initialisation principale ──
    async function initCard() {
      try {
        const authResp = await chrome.runtime.sendMessage({
          action: "CHECK_AUTH",
        });
        if (!authResp?.authenticated) {
          ctx.state = "login";
          ctx.user = null;
          (0, _states_login__WEBPACK_IMPORTED_MODULE_11__.renderLoginState)(
            () => initCard(),
          );
          return;
        }
        ctx.user = authResp.user ?? null;
        // Fetch plan info (non-bloquant)
        chrome.runtime
          .sendMessage({ action: "GET_PLAN" })
          .then((resp) => {
            if (resp?.success) ctx.planInfo = resp.plan ?? null;
          })
          .catch(() => {});
        // Fetch Tournesol score (non-bloquant)
        if (ctx.videoId) {
          (0, _tournesol__WEBPACK_IMPORTED_MODULE_8__.fetchTournesolScore)(
            ctx.videoId,
          )
            .then((data) => {
              ctx.tournesol = data;
              // Mettre à jour le widget si en état ready
              if (ctx.state === "ready" && ctx.user) {
                (0,
                _states_ready__WEBPACK_IMPORTED_MODULE_12__.renderReadyState)({
                  user: {
                    username: ctx.user.username,
                    plan: ctx.user.plan,
                    credits: ctx.user.credits,
                  },
                  tournesol: ctx.tournesol,
                  videoTitle: getVideoTitle(),
                  onAnalyze: (mode, lang) => startAnalysis(mode, lang),
                  onQuickChat: (lang) => handleQuickChat(lang),
                  onLogout: handleLogout,
                });
              }
            })
            .catch(() => {});
        }
        ctx.state = "ready";
        (0, _states_ready__WEBPACK_IMPORTED_MODULE_12__.renderReadyState)({
          user: {
            username: ctx.user.username,
            plan: ctx.user.plan,
            credits: ctx.user.credits,
          },
          tournesol: ctx.tournesol,
          videoTitle: getVideoTitle(),
          onAnalyze: (mode, lang) => startAnalysis(mode, lang),
          onQuickChat: (lang) => handleQuickChat(lang),
          onLogout: handleLogout,
        });
      } catch (err) {
        showError(`Erreur d'initialisation: ${err.message}`);
      }
    }
    function getVideoTitle() {
      // YouTube: titre dans le DOM
      const el =
        document.querySelector("ytd-watch-metadata h1 yt-formatted-string") ??
        document.querySelector("h1.title") ??
        document.querySelector('meta[name="title"]');
      if (el instanceof HTMLMetaElement) return el.content;
      return el?.textContent?.trim() ?? "";
    }
    // ── Analyse ──
    function handleCancelCurrentAnalysis() {
      if (ctx.currentTaskId) {
        chrome.runtime
          .sendMessage({
            action: "CANCEL_ANALYSIS",
            data: { taskId: ctx.currentTaskId },
          })
          .catch(() => {});
      }
      ctx.state = "ready";
      ctx.currentTaskId = null;
      if (ctx.user) {
        (0, _states_ready__WEBPACK_IMPORTED_MODULE_12__.renderReadyState)({
          user: {
            username: ctx.user.username,
            plan: ctx.user.plan,
            credits: ctx.user.credits,
          },
          tournesol: ctx.tournesol,
          videoTitle: getVideoTitle(),
          onAnalyze: startAnalysis,
          onQuickChat: handleQuickChat,
          onLogout: handleLogout,
        });
      }
    }
    async function startAnalysis(mode, lang) {
      if (!ctx.videoId) return;
      ctx.state = "analyzing";
      ctx.currentTaskId = null;
      (0, _states_analyzing__WEBPACK_IMPORTED_MODULE_13__.renderAnalyzingState)(
        "Démarrage de l'analyse...",
        0,
        handleCancelCurrentAnalysis,
      );
      const url = window.location.href;
      try {
        const response = await chrome.runtime.sendMessage({
          action: "ANALYZE_VIDEO",
          data: { url, options: { mode, lang, category: "auto" } },
        });
        if (!response?.success)
          throw new Error(response?.error || "Analyse échouée");
        const result = response.result;
        if (result.status === "completed" && result.result?.summary_id) {
          await displaySummary(result.result.summary_id);
        } else if (result.status === "failed") {
          throw new Error(result.error ?? "Analyse échouée");
        }
      } catch (e) {
        ctx.state = "ready";
        showError(e.message);
        // Retour à l'état ready après 3s
        setTimeout(() => {
          if (ctx.user) {
            (0, _states_ready__WEBPACK_IMPORTED_MODULE_12__.renderReadyState)({
              user: {
                username: ctx.user.username,
                plan: ctx.user.plan,
                credits: ctx.user.credits,
              },
              tournesol: ctx.tournesol,
              videoTitle: getVideoTitle(),
              onAnalyze: startAnalysis,
              onQuickChat: handleQuickChat,
              onLogout: handleLogout,
            });
          }
        }, 3000);
      }
    }
    async function displaySummary(summaryId) {
      const resp = await chrome.runtime.sendMessage({
        action: "GET_SUMMARY",
        data: { summaryId },
      });
      if (!resp?.success)
        throw new Error(resp?.error || "Récupération analyse échouée");
      ctx.summary = resp.summary;
      ctx.state = "results";
      // Enregistrer dans historique local
      if (ctx.videoId) {
        await (0,
        _utils_storage__WEBPACK_IMPORTED_MODULE_1__.addRecentAnalysis)({
          videoId: ctx.videoId,
          summaryId: ctx.summary.id,
          title: ctx.summary.video_title,
        });
      }
      await (0,
      _states_results__WEBPACK_IMPORTED_MODULE_14__.renderResultsState)({
        summary: ctx.summary,
        userPlan: ctx.user?.plan ?? "free",
        onChat: openChat,
        onCopyLink: handleCopy,
        onShare: handleShare,
      });
    }
    // ── Quick Chat ──
    async function handleQuickChat(lang) {
      try {
        const resp = await chrome.runtime.sendMessage({
          action: "QUICK_CHAT",
          data: { url: window.location.href, lang },
        });
        if (!resp?.success) throw new Error(resp?.error || "Quick Chat échoué");
        const result = resp.result;
        openChat(result.summary_id, result.video_title);
      } catch (e) {
        showError(e.message);
        // Re-enable button
        const btn = (0, _shadow__WEBPACK_IMPORTED_MODULE_7__.$id)(
          "ds-quickchat-btn",
        );
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = "💬 Quick Chat IA";
        }
      }
    }
    // ── Chat ──
    async function openChat(summaryId, title) {
      ctx.state = "chat";
      // Charger l'historique
      let messages = [];
      try {
        const histResp = await chrome.runtime.sendMessage({
          action: "GET_CHAT_HISTORY",
          data: { summaryId },
        });
        if (histResp?.success && Array.isArray(histResp.result)) {
          messages = histResp.result;
        }
      } catch {
        /* historique non critique */
      }
      await (0, _states_chat__WEBPACK_IMPORTED_MODULE_15__.renderChatState)({
        summaryId,
        videoTitle: title,
        category: ctx.summary?.category ?? "default",
        messages,
        onBack: ctx.summary
          ? () => {
              ctx.state = "results";
              (0,
              _states_results__WEBPACK_IMPORTED_MODULE_14__.renderResultsState)(
                {
                  summary: ctx.summary,
                  userPlan: ctx.user?.plan ?? "free",
                  onChat: openChat,
                  onCopyLink: handleCopy,
                  onShare: handleShare,
                },
              );
            }
          : undefined,
      });
    }
    // ── Copy ──
    async function handleCopy() {
      if (!ctx.summary) return;
      const btn = (0, _shadow__WEBPACK_IMPORTED_MODULE_7__.$id)("ds-copy-btn");
      if (!btn) return;
      let shareUrl = `${_utils_config__WEBPACK_IMPORTED_MODULE_2__.WEBAPP_URL}/summary/${ctx.summary.id}`;
      try {
        const res = await chrome.runtime.sendMessage({
          action: "SHARE_ANALYSIS",
          data: { videoId: ctx.videoId },
        });
        if (res?.success && res.share_url) shareUrl = res.share_url;
      } catch {
        /* use fallback */
      }
      const text = [
        `🎯 DeepSight — Analyse IA`,
        ``,
        `📹 ${ctx.summary.video_title}`,
        `🏷️ Catégorie: ${ctx.summary.category}`,
        `📊 Fiabilité: ${ctx.summary.reliability_score}%`,
        ``,
        `🔗 ${shareUrl}`,
        `—`,
        `deepsightsynthesis.com`,
      ].join("\n");
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = "✅ Copié!";
        setTimeout(() => {
          btn.textContent = "📋 Copier";
        }, 2000);
      } catch {
        btn.textContent = "❌ Échec";
        setTimeout(() => {
          btn.textContent = "📋 Copier";
        }, 2000);
      }
    }
    // ── Share ──
    async function handleShare() {
      if (!ctx.summary) return;
      const btn = (0, _shadow__WEBPACK_IMPORTED_MODULE_7__.$id)("ds-share-btn");
      if (!btn) return;
      try {
        const res = await chrome.runtime.sendMessage({
          action: "SHARE_ANALYSIS",
          data: { videoId: ctx.videoId },
        });
        const url = res?.success
          ? res.share_url
          : `${_utils_config__WEBPACK_IMPORTED_MODULE_2__.WEBAPP_URL}/summary/${ctx.summary.id}`;
        await navigator.clipboard.writeText(url);
        btn.textContent = "✅ Lien copié!";
        setTimeout(() => {
          btn.textContent = "🔗 Partager";
        }, 2000);
      } catch {
        btn.textContent = "❌ Échec";
        setTimeout(() => {
          btn.textContent = "🔗 Partager";
        }, 2000);
      }
    }
    // ── Logout ──
    async function handleLogout() {
      await chrome.runtime.sendMessage({ action: "LOGOUT" });
      ctx.user = null;
      ctx.planInfo = null;
      ctx.summary = null;
      ctx.tournesol = null;
      ctx.state = "login";
      (0, _states_login__WEBPACK_IMPORTED_MODULE_11__.renderLoginState)(() =>
        initCard(),
      );
    }
    // ── Error display ──
    function showError(message) {
      const body = (0, _widget__WEBPACK_IMPORTED_MODULE_6__.getWidgetBody)();
      if (!body) return;
      const errorDiv = document.createElement("div");
      errorDiv.style.cssText =
        "padding:8px 12px;background:var(--ds-error-bg);border-radius:8px;font-size:11px;color:var(--ds-error);margin-top:8px";
      errorDiv.textContent = `❌ ${message}`;
      body.appendChild(errorDiv);
    }
    // ── Navigation handler ──
    async function onNavigate(videoId) {
      // Stop TTS audio on navigation
      (0, _tts__WEBPACK_IMPORTED_MODULE_3__.ttsStop)();
      // Cleanup observers
      (0, _observer__WEBPACK_IMPORTED_MODULE_9__.stopWidgetObserver)();
      (0, _theater__WEBPACK_IMPORTED_MODULE_10__.stopWatchingLayout)();
      // Reset state
      ctx.videoId = videoId;
      ctx.summary = null;
      ctx.tournesol = null;
      ctx.state = "login";
      ctx.injected = false;
      ctx.injectionAttempts = 0;
      (0, _widget__WEBPACK_IMPORTED_MODULE_6__.removeWidget)();
      if (
        !videoId ||
        !(0, _navigation__WEBPACK_IMPORTED_MODULE_4__.isVideoPage)()
      )
        return;
      // Délai pour laisser le DOM YouTube se mettre en place
      setTimeout(tryInjectWidget, 800);
    }
    // ── Message listener (from background / popup) ──
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.action === "ANALYSIS_PROGRESS") {
        const { taskId, progress, message: msg } = message.data;
        if (ctx.state === "analyzing") {
          ctx.currentTaskId = taskId;
          (0,
          _states_analyzing__WEBPACK_IMPORTED_MODULE_13__.updateAnalyzingProgress)(
            msg,
            progress,
          );
        }
        sendResponse({ success: true });
        return undefined;
      }
      if (message.action === "TOGGLE_WIDGET") {
        const w = (0, _widget__WEBPACK_IMPORTED_MODULE_6__.getExistingWidget)();
        if (w) (0, _widget__WEBPACK_IMPORTED_MODULE_6__.removeWidget)();
        else tryInjectWidget();
        sendResponse({ success: true });
        return undefined;
      }
      if (message.action === "START_ANALYSIS_FROM_COMMAND") {
        if (ctx.state === "ready") {
          startAnalysis("standard", "fr");
        }
        sendResponse({ success: true });
        return undefined;
      }
      if (message.action === "OPEN_CHAT_FROM_COMMAND") {
        if (ctx.state === "results" && ctx.summary) {
          openChat(ctx.summary.id, ctx.summary.video_title);
        }
        sendResponse({ success: true });
        return undefined;
      }
      return undefined;
    });
    // ── Bootstrap ──
    function bootstrap() {
      if (!(0, _navigation__WEBPACK_IMPORTED_MODULE_4__.isVideoPage)()) return;
      ctx.videoId = (0,
      _navigation__WEBPACK_IMPORTED_MODULE_4__.getCurrentVideoId)();
      if (!ctx.videoId) return;
      // Démarrer l'injection avec délai
      setTimeout(tryInjectWidget, 1000);
      // Écouter les navigations SPA
      (0, _navigation__WEBPACK_IMPORTED_MODULE_4__.watchNavigation)(onNavigate);
    }
    // Attendre que le DOM soit prêt
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bootstrap);
    } else {
      bootstrap();
    }
  })();

  /******/
})();
//# sourceMappingURL=content.js.map
