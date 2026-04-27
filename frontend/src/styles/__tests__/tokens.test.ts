import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("design tokens v3", () => {
  const tokensPath = path.resolve(__dirname, "../../index.css");
  const content = fs.existsSync(tokensPath)
    ? fs.readFileSync(tokensPath, "utf-8")
    : "";

  it("text-secondary uses slate-100 (#f1f5f9)", () => {
    expect(content).toMatch(/--text-secondary:\s*#f1f5f9/i);
  });

  it("text-muted uses slate-200 (#e2e8f0)", () => {
    expect(content).toMatch(/--text-muted:\s*#e2e8f0/i);
  });

  it("text-disabled uses rgba opacity", () => {
    expect(content).toMatch(
      /--text-disabled:\s*rgba\(255,\s*255,\s*255,\s*0\.45\)/i,
    );
  });

  it("text-meta uses slate-300", () => {
    expect(content).toMatch(/--text-meta:\s*#cbd5e1/i);
  });
});
