export interface SunState {
  visible: boolean;
  opacity: number;
  x: number;
  y: number;
}
/**
 * Get sun state at a given hour [0, 24).
 * Rises in the East (right, 75%) around 5h30, sets in the West (left, 18%) around 19h.
 * Peaks at noon (50%, top 18%).
 */
export declare function getSunState(hour: number): SunState;
