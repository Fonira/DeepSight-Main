/**
 * Tests for the `haptics` helper wrapper.
 * Verifies each method maps to the expected expo-haptics call.
 */
import * as Haptics from "expo-haptics";
import { haptics } from "../../src/utils/haptics";

describe("haptics helper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("selection() calls Haptics.selectionAsync", async () => {
    await haptics.selection();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it("light() calls impactAsync with Light style", async () => {
    await haptics.light();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Light,
    );
  });

  it("medium() calls impactAsync with Medium style", async () => {
    await haptics.medium();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Medium,
    );
  });

  it("heavy() calls impactAsync with Heavy style", async () => {
    await haptics.heavy();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Heavy,
    );
  });

  it("success() calls notificationAsync with Success type", async () => {
    await haptics.success();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Success,
    );
  });

  it("warning() calls notificationAsync with Warning type", async () => {
    await haptics.warning();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Warning,
    );
  });

  it("error() calls notificationAsync with Error type", async () => {
    await haptics.error();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(
      Haptics.NotificationFeedbackType.Error,
    );
  });

  it("swallows errors thrown by expo-haptics", async () => {
    (Haptics.impactAsync as jest.Mock).mockRejectedValueOnce(
      new Error("no haptic engine"),
    );
    await expect(haptics.medium()).resolves.toBeUndefined();
  });
});
