/** @jest-environment jsdom */
//
// Tests — `YouTubeAudioController` (extension/src/content/youtubeAudioController.ts)
//
// Pendant un voice call DeepSight, on baisse le volume de la vidéo YouTube
// à 10% (audio ducking) pour ne pas masquer la voix de l'agent.
// Au raccrochage on remet le volume original.
import { YouTubeAudioController } from "../../src/content/youtubeAudioController";

describe("YouTubeAudioController", () => {
  let video: HTMLVideoElement;

  beforeEach(() => {
    document.body.innerHTML = "<video></video>";
    video = document.querySelector("video") as HTMLVideoElement;
    video.volume = 0.8;
  });

  it("attach reduces volume to 10%", () => {
    const c = new YouTubeAudioController();
    c.attach();
    expect(video.volume).toBeCloseTo(0.1);
  });

  it("detach restores original volume", () => {
    const c = new YouTubeAudioController();
    c.attach();
    c.detach();
    expect(video.volume).toBeCloseTo(0.8);
  });

  it("attach is no-op when no <video> element", () => {
    document.body.innerHTML = "";
    const c = new YouTubeAudioController();
    expect(() => c.attach()).not.toThrow();
  });

  it("detach without attach is no-op", () => {
    const c = new YouTubeAudioController();
    expect(() => c.detach()).not.toThrow();
  });

  it("double attach does not lose original volume", () => {
    const c = new YouTubeAudioController();
    c.attach();
    c.attach(); // already at 0.1 — should NOT overwrite originalVolume to 0.1
    c.detach();
    expect(video.volume).toBeCloseTo(0.8);
  });
});
