/**
 * Sunflower SVG builder — emits a full <svg>...</svg> string faithful to the
 * official Tournesol logo (13 outer + 13 inner petals, brown core, 13 black
 * seeds in a triangular rosette). Pure data, no DOM dependency, so it works
 * in browser, Preact (extension), and Node tests.
 */
import { SUNFLOWER_PALETTES, SUNFLOWER_PETAL_SCALE, } from "./sunflower-phase.js";
const PETAL_COUNT_OUTER = 13;
const PETAL_COUNT_INNER = 13;
const VIEWBOX = 200;
const CENTER = 100;
const INNER_R = 32;
const PETAL_LEN = 40;
const TRANSITION = "transform 1.5s cubic-bezier(0.4,0,0.2,1)";
/**
 * Build a full inline SVG string for the sunflower in the given phase.
 * Web platforms (frontend + extension) inject this via dangerouslySetInnerHTML.
 */
export function buildSunflowerSVG({ size = 90, phase }) {
    const c = SUNFLOWER_PALETTES[phase];
    const petalScale = SUNFLOWER_PETAL_SCALE[phase];
    const outerPetals = [];
    for (let i = 0; i < PETAL_COUNT_OUTER; i++) {
        const angle = (i * 360) / PETAL_COUNT_OUTER;
        outerPetals.push(`<g transform="rotate(${angle} ${CENTER} ${CENTER})">` +
            `<path d="M ${CENTER} ${CENTER - INNER_R} ` +
            `C ${CENTER - 13} ${CENTER - INNER_R - 8}, ` +
            `${CENTER - 13} ${CENTER - INNER_R - PETAL_LEN + 6}, ` +
            `${CENTER} ${CENTER - INNER_R - PETAL_LEN} ` +
            `C ${CENTER + 13} ${CENTER - INNER_R - PETAL_LEN + 6}, ` +
            `${CENTER + 13} ${CENTER - INNER_R - 8}, ` +
            `${CENTER} ${CENTER - INNER_R} Z" ` +
            `fill="${c.petalOuter}" stroke="${c.stroke}" stroke-width="3" stroke-linejoin="round"/>` +
            `</g>`);
    }
    const innerPetals = [];
    const innerOffset = 360 / PETAL_COUNT_INNER / 2;
    const innerLen = PETAL_LEN - 8;
    for (let i = 0; i < PETAL_COUNT_INNER; i++) {
        const angle = (i * 360) / PETAL_COUNT_INNER + innerOffset;
        innerPetals.push(`<g transform="rotate(${angle} ${CENTER} ${CENTER})">` +
            `<path d="M ${CENTER} ${CENTER - INNER_R + 2} ` +
            `C ${CENTER - 9} ${CENTER - INNER_R - 4}, ` +
            `${CENTER - 9} ${CENTER - INNER_R - innerLen + 4}, ` +
            `${CENTER} ${CENTER - INNER_R - innerLen} ` +
            `C ${CENTER + 9} ${CENTER - INNER_R - innerLen + 4}, ` +
            `${CENTER + 9} ${CENTER - INNER_R - 4}, ` +
            `${CENTER} ${CENTER - INNER_R + 2} Z" ` +
            `fill="${c.petalInner}" stroke="${c.stroke}" stroke-width="2.5" stroke-linejoin="round" opacity="0.92"/>` +
            `</g>`);
    }
    const seeds = [
        `<circle cx="${CENTER}" cy="${CENTER}" r="3" fill="${c.seed}"/>`,
    ];
    for (let i = 0; i < 6; i++) {
        const a = (i * 60 * Math.PI) / 180;
        const x = CENTER + Math.cos(a) * 11;
        const y = CENTER + Math.sin(a) * 11;
        seeds.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3" fill="${c.seed}"/>`);
    }
    for (let i = 0; i < 6; i++) {
        const a = ((i * 60 + 30) * Math.PI) / 180;
        const x = CENTER + Math.cos(a) * 21;
        const y = CENTER + Math.sin(a) * 21;
        seeds.push(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3" fill="${c.seed}"/>`);
    }
    return (`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" ` +
        `width="${size}" height="${size}" aria-hidden="true" style="display:block">` +
        `<g style="transform-origin:${CENTER}px ${CENTER}px;transform:scale(${petalScale});transition:${TRANSITION}">` +
        innerPetals.join("") +
        outerPetals.join("") +
        `</g>` +
        `<circle cx="${CENTER}" cy="${CENTER}" r="${INNER_R}" fill="${c.core}" stroke="${c.stroke}" stroke-width="3"/>` +
        `<circle cx="${CENTER}" cy="${CENTER}" r="${INNER_R - 4}" fill="${c.coreShadow}" opacity="0.6"/>` +
        seeds.join("") +
        `</svg>`);
}
/** Geometric constants exposed for native renderers (mobile react-native-svg). */
export const SUNFLOWER_GEOMETRY = {
    viewBox: VIEWBOX,
    center: CENTER,
    innerR: INNER_R,
    petalLen: PETAL_LEN,
    petalCountOuter: PETAL_COUNT_OUTER,
    petalCountInner: PETAL_COUNT_INNER,
};
