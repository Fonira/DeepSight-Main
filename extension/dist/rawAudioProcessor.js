const BIAS = 132,
  CLIP = 32635,
  encodeTable = [
    0, 0, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4,
    4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
    5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
    6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
    6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
    6, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7,
  ];
function encodeSample(e) {
  let t, s, r, a;
  return (
    (t = (e >> 8) & 128),
    0 !== t && (e = -e),
    (e += 132) > CLIP && (e = CLIP),
    (s = encodeTable[(e >> 7) & 255]),
    (r = (e >> (s + 3)) & 15),
    (a = ~(t | (s << 4) | r)),
    a
  );
}
class RawAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    (super(),
      (this.port.onmessage = ({ data: e }) => {
        switch (e.type) {
          case "setFormat":
            ((this.isMuted = !1),
              (this.buffer = []),
              (this.bufferSize = e.sampleRate / 10),
              (this.format = e.format),
              globalThis.LibSampleRate &&
                sampleRate !== e.sampleRate &&
                globalThis.LibSampleRate.create(
                  1,
                  sampleRate,
                  e.sampleRate,
                ).then((e) => {
                  this.resampler = e;
                }));
            break;
          case "setMuted":
            this.isMuted = e.isMuted;
        }
      }));
  }
  process(e) {
    if (!this.buffer) return !0;
    const t = e[0];
    if (t.length > 0) {
      let e = t[0];
      (this.resampler && (e = this.resampler.full(e)), this.buffer.push(...e));
      let s = 0;
      for (let t = 0; t < e.length; t++) s += e[t] * e[t];
      const r = Math.sqrt(s / e.length);
      if (this.buffer.length >= this.bufferSize) {
        const e = this.isMuted
          ? new Float32Array(this.buffer.length)
          : new Float32Array(this.buffer);
        let t =
          "ulaw" === this.format
            ? new Uint8Array(e.length)
            : new Int16Array(e.length);
        for (let s = 0; s < e.length; s++) {
          let r = Math.max(-1, Math.min(1, e[s])),
            a = r < 0 ? 32768 * r : 32767 * r;
          ("ulaw" === this.format && (a = encodeSample(Math.round(a))),
            (t[s] = a));
        }
        (this.port.postMessage([t, r]), (this.buffer = []));
      }
    }
    return !0;
  }
}
registerProcessor("rawAudioProcessor", RawAudioProcessor);
