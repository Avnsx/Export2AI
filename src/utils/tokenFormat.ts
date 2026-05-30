const LOCALE = "en-US";

import { DEFAULT_LLM_MODEL } from "./modelRegistry";
import { formatModelDisplayName } from "./modelFormat";

export const TOOLTIP_SETTINGS_FOOTER = "Steer used Tokenizer Model, in Extension Settings.";

/** Plain-text compatibility chart shown in status bar / explorer tooltips. */
export const TOKENIZER_COMPATIBILITY_CHART = [
  "Compatible models (offline tokenizers):",
  `  OpenAI      ${DEFAULT_LLM_MODEL} (default), gpt-5.4, gpt-4o, o3-mini`,
  "              exact (gpt-tokenizer o200k — ChatGPT modern models)",
  "  OpenAI      gpt-4, gpt-3.5-turbo",
  "              exact (gpt-tokenizer cl100k, legacy)",
  "  Anthropic   claude-opus-4-8, claude-opus-4-7, claude-sonnet-4-6",
  "              ~approx (Opus 4.7+ uses updated tokenizer uplift)",
  "  Anthropic   claude-haiku-4-5, claude-opus-4-6",
  "              ~approx (legacy Claude tokenizer, ~1–2% off)",
  "  Other       gemini-2.5-pro, grok-3, deepseek-*",
  "              ~approx (characters ÷ 4 heuristic)"
] as const;

export interface TokenDisplayOptions {
  approximate?: boolean;
  includeSuffix?: boolean;
}

/** Full written-out token count, e.g. "~47,382" or "47,382". */
export function formatTokenCount(
  tokenCount: number,
  options: TokenDisplayOptions = {}
): string {
  const { approximate = false } = options;
  const rounded = Math.max(0, Math.floor(tokenCount));
  const formatted = rounded.toLocaleString(LOCALE);
  return approximate ? `~${formatted}` : formatted;
}

/** Status bar / notification label, e.g. "(~47,382 tokens will be used)". */
export function formatTokenUsageLabel(
  tokenCount: number,
  options: TokenDisplayOptions = {}
): string {
  const { approximate = false, includeSuffix = true } = options;
  const countLabel = formatTokenCount(tokenCount, { approximate });
  if (!includeSuffix) {
    return countLabel;
  }
  return `(${countLabel} tokens will be used)`;
}

/** Status bar primary label — model matches export2ai.llmModel. */
export function formatStatusBarZipLabel(
  model: string,
  tokenCount: number,
  approximate: boolean
): string {
  const display = formatModelDisplayName(model);
  return `${display} · ${formatTokenUsageLabel(tokenCount, { approximate, includeSuffix: true })}`;
}
/** Explorer badge (VS Code allows at most two characters). */
export function formatTokenBadge(tokenCount: number): string | undefined {
  const count = Math.max(0, Math.floor(tokenCount));
  if (count === 0) {
    return undefined;
  }
  if (count < 1000) {
    return count <= 99 ? String(count) : "99";
  }
  if (count < 1_000_000) {
    const thousands = Math.round(count / 1000);
    if (thousands <= 9) {
      return `${thousands}k`;
    }
    if (thousands <= 99) {
      return `${thousands}k`.slice(0, 2);
    }
    return "99";
  }
  const millions = Math.round(count / 100_000) / 10;
  if (millions < 10) {
    return `${Math.floor(millions)}m`.slice(0, 2);
  }
  return "9m";
}

export function formatTokenTooltip(
  tokenCount: number,
  approximate: boolean,
  methodLabel?: string,
  llmModel?: string
): string {
  const countLabel = formatTokenCount(tokenCount, { approximate });
  const methodSuffix = methodLabel ? ` (${methodLabel})` : "";
  const modelLabel = formatModelDisplayName(llmModel ?? DEFAULT_LLM_MODEL);
  const lines = [
    `${modelLabel} · ${countLabel} tokens will be used if this folder is zipped for AI${methodSuffix}`,
    "",
    ...TOKENIZER_COMPATIBILITY_CHART
  ];

  if (llmModel?.trim()) {
    lines.push("", `Active setting: ${llmModel.trim()}`);
  }

  lines.push("", TOOLTIP_SETTINGS_FOOTER);
  return lines.join("\n");
}
