/**
 * Tests for useTabBarFootprint — TAB_BAR_HEIGHT + safe-area bottom + sp.md.
 */
import { renderHook } from "@testing-library/react-native";

const mockInsets = jest.fn();

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => mockInsets(),
}));

import { useTabBarFootprint } from "../../src/hooks/useTabBarFootprint";

describe("useTabBarFootprint", () => {
  beforeEach(() => {
    mockInsets.mockReset();
  });

  it("returns TAB_BAR_HEIGHT + insets.bottom + sp.md when bottom inset is large", () => {
    // 56 + 34 (iPhone home indicator) + 12 (sp.md) = 102
    mockInsets.mockReturnValue({ top: 0, bottom: 34, left: 0, right: 0 });
    const { result } = renderHook(() => useTabBarFootprint());
    expect(result.current).toBe(102);
  });

  it("uses sp.sm (8) as floor when device has no bottom safe area", () => {
    // 56 + max(0, 8) + 12 = 76
    mockInsets.mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0 });
    const { result } = renderHook(() => useTabBarFootprint());
    expect(result.current).toBe(76);
  });

  it("clamps small insets to sp.sm floor", () => {
    // 56 + max(2, 8) + 12 = 76
    mockInsets.mockReturnValue({ top: 0, bottom: 2, left: 0, right: 0 });
    const { result } = renderHook(() => useTabBarFootprint());
    expect(result.current).toBe(76);
  });
});
