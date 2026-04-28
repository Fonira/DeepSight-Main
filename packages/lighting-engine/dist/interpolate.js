// Generic interpolation utilities
export function clamp(t, min = 0, max = 1) {
    return Math.max(min, Math.min(max, t));
}
export function lerp(a, b, t) {
    const tt = clamp(t);
    return a + (b - a) * tt;
}
export function lerpColor(a, b, t) {
    const tt = clamp(t);
    return [
        Math.round(a[0] + (b[0] - a[0]) * tt),
        Math.round(a[1] + (b[1] - a[1]) * tt),
        Math.round(a[2] + (b[2] - a[2]) * tt),
    ];
}
export function lerpAngle(a, b, t) {
    const tt = clamp(t);
    const diff = ((((b - a) % 360) + 540) % 360) - 180;
    return (a + diff * tt + 360) % 360;
}
export function rgbToCss(rgb, alpha = 1) {
    const a = clamp(alpha);
    return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a.toFixed(3)})`;
}
export function rgbToHex(rgb) {
    return ("#" +
        rgb
            .map((v) => Math.max(0, Math.min(255, Math.round(v)))
            .toString(16)
            .padStart(2, "0"))
            .join(""));
}
