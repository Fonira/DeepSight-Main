/**
 * vite-plugin-ambient-critical-css
 *
 * Inject critical CSS + sprite preload into the index.html <head>
 * BEFORE React hydrates, so the ambient lighting (beam + halo + base bg)
 * is already visible on first paint.
 *
 * Computes the preset at build time using the current Date(). For dev
 * (HMR) the preset will reflect the dev server start time, which is fine
 * for a critical-CSS first paint — the React layer takes over after
 * hydration and refreshes every 30s via AmbientLightingProvider.
 */

import type { Plugin } from "vite";
import { getAmbientPresetV3, rgbToCss } from "@deepsight/lighting-engine";

export function ambientCriticalCssPlugin(): Plugin {
  return {
    name: "vite-plugin-ambient-critical-css",
    transformIndexHtml(html: string) {
      const preset = getAmbientPresetV3(new Date());
      const beamColor = rgbToCss(preset.beam.color, preset.beam.opacity);
      const haloColor = rgbToCss(
        preset.colors.primary,
        preset.beam.opacity * 0.5,
      );
      const sprite =
        preset.nightMode === "glowing"
          ? "sunflower-night.webp"
          : "sunflower-day.webp";

      const inlineCss = `
:root {
  --ambient-beam-angle: ${preset.beam.angleDeg}deg;
  --ambient-beam-color: ${beamColor};
  --ambient-halo-color: ${haloColor};
  --ambient-halo-accent: ${preset.haloAccentColor || "transparent"};
  --ambient-intensity: ${preset.beam.opacity};
  --ambient-frame-index: ${preset.frameIndex};
}
html { background-color: #0a0a0f; }
body { background-color: #0a0a0f; }
.ambient-beam-initial {
  position: fixed; inset: 0; pointer-events: none; z-index: 1;
  background: linear-gradient(var(--ambient-beam-angle),
    transparent 45%, var(--ambient-beam-color) 50%, transparent 55%);
}
.ambient-halo-initial {
  position: fixed; top: -100px; left: -100px; width: 400px; height: 400px;
  background: radial-gradient(circle, var(--ambient-halo-color), transparent 60%);
  filter: blur(40px); mix-blend-mode: screen; z-index: 1; pointer-events: none;
}
.ambient-disabled .ambient-beam-initial,
.ambient-disabled .ambient-halo-initial { display: none; }
      `.trim();

      const injection = `
<style id="ambient-critical">${inlineCss}</style>
<link rel="preload" as="image" href="/assets/ambient/${sprite}">
      `.trim();

      return html.replace("</head>", `${injection}\n</head>`);
    },
  };
}
