import { colors } from "../colors";

describe("text colors v3", () => {
  it("text.primary is pure white", () => {
    expect(colors.text.primary).toBe("#ffffff");
  });

  it("text.secondary is slate-100", () => {
    expect(colors.text.secondary).toBe("#f1f5f9");
  });

  it("text.muted is slate-200", () => {
    expect(colors.text.muted).toBe("#e2e8f0");
  });

  it("text.disabled uses rgba opacity", () => {
    expect(colors.text.disabled).toBe("rgba(255,255,255,0.45)");
  });

  it("text.meta is slate-300", () => {
    expect(colors.text.meta).toBe("#cbd5e1");
  });
});
