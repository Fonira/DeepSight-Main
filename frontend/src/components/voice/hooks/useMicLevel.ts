/**
 * useMicLevel — Extract real-time microphone audio level from a MediaStream.
 *
 * Uses Web Audio API (AudioContext + AnalyserNode) to compute RMS amplitude
 * of the input stream. Returns a normalized [0, 1] value updated at ~20 Hz
 * (throttled to avoid excessive re-renders). Automatically cleans up the
 * AudioContext when the stream changes or the component unmounts.
 *
 * Pass `active=false` to pause analysis (e.g., when PTT is released) — the
 * AnalyserNode stays wired but we skip the RAF loop to save CPU.
 */

import { useEffect, useState, useRef, type RefObject } from "react";

const UPDATE_INTERVAL_MS = 50; // 20 Hz update rate
const FFT_SIZE = 256; // 128 time-domain samples

export function useMicLevel(
  streamRef: RefObject<MediaStream | null>,
  active: boolean,
): number {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    const stream = streamRef.current;
    if (!active || !stream) {
      setLevel(0);
      return;
    }

    // Setup AudioContext lazily on first active call
    let audioCtx: AudioContext;
    try {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      audioCtx = new AudioCtxClass();
      audioCtxRef.current = audioCtx;
    } catch {
      return;
    }

    let source: MediaStreamAudioSourceNode;
    try {
      source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
    } catch {
      audioCtx.close().catch(() => {});
      audioCtxRef.current = null;
      return;
    }

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.6;
    analyserRef.current = analyser;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.fftSize);
    dataArrayRef.current = dataArray;

    const tick = (timestamp: number) => {
      if (timestamp - lastUpdateRef.current < UPDATE_INTERVAL_MS) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      lastUpdateRef.current = timestamp;

      const arr = dataArrayRef.current;
      const ana = analyserRef.current;
      if (arr && ana) {
        // Cast to any: TS lib.dom disagrees across versions on
        // Uint8Array<ArrayBuffer> vs Uint8Array<ArrayBufferLike>.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ana.getByteTimeDomainData(arr as any);
        // RMS — silence is 128 (mid-point of uint8), so subtract and normalize
        let sumSquares = 0;
        for (let i = 0; i < arr.length; i++) {
          const normalized = (arr[i] - 128) / 128; // [-1, 1]
          sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / arr.length);
        // Scale RMS for speech range — typical speech peaks ~0.2, amplify
        const scaled = Math.min(1, rms * 3);
        setLevel(scaled);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      try {
        source.disconnect();
      } catch {
        /* already disconnected */
      }
      try {
        analyser.disconnect();
      } catch {
        /* already disconnected */
      }
      audioCtx.close().catch(() => {});
      audioCtxRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
      dataArrayRef.current = null;
      setLevel(0);
    };
  }, [active, streamRef]);

  return level;
}
