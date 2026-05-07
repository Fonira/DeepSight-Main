// extension/e2e/voice-leak-utils/load-streaming-prompts.ts
//
// Loader that reads the canonical ``EXPLORER_STREAMING_PROMPT_FR`` and
// ``EXPLORER_STREAMING_PROMPT_EN`` literals from
// ``backend/src/voice/streaming_prompts.py`` so the live variant of the
// leak-detection spec exercises the EXACT prompt that ships in production.
//
// We intentionally parse the Python source rather than maintaining a TS
// mirror — keeping a TS copy would silently rot the moment the prompt is
// edited. By reading the SSOT we make the test fail loud if the file is
// renamed or the constants restructured.
//
// Parsing strategy : the Python file uses simple triple-quoted string
// literals declared as ``EXPLORER_STREAMING_PROMPT_FR = """..."""``. A
// regex with ``[\s\S]*?`` is enough — there are no escaped triple quotes
// in the source today, and the test fails loudly via the post-extract
// sanity checks if the structure ever changes.

import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const PROMPT_PY = path.join(
  REPO_ROOT,
  "backend",
  "src",
  "voice",
  "streaming_prompts.py",
);

export interface StreamingPrompts {
  fr: string;
  en: string;
}

let cached: StreamingPrompts | null = null;

function extract(name: string, source: string): string {
  // Match ``NAME = """\<body>\n"""`` (the leading backslash continuation
  // is optional) — non-greedy body capture stops at the next ``"""``.
  const pattern = new RegExp(
    `${name}\\s*=\\s*"""\\\\?\\n?([\\s\\S]*?)"""`,
    "m",
  );
  const m = pattern.exec(source);
  if (!m) {
    throw new Error(
      `Could not extract ${name} from ${PROMPT_PY}. The source layout has changed.`,
    );
  }
  return m[1];
}

/**
 * Read both prompts from the Python source. Memoised — subsequent calls
 * return the cached object. Throws if the file cannot be parsed (e.g.
 * the constant was renamed) so the test fails loudly.
 */
export function loadStreamingPrompts(): StreamingPrompts {
  if (cached) return cached;
  const source = fs.readFileSync(PROMPT_PY, "utf8");
  const fr = extract("EXPLORER_STREAMING_PROMPT_FR", source);
  const en = extract("EXPLORER_STREAMING_PROMPT_EN", source);

  // Sanity guards — any of these failing means we extracted gibberish.
  for (const [label, body] of [
    ["FR", fr],
    ["EN", en],
  ] as const) {
    if (body.length < 1500) {
      throw new Error(
        `${label} prompt is suspiciously short (${body.length} chars) — extraction probably broken.`,
      );
    }
    for (const tag of [
      "[CTX UPDATE]",
      "[PHASE TRANSITION]",
      "[CTX HEARTBEAT]",
      "[CTX COMPLETE]",
    ]) {
      if (!body.includes(tag)) {
        throw new Error(
          `${label} prompt missing ${tag} — extraction probably broken.`,
        );
      }
    }
  }

  cached = { fr, en };
  return cached;
}
