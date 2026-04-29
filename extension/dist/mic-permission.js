(() => {
  "use strict";
  const e = document.getElementById("grant-btn"),
    t = document.getElementById("status");
  function r(e, r = "") {
    t && ((t.textContent = e), (t.className = "status" + (r ? ` ${r}` : "")));
  }
  e &&
    e.addEventListener("click", () => {
      ((e.disabled = !0),
        r("Demande en cours…"),
        navigator.mediaDevices
          .getUserMedia({ audio: !0 })
          .then((e) => {
            for (const t of e.getTracks()) t.stop();
            (r("✅ Micro autorisé ! Cette fenêtre se ferme…", "ok"),
              chrome.runtime
                .sendMessage({ action: "MIC_PERMISSION_GRANTED" })
                .catch(() => {}),
              setTimeout(() => window.close(), 800));
          })
          .catch((t) => {
            e.disabled = !1;
            const o = t.name || "Error";
            r(
              "NotAllowedError" === o || "PermissionDeniedError" === o
                ? "❌ Permission refusée. Recharge la page et choisis « Autoriser »."
                : "NotFoundError" === o || "DevicesNotFoundError" === o
                  ? "❌ Aucun micro détecté sur ton appareil."
                  : "NotReadableError" === o
                    ? "❌ Le micro est utilisé par une autre application."
                    : `❌ ${o}: ${t.message}`,
              "err",
            );
          }));
    });
})();
