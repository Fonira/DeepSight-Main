/**
 * Sunflower SVG builder — full sunflower with stem + leaves + heliotropic head.
 *
 * Layout (viewBox 200×280) :
 *   - Stem : courbure en bezier Q de la base (100, 270) au sommet de la tige.
 *            Le sommet dérive horizontalement selon l'angle de la tête,
 *            comme une vraie tige qui penche vers le soleil.
 *   - 2 feuilles vertes (gauche bas, droite mi-tige), style logo officiel.
 *   - Tête (pétales + cœur + graines) : groupe pivoté autour du sommet
 *            de la tige (head pivot). L'angle est passé en paramètre.
 *
 * Pure data, no DOM dependency : works in browser, Preact (extension), Node.
 */

import {
  SUNFLOWER_PALETTES,
  SUNFLOWER_PETAL_SCALE,
  type SunflowerPhase,
} from "./sunflower-phase.js";

const PETAL_COUNT_OUTER = 13;
const PETAL_COUNT_INNER = 13;

// ── ViewBox geometry ─────────────────────────────────────────────────────
const VIEWBOX_W = 200;
const VIEWBOX_H = 280;
const HEAD_CENTER_X = 100; // x du centre de la tête (avant rotation)
const HEAD_CENTER_Y = 100; // y du centre de la tête
const STEM_BASE_X = 100;
const STEM_BASE_Y = 270;
const STEM_TIP_DEFAULT_X = 100;
const STEM_TIP_Y = 130; // jonction tige/tête : la tête pivote autour de (tipX, STEM_TIP_Y)

const INNER_R = 32;
const PETAL_LEN = 40;
const STEM_GREEN = "#5A8F1E";
const LEAF_GREEN = "#8FBF2A";
const LEAF_GREEN_DARK = "#6FA01F";

const TRANSITION = "transform 1.5s cubic-bezier(0.4,0,0.2,1)";

interface BuildOptions {
  /** Pixel width of the rendered SVG. Height is auto via viewBox aspect ratio. */
  size?: number;
  /** Daily phase — drives palette + petal scale. */
  phase: SunflowerPhase;
  /** Heliotropic head rotation in degrees (0 = vertical, ±85 = max lean). */
  rotation?: number;
}

/**
 * Build a full inline SVG string for the sunflower (stem + head pivoting).
 * Web platforms (frontend + extension) inject this via dangerouslySetInnerHTML.
 */
export function buildSunflowerSVG({
  size = 90,
  phase,
  rotation = 0,
}: BuildOptions): string {
  const c = SUNFLOWER_PALETTES[phase];
  const petalScale = SUNFLOWER_PETAL_SCALE[phase];

  // Tip de la tige dérive horizontalement selon la rotation (sin → ±)
  // À ±85° → ±18px de dérive, à 0° → 0
  const sinRot = Math.sin((rotation * Math.PI) / 180);
  const stemTipX = STEM_TIP_DEFAULT_X + sinRot * 18;
  // Point de contrôle Q : milieu de la tige avec déviation amplifiée → courbure naturelle
  const stemMidX = STEM_TIP_DEFAULT_X + sinRot * 28;
  const stemMidY = (STEM_BASE_Y + STEM_TIP_Y) / 2;

  // ── Tige (path Q quadratic bezier) ─────────────────────────────────────
  const stem =
    `<path d="M ${STEM_BASE_X} ${STEM_BASE_Y} ` +
    `Q ${stemMidX.toFixed(2)} ${stemMidY} ` +
    `${stemTipX.toFixed(2)} ${STEM_TIP_Y}" ` +
    `stroke="${STEM_GREEN}" stroke-width="9" stroke-linecap="round" ` +
    `fill="none"/>`;

  // ── 2 feuilles vertes style logo officiel (à gauche et à droite de la tige) ─
  // Feuille gauche (bas tige, pointe vers gauche)
  const leafLeftX = STEM_BASE_X - 4 + sinRot * 4;
  const leafLeftY = 230;
  const leafLeft =
    `<path d="M ${leafLeftX} ${leafLeftY} ` +
    `C ${leafLeftX - 38} ${leafLeftY - 8}, ` +
    `${leafLeftX - 42} ${leafLeftY + 12}, ` +
    `${leafLeftX - 8} ${leafLeftY + 14} ` +
    `C ${leafLeftX - 18} ${leafLeftY + 6}, ` +
    `${leafLeftX - 22} ${leafLeftY - 2}, ` +
    `${leafLeftX} ${leafLeftY} Z" ` +
    `fill="${LEAF_GREEN}" stroke="${c.stroke}" stroke-width="2.5" ` +
    `stroke-linejoin="round"/>`;

  // Feuille droite (mi-tige, pointe vers droite)
  const leafRightX = STEM_BASE_X + 4 + sinRot * 8;
  const leafRightY = 195;
  const leafRight =
    `<path d="M ${leafRightX} ${leafRightY} ` +
    `C ${leafRightX + 36} ${leafRightY - 12}, ` +
    `${leafRightX + 42} ${leafRightY + 6}, ` +
    `${leafRightX + 8} ${leafRightY + 14} ` +
    `C ${leafRightX + 20} ${leafRightY + 4}, ` +
    `${leafRightX + 24} ${leafRightY - 4}, ` +
    `${leafRightX} ${leafRightY} Z" ` +
    `fill="${LEAF_GREEN_DARK}" stroke="${c.stroke}" stroke-width="2.5" ` +
    `stroke-linejoin="round"/>`;

  // ── Tête (pétales + cœur + graines) ────────────────────────────────────
  // Décalage : le centre de la tête (HEAD_CENTER) est dessiné autour de
  // (HEAD_CENTER_X, HEAD_CENTER_Y), mais on translate le groupe vers
  // (stemTipX, STEM_TIP_Y) pour aligner la base de la tête au sommet de
  // la tige. Puis on pivote autour de ce point d'attache.
  const headTranslateX = stemTipX - HEAD_CENTER_X;
  const headTranslateY = STEM_TIP_Y - HEAD_CENTER_Y - INNER_R + 4; // -INNER_R + 4 = base du cœur sur le sommet de la tige

  const outerPetals: string[] = [];
  for (let i = 0; i < PETAL_COUNT_OUTER; i++) {
    const angle = (i * 360) / PETAL_COUNT_OUTER;
    outerPetals.push(
      `<g transform="rotate(${angle} ${HEAD_CENTER_X} ${HEAD_CENTER_Y})">` +
        `<path d="M ${HEAD_CENTER_X} ${HEAD_CENTER_Y - INNER_R} ` +
        `C ${HEAD_CENTER_X - 13} ${HEAD_CENTER_Y - INNER_R - 8}, ` +
        `${HEAD_CENTER_X - 13} ${HEAD_CENTER_Y - INNER_R - PETAL_LEN + 6}, ` +
        `${HEAD_CENTER_X} ${HEAD_CENTER_Y - INNER_R - PETAL_LEN} ` +
        `C ${HEAD_CENTER_X + 13} ${HEAD_CENTER_Y - INNER_R - PETAL_LEN + 6}, ` +
        `${HEAD_CENTER_X + 13} ${HEAD_CENTER_Y - INNER_R - 8}, ` +
        `${HEAD_CENTER_X} ${HEAD_CENTER_Y - INNER_R} Z" ` +
        `fill="${c.petalOuter}" stroke="${c.stroke}" stroke-width="3" stroke-linejoin="round"/>` +
        `</g>`,
    );
  }

  const innerPetals: string[] = [];
  const innerOffset = 360 / PETAL_COUNT_INNER / 2;
  const innerLen = PETAL_LEN - 8;
  for (let i = 0; i < PETAL_COUNT_INNER; i++) {
    const angle = (i * 360) / PETAL_COUNT_INNER + innerOffset;
    innerPetals.push(
      `<g transform="rotate(${angle} ${HEAD_CENTER_X} ${HEAD_CENTER_Y})">` +
        `<path d="M ${HEAD_CENTER_X} ${HEAD_CENTER_Y - INNER_R + 2} ` +
        `C ${HEAD_CENTER_X - 9} ${HEAD_CENTER_Y - INNER_R - 4}, ` +
        `${HEAD_CENTER_X - 9} ${HEAD_CENTER_Y - INNER_R - innerLen + 4}, ` +
        `${HEAD_CENTER_X} ${HEAD_CENTER_Y - INNER_R - innerLen} ` +
        `C ${HEAD_CENTER_X + 9} ${HEAD_CENTER_Y - INNER_R - innerLen + 4}, ` +
        `${HEAD_CENTER_X + 9} ${HEAD_CENTER_Y - INNER_R - 4}, ` +
        `${HEAD_CENTER_X} ${HEAD_CENTER_Y - INNER_R + 2} Z" ` +
        `fill="${c.petalInner}" stroke="${c.stroke}" stroke-width="2.5" stroke-linejoin="round" opacity="0.92"/>` +
        `</g>`,
    );
  }

  const seeds: string[] = [
    `<circle cx="${HEAD_CENTER_X}" cy="${HEAD_CENTER_Y}" r="3" fill="${c.seed}"/>`,
  ];
  for (let i = 0; i < 6; i++) {
    const a = (i * 60 * Math.PI) / 180;
    const x = HEAD_CENTER_X + Math.cos(a) * 11;
    const y = HEAD_CENTER_Y + Math.sin(a) * 11;
    seeds.push(
      `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3" fill="${c.seed}"/>`,
    );
  }
  for (let i = 0; i < 6; i++) {
    const a = ((i * 60 + 30) * Math.PI) / 180;
    const x = HEAD_CENTER_X + Math.cos(a) * 21;
    const y = HEAD_CENTER_Y + Math.sin(a) * 21;
    seeds.push(
      `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3" fill="${c.seed}"/>`,
    );
  }

  const headInner =
    `<g style="transform-origin:${HEAD_CENTER_X}px ${HEAD_CENTER_Y}px;` +
    `transform:scale(${petalScale});transition:${TRANSITION}">` +
    innerPetals.join("") +
    outerPetals.join("") +
    `</g>` +
    `<circle cx="${HEAD_CENTER_X}" cy="${HEAD_CENTER_Y}" r="${INNER_R}" ` +
    `fill="${c.core}" stroke="${c.stroke}" stroke-width="3"/>` +
    `<circle cx="${HEAD_CENTER_X}" cy="${HEAD_CENTER_Y}" r="${INNER_R - 4}" ` +
    `fill="${c.coreShadow}" opacity="0.6"/>` +
    seeds.join("");

  // Pivot de la tête : autour de la base de la tête (point d'attache à la tige)
  // qui est (HEAD_CENTER_X, HEAD_CENTER_Y + INNER_R) avant translation.
  const pivotX = HEAD_CENTER_X;
  const pivotY = HEAD_CENTER_Y + INNER_R;

  const head =
    `<g transform="translate(${headTranslateX.toFixed(2)} ${headTranslateY.toFixed(2)})">` +
    `<g transform="rotate(${rotation.toFixed(2)} ${pivotX} ${pivotY})" ` +
    `style="transition:${TRANSITION}">` +
    headInner +
    `</g>` +
    `</g>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX_W} ${VIEWBOX_H}" ` +
    `width="${size}" height="${(size * VIEWBOX_H) / VIEWBOX_W}" aria-hidden="true" style="display:block">` +
    stem +
    leafLeft +
    leafRight +
    head +
    `</svg>`
  );
}

/** Geometric constants exposed for native renderers (mobile react-native-svg). */
export const SUNFLOWER_GEOMETRY = {
  viewBoxW: VIEWBOX_W,
  viewBoxH: VIEWBOX_H,
  headCenterX: HEAD_CENTER_X,
  headCenterY: HEAD_CENTER_Y,
  stemBaseX: STEM_BASE_X,
  stemBaseY: STEM_BASE_Y,
  stemTipDefaultX: STEM_TIP_DEFAULT_X,
  stemTipY: STEM_TIP_Y,
  innerR: INNER_R,
  petalLen: PETAL_LEN,
  petalCountOuter: PETAL_COUNT_OUTER,
  petalCountInner: PETAL_COUNT_INNER,
  stemGreen: STEM_GREEN,
  leafGreen: LEAF_GREEN,
  leafGreenDark: LEAF_GREEN_DARK,
  // Backward compat aliases (some files imported `viewBox` and `center`)
  viewBox: VIEWBOX_W,
  center: HEAD_CENTER_X,
} as const;
