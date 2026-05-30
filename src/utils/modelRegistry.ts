export type ModelFamily = "openai" | "anthropic" | "google" | "xai" | "deepseek" | "mistral" | "unknown";

export interface ModelInfo {
  maxInputTokens: number;
  family: ModelFamily;
}

/**
 * Default offline tokenizer target — latest ChatGPT flagship (GPT-5.5, OpenAI, April 2026).
 * Uses exact o200k encoding via gpt-tokenizer (same family as GPT-4o / GPT-5).
 * Keep in sync with export2ai.llmModel default in package.slim.json.
 */
export const DEFAULT_LLM_MODEL = "gpt-5.5";

export const MODEL_REGISTRY: Readonly<Record<string, ModelInfo>> = {
  "claude-opus-4-8": { maxInputTokens: 1000000, family: "anthropic" },
  "claude-opus-4-7": { maxInputTokens: 1000000, family: "anthropic" },
  "claude-opus-4-6": { maxInputTokens: 1000000, family: "anthropic" },
  "claude-sonnet-4-6": { maxInputTokens: 1000000, family: "anthropic" },
  "claude-haiku-4-5": { maxInputTokens: 200000, family: "anthropic" },
  "gpt-5.5-pro": { maxInputTokens: 1000000, family: "openai" },
  "gpt-5.5": { maxInputTokens: 1000000, family: "openai" },
  "gpt-5.4": { maxInputTokens: 400000, family: "openai" },
  "gpt-5": { maxInputTokens: 400000, family: "openai" },
  "gpt-4.1": { maxInputTokens: 1047576, family: "openai" },
  "gpt-4o": { maxInputTokens: 128000, family: "openai" },
  "gpt-4o-mini": { maxInputTokens: 128000, family: "openai" },
  "o3-mini": { maxInputTokens: 200000, family: "openai" },
  "o1": { maxInputTokens: 200000, family: "openai" },
  "gemini-3-pro": { maxInputTokens: 1048576, family: "google" },
  "gemini-2.5-pro": { maxInputTokens: 2000000, family: "google" }
};

const SORTED_KEYS = Object.keys(MODEL_REGISTRY).sort((a, b) => b.length - a.length);

export function resolveModel(model: string): ModelInfo | undefined {
  const normalized = model.trim().toLowerCase();
  if (MODEL_REGISTRY[normalized]) {
    return MODEL_REGISTRY[normalized];
  }
  for (const key of SORTED_KEYS) {
    if (normalized.startsWith(key)) {
      return MODEL_REGISTRY[key];
    }
  }
  return undefined;
}

export function detectFamily(model: string): ModelFamily {
  const resolved = resolveModel(model);
  if (resolved) {
    return resolved.family;
  }
  const m = model.trim().toLowerCase();
  if (m.startsWith("claude")) { return "anthropic"; }
  if (m.startsWith("gpt-") || m.startsWith("o1") || m.startsWith("o3") || m.startsWith("o4")) {
    return "openai";
  }
  if (m.startsWith("gemini")) { return "google"; }
  if (m.startsWith("grok")) { return "xai"; }
  if (m.startsWith("deepseek")) { return "deepseek"; }
  if (m.startsWith("mistral") || m.startsWith("mixtral")) { return "mistral"; }
  return "unknown";
}

/** GPT-3.5 and pre-4o GPT-4 use cl100k; modern ChatGPT (4o, 4.1, 5.x, o-series) use o200k. */
export function usesOpenAiCl100k(model: string): boolean {
  const m = model.trim().toLowerCase();
  if (m.startsWith("gpt-3.5")) {
    return true;
  }
  if (m.startsWith("gpt-4") && !m.startsWith("gpt-4o") && !m.startsWith("gpt-4.1")) {
    return true;
  }
  return false;
}

/** Opus 4.7 and 4.8 share Anthropic's updated tokenizer (not the pre-2026 legacy npm package). */
export function usesAnthropicOpusModernTokenizer(model: string): boolean {
  const m = model.trim().toLowerCase();
  return m.startsWith("claude-opus-4-7") || m.startsWith("claude-opus-4-8");
}
