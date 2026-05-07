// extension/e2e/voice-leak-utils/llm-client.ts
//
// Pluggable LLM client used by the LIVE variant of the leak-detection
// spec. Auto-detects which provider is available from process.env and
// falls back to ``null`` (test skipped) if none.
//
// Provider precedence: MISTRAL → ANTHROPIC → OPENAI. Mistral is the
// production model behind ``EXPLORER_STREAMING_PROMPT_FR/EN`` so we
// prefer it when its key is present; the others are useful for local
// dev when only one key is around.
//
// All provider implementations expose the same minimal shape :
//   * ``name``  : human-readable label, surfaces in test reports
//   * ``ask()`` : (system, history) -> assistant text
//
// We intentionally DO NOT use any provider SDK — a tiny ``fetch`` is
// enough and avoids dragging 50 MB of deps into the extension's E2E
// tooling. If one provider's auth fails at request time, the spec
// reports the exception and skips the live branch.

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmClient {
  name: string;
  ask: (messages: LlmMessage[]) => Promise<string>;
}

function getEnv(name: string): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = (process.env as any)[name];
  if (typeof v !== "string") return undefined;
  // Some shells store keys wrapped in quotes (export FOO='"value"') —
  // the shell exposes the literal quotes. Strip them defensively.
  return v.replace(/^"|"$/g, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// Mistral
// ─────────────────────────────────────────────────────────────────────────────

function makeMistralClient(apiKey: string): LlmClient {
  return {
    name: "mistral",
    ask: async (messages) => {
      const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mistral-small-latest",
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          max_tokens: 400,
          temperature: 0.5,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Mistral ${res.status}: ${t.slice(0, 200)}`);
      }
      const json = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      return json.choices[0]?.message?.content ?? "";
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Anthropic
// ─────────────────────────────────────────────────────────────────────────────

function makeAnthropicClient(apiKey: string): LlmClient {
  const base =
    getEnv("ANTHROPIC_BASE_URL") || "https://api.anthropic.com";
  return {
    name: "anthropic",
    ask: async (messages) => {
      // Anthropic puts system separately, not as a role.
      const system = messages
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n\n");
      const userAssistant = messages.filter((m) => m.role !== "system");
      const res = await fetch(`${base}/v1/messages`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 400,
          system,
          messages: userAssistant.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Anthropic ${res.status}: ${t.slice(0, 200)}`);
      }
      const json = (await res.json()) as {
        content: Array<{ type: string; text?: string }>;
      };
      return (
        json.content
          ?.filter((b) => b.type === "text")
          .map((b) => b.text ?? "")
          .join("\n") ?? ""
      );
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI
// ─────────────────────────────────────────────────────────────────────────────

function makeOpenAiClient(apiKey: string): LlmClient {
  return {
    name: "openai",
    ask: async (messages) => {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          max_tokens: 400,
          temperature: 0.5,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`OpenAI ${res.status}: ${t.slice(0, 200)}`);
      }
      const json = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      return json.choices[0]?.message?.content ?? "";
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-detect
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inspect the environment and return the first available client, or
 * ``null`` if none. Override the precedence with
 * ``DEEPSIGHT_LIVE_LLM=mistral|anthropic|openai`` for local dev.
 */
export function detectLiveLlm(): LlmClient | null {
  const force = (getEnv("DEEPSIGHT_LIVE_LLM") || "").toLowerCase();
  const mistral = getEnv("MISTRAL_API_KEY");
  const anthropic = getEnv("ANTHROPIC_API_KEY");
  const openai = getEnv("OPENAI_API_KEY");

  if (force === "mistral" && mistral) return makeMistralClient(mistral);
  if (force === "anthropic" && anthropic) return makeAnthropicClient(anthropic);
  if (force === "openai" && openai) return makeOpenAiClient(openai);

  if (mistral) return makeMistralClient(mistral);
  if (anthropic) return makeAnthropicClient(anthropic);
  if (openai) return makeOpenAiClient(openai);
  return null;
}
