/** @jest-environment jsdom */
//
// Messages de la fenêtre micro reçus par le service worker.

import { handleMessage } from "../../src/background";
import { resetChromeMocks } from "../setup/chrome-api-mock";

const sendMessage = chrome.runtime.sendMessage as unknown as jest.Mock;

describe("mic permission messages", () => {
  beforeEach(() => {
    resetChromeMocks();
    sendMessage.mockImplementation(() => Promise.resolve({}));
  });

  it("relays a granted microphone to the side panel", async () => {
    await expect(
      handleMessage({ action: "MIC_PERMISSION_GRANTED" }),
    ).resolves.toEqual({ success: true });
    expect(sendMessage).toHaveBeenCalledWith({
      action: "MIC_PERMISSION_GRANTED_BROADCAST",
    });
  });

  it("acknowledges a closed window without relaying it", async () => {
    await expect(
      handleMessage({ action: "MIC_PERMISSION_DISMISSED" }),
    ).resolves.toEqual({ success: true });
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
