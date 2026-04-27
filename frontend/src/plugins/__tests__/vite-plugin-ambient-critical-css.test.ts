import { describe, expect, it } from "vitest";
import { ambientCriticalCssPlugin } from "../vite-plugin-ambient-critical-css";

describe("ambientCriticalCssPlugin", () => {
  it("returns a Vite plugin object", () => {
    const plugin = ambientCriticalCssPlugin();
    expect(plugin.name).toBe("vite-plugin-ambient-critical-css");
    expect(plugin.transformIndexHtml).toBeDefined();
  });

  it('injects <style id="ambient-critical"> in <head>', () => {
    const plugin = ambientCriticalCssPlugin();
    const html = `<html><head></head><body></body></html>`;
    const transform = plugin.transformIndexHtml as (
      html: string,
    ) => string | undefined;
    const result = transform(html) ?? "";
    expect(result).toContain('<style id="ambient-critical">');
    expect(result).toContain("--ambient-beam-angle");
    expect(result).toContain("background-color: #0a0a0f");
  });

  it('injects <link rel="preload" as="image"> for sprite', () => {
    const plugin = ambientCriticalCssPlugin();
    const html = `<html><head></head><body></body></html>`;
    const transform = plugin.transformIndexHtml as (
      html: string,
    ) => string | undefined;
    const result = transform(html) ?? "";
    expect(result).toMatch(
      /<link rel="preload" as="image" href="\/assets\/ambient\/sunflower-(day|night)\.webp"/,
    );
  });
});
