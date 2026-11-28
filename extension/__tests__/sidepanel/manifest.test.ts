// ── Tests : manifest CSP + permissions Spec #4 ──
//
// Vérifie le manifest Chrome : side panel (Spec #4), CSP ElevenLabs et
// permissions minimales pour la revue du Chrome Web Store.

import * as fs from "fs";
import * as path from "path";

interface Manifest {
  manifest_version: number;
  minimum_chrome_version?: string;
  permissions?: string[];
  optional_permissions?: string[];
  host_permissions?: string[];
  side_panel?: { default_path?: string };
  content_security_policy?: { extension_pages?: string };
  commands?: Record<string, unknown>;
  action?: { default_popup?: string };
}

const manifestPath = path.resolve(
  __dirname,
  "..",
  "..",
  "public",
  "manifest.json",
);

function loadManifest(): Manifest {
  const raw = fs.readFileSync(manifestPath, "utf8");
  return JSON.parse(raw) as Manifest;
}

describe("manifest.json — Spec #4 patches", () => {
  let manifest: Manifest;

  beforeAll(() => {
    manifest = loadManifest();
  });

  it("uses Manifest V3", () => {
    expect(manifest.manifest_version).toBe(3);
  });

  it("declares the sidePanel permission", () => {
    expect(manifest.permissions).toEqual(expect.arrayContaining(["sidePanel"]));
  });

  it("declares side_panel.default_path = sidepanel.html", () => {
    expect(manifest.side_panel?.default_path).toBe("sidepanel.html");
  });

  it("limits host_permissions to the API and the video sites", () => {
    // Le SDK ElevenLabs ouvre une WebSocket (signed URL) : c'est la CSP
    // connect-src qui l'autorise, pas host_permissions. Les content scripts
    // du site DeepSight n'ont pas besoin de host_permissions non plus.
    expect([...(manifest.host_permissions ?? [])].sort()).toEqual(
      [
        "https://api.deepsightsynthesis.com/*",
        "https://www.youtube.com/*",
        "https://youtube.com/*",
        "https://www.tiktok.com/*",
        "https://tiktok.com/*",
        "https://vm.tiktok.com/*",
        "https://m.tiktok.com/*",
      ].sort(),
    );
  });

  it("does not request the 'tabs' permission (host access is enough)", () => {
    expect(manifest.permissions).not.toContain("tabs");
    expect(manifest.permissions).toEqual(
      expect.arrayContaining(["storage", "identity", "alarms", "sidePanel"]),
    );
  });

  // Chaque permission doit être justifiée dans la fiche Chrome Web Store
  // (extension/CHROME_WEB_STORE.md) : liste exacte, pour qu'un ajout soit
  // un choix explicite. `activeTab` est retiré : l'accès aux onglets YouTube
  // et TikTok passe par host_permissions, aucune autre page n'est lue.
  it("requests exactly the permissions justified for the store", () => {
    expect([...(manifest.permissions ?? [])].sort()).toEqual(
      [
        "alarms",
        "clipboardRead",
        "clipboardWrite",
        "identity",
        "offscreen",
        "sidePanel",
        "storage",
      ].sort(),
    );
  });

  it("references no former hosting provider", () => {
    const raw = fs.readFileSync(manifestPath, "utf8");
    expect(raw).not.toMatch(/89\.167\.23\.214|railway|vercel\.app|localhost/i);
  });

  it("CSP allows connect-src to ElevenLabs (HTTPS + WSS)", () => {
    const csp = manifest.content_security_policy?.extension_pages ?? "";
    expect(csp).toMatch(/connect-src/);
    expect(csp).toMatch(/https:\/\/api\.elevenlabs\.io/);
    expect(csp).toMatch(/wss:\/\/api\.elevenlabs\.io/);
    expect(csp).toMatch(/https:\/\/\*\.elevenlabs\.io/);
    expect(csp).toMatch(/wss:\/\/\*\.elevenlabs\.io/);
  });

  it("CSP keeps script-src 'self' (no remote scripts)", () => {
    const csp = manifest.content_security_policy?.extension_pages ?? "";
    expect(csp).toMatch(/script-src 'self'/);
    expect(csp).not.toMatch(/script-src[^;]*https?:/);
  });

  it("CSP keeps DeepSight API in connect-src", () => {
    const csp = manifest.content_security_policy?.extension_pages ?? "";
    expect(csp).toMatch(/https:\/\/api\.deepsightsynthesis\.com/);
  });

  it("declares the _execute_action keyboard shortcut", () => {
    const cmds = manifest.commands ?? {};
    expect(cmds).toHaveProperty("_execute_action");
  });

  it("opens the side panel from the toolbar icon (no popup)", () => {
    // setPanelBehavior({openPanelOnActionClick:true}) dans background.ts :
    // un default_popup empêcherait l'ouverture du side panel.
    expect(manifest.action?.default_popup).toBeUndefined();
  });

  // ── Quick Voice Call (B1) — permission micro ──────────────────────────────
  // getUserMedia passe par l'offscreen document (permission "offscreen") et
  // la popup mic-permission.html. `audioCapture` n'existe que pour les
  // Chrome Apps : Chrome affichait « 'audioCapture' is only allowed for
  // packaged apps » au chargement de l'extension.
  describe("microphone capture (Quick Voice Call B1)", () => {
    it("bumps minimum_chrome_version to 116+", () => {
      const min = manifest.minimum_chrome_version;
      expect(min).toBeDefined();
      const major = parseInt((min ?? "0").split(".")[0], 10);
      expect(major).toBeGreaterThanOrEqual(116);
    });

    it("relies on the offscreen permission, not the apps-only audioCapture", () => {
      expect(manifest.permissions).toEqual(
        expect.arrayContaining(["offscreen"]),
      );
      expect(manifest.optional_permissions ?? []).not.toContain(
        "audioCapture",
      );
    });
  });
});
