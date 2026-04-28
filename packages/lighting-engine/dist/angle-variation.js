// Daily seeded ± 15° angle variation, smoothed across hours
import { mulberry32 } from "./seeded-random.js";
export const DAILY_VARIATION = {
    angleDegRange: 15,
};
export function computeAngleVariation(seed, hour) {
    const rng = mulberry32(seed);
    const anchors = [];
    for (let i = 0; i < 49; i++) {
        anchors.push(rng() * 2 - 1);
    }
    const slot = hour / 0.5;
    const i = Math.floor(slot);
    const t = slot - i;
    const a = anchors[i % 48];
    const b = anchors[(i + 1) % 48];
    const v = a + (b - a) * t;
    return v * DAILY_VARIATION.angleDegRange;
}
