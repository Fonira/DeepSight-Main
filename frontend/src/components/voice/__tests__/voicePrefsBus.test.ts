import { describe, it, expect, vi } from "vitest";
import {
  emitVoicePrefsEvent,
  subscribeVoicePrefsEvents,
  presetToPlaybackRate,
} from "../voicePrefsBus";

describe("voicePrefsBus", () => {
  it("delivers playback_rate_changed (legacy)", () => {
    const listener = vi.fn();
    const unsub = subscribeVoicePrefsEvents(listener);
    emitVoicePrefsEvent({ type: "playback_rate_changed", value: 1.25 });
    expect(listener).toHaveBeenCalledWith({
      type: "playback_rate_changed",
      value: 1.25,
    });
    unsub();
  });

  it("delivers apply_with_restart (new)", () => {
    const listener = vi.fn();
    const unsub = subscribeVoicePrefsEvents(listener);
    emitVoicePrefsEvent({ type: "apply_with_restart" });
    expect(listener).toHaveBeenCalledWith({ type: "apply_with_restart" });
    unsub();
  });

  it("delivers call_status_changed (new)", () => {
    const listener = vi.fn();
    const unsub = subscribeVoicePrefsEvents(listener);
    emitVoicePrefsEvent({ type: "call_status_changed", active: true });
    expect(listener).toHaveBeenCalledWith({
      type: "call_status_changed",
      active: true,
    });
    unsub();
  });

  it("unsubscribe stops delivery", () => {
    const listener = vi.fn();
    const unsub = subscribeVoicePrefsEvents(listener);
    unsub();
    emitVoicePrefsEvent({ type: "apply_with_restart" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("preserves presetToPlaybackRate behavior", () => {
    expect(presetToPlaybackRate("1x")).toBe(1);
    expect(presetToPlaybackRate("1.5x")).toBe(1.5);
    expect(presetToPlaybackRate("unknown")).toBe(1);
  });
});
