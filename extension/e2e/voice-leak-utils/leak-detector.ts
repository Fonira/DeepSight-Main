// extension/e2e/voice-leak-utils/leak-detector.ts
//
// Leak detector for the Quick Voice Call agent. Scans an agent reply text
// for any of the forbidden internal protocol markers that should NEVER be
// surfaced to the end user — see ``backend/src/voice/streaming_prompts.py``
// (constants ``EXPLORER_STREAMING_PROMPT_FR`` / ``_EN``) for the contract.
//
// Forbidden markers fall in three buckets:
//
//   1. Envelope tags (full or partial) — these are the structural fences
//      our backend uses to inject context into the agent. They must never
//      echo into a voice reply.
//      e.g. "[CTX UPDATE]", "[PHASE TRANSITION]", "[CTX HEARTBEAT]",
//           "[CTX COMPLETE]", "[CTX FAILED]", "[PHASE", "[CTX".
//
//   2. Internal jargon — words that describe our plumbing and have NO
//      business in a user-facing voice reply.
//      e.g. "transcript chunk", "system prompt", "ElevenLabs".
//
//   3. Plumbing-mention of "streaming" — the prompt explicitly forbids the
//      agent from telling the user "the streaming is stalled". We allow
//      the WORD ``streaming`` in dictionary contexts (e.g. "streaming
//      service like Netflix") but flag any phrase that ties it to the
//      pipeline ("streaming context", "streaming pipeline", "context
//      streaming", etc.).
//
// The detector is intentionally case-insensitive on tags but case-sensitive
// on rare proper nouns ("ElevenLabs") to avoid flagging "elevation labs"
// or similar coincidences.

export interface LeakHit {
  /** The matched forbidden token / phrase. */
  marker: string;
  /** ~80-char excerpt around the match for diagnosis. */
  context: string;
  /** 0-based index of the match in the input string. */
  index: number;
  /** Bucket for filtering / reporting. */
  bucket: "envelope" | "jargon" | "streaming-jargon";
}

export interface LeakReport {
  /** Whether any forbidden token was found. */
  hasLeak: boolean;
  /** Per-marker hits, in the order they appear in the input. */
  hits: LeakHit[];
}

/**
 * Hard envelope tags — substring match, case-insensitive.
 *
 * The production side panel pushes envelopes in two shapes :
 *   * standalone tag                         e.g. ``[CTX COMPLETE]``
 *   * tag with inline metadata after a colon  e.g. ``[CTX UPDATE: transcript chunk 1/3]``
 *
 * To catch both we omit the closing ``]`` from the marker list — substring
 * matching on ``[CTX UPDATE`` flags ``[CTX UPDATE]`` AND ``[CTX UPDATE: ...]``.
 *
 * The trailing partial brackets (``[PHASE`` / ``[CTX``) are last-resort
 * fallbacks for sloppy agent typos like ``[CTXUPDATE`` or ``[ CTX UPDATE``.
 */
const ENVELOPE_MARKERS = [
  "[CTX UPDATE",
  "[PHASE TRANSITION",
  "[CTX HEARTBEAT",
  "[CTX COMPLETE",
  "[CTX FAILED",
  "[PHASE",
  "[CTX",
];

/**
 * Internal jargon — case-insensitive substring match. ``ElevenLabs`` is the
 * brand spelling of our voice provider; agent should never name-drop it
 * unprompted (the task is "answer questions about a YouTube video" not
 * "advertise our stack").
 */
const JARGON_MARKERS = [
  "transcript chunk",
  "system prompt",
  "ElevenLabs",
];

/**
 * "Streaming" jargon contexts — only flag when the word ``streaming`` is
 * adjacent to a pipeline-y noun. Phrases like "streaming service" or
 * "video streaming platform" are NOT flagged.
 */
const STREAMING_JARGON_PATTERNS: RegExp[] = [
  /streaming\s+(context|pipeline|orchestrator|protocol|chunk|chunks|envelope)/i,
  /(context|pipeline|protocol|envelope)\s+streaming/i,
  /the\s+streaming\s+(is|has)\s+(stalled|blocked|stuck|failed)/i,
  /le\s+streaming\s+est\s+(bloqu|stall)/i,
];

function excerpt(text: string, index: number, marker: string): string {
  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + marker.length + 30);
  const slice = text.slice(start, end).replace(/\s+/g, " ");
  return (start > 0 ? "…" : "") + slice + (end < text.length ? "…" : "");
}

function findCaseInsensitive(haystack: string, needle: string): number {
  return haystack.toLowerCase().indexOf(needle.toLowerCase());
}

function findExact(haystack: string, needle: string): number {
  return haystack.indexOf(needle);
}

/**
 * Scan an agent reply for any of the forbidden internal protocol markers.
 *
 * Returns a structured report rather than throwing — the caller (a
 * Playwright test, typically) can decide whether to fail hard, accumulate
 * across many scenarios, or report a partial pass rate.
 */
export function detectLeak(text: string): LeakReport {
  const hits: LeakHit[] = [];
  if (!text) return { hasLeak: false, hits };

  // 1. Envelope tags (case-insensitive — agent might capitalise oddly).
  for (const marker of ENVELOPE_MARKERS) {
    const idx = findCaseInsensitive(text, marker);
    if (idx >= 0) {
      hits.push({
        marker,
        context: excerpt(text, idx, marker),
        index: idx,
        bucket: "envelope",
      });
    }
  }

  // 2. Jargon (mixed case sensitivity — see comment on JARGON_MARKERS).
  for (const marker of JARGON_MARKERS) {
    const idx =
      marker === "ElevenLabs"
        ? findExact(text, marker)
        : findCaseInsensitive(text, marker);
    if (idx >= 0) {
      hits.push({
        marker,
        context: excerpt(text, idx, marker),
        index: idx,
        bucket: "jargon",
      });
    }
  }

  // 3. Streaming-jargon (regex, only flag pipeline-y phrasing).
  for (const pattern of STREAMING_JARGON_PATTERNS) {
    const m = pattern.exec(text);
    if (m) {
      hits.push({
        marker: m[0],
        context: excerpt(text, m.index, m[0]),
        index: m.index,
        bucket: "streaming-jargon",
      });
    }
  }

  // De-duplicate by (marker, index) and re-sort by index so reports are
  // legible even when the same string contains many markers.
  const seen = new Set<string>();
  const dedup = hits.filter((h) => {
    const key = `${h.marker}@${h.index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  dedup.sort((a, b) => a.index - b.index);

  return { hasLeak: dedup.length > 0, hits: dedup };
}

/**
 * Format a leak report for human consumption (test failure messages,
 * PR-body summaries). Returns one line per hit.
 */
export function formatReport(report: LeakReport): string {
  if (!report.hasLeak) return "(no leak)";
  return report.hits
    .map(
      (h) =>
        `[${h.bucket}] ${JSON.stringify(h.marker)} @${h.index} — ${h.context}`,
    )
    .join("\n");
}
