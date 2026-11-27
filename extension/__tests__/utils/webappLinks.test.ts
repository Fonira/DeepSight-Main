/**
 * Tests — utils/webappLinks.ts
 *
 * Bug couvert : les CTA « Ouvrir dans l'app » visaient des routes supprimées
 * du site (/summary/:id, /hub/analysis/:id, /library, /mobile, /analyze,
 * /study/<videoId>) → page 404. Les routes ci-dessous existent dans
 * frontend/src/App.tsx (/hub?conv=, /study/:summaryId, /dashboard?id=&legacy=1,
 * /upgrade, /login?tab=register, /hub?view=history).
 */

import {
  DASHBOARD_URL,
  HISTORY_URL,
  REGISTER_URL,
  UPGRADE_URL,
  analysisUrl,
  featureUrl,
  studyUrl,
  upgradeUrl,
} from "../../src/utils/webappLinks";

const WEB = "https://www.deepsightsynthesis.com";

describe("webappLinks", () => {
  it("opens an analysis in the Hub", () => {
    expect(analysisUrl(42)).toBe(`${WEB}/hub?conv=42`);
    expect(analysisUrl(42, "chat")).toBe(`${WEB}/hub?conv=42&tab=chat`);
  });

  it("uses the canonical register / upgrade / history routes", () => {
    expect(REGISTER_URL).toBe(`${WEB}/login?tab=register`);
    expect(UPGRADE_URL).toBe(`${WEB}/upgrade`);
    expect(HISTORY_URL).toBe(`${WEB}/hub?view=history`);
    expect(upgradeUrl({ utm_source: "extension", feature: "visual" })).toBe(
      `${WEB}/upgrade?utm_source=extension&feature=visual`,
    );
  });

  it("maps each feature CTA to a page that exists", () => {
    expect(studyUrl(7)).toBe(`${WEB}/study/7`);
    expect(featureUrl(7, "flashcards")).toBe(`${WEB}/study/7`);
    expect(featureUrl(7, "mind_maps")).toBe(`${DASHBOARD_URL}?id=7&legacy=1`);
    expect(featureUrl(7, "exports")).toBe(`${DASHBOARD_URL}?id=7&legacy=1`);
    expect(featureUrl(7, "web_search")).toBe(`${WEB}/hub?conv=7&tab=chat`);
    expect(featureUrl(7, "playlists")).toBe(DASHBOARD_URL);
  });

  it("never produces a removed route", () => {
    const urls = [
      analysisUrl(1),
      analysisUrl(1, "flashcards"),
      studyUrl(1),
      ...(["flashcards", "mind_maps", "web_search", "exports", "playlists"] as const).map(
        (f) => featureUrl(1, f),
      ),
      REGISTER_URL,
      UPGRADE_URL,
    ];
    for (const url of urls) {
      expect(url).not.toMatch(/\/(summary|library|mobile|analyze|register|pricing)\b/);
      expect(url).not.toContain("/hub/analysis/");
    }
  });
});
