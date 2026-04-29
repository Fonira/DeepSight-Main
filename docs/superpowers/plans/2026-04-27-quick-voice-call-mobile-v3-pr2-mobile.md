# Quick Voice Call Mobile V3 — PR2 Mobile UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Câbler le Home mobile (paste manuel + clipboard auto-detect + 2 CTA Analyser/Voice Call), étendre VoiceScreen avec une variante streaming (progress bar contexte), créer le hook `useStreamingVideoContext` (consume SSE + inject `[CTX UPDATE]` dans la conversation ElevenLabs), et créer le PostCallScreen post-hangup.

**Architecture:** Le Home appelle `useVoiceChat` étendu (qui expose désormais `sessionId` + `conversation` dans son retour) ET `useStreamingVideoContext(sessionId, conversation)` qui s'auto-active dès qu'un session_id est disponible. `VoiceScreen` reste presentational, reçoit `streaming/contextProgress/contextComplete` en props. Après hangup, `PostCallScreen` Modal s'affiche avec transcript + 2 CTA (analyse complète / autre appel).

**Tech Stack:** React Native 0.81 + Expo SDK 54 + Reanimated 4.1, `@elevenlabs/react-native` (existing), `expo-clipboard`, `expo-linking`, `react-native-sse` (NEW dep), `@gorhom/bottom-sheet`, Jest + Testing Library RN.

**Spec source:** `docs/superpowers/specs/2026-04-27-quick-voice-call-mobile-v3-design.md` § 6, 7, 8.

**Branche:** `feat/quick-voice-call-mobile-v3`. **Dépend de PR1 mergée + déployée.**

---

## File Structure

| Fichier                                                              | Type   | Responsabilité                                                                                                |
| -------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| `mobile/src/utils/validateVideoURL.ts`                               | NEW    | Regex YT + TikTok mirror du backend                                                                           |
| `mobile/src/hooks/useClipboardURLDetector.ts`                        | NEW    | Scan clipboard sur focus Home, return URL si valide                                                           |
| `mobile/src/hooks/useDeepLinkURL.ts`                                 | NEW    | Listener Linking pour `deepsight://voice-call?url=...&autostart=true`                                         |
| `mobile/src/components/voice/useStreamingVideoContext.ts`            | NEW    | EventSource SSE → `conversation.sendUserMessage([CTX UPDATE])` + state progress                               |
| `mobile/src/components/voice/useVoiceChat.ts`                        | MODIFY | Exposer `sessionId` et `conversation` dans le retour                                                          |
| `mobile/src/services/api.ts`                                         | MODIFY | `voiceApi.createSession({video_url, agent_type:'explorer_streaming'})` accepté + `summary_id` dans la réponse |
| `mobile/src/components/voice/VoiceScreen.tsx`                        | MODIFY | Props `streaming`, `contextProgress`, `contextComplete` + ContextProgressBar                                  |
| `mobile/src/components/voice/PostCallScreen.tsx`                     | NEW    | Modal post-hangup : transcript + 2 CTA + banner upgrade                                                       |
| `mobile/app/(tabs)/index.tsx` (Home)                                 | MODIFY | Layout 2 CTA + bandeau clipboard + wiring useVoiceChat + useStreamingVideoContext + PostCallScreen            |
| `mobile/__tests__/utils/validateVideoURL.test.ts`                    | NEW    | Tests regex client                                                                                            |
| `mobile/__tests__/hooks/useClipboardURLDetector.test.ts`             | NEW    | Mock expo-clipboard, test focus → detect                                                                      |
| `mobile/__tests__/hooks/useDeepLinkURL.test.ts`                      | NEW    | Mock Linking, test deep link routing                                                                          |
| `mobile/__tests__/components/voice/useStreamingVideoContext.test.ts` | NEW    | Mock EventSource, test events → sendUserMessage                                                               |
| `mobile/__tests__/components/voice/VoiceScreen.streaming.test.tsx`   | NEW    | Test progress bar conditional render                                                                          |
| `mobile/__tests__/components/voice/PostCallScreen.test.tsx`          | NEW    | Test CTAs + banner                                                                                            |

---

## Task 1: Util validateVideoURL (TDD)

**Files:**

- Create: `mobile/src/utils/validateVideoURL.ts`
- Test: `mobile/__tests__/utils/validateVideoURL.test.ts`

- [ ] **Step 1.1: Write the failing test**

```typescript
// mobile/__tests__/utils/validateVideoURL.test.ts
import {
  validateVideoURL,
  parseVideoURL,
} from "../../src/utils/validateVideoURL";

describe("validateVideoURL", () => {
  test.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/shorts/abc123XYZ_-",
    "https://www.tiktok.com/@user/video/7123456789012345678",
    "https://vm.tiktok.com/ZMabc123/",
  ])("accepts %s", (url) => expect(validateVideoURL(url)).toBe(true));

  test.each([
    "https://vimeo.com/123",
    "https://twitter.com/x/status/1",
    "not a url",
    "",
    "ftp://youtube.com/watch?v=dQw4w9WgXcQ",
  ])("rejects %s", (url) => expect(validateVideoURL(url)).toBe(false));
});

describe("parseVideoURL", () => {
  test("returns youtube + id", () => {
    expect(parseVideoURL("https://youtu.be/dQw4w9WgXcQ")).toEqual({
      platform: "youtube",
      videoId: "dQw4w9WgXcQ",
    });
  });
  test("returns tiktok + id", () => {
    expect(
      parseVideoURL("https://www.tiktok.com/@u/video/7123456789012345678"),
    ).toEqual({
      platform: "tiktok",
      videoId: "7123456789012345678",
    });
  });
  test("returns null for invalid", () => {
    expect(parseVideoURL("https://vimeo.com/123")).toBeNull();
  });
});
```

- [ ] **Step 1.2: Run to verify fail**

`cd mobile && npm test -- validateVideoURL` → FAIL (module missing).

- [ ] **Step 1.3: Implement**

```typescript
// mobile/src/utils/validateVideoURL.ts
const YOUTUBE_RE =
  /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const TIKTOK_RE =
  /^https?:\/\/(?:www\.|vm\.|m\.)?tiktok\.com\/(?:@[\w.-]+\/video\/(\d+)|t\/([A-Za-z0-9]+)|v\/(\d+)|([A-Za-z0-9]+)\/?)/;

export function validateVideoURL(url: string): boolean {
  return YOUTUBE_RE.test(url) || TIKTOK_RE.test(url);
}

export interface ParsedVideoURL {
  platform: "youtube" | "tiktok";
  videoId: string;
}

export function parseVideoURL(url: string): ParsedVideoURL | null {
  const ytMatch = url.match(YOUTUBE_RE);
  if (ytMatch) return { platform: "youtube", videoId: ytMatch[1] };
  const ttMatch = url.match(TIKTOK_RE);
  if (ttMatch) {
    const id = ttMatch[1] || ttMatch[2] || ttMatch[3] || ttMatch[4];
    if (id) return { platform: "tiktok", videoId: id };
  }
  return null;
}
```

- [ ] **Step 1.4: Run + commit**

```bash
cd mobile && npm test -- validateVideoURL  # PASS
git add mobile/src/utils/validateVideoURL.ts mobile/__tests__/utils/validateVideoURL.test.ts
git commit -m "feat(mobile): add validateVideoURL util (YT + TikTok regex mirror backend)"
```

---

## Task 2: Hook useClipboardURLDetector (TDD)

**Files:**

- Create: `mobile/src/hooks/useClipboardURLDetector.ts`
- Test: `mobile/__tests__/hooks/useClipboardURLDetector.test.ts`

- [ ] **Step 2.1: Add expo-clipboard if not in deps**

Run: `grep '"expo-clipboard"' mobile/package.json`. If absent:

```bash
cd mobile && npx expo install expo-clipboard
```

- [ ] **Step 2.2: Write the failing test**

```typescript
// mobile/__tests__/hooks/useClipboardURLDetector.test.ts
import { renderHook, act, waitFor } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
import { useClipboardURLDetector } from "../../src/hooks/useClipboardURLDetector";

jest.mock("expo-clipboard");
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (cb: () => void) => {
    cb(); // run immediately in tests
  },
}));

describe("useClipboardURLDetector", () => {
  beforeEach(() => jest.clearAllMocks());

  test("detects YouTube URL in clipboard on focus", async () => {
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValue(
      "https://youtu.be/dQw4w9WgXcQ",
    );
    const { result } = renderHook(() => useClipboardURLDetector());
    await waitFor(() => {
      expect(result.current.clipboardURL).toBe("https://youtu.be/dQw4w9WgXcQ");
    });
  });

  test("ignores non-video URLs", async () => {
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValue(
      "https://example.com",
    );
    const { result } = renderHook(() => useClipboardURLDetector());
    await waitFor(() => {
      expect(result.current.clipboardURL).toBeNull();
    });
  });

  test("ignores empty clipboard", async () => {
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValue("");
    const { result } = renderHook(() => useClipboardURLDetector());
    await waitFor(() => {
      expect(result.current.clipboardURL).toBeNull();
    });
  });

  test("dismiss clears the state", async () => {
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValue(
      "https://www.tiktok.com/@u/video/7123456789012345678",
    );
    const { result } = renderHook(() => useClipboardURLDetector());
    await waitFor(() => expect(result.current.clipboardURL).toBeTruthy());
    act(() => result.current.dismiss());
    expect(result.current.clipboardURL).toBeNull();
  });
});
```

- [ ] **Step 2.3: Run to fail**

`cd mobile && npm test -- useClipboardURLDetector` → FAIL.

- [ ] **Step 2.4: Implement**

```typescript
// mobile/src/hooks/useClipboardURLDetector.ts
import { useCallback, useState } from "react";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "@react-navigation/native";
import { validateVideoURL } from "../utils/validateVideoURL";

export interface UseClipboardURLDetectorReturn {
  clipboardURL: string | null;
  dismiss: () => void;
  refresh: () => Promise<void>;
}

export function useClipboardURLDetector(): UseClipboardURLDetectorReturn {
  const [clipboardURL, setClipboardURL] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (text && validateVideoURL(text)) {
        setClipboardURL(text);
      } else {
        setClipboardURL(null);
      }
    } catch {
      setClipboardURL(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const text = await Clipboard.getStringAsync();
          if (cancelled) return;
          if (text && validateVideoURL(text)) {
            setClipboardURL(text);
          }
        } catch {
          /* ignore */
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const dismiss = useCallback(() => setClipboardURL(null), []);
  return { clipboardURL, dismiss, refresh };
}
```

- [ ] **Step 2.5: Run + commit**

```bash
cd mobile && npm test -- useClipboardURLDetector  # PASS (4 tests)
git add mobile/src/hooks/useClipboardURLDetector.ts mobile/__tests__/hooks/useClipboardURLDetector.test.ts mobile/package.json mobile/package-lock.json
git commit -m "feat(mobile): add useClipboardURLDetector hook (auto-detect YT/TikTok URLs on Home focus)"
```

---

## Task 3: Hook useDeepLinkURL (TDD)

**Files:**

- Create: `mobile/src/hooks/useDeepLinkURL.ts`
- Test: `mobile/__tests__/hooks/useDeepLinkURL.test.ts`

- [ ] **Step 3.1: Failing test**

```typescript
// mobile/__tests__/hooks/useDeepLinkURL.test.ts
import { renderHook, act, waitFor } from "@testing-library/react-native";
import * as Linking from "expo-linking";
import { useDeepLinkURL } from "../../src/hooks/useDeepLinkURL";

jest.mock("expo-linking");

describe("useDeepLinkURL", () => {
  let urlListener: ((evt: { url: string }) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    urlListener = null;
    (Linking.addEventListener as jest.Mock).mockImplementation((event, cb) => {
      urlListener = cb;
      return { remove: jest.fn() };
    });
    (Linking.getInitialURL as jest.Mock).mockResolvedValue(null);
    (Linking.parse as jest.Mock).mockImplementation((url: string) => {
      const m = url.match(
        /deepsight:\/\/voice-call\?url=([^&]+)(?:&autostart=(\w+))?/,
      );
      if (m)
        return {
          path: "voice-call",
          queryParams: {
            url: decodeURIComponent(m[1]),
            autostart: m[2] || "false",
          },
        };
      return { path: null, queryParams: {} };
    });
  });

  test("calls onURL with valid YT deep link + autostart=true", async () => {
    const onURL = jest.fn();
    renderHook(() => useDeepLinkURL(onURL));
    await waitFor(() => expect(urlListener).not.toBeNull());

    act(() => {
      urlListener!({
        url: `deepsight://voice-call?url=${encodeURIComponent(
          "https://youtu.be/dQw4w9WgXcQ",
        )}&autostart=true`,
      });
    });

    expect(onURL).toHaveBeenCalledWith("https://youtu.be/dQw4w9WgXcQ", true);
  });

  test("ignores non-voice-call paths", async () => {
    const onURL = jest.fn();
    renderHook(() => useDeepLinkURL(onURL));
    await waitFor(() => expect(urlListener).not.toBeNull());
    act(() => {
      urlListener!({ url: "deepsight://settings" });
    });
    expect(onURL).not.toHaveBeenCalled();
  });

  test("ignores invalid URL in deep link", async () => {
    const onURL = jest.fn();
    renderHook(() => useDeepLinkURL(onURL));
    await waitFor(() => expect(urlListener).not.toBeNull());
    act(() => {
      urlListener!({
        url: `deepsight://voice-call?url=${encodeURIComponent("https://vimeo.com/1")}&autostart=true`,
      });
    });
    expect(onURL).not.toHaveBeenCalled();
  });

  test("processes initial URL on mount", async () => {
    (Linking.getInitialURL as jest.Mock).mockResolvedValue(
      `deepsight://voice-call?url=${encodeURIComponent("https://youtu.be/dQw4w9WgXcQ")}&autostart=true`,
    );
    const onURL = jest.fn();
    renderHook(() => useDeepLinkURL(onURL));
    await waitFor(() => expect(onURL).toHaveBeenCalled());
  });
});
```

- [ ] **Step 3.2: Run to fail**

`cd mobile && npm test -- useDeepLinkURL` → FAIL.

- [ ] **Step 3.3: Implement**

```typescript
// mobile/src/hooks/useDeepLinkURL.ts
import { useEffect } from "react";
import * as Linking from "expo-linking";
import { validateVideoURL } from "../utils/validateVideoURL";

type OnURL = (url: string, autostart: boolean) => void;

export function useDeepLinkURL(onURL: OnURL): void {
  useEffect(() => {
    const handle = (raw: string) => {
      const parsed = Linking.parse(raw);
      if (parsed.path !== "voice-call") return;
      const target = String(parsed.queryParams?.url ?? "");
      const autostart = parsed.queryParams?.autostart === "true";
      if (target && validateVideoURL(target)) {
        onURL(target, autostart);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handle(url);
    });

    const sub = Linking.addEventListener("url", ({ url }: { url: string }) => {
      handle(url);
    });
    return () => sub.remove();
  }, [onURL]);
}
```

- [ ] **Step 3.4: Run + commit**

```bash
cd mobile && npm test -- useDeepLinkURL  # PASS
git add mobile/src/hooks/useDeepLinkURL.ts mobile/__tests__/hooks/useDeepLinkURL.test.ts
git commit -m "feat(mobile): add useDeepLinkURL hook for deepsight://voice-call?url=...&autostart=true"
```

---

## Task 4: Extend voiceApi.createSession to accept video_url

**Files:**

- Modify: `mobile/src/services/api.ts`
- Test: `mobile/__tests__/services/voiceApi.test.ts` (existing — extend)

- [ ] **Step 4.1: Failing test**

Append to `mobile/__tests__/services/voiceApi.test.ts`:

```typescript
describe("voiceApi.createSession with video_url", () => {
  test("posts video_url + agent_type=explorer_streaming", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        session_id: "sess_1",
        agent_id: "agent_1",
        signed_url: "wss://elv/...",
        conversation_token: "lkjwt",
        expires_at: "2026-04-27T12:00:00Z",
        quota_remaining_minutes: 30,
        max_session_minutes: 30,
        summary_id: 99,
      }),
    } as Response);

    const result = await voiceApi.createSession({
      video_url: "https://youtu.be/dQw4w9WgXcQ",
      agent_type: "explorer_streaming",
      language: "fr",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/voice/session"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining(
          '"video_url":"https://youtu.be/dQw4w9WgXcQ"',
        ),
      }),
    );
    expect(result.summary_id).toBe(99);
  });
});
```

- [ ] **Step 4.2: Run to fail**

`cd mobile && npm test -- voiceApi` → FAIL or skipped (depending on existing fixtures).

- [ ] **Step 4.3: Modify api.ts**

In `mobile/src/services/api.ts`, locate `createSession` inside `voiceApi`. Update the signature and body:

```typescript
async createSession(arg1: number | {
  summary_id?: number;
  debate_id?: number;
  video_url?: string;          // NEW
  agent_type?: "explorer" | "companion" | "debate_moderator" | "explorer_streaming";  // NEW value
  language?: string;
}, legacyLanguage?: string): Promise<{
  session_id: string;
  signed_url: string;
  agent_id: string;
  conversation_token: string | null;
  expires_at: string;
  quota_remaining_minutes: number;
  max_session_minutes: number;
  summary_id?: number;          // NEW
}> {
  // Legacy positional
  if (typeof arg1 === "number") {
    return request("/api/voice/session", {
      method: "POST",
      body: { summary_id: arg1, agent_type: "explorer", language: legacyLanguage ?? "fr" },
    });
  }

  // Object form
  const body: Record<string, unknown> = {
    agent_type:
      arg1.agent_type ??
      (arg1.video_url
        ? "explorer_streaming"
        : arg1.summary_id
        ? "explorer"
        : "companion"),
    language: arg1.language ?? "fr",
  };
  if (arg1.summary_id !== undefined) body.summary_id = arg1.summary_id;
  if (arg1.debate_id !== undefined) body.debate_id = arg1.debate_id;
  if (arg1.video_url !== undefined) body.video_url = arg1.video_url;
  return request("/api/voice/session", { method: "POST", body });
},
```

- [ ] **Step 4.4: Run + commit**

```bash
cd mobile && npm test -- voiceApi  # PASS
git add mobile/src/services/api.ts mobile/__tests__/services/voiceApi.test.ts
git commit -m "feat(mobile): voiceApi.createSession accepts video_url + returns summary_id"
```

---

## Task 5: Extend useVoiceChat to expose sessionId + conversation

**Files:**

- Modify: `mobile/src/components/voice/useVoiceChat.ts`
- Test: `mobile/src/components/voice/__tests__/useVoiceChat.test.ts` (existing — extend)

- [ ] **Step 5.1: Read existing useVoiceChat**

The hook is at `mobile/src/components/voice/useVoiceChat.ts`. Note that `sessionIdRef.current` is set inside `start()` but not exposed in the return. Same for `conversation` (used internally).

- [ ] **Step 5.2: Failing test**

Append to `mobile/src/components/voice/__tests__/useVoiceChat.test.ts`:

```typescript
test("exposes sessionId and conversation in return", async () => {
  // (use existing test setup mocks)
  const { result } = renderHook(() => useVoiceChat({ summaryId: "1" }));
  expect(result.current.sessionId).toBeDefined(); // null before start
  expect(result.current.sessionId).toBeNull();
  expect(result.current.conversation).toBeDefined();
});

test("sessionId set after start()", async () => {
  // mock voiceApi.createSession to return session_id 'sess_42'
  // mock conversation.startSession to resolve
  const { result } = renderHook(() => useVoiceChat({ summaryId: "1" }));
  await act(() => result.current.start());
  expect(result.current.sessionId).toBe("sess_42");
});
```

- [ ] **Step 5.3: Modify useVoiceChat.ts**

Add to the return interface:

```typescript
interface UseVoiceChatReturn {
  // ... existing fields
  /** Session ID backend (null avant start()) — exposé pour useStreamingVideoContext */
  sessionId: string | null; // NEW
  /** Object SDK ElevenLabs RN — exposé pour useStreamingVideoContext */
  conversation: ReturnType<typeof useConversation>; // NEW
}
```

In the hook body, also expose `sessionId` as state (not just ref):

```typescript
const [sessionId, setSessionId] = useState<string | null>(null);

// Inside start(), after sessionData is fetched:
sessionIdRef.current = sessionData.session_id;
setSessionId(sessionData.session_id); // NEW

// Inside stop(), at the end:
sessionIdRef.current = null;
setSessionId(null); // NEW
```

In the return:

```typescript
return {
  start,
  stop,
  toggleMute,
  sendUserMessage,
  status,
  isSpeaking: conversation.isSpeaking,
  isMuted,
  messages,
  elapsedSeconds,
  remainingMinutes,
  error,
  sessionId, // NEW
  conversation, // NEW
};
```

- [ ] **Step 5.4: Run + commit**

```bash
cd mobile && npm test -- useVoiceChat  # PASS (existing + new)
git add mobile/src/components/voice/useVoiceChat.ts mobile/src/components/voice/__tests__/useVoiceChat.test.ts
git commit -m "feat(mobile): expose sessionId + conversation from useVoiceChat (for streaming context hook)"
```

---

## Task 6: Hook useStreamingVideoContext (TDD)

**Files:**

- Create: `mobile/src/components/voice/useStreamingVideoContext.ts`
- Test: `mobile/__tests__/components/voice/useStreamingVideoContext.test.ts`

- [ ] **Step 6.1: Add react-native-sse dep**

```bash
cd mobile && npm install react-native-sse
```

- [ ] **Step 6.2: Failing test**

```typescript
// mobile/__tests__/components/voice/useStreamingVideoContext.test.ts
import { renderHook, act, waitFor } from "@testing-library/react-native";
import { useStreamingVideoContext } from "../../../src/components/voice/useStreamingVideoContext";

// Mock react-native-sse
let mockListeners: Record<string, ((e: { data: string }) => void)[]> = {};
const mockClose = jest.fn();
jest.mock("react-native-sse", () =>
  jest.fn().mockImplementation(() => ({
    addEventListener: (event: string, cb: (e: { data: string }) => void) => {
      mockListeners[event] = mockListeners[event] || [];
      mockListeners[event].push(cb);
    },
    removeAllEventListeners: jest.fn(),
    close: mockClose,
  })),
);

// Mock auth headers
jest.mock("../../../src/services/api", () => ({
  __esModule: true,
  getAuthHeaders: () => ({ Authorization: "Bearer test" }),
  API_BASE_URL: "http://test",
}));

const fakeConversation = {
  sendUserMessage: jest.fn(),
};

describe("useStreamingVideoContext", () => {
  beforeEach(() => {
    mockListeners = {};
    fakeConversation.sendUserMessage.mockClear();
    mockClose.mockClear();
  });

  test("does nothing when sessionId is null", () => {
    renderHook(() => useStreamingVideoContext(null, fakeConversation as any));
    expect(mockListeners).toEqual({});
  });

  test("dispatches transcript_chunk to sendUserMessage with [CTX UPDATE] prefix", async () => {
    const { result } = renderHook(() =>
      useStreamingVideoContext("sess_1", fakeConversation as any),
    );
    await waitFor(() => expect(mockListeners.transcript_chunk).toBeDefined());

    act(() => {
      mockListeners.transcript_chunk[0]({
        data: JSON.stringify({
          chunk_index: 1,
          total_chunks: 4,
          text: "Hello",
        }),
      });
    });

    expect(fakeConversation.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining("[CTX UPDATE: transcript chunk 1/4]"),
    );
    expect(fakeConversation.sendUserMessage.mock.calls[0][0]).toContain(
      "Hello",
    );
    expect(result.current.contextProgress).toBeCloseTo((1 / 4) * 80, 1);
  });

  test("ctx_complete sets contextComplete=true and progress=100", async () => {
    const { result } = renderHook(() =>
      useStreamingVideoContext("sess_2", fakeConversation as any),
    );
    await waitFor(() => expect(mockListeners.ctx_complete).toBeDefined());

    act(() => {
      mockListeners.ctx_complete[0]({
        data: JSON.stringify({ final_digest_summary: "Final" }),
      });
    });

    expect(result.current.contextProgress).toBe(100);
    expect(result.current.contextComplete).toBe(true);
    expect(fakeConversation.sendUserMessage).toHaveBeenCalledWith(
      expect.stringContaining("[CTX COMPLETE]"),
    );
  });

  test("closes EventSource on unmount", async () => {
    const { unmount } = renderHook(() =>
      useStreamingVideoContext("sess_3", fakeConversation as any),
    );
    await waitFor(() => expect(mockListeners.transcript_chunk).toBeDefined());
    unmount();
    expect(mockClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 6.3: Run to fail**

`cd mobile && npm test -- useStreamingVideoContext` → FAIL.

- [ ] **Step 6.4: Implement**

```typescript
// mobile/src/components/voice/useStreamingVideoContext.ts
import { useState, useEffect } from "react";
import EventSource from "react-native-sse";
import { API_BASE_URL, getAuthHeaders } from "../../services/api";

interface ConversationLike {
  sendUserMessage?: (text: string) => void;
}

export interface UseStreamingVideoContextReturn {
  contextProgress: number;
  contextComplete: boolean;
}

export function useStreamingVideoContext(
  sessionId: string | null,
  conversation: ConversationLike,
): UseStreamingVideoContextReturn {
  const [contextProgress, setContextProgress] = useState(0);
  const [contextComplete, setContextComplete] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    const url = `${API_BASE_URL}/api/voice/context/stream?session_id=${encodeURIComponent(sessionId)}`;
    const headers = getAuthHeaders();
    const es = new EventSource(url, { headers });

    es.addEventListener("transcript_chunk", (e: { data: string }) => {
      try {
        const data = JSON.parse(e.data);
        conversation.sendUserMessage?.(
          `[CTX UPDATE: transcript chunk ${data.chunk_index}/${data.total_chunks}]\n${data.text}`,
        );
        setContextProgress((data.chunk_index / data.total_chunks) * 80);
      } catch {
        /* ignore */
      }
    });

    es.addEventListener("analysis_partial", (e: { data: string }) => {
      try {
        const data = JSON.parse(e.data);
        conversation.sendUserMessage?.(
          `[CTX UPDATE: analysis - ${data.section}]\n${data.content}`,
        );
        setContextProgress((p) => Math.min(p + 5, 95));
      } catch {
        /* ignore */
      }
    });

    es.addEventListener("ctx_complete", (e: { data: string }) => {
      try {
        const data = JSON.parse(e.data);
        conversation.sendUserMessage?.(
          `[CTX COMPLETE]\nFinal digest: ${data.final_digest_summary}`,
        );
      } catch {
        conversation.sendUserMessage?.("[CTX COMPLETE]");
      }
      setContextProgress(100);
      setContextComplete(true);
    });

    es.addEventListener("error", () => {
      /* tolerate transient errors; mobile fallback agent handles silence */
    });

    return () => {
      es.close();
    };
  }, [sessionId, conversation]);

  return { contextProgress, contextComplete };
}
```

- [ ] **Step 6.5: If `getAuthHeaders` not exported from api.ts, add export**

In `mobile/src/services/api.ts`, ensure these are exported (or add wrappers):

```typescript
export const API_BASE_URL = /* existing const */;

export function getAuthHeaders(): Record<string, string> {
  // Reuse existing internal auth header builder
  const token = /* existing accessor, e.g. authStore.getState().accessToken */;
  return { Authorization: `Bearer ${token}` };
}
```

- [ ] **Step 6.6: Run + commit**

```bash
cd mobile && npm test -- useStreamingVideoContext  # PASS
git add mobile/src/components/voice/useStreamingVideoContext.ts mobile/__tests__/components/voice/useStreamingVideoContext.test.ts mobile/src/services/api.ts mobile/package.json mobile/package-lock.json
git commit -m "feat(mobile): add useStreamingVideoContext hook (SSE → sendUserMessage [CTX UPDATE])"
```

---

## Task 7: VoiceScreen variante streaming + ContextProgressBar (TDD)

**Files:**

- Modify: `mobile/src/components/voice/VoiceScreen.tsx`
- Test: `mobile/__tests__/components/voice/VoiceScreen.streaming.test.tsx`

- [ ] **Step 7.1: Failing test**

```typescript
// mobile/__tests__/components/voice/VoiceScreen.streaming.test.tsx
import { render } from "@testing-library/react-native";
import { VoiceScreen } from "../../../src/components/voice/VoiceScreen";

const baseProps = {
  visible: true,
  onClose: jest.fn(),
  videoTitle: "Test",
  voiceStatus: "listening" as const,
  isSpeaking: false,
  messages: [],
  elapsedSeconds: 0,
  remainingMinutes: 30,
  onStart: jest.fn(),
  onStop: jest.fn(),
  onMuteToggle: jest.fn(),
  isMuted: false,
};

describe("VoiceScreen streaming variant", () => {
  test("does NOT show progress bar when streaming=false", () => {
    const { queryByTestId } = render(<VoiceScreen {...baseProps} streaming={false} />);
    expect(queryByTestId("context-progress-bar")).toBeNull();
  });

  test("shows progress bar with percent when streaming=true and contextProgress=60", () => {
    const { getByTestId, getByText } = render(
      <VoiceScreen {...baseProps} streaming={true} contextProgress={60} contextComplete={false} />
    );
    expect(getByTestId("context-progress-bar")).toBeTruthy();
    expect(getByText(/60%/)).toBeTruthy();
    expect(getByText(/d'apr.s ce que j'.coute/i) || getByText(/Analyse en cours/i)).toBeTruthy();
  });

  test("shows 'contexte complet' label when contextComplete=true", () => {
    const { getByText } = render(
      <VoiceScreen {...baseProps} streaming={true} contextProgress={100} contextComplete={true} />
    );
    expect(getByText(/contexte.*complet/i)).toBeTruthy();
  });
});
```

- [ ] **Step 7.2: Run to fail**

`cd mobile && npm test -- VoiceScreen.streaming` → FAIL (props not in interface).

- [ ] **Step 7.3: Modify VoiceScreen.tsx**

Add to props interface:

```typescript
interface VoiceScreenProps {
  // ... existing props
  /** NEW — active la variante streaming (Quick Voice Call mobile V3) */
  streaming?: boolean;
  /** NEW — 0-100, progression du contexte vidéo */
  contextProgress?: number;
  /** NEW — true quand [CTX COMPLETE] reçu */
  contextComplete?: boolean;
}
```

Inside the component, after the title block, render the progress bar conditionally:

```tsx
{
  streaming && (
    <View testID="context-progress-bar" style={styles.contextProgressContainer}>
      {!contextComplete ? (
        <>
          <Text style={styles.contextProgressLabel}>
            🎙️ J'écoute la vidéo en même temps que toi · Analyse en cours:{" "}
            {Math.floor(contextProgress ?? 0)}%
          </Text>
          <View style={styles.contextProgressTrack}>
            <Animated.View
              style={[
                styles.contextProgressFill,
                { width: `${contextProgress ?? 0}%` },
              ]}
            />
          </View>
        </>
      ) : (
        <Text style={styles.contextProgressLabel}>
          ✓ Contexte vidéo complet
        </Text>
      )}
    </View>
  );
}
```

Add styles:

```typescript
contextProgressContainer: {
  paddingHorizontal: sp(4),
  paddingVertical: sp(3),
  marginTop: sp(2),
  backgroundColor: "rgba(245,180,0,0.08)",
  borderRadius: borderRadius.md,
  borderWidth: 1,
  borderColor: "rgba(245,180,0,0.25)",
},
contextProgressLabel: {
  fontSize: fontSize.sm,
  fontFamily: fontFamily.medium,
  color: palette.gold,
  marginBottom: sp(2),
},
contextProgressTrack: {
  height: 4,
  backgroundColor: "rgba(255,255,255,0.08)",
  borderRadius: 2,
  overflow: "hidden",
},
contextProgressFill: {
  height: "100%",
  backgroundColor: palette.gold,
  borderRadius: 2,
},
```

- [ ] **Step 7.4: Run + commit**

```bash
cd mobile && npm test -- VoiceScreen  # PASS (existing + new)
git add mobile/src/components/voice/VoiceScreen.tsx mobile/__tests__/components/voice/VoiceScreen.streaming.test.tsx
git commit -m "feat(mobile): VoiceScreen streaming variant with context progress bar"
```

---

## Task 8: PostCallScreen Modal (TDD)

**Files:**

- Create: `mobile/src/components/voice/PostCallScreen.tsx`
- Test: `mobile/__tests__/components/voice/PostCallScreen.test.tsx`

- [ ] **Step 8.1: Failing test**

```typescript
// mobile/__tests__/components/voice/PostCallScreen.test.tsx
import { render, fireEvent } from "@testing-library/react-native";
import { PostCallScreen } from "../../../src/components/voice/PostCallScreen";

const baseProps = {
  visible: true,
  onClose: jest.fn(),
  videoTitle: "Le futur de l'IA",
  channelName: "AI Channel",
  summaryId: 99,
  durationSeconds: 272,
  messages: [
    { text: "Salut", source: "user" as const },
    { text: "Bonjour!", source: "ai" as const },
  ],
  quotaRemaining: 27,
  onViewAnalysis: jest.fn(),
  onCallAnother: jest.fn(),
};

describe("PostCallScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  test("renders title + duration + messages", () => {
    const { getByText } = render(<PostCallScreen {...baseProps} />);
    expect(getByText(/Le futur de l'IA/)).toBeTruthy();
    expect(getByText(/04:32/)).toBeTruthy();
    expect(getByText(/Salut/)).toBeTruthy();
    expect(getByText(/Bonjour/)).toBeTruthy();
  });

  test("primary CTA calls onViewAnalysis with summaryId", () => {
    const { getByText } = render(<PostCallScreen {...baseProps} />);
    fireEvent.press(getByText(/Voir l'analyse complète/i));
    expect(baseProps.onViewAnalysis).toHaveBeenCalledWith(99);
  });

  test("secondary CTA calls onCallAnother", () => {
    const { getByText } = render(<PostCallScreen {...baseProps} />);
    fireEvent.press(getByText(/Appeler une autre vidéo/i));
    expect(baseProps.onCallAnother).toHaveBeenCalled();
  });

  test("does NOT show upgrade banner when quotaRemaining > 0", () => {
    const { queryByText } = render(<PostCallScreen {...baseProps} quotaRemaining={5} />);
    expect(queryByText(/Quota voice épuisé/i)).toBeNull();
  });

  test("shows upgrade banner when quotaRemaining === 0", () => {
    const { getByText } = render(<PostCallScreen {...baseProps} quotaRemaining={0} />);
    expect(getByText(/Quota voice épuisé/i)).toBeTruthy();
  });
});
```

- [ ] **Step 8.2: Run to fail**

`cd mobile && npm test -- PostCallScreen` → FAIL.

- [ ] **Step 8.3: Implement**

```tsx
// mobile/src/components/voice/PostCallScreen.tsx
import React from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Platform,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { palette } from "../../theme/colors";
import { sp, borderRadius } from "../../theme/spacing";
import { fontFamily, fontSize } from "../../theme/typography";
import { shadows } from "../../theme/shadows";

interface VoiceMessage {
  text: string;
  source: "user" | "ai";
}

interface PostCallScreenProps {
  visible: boolean;
  onClose: () => void;
  videoTitle: string;
  channelName?: string;
  summaryId?: number;
  durationSeconds: number;
  messages: VoiceMessage[];
  quotaRemaining: number;
  onViewAnalysis: (summaryId: number) => void;
  onCallAnother: () => void;
}

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
};

export const PostCallScreen: React.FC<PostCallScreenProps> = ({
  visible,
  onClose,
  videoTitle,
  channelName,
  summaryId,
  durationSeconds,
  messages,
  quotaRemaining,
  onViewAnalysis,
  onCallAnother,
}) => (
  <Modal
    visible={visible}
    animationType="slide"
    presentationStyle="formSheet"
    onRequestClose={onClose}
  >
    <View style={styles.container}>
      <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
        <Ionicons name="close" size={28} color={palette.textPrimary} />
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.headerLabel}>✓ Appel terminé</Text>
        <Text style={styles.title}>{videoTitle}</Text>
        <Text style={styles.subtitle}>
          {channelName ? `${channelName} · ` : ""}
          {formatTime(durationSeconds)}
        </Text>
      </View>

      {quotaRemaining === 0 && (
        <View style={styles.upgradeBanner}>
          <Text style={styles.upgradeText}>
            ⚠ Quota voice épuisé · Passe en Pro pour continuer
          </Text>
        </View>
      )}

      <View style={styles.transcriptSection}>
        <Text style={styles.sectionLabel}>TRANSCRIPT</Text>
        <FlashList
          data={messages}
          estimatedItemSize={48}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => (
            <View
              style={[
                styles.bubble,
                item.source === "user" ? styles.userBubble : styles.aiBubble,
              ]}
            >
              <Text style={styles.bubbleAuthor}>
                {item.source === "user" ? "Toi" : "Agent"}
              </Text>
              <Text style={styles.bubbleText}>{item.text}</Text>
            </View>
          )}
        />
      </View>

      <View style={styles.ctaSection}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryCta,
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => summaryId && onViewAnalysis(summaryId)}
          disabled={!summaryId}
        >
          <LinearGradient
            colors={[palette.gold, "#d97706"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.primaryCtaText}>Voir l'analyse complète →</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.secondaryCta,
            pressed && { opacity: 0.85 },
          ]}
          onPress={onCallAnother}
        >
          <Text style={styles.secondaryCtaText}>Appeler une autre vidéo</Text>
        </Pressable>
      </View>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bgPrimary,
    padding: sp(4),
    paddingTop: Platform.OS === "ios" ? sp(8) : sp(4),
  },
  closeBtn: { alignSelf: "flex-end", padding: sp(2) },
  header: { marginTop: sp(4), marginBottom: sp(6) },
  headerLabel: {
    fontSize: fontSize.sm,
    color: palette.gold,
    fontFamily: fontFamily.semibold,
    marginBottom: sp(2),
  },
  title: {
    fontSize: fontSize.xl,
    color: palette.textPrimary,
    fontFamily: fontFamily.bold,
    marginBottom: sp(1),
  },
  subtitle: { fontSize: fontSize.sm, color: palette.textMuted },
  upgradeBanner: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderColor: "rgba(239,68,68,0.3)",
    borderWidth: 1,
    padding: sp(3),
    borderRadius: borderRadius.md,
    marginBottom: sp(4),
  },
  upgradeText: { color: "#fca5a5", fontSize: fontSize.sm, textAlign: "center" },
  transcriptSection: { flex: 1, marginBottom: sp(4) },
  sectionLabel: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    fontFamily: fontFamily.semibold,
    letterSpacing: 1,
    marginBottom: sp(2),
  },
  bubble: {
    padding: sp(3),
    borderRadius: borderRadius.md,
    marginBottom: sp(2),
  },
  userBubble: {
    backgroundColor: "rgba(99,102,241,0.12)",
    alignSelf: "flex-end",
    maxWidth: "85%",
  },
  aiBubble: {
    backgroundColor: "rgba(255,255,255,0.04)",
    alignSelf: "flex-start",
    maxWidth: "85%",
  },
  bubbleAuthor: {
    fontSize: fontSize.xs,
    color: palette.textMuted,
    marginBottom: sp(1),
  },
  bubbleText: {
    fontSize: fontSize.md,
    color: palette.textPrimary,
    lineHeight: 22,
  },
  ctaSection: { gap: sp(3) },
  primaryCta: {
    paddingVertical: sp(4),
    borderRadius: borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...shadows.glow(palette.gold),
  },
  primaryCtaText: {
    color: palette.white,
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
  secondaryCta: {
    paddingVertical: sp(4),
    borderRadius: borderRadius.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  secondaryCtaText: {
    color: palette.textPrimary,
    fontSize: fontSize.md,
    fontFamily: fontFamily.medium,
  },
});
```

- [ ] **Step 8.4: Run + commit**

```bash
cd mobile && npm test -- PostCallScreen  # PASS
git add mobile/src/components/voice/PostCallScreen.tsx mobile/__tests__/components/voice/PostCallScreen.test.tsx
git commit -m "feat(mobile): add PostCallScreen Modal (transcript + 2 CTAs + upgrade banner)"
```

---

## Task 9: Wire Home screen — input + 2 CTA + clipboard banner + voice flow

**Files:**

- Modify: `mobile/app/(tabs)/index.tsx` (Home)

- [ ] **Step 9.1: Read current Home structure**

`cat mobile/app/(tabs)/index.tsx | head -50` to identify the existing input + Analyser button layout.

- [ ] **Step 9.2: Modify Home (full rewrite of the input section)**

In `mobile/app/(tabs)/index.tsx`:

1. Add imports at the top:

```typescript
import { useCallback, useState } from "react";
import { router } from "expo-router";
import { useClipboardURLDetector } from "../../src/hooks/useClipboardURLDetector";
import { useDeepLinkURL } from "../../src/hooks/useDeepLinkURL";
import { validateVideoURL } from "../../src/utils/validateVideoURL";
import { useVoiceChat } from "../../src/components/voice/useVoiceChat";
import { useStreamingVideoContext } from "../../src/components/voice/useStreamingVideoContext";
import { VoiceScreen } from "../../src/components/voice/VoiceScreen";
import { PostCallScreen } from "../../src/components/voice/PostCallScreen";
```

2. In the Home component body, add state and hooks:

```typescript
const [url, setUrl] = useState("");
const [voiceOpen, setVoiceOpen] = useState(false);
const [postCallOpen, setPostCallOpen] = useState(false);
const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);

const { clipboardURL, dismiss: dismissClipboard } = useClipboardURLDetector();

const voice = useVoiceChat({
  agentType: "explorer_streaming",
  // summaryId not used in streaming mode; backend creates it
});
const ctx = useStreamingVideoContext(voice.sessionId, voice.conversation);

const handleVoiceCall = useCallback(
  async (videoUrl: string) => {
    if (!validateVideoURL(videoUrl)) {
      // TODO: show toast "Source non supportée"
      return;
    }
    setActiveVideoUrl(videoUrl);
    setVoiceOpen(true);
    // useVoiceChat.start() needs to know videoUrl — adapt useVoiceChat to accept videoUrl in start()
    await voice.start({ videoUrl });
    dismissClipboard();
  },
  [voice, dismissClipboard],
);

const handleAnalyze = useCallback((videoUrl: string) => {
  if (!validateVideoURL(videoUrl)) return;
  // existing analyze flow — push to /analysis with the URL
  router.push({ pathname: "/analysis", params: { url: videoUrl } });
}, []);

useDeepLinkURL((deepUrl, autostart) => {
  setUrl(deepUrl);
  if (autostart) handleVoiceCall(deepUrl);
});

// Auto-show PostCall when voice idle but messages exist
useEffect(() => {
  if (voice.status === "idle" && voice.messages.length > 0 && voiceOpen) {
    setVoiceOpen(false);
    setPostCallOpen(true);
  }
}, [voice.status, voice.messages.length, voiceOpen]);
```

3. Replace the input/CTA section in the JSX:

```tsx
<View style={styles.inputCard}>
  {/* Clipboard banner */}
  {clipboardURL && (
    <Pressable
      onPress={() => handleVoiceCall(clipboardURL)}
      style={styles.clipboardBanner}
    >
      <Text style={styles.clipboardLabel}>
        📋 LIEN DÉTECTÉ DANS LE PRESSE-PAPIER
      </Text>
      <Text style={styles.clipboardURL} numberOfLines={1}>
        {clipboardURL.replace(/^https?:\/\//, "")}
      </Text>
      <Text style={styles.clipboardHint}>Tape pour appeler →</Text>
    </Pressable>
  )}

  {/* URL input */}
  <TextInput
    style={styles.urlInput}
    placeholder="🔗 Colle un lien YouTube ou TikTok…"
    placeholderTextColor={palette.textMuted}
    value={url}
    onChangeText={setUrl}
    autoCapitalize="none"
    autoCorrect={false}
    keyboardType="url"
  />

  {/* 2 CTA */}
  <View style={styles.ctaRow}>
    <Pressable
      style={[
        styles.cta,
        styles.ctaAnalyse,
        !validateVideoURL(url) && styles.ctaDisabled,
      ]}
      disabled={!validateVideoURL(url)}
      onPress={() => handleAnalyze(url)}
    >
      <LinearGradient
        colors={["#6366f1", "#8b5cf6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.ctaText}>📊 Analyser</Text>
    </Pressable>
    <Pressable
      style={[
        styles.cta,
        styles.ctaVoice,
        !validateVideoURL(url) && styles.ctaDisabled,
      ]}
      disabled={!validateVideoURL(url)}
      onPress={() => handleVoiceCall(url)}
    >
      <LinearGradient
        colors={[palette.gold, "#d97706"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text style={styles.ctaText}>🎙️ Voice Call</Text>
    </Pressable>
  </View>
</View>;

{
  /* Voice modal */
}
<VoiceScreen
  visible={voiceOpen}
  onClose={() => {
    voice.stop();
    setVoiceOpen(false);
  }}
  videoTitle={activeVideoUrl ?? ""}
  voiceStatus={voice.status}
  isSpeaking={voice.isSpeaking}
  messages={voice.messages}
  elapsedSeconds={voice.elapsedSeconds}
  remainingMinutes={voice.remainingMinutes}
  onStart={() => activeVideoUrl && voice.start({ videoUrl: activeVideoUrl })}
  onStop={() => {
    voice.stop();
  }}
  onMuteToggle={voice.toggleMute}
  isMuted={voice.isMuted}
  error={voice.error ?? undefined}
  streaming={true}
  contextProgress={ctx.contextProgress}
  contextComplete={ctx.contextComplete}
/>;

{
  /* Post-call modal */
}
<PostCallScreen
  visible={postCallOpen}
  onClose={() => setPostCallOpen(false)}
  videoTitle={activeVideoUrl ?? ""}
  summaryId={voice.summaryId} // exposed by extending useVoiceChat — see Step 9.3
  durationSeconds={voice.elapsedSeconds}
  messages={voice.messages}
  quotaRemaining={voice.remainingMinutes}
  onViewAnalysis={(id) => {
    setPostCallOpen(false);
    router.push(`/analysis/${id}`);
  }}
  onCallAnother={() => {
    setPostCallOpen(false);
    setUrl("");
    setActiveVideoUrl(null);
  }}
/>;
```

4. Add styles in the same file:

```typescript
inputCard: { padding: sp(4), gap: sp(3) },
clipboardBanner: {
  backgroundColor: "rgba(245,180,0,0.08)",
  borderColor: "rgba(245,180,0,0.4)",
  borderWidth: 1.5,
  borderRadius: borderRadius.md,
  padding: sp(3),
},
clipboardLabel: { fontSize: 10, color: palette.gold, fontFamily: fontFamily.bold, letterSpacing: 1 },
clipboardURL: { fontSize: fontSize.md, color: palette.textPrimary, marginTop: sp(1) },
clipboardHint: { fontSize: fontSize.xs, color: palette.gold, marginTop: sp(2) },
urlInput: {
  backgroundColor: "rgba(255,255,255,0.04)",
  borderColor: "rgba(255,255,255,0.08)",
  borderWidth: 1,
  borderRadius: borderRadius.md,
  padding: sp(3),
  fontSize: fontSize.md,
  color: palette.textPrimary,
},
ctaRow: { flexDirection: "row", gap: sp(2) },
cta: { flex: 1, paddingVertical: sp(4), borderRadius: borderRadius.md, alignItems: "center", justifyContent: "center", overflow: "hidden" },
ctaAnalyse: {},
ctaVoice: {},
ctaDisabled: { opacity: 0.4 },
ctaText: { color: palette.white, fontSize: fontSize.md, fontFamily: fontFamily.bold },
```

- [ ] **Step 9.3: Extend useVoiceChat to accept videoUrl in start() AND expose summaryId**

In `mobile/src/components/voice/useVoiceChat.ts`:

1. Update `UseVoiceChatOptions`:

```typescript
interface UseVoiceChatOptions {
  summaryId?: string;
  agentType?: VoiceAgentType | "explorer_streaming";
  onError?: (error: string) => void;
}
```

2. Update `start()` signature to accept optional `{ videoUrl }`:

```typescript
const start = useCallback(async (opts?: { videoUrl?: string }) => {
  // ... existing logic
  const sessionData = await voiceApi.createSession({
    summary_id: numericId,
    video_url: opts?.videoUrl,                  // NEW
    agent_type: opts?.videoUrl
      ? "explorer_streaming"
      : resolvedAgentType,
    language: "fr",
  });
  setRemainingMinutes(sessionData.quota_remaining_minutes);
  maxSecondsRef.current = sessionData.max_session_minutes * 60;
  sessionIdRef.current = sessionData.session_id;
  setSessionId(sessionData.session_id);
  setSummaryId(sessionData.summary_id ?? null);  // NEW
  // ...
}, [...deps, ...]);
```

3. Add `summaryId` state + return:

```typescript
const [summaryId, setSummaryId] = useState<number | null>(null);

return {
  // ... existing
  summaryId,
};
```

4. Reset `summaryId` to null in `stop()`.

- [ ] **Step 9.4: Run mobile typecheck + tests**

```bash
cd mobile && npm run typecheck
cd mobile && npm test
```

Expected: typecheck PASS, tests PASS (existing + new from PR2 tasks 1-9).

- [ ] **Step 9.5: Commit**

```bash
git add mobile/app/\(tabs\)/index.tsx mobile/src/components/voice/useVoiceChat.ts
git commit -m "feat(mobile): wire Home — paste + clipboard banner + 2 CTAs + voice flow + PostCallScreen"
```

---

## Task 10: Open PR2

- [ ] **Step 10.1: Verify PR1 backend is merged + deployed**

```bash
ssh -i ~/.ssh/id_hetzner root@89.167.23.214 "docker exec repo-backend-1 curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/api/voice/context/stream?session_id=ping"
```

Expected: `401` (endpoint exists, auth required). If `404` → PR1 not deployed yet, BLOCK.

- [ ] **Step 10.2: Open PR**

```bash
cd C:/Users/33667/DeepSight-quick-voice-mobile
gh pr create --title "feat(mobile): Quick Voice Call mobile V3 — PR2 mobile UI (paste + clipboard auto-detect + streaming variant + PostCall)" --body "$(cat <<'EOF'
## Summary

PR2 du Quick Voice Call mobile V3 : câble le Home (paste + clipboard auto-detect + 2 CTA), étend VoiceScreen avec une variante streaming, ajoute PostCallScreen.

- New: `validateVideoURL` util (mirror backend)
- New: `useClipboardURLDetector` hook (scan clipboard sur focus Home)
- New: `useDeepLinkURL` hook (deepsight://voice-call?url=...)
- New: `useStreamingVideoContext` hook (SSE → sendUserMessage [CTX UPDATE])
- Modify: `useVoiceChat` expose sessionId, conversation, summaryId; start() accepte videoUrl
- Modify: `voiceApi.createSession` accepte video_url
- Modify: `VoiceScreen` props streaming/contextProgress/contextComplete + ContextProgressBar
- New: `PostCallScreen` Modal (transcript + 2 CTAs + upgrade banner)
- Modify: Home (`app/(tabs)/index.tsx`) — input + 2 CTA + clipboard banner + voice flow

Spec: `docs/superpowers/specs/2026-04-27-quick-voice-call-mobile-v3-design.md` § 6, 7, 8
Plan: `docs/superpowers/plans/2026-04-27-quick-voice-call-mobile-v3-pr2-mobile.md`

⚠️ Dépend de PR1 backend mergée + déployée.

## Test plan

- [ ] `npm test` mobile → all pass
- [ ] `npm run typecheck` mobile → no error
- [ ] Manual smoke iOS/Android Expo Go : paste lien YT → tap Voice Call → vérifier appel démarre + agent dit "j'écoute la vidéo"
- [ ] Manual smoke : copier un lien TikTok → ouvrir l'app → vérifier bandeau gold "Lien détecté"
- [ ] Manual smoke : hangup pendant l'appel → vérifier PostCallScreen avec transcript + CTAs

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Checklist (run before merging PR2)

- [ ] All Task 1-10 steps completed
- [ ] `cd mobile && npm test` is green
- [ ] `cd mobile && npm run typecheck` is green
- [ ] No `TODO`/`FIXME` introduced
- [ ] Clipboard scan only triggers on Home focus (pas global)
- [ ] Deep link autostart=true → start() called with videoUrl
- [ ] `useStreamingVideoContext` cleans up EventSource on unmount
- [ ] `VoiceScreen` testID="context-progress-bar" only when streaming=true
- [ ] PostCallScreen primary CTA disabled when summaryId is undefined
- [ ] Banner upgrade only shown when quotaRemaining === 0

---

## Dependencies for PR3

PR3 (Native Share Extensions) requires PR2 merged. Verify post-deploy via TestFlight/Play Internal:

- Open the dev build of the app
- Verify deep link `deepsight://voice-call?url=https://youtu.be/dQw4w9WgXcQ&autostart=true` triggers Voice Call (paste manual into Notes app, tap link)
