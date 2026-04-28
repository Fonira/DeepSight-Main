/**
 * Compute the sunflower sprite frame index (0..23) for a given Date.
 * Each hour maps to one frame. Within a slot, the index is constant
 * (e.g. 12:00..12:59:59 → 12). At HH:00 sharp, snaps to the next hour.
 */
export declare function getSpriteFrameIndex(date: Date): number;
