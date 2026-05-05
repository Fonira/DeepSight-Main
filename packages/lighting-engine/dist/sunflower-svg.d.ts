/**
 * Sunflower SVG builder — emits a full <svg>...</svg> string faithful to the
 * official Tournesol logo (13 outer + 13 inner petals, brown core, 13 black
 * seeds in a triangular rosette). Pure data, no DOM dependency, so it works
 * in browser, Preact (extension), and Node tests.
 */
import { type SunflowerPhase } from "./sunflower-phase.js";
interface BuildOptions {
  /** Pixel width/height of the rendered SVG. Default 90. */
  size?: number;
  /** Daily phase — drives palette + petal scale. */
  phase: SunflowerPhase;
}
/**
 * Build a full inline SVG string for the sunflower in the given phase.
 * Web platforms (frontend + extension) inject this via dangerouslySetInnerHTML.
 */
export declare function buildSunflowerSVG({
  size,
  phase,
}: BuildOptions): string;
/** Geometric constants exposed for native renderers (mobile react-native-svg). */
export declare const SUNFLOWER_GEOMETRY: {
  readonly viewBox: 200;
  readonly center: 100;
  readonly innerR: 32;
  readonly petalLen: 40;
  readonly petalCountOuter: 13;
  readonly petalCountInner: 13;
};
export {};
