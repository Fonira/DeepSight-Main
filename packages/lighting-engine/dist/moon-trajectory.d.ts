export interface MoonState {
  visible: boolean;
  opacity: number;
  x: number;
  y: number;
}
export declare function getMoonState(hour: number): MoonState;
