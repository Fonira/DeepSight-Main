/** @jest-environment jsdom */
//
// Tests — `renderVisualAnalysisBadge` (extension/src/content/widget.ts)
//
// Couvre :
//  - Rendu du badge "Analyse visuelle" sous le bouton voice
//  - Variation Pro/Expert (Inclus) vs Free (Pro+ CTA)
//  - Click → envoie OPEN_SIDEPANEL_VISUAL ou OPEN_BILLING_UPSELL
import { renderVisualAnalysisBadge } from "../../src/content/widget";

async function renderBadge(opts: {
  plan: "free" | "pro" | "expert";
  videoId?: string;
}): Promise<void> {
  document.body.innerHTML = '<div id="ds-widget-root"></div>';
  const root = document.getElementById("ds-widget-root");
  if (!root) throw new Error("root not found");
  await renderVisualAnalysisBadge(root, opts);
}

function getBadges(): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>("button.ds-visual-badge"),
  );
}

describe("widget visual analysis badge", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    chrome.runtime.sendMessage = jest.fn();
  });

  it("renders one badge with eye emoji", async () => {
    await renderBadge({ plan: "pro", videoId: "abc" });
    const badges = getBadges();
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toMatch(/👁️/);
    expect(badges[0].textContent).toMatch(/Analyse visuelle/);
  });

  it("shows 'Inclus' tag for Pro user", async () => {
    await renderBadge({ plan: "pro" });
    expect(document.body.textContent).toMatch(/Inclus/i);
  });

  it("shows 'Inclus' tag for Expert user", async () => {
    await renderBadge({ plan: "expert" });
    expect(document.body.textContent).toMatch(/Inclus/i);
  });

  it("shows 'Pro+' tag for Free user (upsell)", async () => {
    await renderBadge({ plan: "free" });
    expect(document.body.textContent).toMatch(/Pro\+/i);
    expect(document.body.textContent).not.toMatch(/Inclus/i);
  });

  it("Pro click sends OPEN_SIDEPANEL_VISUAL", async () => {
    await renderBadge({ plan: "pro", videoId: "abc" });
    getBadges()[0].click();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "OPEN_SIDEPANEL_VISUAL",
      videoId: "abc",
      feature: "visual_analysis",
      plan: "pro",
    });
  });

  it("Free click sends OPEN_BILLING_UPSELL", async () => {
    await renderBadge({ plan: "free", videoId: "xyz" });
    getBadges()[0].click();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: "OPEN_BILLING_UPSELL",
      videoId: "xyz",
      feature: "visual_analysis",
      plan: "free",
    });
  });

  it("has aria-label adapted to plan", async () => {
    await renderBadge({ plan: "expert" });
    const badge = getBadges()[0];
    expect(badge.getAttribute("aria-label")).toMatch(
      /incluse dans votre plan/i,
    );

    document.body.innerHTML = "";
    await renderBadge({ plan: "free" });
    const badge2 = getBadges()[0];
    expect(badge2.getAttribute("aria-label")).toMatch(/disponible dès Pro/i);
  });
});
