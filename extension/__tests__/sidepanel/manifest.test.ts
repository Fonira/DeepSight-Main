// ── Tests : manifest CSP + permissions Spec #4 ──
//
// Vérifie que le manifest Chrome inclut bien tous les patches requis
// par le Spec #4 (side panel + ElevenLabs CSP/host_permissions).

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

  it("declares ElevenLabs host_permissions for HTTPS + WSS", () => {
    const hosts = manifest.host_permissions ?? [];
    expect(hosts).toEqual(
      expect.arrayContaining([
        "https://api.elevenlabs.io/*",
        "wss://api.elevenlabs.io/*",
        "https://*.elevenlabs.io/*",
        "wss://*.elevenlabs.io/*",
      ]),
    );
  });

  it("does NOT lose the existing DeepSight host_permissions", () => {
    const hosts = manifest.host_permissions ?? [];
    expect(hosts).toEqual(
      expect.arrayContaining([
        "https://api.deepsightsynthesis.com/*",
        "https://www.youtube.com/*",
      ]),
    );
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

  it("keeps the popup as default action target", () => {
    expect(manifest.action?.default_popup).toBe("popup.html");
  });

  // ── Quick Voice Call (B1) — permission micro ──────────────────────────────
  // Le SDK ElevenLabs appelle `getUserMedia({audio:true})` depuis le side
  // panel. En MV3, getUserMedia depuis chrome-extension://… est autorisé
  // par défaut (prompt natif), mais Chrome < 116 a des bugs sur les side
  // panels. On bumpe minimum_chrome_version + on déclare audioCapture en
  // optional_permissions pour signaler le besoin au Chrome Web Store.
  describe("microphone capture (Quick Voice Call B1)", () => {
    it("bumps minimum_chrome_version to 116+", () => {
      const min = manifest.minimum_chrome_version;
      expect(min).toBeDefined();
      const major = parseInt((min ?? "0").split(".")[0], 10);
      expect(major).toBeGreaterThanOrEqual(116);
    });

    it("declares audioCapture in optional_permissions", () => {
      const opts = manifest.optional_permissions ?? [];
      expect(opts).toEqual(expect.arrayContaining(["audioCapture"]));
    });
  });
});
