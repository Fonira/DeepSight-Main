// extension/src/sidepanel/components/VoiceWaveform.tsx
//
// Waveform LIVE pendant un voice call. Affiche 32 barres animées dont la
// hauteur est dérivée des frequency data exposées par @elevenlabs/client
// 0.15+ (`getInputByteFrequencyData` / `getOutputByteFrequencyData`).
//
// Stratégie :
//   - Fusion input + output : on prend le max bar-par-bar entre micro user
//     (input) et voix agent (output) ⇒ une seule waveform reflétant qui
//     parle.
//   - Animation via requestAnimationFrame, throttle ~30 fps en mettant à
//     jour le state max 1/frame avec un `useReducer`-style ref pour éviter
//     les re-renders excessifs.
//   - Fallback : si la conversation n'expose pas getInputByteFrequencyData
//     (versions plus anciennes du SDK ou avant connect), on retombe sur 7
//     barres statiques cosmétiques (ancien comportement).
//   - Mute : quand isMuted=true, on diminue artificiellement les barres
//     "user" mais on garde celles "agent" (l'utilisateur entend toujours
//     l'agent même en muet).
//
// Performance : on garde la liste de bars en useRef et on fait un setState
// de l'array tous les frames (~16 ms). React reconcilie 32 spans, c'est
// négligeable. Pas d'animation CSS supplémentaire pour éviter les saccades.
import React, { useEffect, useRef, useState } from "react";

interface ConversationLike {
  getInputByteFrequencyData?: () => Uint8Array | null;
  getOutputByteFrequencyData?: () => Uint8Array | null;
}

interface Props {
  conversation: ConversationLike | null;
  isMuted?: boolean;
}

const BAR_COUNT = 32;
// Hauteurs initiales (cosmétiques) avant que les freq data n'arrivent.
const STATIC_HEIGHTS = [
  10, 18, 12, 22, 30, 24, 16, 28, 36, 30, 22, 18, 12, 20, 28, 34, 38, 34, 28,
  20, 14, 22, 30, 26, 18, 14, 22, 30, 24, 18, 12, 16,
];

function downsampleToBars(arr: Uint8Array | null, bars: number): number[] {
  if (!arr || arr.length === 0) return [];
  // arr a typiquement 1024 ou 2048 valeurs (FFT analyser). On bin-average
  // en `bars` buckets et on convertit en hauteur 0-100%.
  const out: number[] = [];
  const bucketSize = Math.floor(arr.length / bars);
  if (bucketSize < 1) {
    // Si arr.length < bars, on pad avec 0.
    for (let i = 0; i < bars; i += 1) {
      const v = arr[i] ?? 0;
      out.push(Math.min(100, Math.round((v / 255) * 100)));
    }
    return out;
  }
  for (let i = 0; i < bars; i += 1) {
    let sum = 0;
    const start = i * bucketSize;
    for (let j = 0; j < bucketSize; j += 1) {
      sum += arr[start + j] ?? 0;
    }
    const avg = sum / bucketSize;
    // 0-255 → 0-100, avec compression douce pour avoir des barres visibles
    // même à faible volume (sqrt curve).
    const norm = Math.sqrt(avg / 255);
    out.push(Math.max(4, Math.round(norm * 100)));
  }
  return out;
}

function combineBars(input: number[], output: number[]): number[] {
  const len = Math.max(input.length, output.length);
  const out: number[] = [];
  for (let i = 0; i < len; i += 1) {
    out.push(Math.max(input[i] ?? 0, output[i] ?? 0));
  }
  return out;
}

export function VoiceWaveform({
  conversation,
  isMuted = false,
}: Props): JSX.Element {
  const [bars, setBars] = useState<number[]>(STATIC_HEIGHTS);
  const rafIdRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);

  useEffect(() => {
    if (!conversation) {
      // Pas de conversation → on garde les bars statiques.
      setBars(STATIC_HEIGHTS);
      return;
    }
    const hasInputApi =
      typeof conversation.getInputByteFrequencyData === "function";
    const hasOutputApi =
      typeof conversation.getOutputByteFrequencyData === "function";

    if (!hasInputApi && !hasOutputApi) {
      // SDK trop ancien — fallback sur animation breathing pseudo-aléatoire
      // pour avoir au moins un signe de vie visuel.
      const start = performance.now();
      const tick = (ts: number): void => {
        const t = (ts - start) / 1000;
        const next: number[] = [];
        for (let i = 0; i < BAR_COUNT; i += 1) {
          // Combinaison de 2 sinus + bruit pseudo-déterministe sur i.
          const phase = (i / BAR_COUNT) * Math.PI * 2;
          const v =
            40 +
            25 * Math.sin(t * 2 + phase) +
            15 * Math.sin(t * 4.7 + phase * 0.8);
          next.push(Math.max(8, Math.min(100, Math.round(v))));
        }
        setBars(next);
        rafIdRef.current = requestAnimationFrame(tick);
      };
      rafIdRef.current = requestAnimationFrame(tick);
      return () => {
        if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      };
    }

    // Mode LIVE : sample input + output toutes les ~33ms (30 fps).
    const tick = (ts: number): void => {
      // Throttle 30fps pour économiser CPU sur sidepanel.
      if (ts - lastFrameRef.current < 33) {
        rafIdRef.current = requestAnimationFrame(tick);
        return;
      }
      lastFrameRef.current = ts;

      const inputData = hasInputApi
        ? (conversation.getInputByteFrequencyData?.() ?? null)
        : null;
      const outputData = hasOutputApi
        ? (conversation.getOutputByteFrequencyData?.() ?? null)
        : null;

      const inputBars = downsampleToBars(inputData, BAR_COUNT);
      const outputBars = downsampleToBars(outputData, BAR_COUNT);

      // Si muté, on neutralise input (mais on garde output = voix agent).
      const finalInputBars = isMuted ? inputBars.map(() => 0) : inputBars;
      const combined =
        finalInputBars.length || outputBars.length
          ? combineBars(finalInputBars, outputBars)
          : STATIC_HEIGHTS;
      setBars(combined);
      rafIdRef.current = requestAnimationFrame(tick);
    };
    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    };
  }, [conversation, isMuted]);

  return (
    <div
      className={`ds-call-active__waveform${isMuted ? " is-muted" : ""}`}
      aria-hidden
      data-testid="voice-waveform"
    >
      {bars.map((h, i) => (
        <span
          key={i}
          className="ds-call-active__waveform-bar"
          style={{ height: `${Math.max(4, h)}%` }}
        />
      ))}
    </div>
  );
}
