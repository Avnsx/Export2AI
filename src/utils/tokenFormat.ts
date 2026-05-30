const LOCALE = "en-US";

import { DEFAULT_LLM_MODEL } from "./modelRegistry";
import { formatModelDisplayName } from "./modelFormat";

export const TOOLTIP_SETTINGS_FOOTER = "Steer used Tokenizer Model, in Extension Settings.";

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

/** Status bar / notification label, e.g. "(est. ~47,382 tokens)". */
export function formatTokenUsageLabel(
  tokenCount: number,
  options: TokenDisplayOptions = {}
): string {
  const { approximate = false, includeSuffix = true } = options;
  const countLabel = formatTokenCount(tokenCount, { approximate });
  if (!includeSuffix) {
    return countLabel;
  }
  return `(est. ${countLabel} tokens)`;
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

/** Compact status-bar hover tooltip (not shown on Explorer badges). */
export function formatTokenTooltip(
  tokenCount: number,
  approximate: boolean,
  methodLabel?: string,
  llmModel?: string
): string {
  const countLabel = formatTokenCount(tokenCount, { approximate });
  const modelLabel = formatModelDisplayName(llmModel ?? DEFAULT_LLM_MODEL);
  const accuracy = approximate ? "approximate offline estimate" : "exact offline estimate";
  const methodHint = methodLabel && !methodLabel.startsWith("exact")
    ? ` (${methodLabel})`
    : "";

  return [
    `Active model: ${modelLabel} · ${countLabel} tokens — ${accuracy}${methodHint}.`,
    "",
    TOOLTIP_SETTINGS_FOOTER
  ].join("\n");
}
