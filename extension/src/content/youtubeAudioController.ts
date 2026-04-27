// extension/src/content/youtubeAudioController.ts
//
// Audio ducking controller — baisse le volume du <video> YouTube à 10%
// pendant un voice call DeepSight, et restaure le volume original au
// raccrochage. Idempotent : un double `attach()` ne perd pas le volume
// initial (on ne réécrit `originalVolume` que si null).
//
// Branché par `content/index.ts` via `chrome.runtime.onMessage` :
//   - `{ type: "DUCK_AUDIO" }`    → attach
//   - `{ type: "RESTORE_AUDIO" }` → detach

export class YouTubeAudioController {
  private originalVolume: number | null = null;
  private videoElement: HTMLVideoElement | null = null;

  attach(): void {
    const video = document.querySelector("video") as HTMLVideoElement | null;
    if (!video) return;
    this.videoElement = video;
    if (this.originalVolume === null) {
      this.originalVolume = video.volume;
    }
    video.volume = 0.1;
  }

  detach(): void {
    if (this.videoElement && this.originalVolume !== null) {
      this.videoElement.volume = this.originalVolume;
    }
    this.videoElement = null;
    this.originalVolume = null;
  }
}
