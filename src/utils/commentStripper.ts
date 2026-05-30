import { BlockCommentRule, COMMENT_PROFILES, CommentProfile, resolveCommentProfile } from "./commentProfiles";

type StringQuote = "'" | '"' | "`";

interface ScanState {
  mode: "code" | "lineComment" | "blockComment" | "string";
  stringQuote?: StringQuote;
  blockRule?: BlockCommentRule;
  blockDepth: number;
}

function looksLikeMatlab(content: string): boolean {
  const head = content.slice(0, 800);
  return /^\s*(%|classdef\s|function\s)/m.test(head);
}

function resolveProfileForFile(relativePath: string, content: string): CommentProfile | undefined {
  const base = relativePath.split(/[/\\]/).pop()?.toLowerCase() ?? "";
  if (base.endsWith(".m")) {
    return looksLikeMatlab(content) ? COMMENT_PROFILES.matlab : COMMENT_PROFILES["c-family"];
  }
  return resolveCommentProfile(relativePath);
}

function startsWithAt(content: string, index: number, token: string): boolean {
  return content.startsWith(token, index);
}

function tryMatchBlockOpen(
  content: string,
  index: number,
  rules: readonly BlockCommentRule[]
): BlockCommentRule | undefined {
  let matched: BlockCommentRule | undefined;
  let matchedLen = 0;
  for (const rule of rules) {
    if (startsWithAt(content, index, rule.open) && rule.open.length > matchedLen) {
      matched = rule;
      matchedLen = rule.open.length;
    }
  }
  return matched;
}

function tryMatchLinePrefix(
  content: string,
  index: number,
  prefixes: readonly string[]
): string | undefined {
  let matched: string | undefined;
  let matchedLen = 0;
  for (const prefix of prefixes) {
    if (startsWithAt(content, index, prefix) && prefix.length > matchedLen) {
      matched = prefix;
      matchedLen = prefix.length;
    }
  }
  return matched;
}

function stripBatchLineComments(line: string): string {
  const trimmed = line.trimStart().toLowerCase();
  if (trimmed.startsWith("rem ") || trimmed === "rem") {
    return "";
  }
  if (trimmed.startsWith("::")) {
    return "";
  }
  return line;
}

function stripBatchComments(content: string): string {
  return content
    .split("\n")
    .map(stripBatchLineComments)
    .join("\n");
}

function stripWithProfile(content: string, profile: CommentProfile): string {
  if (profile.id === "batch") {
    return stripBatchComments(content);
  }

  let shebangLine = "";
  let body = content;
  if (profile.preserveShebang && body.startsWith("#!")) {
    const newline = body.indexOf("\n");
    if (newline === -1) {
      return body;
    }
    shebangLine = body.slice(0, newline + 1);
    body = body.slice(newline + 1);
  }

  const state: ScanState = { mode: "code", blockDepth: 0 };
  let out = "";
  let i = 0;

  while (i < body.length) {
    const ch = body[i];
    const next = body[i + 1];

    if (state.mode === "string") {
      out += ch;
      if (ch === "\\" && next !== undefined) {
        out += next;
        i += 2;
        continue;
      }
      if (ch === state.stringQuote) {
        state.mode = "code";
        state.stringQuote = undefined;
      }
      i += 1;
      continue;
    }

    if (state.mode === "lineComment") {
      if (ch === "\n") {
        state.mode = "code";
        out += ch;
      }
      i += 1;
      continue;
    }

    if (state.mode === "blockComment") {
      const rule = state.blockRule;
      if (!rule) {
        state.mode = "code";
        continue;
      }
      if (rule.nested && startsWithAt(body, i, rule.open)) {
        state.blockDepth += 1;
        i += rule.open.length;
        continue;
      }
      if (startsWithAt(body, i, rule.close)) {
        state.blockDepth -= 1;
        i += rule.close.length;
        if (state.blockDepth <= 0) {
          state.mode = "code";
          state.blockRule = undefined;
          state.blockDepth = 0;
        }
        continue;
      }
      i += 1;
      continue;
    }

    // code mode
    if (ch === '"' || ch === "'" || ch === "`") {
      state.mode = "string";
      state.stringQuote = ch as StringQuote;
      out += ch;
      i += 1;
      continue;
    }

    const blockRule = tryMatchBlockOpen(body, i, profile.blockRules);
    if (blockRule) {
      state.mode = "blockComment";
      state.blockRule = blockRule;
      state.blockDepth = 1;
      i += blockRule.open.length;
      continue;
    }

    const linePrefix = tryMatchLinePrefix(body, i, profile.linePrefixes);
    if (linePrefix) {
      state.mode = "lineComment";
      i += linePrefix.length;
      continue;
    }

    out += ch;
    i += 1;
  }

  return shebangLine + out;
}

/** Remove comments using language rules inferred from the file path. */
export function stripCommentsForFile(content: string, relativePath: string): string {
  const profile = resolveProfileForFile(relativePath, content);
  if (!profile) {
    return content;
  }
  return stripWithProfile(content, profile);
}

/** @deprecated Use stripCommentsForFile. C-family-only strip for tests/back-compat. */
export function stripCStyleComments(content: string): string {
  return stripWithProfile(content, COMMENT_PROFILES["c-family"]);
}

export { stripWithProfile };
