/** @jest-environment jsdom */

import {
  buildWidgetHeader,
  bindVoiceButton,
} from "../../src/content/widget";
import { setShadowRoot } from "../../src/content/shadow";

interface ChromeFeatureFlags {
  sidePanel?: object;
}

function setChromeFeatureFlags(flags: ChromeFeatureFlags): void {
  const c = (global as unknown as { chrome: ChromeFeatureFlags & object })
    .chrome;
  if (flags.sidePanel === undefined) {
    delete (c as { sidePanel?: object }).sidePanel;
  } else {
    (c as { sidePanel?: object }).sidePanel = flags.sidePanel;
  }
}

describe("widget header — voice button feature detection", () => {
  afterEach(() => {
    setChromeFeatureFlags({ sidePanel: undefined });
    document.body.innerHTML = "";
    setShadowRoot(null);
  });

  it("includes the voice button when chrome.sidePanel API is available", () => {
    setChromeFeatureFlags({ sidePanel: {} });
    const html = buildWidgetHeader('<img src="x" />');
    expect(html).toContain('id="ds-voice-btn"');
    expect(html).toContain("Appeler");
  });

  it("hides the voice button when chrome.sidePanel API is missing (Firefox/Safari)", () => {
    setChromeFeatureFlags({ sidePanel: undefined });
    const html = buildWidgetHeader('<img src="x" />');
    expect(html).not.toContain('id="ds-voice-btn"');
    expect(html).not.toContain("Appeler");
  });

  it("bindVoiceButton sends OPEN_VOICE_PANEL message with current context", async () => {
    setChromeFeatureFlags({ sidePanel: {} });

    // Mount a fake shadow root with the header HTML.
    const root = document.createElement("div");
    document.body.appendChild(root);
    const shadow = root.attachShadow({ mode: "open" });
    shadow.innerHTML = `<div id="ds-card">${buildWidgetHeader("<img />")}</div>`;
    setShadowRoot(shadow);

    const sendMessage = jest.fn().mockResolvedValue({ success: true });
    type RuntimeShape = { sendMessage: typeof sendMessage };
    const c = (global as unknown as { chrome: { runtime: RuntimeShape } })
      .chrome;
    c.runtime.sendMessage = sendMessage;

    bindVoiceButton(() => ({
      summaryId: 12,
      videoId: "abc",
      videoTitle: "Hello",
      platform: "youtube",
    }));

    const btn = shadow.getElementById("ds-voice-btn") as HTMLButtonElement;
    expect(btn).toBeTruthy();
    btn.click();
    // Wait one microtask for the async handler.
    await Promise.resolve();

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "OPEN_VOICE_PANEL",
        data: expect.objectContaining({
          summaryId: 12,
          videoId: "abc",
          videoTitle: "Hello",
          platform: "youtube",
        }),
      }),
    );
  });

  it("bindVoiceButton is idempotent (data-bound guard)", () => {
    setChromeFeatureFlags({ sidePanel: {} });
    const root = document.createElement("div");
    document.body.appendChild(root);
    const shadow = root.attachShadow({ mode: "open" });
    shadow.innerHTML = `<div id="ds-card">${buildWidgetHeader("<img />")}</div>`;
    setShadowRoot(shadow);

    const getCtx = jest.fn(() => ({
      summaryId: null,
      videoId: null,
      videoTitle: null,
      platform: null,
    }));

    bindVoiceButton(getCtx);
    bindVoiceButton(getCtx); // second call should be a no-op

    const btn = shadow.getElementById("ds-voice-btn") as HTMLButtonElement;
    btn.click();

    expect(getCtx).toHaveBeenCalledTimes(1);
  });
});
