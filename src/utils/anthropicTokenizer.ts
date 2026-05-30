import { countTokens as countTokensAnthropicLegacy } from "@anthropic-ai/tokenizer";

/**
 * Opus 4.7+ (incl. 4.8) ships an updated tokenizer — same input can be 1.0–1.35×
 * more tokens vs pre-4.7 models. Anthropic has not published an offline npm
 * tokenizer for it; we uplift the legacy @anthropic-ai/tokenizer baseline using
 * content heuristics from https://www.anthropic.com/news/claude-opus-4-7
 */
export function estimateOpusModernUplift(text: string): number {
  const len = text.length;
  if (len === 0) {
    return 1;
  }

  const nonAsciiRatio = [...text].filter((char) => char.charCodeAt(0) > 127).length / len;
  if (nonAsciiRatio > 0.05) {
    return 1.2;
  }

  const structuralChars = (text.match(/[{[\]}":,]/g) ?? []).length / len;
  if (structuralChars > 0.06) {
    return 1.275;
  }

  const codeSignals = (text.match(/\b(import|export|function|class|const|return|def |async |=>)\b/g) ?? []).length;
  const lineCount = text.split("\n").length;
  if (codeSignals >= 3 || (lineCount > 20 && codeSignals >= 1)) {
    return 1.2;
  }

  if (codeSignals >= 1) {
    return 1.15;
  }

  return 1.05;
}

export function countOpusModernTokens(text: string): number {
  const base = countTokensAnthropicLegacy(text);
  return Math.ceil(base * estimateOpusModernUplift(text));
}
