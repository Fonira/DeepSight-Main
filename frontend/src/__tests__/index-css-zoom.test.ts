/**
 * index-css-zoom.test.ts — Light regression test ensuring the global UI
 * scale-up is wired via `html { font-size: 18px; }` in index.css.
 *
 * The +12.5% zoom is purely declarative — a single CSS rule ahead of
 * @tailwind. If anyone removes or changes it, this test catches it before
 * anyone notices that the entire app shrunk back to 16px-based sizing.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Global UI zoom (index.css)", () => {
  const cssPath = resolve(__dirname, "..", "index.css");
  const css = readFileSync(cssPath, "utf-8");

  it("declares html font-size: 18px before @tailwind", () => {
    const tailwindIdx = css.indexOf("@tailwind base");
    expect(tailwindIdx).toBeGreaterThan(-1);
    const before = css.slice(0, tailwindIdx);
    // Must contain a rule like: html { font-size: 18px; }
    expect(before).toMatch(/html\s*\{[^}]*font-size:\s*18px;[^}]*\}/);
  });

  it("does not also override <body> font-size — keeps cascade clean", () => {
    // We want to scale via html only so the rem unit becomes 18px.
    // Setting body to a px size as well would re-anchor children.
    expect(css).not.toMatch(/body\s*\{[^}]*font-size:\s*\d+px[^}]*\}/);
  });
});
