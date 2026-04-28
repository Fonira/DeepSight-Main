// extension/src/mic-permission.ts
//
// Popup window dédié pour demander la permission micro.
//
// Pourquoi un popup window ?
// Le sidepanel Chrome MV3 a un bug connu (chromium #41497129) où
// getUserMedia ne déclenche pas le prompt natif Chrome de façon fiable.
// Une nouvelle window ouverte via chrome.windows.create({type:"popup"})
// est un context "tab-like" où getUserMedia se comporte comme dans une
// page web normale — le prompt natif Chrome s'affiche garanti.
//
// Flow :
//   1. Sidepanel envoie {action:"OPEN_MIC_PERMISSION_POPUP"} au background
//   2. Background ouvre chrome.windows.create({url:"mic-permission.html"})
//   3. User clique le gros bouton dans cette window
//   4. getUserMedia → prompt natif Chrome → user clique Autoriser
//   5. Permission cached pour chrome-extension://<id>
//   6. Window envoie {action:"MIC_PERMISSION_GRANTED"} au background
//   7. Background broadcast au sidepanel → re-bootstrap

const btn = document.getElementById("grant-btn") as HTMLButtonElement | null;
const statusEl = document.getElementById("status") as HTMLDivElement | null;

function setStatus(text: string, kind: "ok" | "err" | "" = ""): void {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.className = "status" + (kind ? ` ${kind}` : "");
}

if (btn) {
  btn.addEventListener("click", () => {
    btn.disabled = true;
    setStatus("Demande en cours…");
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        // Release immédiat — Chrome cache la permission, le SDK ElevenLabs
        // côté sidepanel re-getUserMedia sans re-prompt.
        for (const track of stream.getTracks()) track.stop();
        setStatus("✅ Micro autorisé ! Cette fenêtre se ferme…", "ok");
        // Notifie le background → broadcast au sidepanel.
        chrome.runtime
          .sendMessage({ action: "MIC_PERMISSION_GRANTED" })
          .catch(() => {
            /* best-effort */
          });
        setTimeout(() => window.close(), 800);
      })
      .catch((err: Error) => {
        btn.disabled = false;
        const name = err.name || "Error";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setStatus(
            "❌ Permission refusée. Recharge la page et choisis « Autoriser ».",
            "err",
          );
        } else if (
          name === "NotFoundError" ||
          name === "DevicesNotFoundError"
        ) {
          setStatus("❌ Aucun micro détecté sur ton appareil.", "err");
        } else if (name === "NotReadableError") {
          setStatus(
            "❌ Le micro est utilisé par une autre application.",
            "err",
          );
        } else {
          setStatus(`❌ ${name}: ${err.message}`, "err");
        }
      });
  });
}
