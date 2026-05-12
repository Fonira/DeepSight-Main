import { describe, it, expect, beforeEach } from "vitest";
import { useHubStore } from "../hubStore";

describe("hubStore", () => {
  beforeEach(() => {
    useHubStore.getState().reset();
  });

  it("initial state has no active conversation and drawer open by default", () => {
    const s = useHubStore.getState();
    expect(s.activeConvId).toBeNull();
    // drawerOpen defaults to true so the conversations drawer is visible on
    // first Hub mount (see INITIAL in hubStore.ts).
    expect(s.drawerOpen).toBe(true);
    expect(s.voiceCallOpen).toBe(false);
    expect(s.pipExpanded).toBe(false);
    expect(s.summaryExpanded).toBe(false);
    expect(s.voiceState).toBe("idle");
    expect(s.messages).toEqual([]);
    expect(s.conversations).toEqual([]);
  });

  it("setActiveConv switches activeConvId and clears messages", () => {
    useHubStore.setState({
      messages: [
        { id: "m1", role: "user", content: "hi", source: "text", timestamp: 1 },
      ],
    });
    useHubStore.getState().setActiveConv(42);
    expect(useHubStore.getState().activeConvId).toBe(42);
    expect(useHubStore.getState().messages).toEqual([]);
  });

  it("appendMessage pushes to messages immutably", () => {
    useHubStore.getState().appendMessage({
      id: "m1",
      role: "user",
      content: "hi",
      source: "text",
      timestamp: 1,
    });
    expect(useHubStore.getState().messages).toHaveLength(1);
    expect(useHubStore.getState().messages[0].id).toBe("m1");
  });

  it("toggleDrawer flips drawerOpen", () => {
    // Initial = true → toggle = false → toggle = true
    useHubStore.getState().toggleDrawer();
    expect(useHubStore.getState().drawerOpen).toBe(false);
    useHubStore.getState().toggleDrawer();
    expect(useHubStore.getState().drawerOpen).toBe(true);
  });

  it("setVoiceState updates voiceState", () => {
    useHubStore.getState().setVoiceState("call_active");
    expect(useHubStore.getState().voiceState).toBe("call_active");
  });
});
