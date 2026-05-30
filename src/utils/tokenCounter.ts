import { countTokens as countTokensO200k } from "gpt-tokenizer/cjs/encoding/o200k_base";
import { countTokens as countTokensCl100k } from "gpt-tokenizer/cjs/encoding/cl100k_base";
import { countTokens as countTokensAnthropic } from "@anthropic-ai/tokenizer";
import { TokenCountMethod, TokenInfo } from "../types";
import { countOpusModernTokens } from "./anthropicTokenizer";
import { detectFamily, usesAnthropicOpusModernTokenizer, usesOpenAiCl100k } from "./modelRegistry";
import {
  formatTokenCount,
  formatTokenUsageLabel
} from "./tokenFormat";

interface TokenizerSelection {
  count: (text: string) => number;
  method: TokenCountMethod;
  approximate: boolean;
}

const METHOD_LABEL: Record<TokenCountMethod, string> = {
  "openai-o200k": "exact",
  "openai-cl100k": "exact",
  "anthropic-opus-modern": "approx - Opus 4.7+ tokenizer uplift",
  "anthropic-legacy": "approx - Claude tokenizer",
  "chars-heuristic": "approx - chars/4 heuristic"
};

function selectTokenizer(model: string): TokenizerSelection {
  const family = detectFamily(model);

  if (family === "anthropic") {
    if (usesAnthropicOpusModernTokenizer(model)) {
      return {
        count: (text) => countOpusModernTokens(text),
        method: "anthropic-opus-modern",
        approximate: true
      };
    }
    return {
      count: (text) => countTokensAnthropic(text),
      method: "anthropic-legacy",
      approximate: true
    };
  }

  if (family === "openai") {
    if (usesOpenAiCl100k(model)) {
      return {
        count: (text) => countTokensCl100k(text),
        method: "openai-cl100k",
        approximate: false
      };
    }
    return {
      count: (text) => countTokensO200k(text),
      method: "openai-o200k",
      approximate: false
    };
  }

  return {
    count: (text) => Math.ceil(text.length / 4),
    method: "chars-heuristic",
    approximate: true
  };
}

export class TokenCounter {
  public static countTokens(content: string, model: string): TokenInfo {
    const tokenizer = selectTokenizer(model);
    return {
      inputTokens: tokenizer.count(content),
      method: tokenizer.method,
      approximate: tokenizer.approximate
    };
  }

  public static countFilesContent(files: ReadonlyArray<{ content: string }>, model: string): TokenInfo {
    const combined = files.map(f => f.content).join("\n");
    return this.countTokens(combined, model);
  }

  /**
   * Tokenize each file exactly once (selecting the tokenizer a single time) and return
   * per-file counts plus their sum. Used for single-pass per-directory aggregation so the
   * same file is never re-tokenized once per ancestor folder.
   *
   * The summed total may differ from {@link countFilesContent} by a few tokens (the latter
   * tokenizes the newline-joined corpus, so join boundaries can merge differently). The gap
   * is negligible for an estimate and invisible at badge granularity.
   */
  public static countFilesPerPath(
    files: ReadonlyArray<{ path: string; content: string }>,
    model: string
  ): { method: TokenCountMethod; approximate: boolean; total: number; perPath: Array<{ path: string; tokens: number }> } {
    const tokenizer = selectTokenizer(model);
    let total = 0;
    const perPath = files.map(file => {
      const tokens = tokenizer.count(file.content);
      total += tokens;
      return { path: file.path, tokens };
    });
    return { method: tokenizer.method, approximate: tokenizer.approximate, total, perPath };
  }

  public static formatTokenCount(tokenCount: number, approximate = false): string {
    return formatTokenCount(tokenCount, { approximate });
  }

  public static formatTokenLabel(tokenCount: number, approximate = false): string {
    return formatTokenUsageLabel(tokenCount, { approximate });
  }

  public static getMethodLabel(method: TokenCountMethod): string {
    return METHOD_LABEL[method];
  }
}

export { METHOD_LABEL };
