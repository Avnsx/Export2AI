const fs = require("fs");
const path = require("path");
const { getConfigurationProperty } = require("./configuration-utils");
const { countTokens: countTokensAnthropic } = require("@anthropic-ai/tokenizer");
const { countTokens: countTokensO200k } = require("gpt-tokenizer/cjs/encoding/o200k_base");
const {
  formatTokenCount,
  formatTokenUsageLabel,
  formatStatusBarZipLabel,
  formatTokenBadge,
  formatTokenTooltip
} = require("../out/utils/tokenFormat");
const { TokenCounter } = require("../out/utils/tokenCounter");
const { DEFAULT_LLM_MODEL, usesOpenAiCl100k, usesAnthropicOpusModernTokenizer, resolveModel } = require("../out/utils/modelRegistry");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function testDefaultModelRouting() {
  assert(DEFAULT_LLM_MODEL === "gpt-5.5", "DEFAULT_LLM_MODEL is gpt-5.5");

  const sample = "hello world from export2ai";
  const defaultInfo = TokenCounter.countTokens(sample, DEFAULT_LLM_MODEL);
  assert(!defaultInfo.approximate, "default model is exact count");
  assert(defaultInfo.method === "openai-o200k", "default model uses o200k");

  const gpt55Pro = TokenCounter.countTokens(sample, "gpt-5.5-pro");
  assert(gpt55Pro.method === "openai-o200k" && !gpt55Pro.approximate, "gpt-5.5-pro uses o200k");

  const thinkingVariant = TokenCounter.countTokens(sample, "gpt-5.5-thinking");
  assert(thinkingVariant.method === "openai-o200k", "gpt-5.5-thinking prefix matches o200k");

  const legacy = TokenCounter.countTokens(sample, "gpt-4-turbo");
  assert(legacy.method === "openai-cl100k" && !legacy.approximate, "legacy gpt-4 uses cl100k");

  assert(usesOpenAiCl100k("gpt-4") === true, "gpt-4 is legacy");
  assert(usesOpenAiCl100k("gpt-5.5") === false, "gpt-5.5 is modern");
  assert(usesOpenAiCl100k("gpt-4o") === false, "gpt-4o is modern");

  const o200kDirect = countTokensO200k(sample);
  assert(defaultInfo.inputTokens === o200kDirect, "default count matches gpt-tokenizer o200k");

  console.log("default model routing: ok");
}

function testOpusModernSupport() {
  const codeSample = [
    "import { TokenCounter } from './tokenCounter';",
    "export function zipFolder() { return TokenCounter.countTokens(text, model); }"
  ].join("\n").repeat(200);

  assert(usesAnthropicOpusModernTokenizer("claude-opus-4-8"), "4.8 modern");
  assert(usesAnthropicOpusModernTokenizer("claude-opus-4-7"), "4.7 modern");
  assert(usesAnthropicOpusModernTokenizer("claude-opus-4-7-20260416"), "dated 4.7 modern");
  assert(usesAnthropicOpusModernTokenizer("claude-opus-4-8-20260528"), "dated 4.8 modern");
  assert(!usesAnthropicOpusModernTokenizer("claude-opus-4-6"), "4.6 not modern");
  assert(!usesAnthropicOpusModernTokenizer("claude-sonnet-4-6"), "sonnet not modern");

  const opus48 = TokenCounter.countTokens(codeSample, "claude-opus-4-8");
  const opus47 = TokenCounter.countTokens(codeSample, "claude-opus-4-7");
  const sonnet = TokenCounter.countTokens(codeSample, "claude-sonnet-4-6");
  const legacyBase = countTokensAnthropic(codeSample);

  assert(opus48.method === "anthropic-opus-modern" && opus48.approximate, "opus 4.8 method");
  assert(opus47.method === "anthropic-opus-modern", "opus 4.7 method");
  assert(sonnet.method === "anthropic-legacy", "sonnet legacy");
  assert(opus48.inputTokens > legacyBase, "opus 4.8 uplifted above legacy");
  assert(opus48.inputTokens === opus47.inputTokens, "4.7 and 4.8 share tokenizer");
  assert(sonnet.inputTokens === legacyBase, "sonnet uses raw legacy count");
  assert(resolveModel("claude-opus-4-8").maxInputTokens === 1000000, "4.8 context window");

  const jsonSample = '{"key":"value","items":[1,2,3]}'.repeat(500);
  const jsonOpus = TokenCounter.countTokens(jsonSample, "claude-opus-4-8");
  const jsonLegacy = countTokensAnthropic(jsonSample);
  assert(jsonOpus.inputTokens >= Math.ceil(jsonLegacy * 1.2), "json gets higher uplift");

  const srcDir = path.join(__dirname, "..", "src");
  const srcFiles = fs.readdirSync(srcDir).filter((name) => name.endsWith(".ts"));
  const srcCombined = srcFiles
    .slice(0, 5)
    .map((name) => fs.readFileSync(path.join(srcDir, name), "utf8"))
    .join("\n");
  const srcOpus = TokenCounter.countTokens(srcCombined, "claude-opus-4-8");
  const srcLegacy = countTokensAnthropic(srcCombined);
  assert(srcOpus.inputTokens >= srcLegacy, "real src sample uplifted for opus 4.8");

  console.log(
    `opus modern: ok (code ${legacyBase} -> ${opus48.inputTokens}, json ${jsonLegacy} -> ${jsonOpus.inputTokens}, src ${srcLegacy} -> ${srcOpus.inputTokens})`
  );
}

function testFormatters() {
  assert(formatTokenCount(47382, { approximate: true }) === "~47,382", "approx count");
  assert(formatTokenCount(47382, { approximate: false }) === "47,382", "exact count no tilde");
  assert(formatTokenCount(0) === "0", "zero count");
  assert(
    formatTokenUsageLabel(12500, { approximate: true }) === "(est. ~12,500 tokens)",
    "usage label approx"
  );
  assert(
    formatTokenUsageLabel(12500, { approximate: false }) === "(est. 12,500 tokens)",
    "usage label exact"
  );
  assert(
    formatStatusBarZipLabel("gpt-5.5", 47382, true)
      === "gpt-5.5 · (est. ~47,382 tokens)",
    "status bar label approx with model"
  );
  assert(
    formatStatusBarZipLabel("claude-opus-4-8", 47382, false)
      === "claude-opus-4-8 · (est. 47,382 tokens)",
    "status bar label exact with model"
  );
  assert(formatTokenBadge(47382) === "47", "badge 47k truncated to 2 chars");
  assert(formatTokenBadge(850) === "99", "badge caps at 99");
  assert(formatTokenBadge(42) === "42", "badge small count");

  const tooltip = formatTokenTooltip(47382, false, "exact", DEFAULT_LLM_MODEL);
  assert(tooltip.includes("47,382") && !tooltip.includes("~47,382"), "tooltip exact count");
  assert(tooltip.includes("Active model: gpt-5.5"), "tooltip active model");
  assert(tooltip.includes("exact offline estimate"), "tooltip accuracy hint");
  assert(!tooltip.includes("Compatible models"), "tooltip has no model chart");
  assert(!tooltip.includes("will be used"), "tooltip avoids consumption phrasing");
  assert(tooltip.endsWith("Steer used Tokenizer Model, in Extension Settings."), "tooltip footer");

  const claudeTooltip = formatTokenTooltip(47382, true, "approx - Claude tokenizer", "claude-sonnet-4-6");
  assert(claudeTooltip.includes("~47,382"), "claude tooltip approx");
  assert(claudeTooltip.includes("approximate offline estimate"), "claude tooltip accuracy");

  const zeroTooltip = formatTokenTooltip(0, false, "exact", DEFAULT_LLM_MODEL);
  assert(zeroTooltip.includes("0 tokens"), "zero-count tooltip");

  const emptyModelTooltip = formatTokenTooltip(100, true, undefined, "");
  assert(emptyModelTooltip.includes(`Active model: ${DEFAULT_LLM_MODEL}`), "empty model falls back to default");

  assert(!formatTokenTooltip(100, false, "exact", "gpt-5.5").includes("Compatible models"), "no chart leak");

  console.log("formatters: ok");
}

function testLiveTokenizer() {
  const sample = "export2ai token counting live test ".repeat(2500);

  const anthropicTokens = countTokensAnthropic(sample);
  assert(anthropicTokens > 10000, `anthropic sample exceeds 10k tokens (got ${anthropicTokens})`);
  const anthropicLabel = formatStatusBarZipLabel("claude-sonnet-4-6", anthropicTokens, true);
  assert(anthropicLabel.includes("~"), "anthropic label includes approximate marker");

  const defaultInfo = TokenCounter.countTokens(sample, DEFAULT_LLM_MODEL);
  assert(defaultInfo.inputTokens > 10000, `default model exceeds 10k (got ${defaultInfo.inputTokens})`);
  assert(!defaultInfo.approximate, "default live count is exact");
  const defaultLabel = formatStatusBarZipLabel(DEFAULT_LLM_MODEL, defaultInfo.inputTokens, false);
  assert(!defaultLabel.includes("~"), "default label has no approximate marker");
  assert(
    defaultLabel.includes(defaultInfo.inputTokens.toLocaleString("en-US")),
    "default label includes exact formatted count"
  );

  console.log(
    `live tokenizer: ok (anthropic ${anthropicTokens.toLocaleString()}, ${DEFAULT_LLM_MODEL} ${defaultInfo.inputTokens.toLocaleString()} tokens)`
  );
}

function testPerFileAggregation() {
  const files = [
    { path: "a.ts", content: "const a = 1;\n".repeat(40) },
    { path: "src/b.ts", content: "function b() { return 2; }\n".repeat(40) },
    { path: "src/utils/c.ts", content: "export const c = 3;\n".repeat(40) }
  ];

  const perFile = TokenCounter.countFilesPerPath(files, DEFAULT_LLM_MODEL);
  assert(perFile.perPath.length === files.length, "one entry per file");
  assert(perFile.perPath.every((entry) => entry.tokens > 0), "each file has positive tokens");

  const summed = perFile.perPath.reduce((acc, entry) => acc + entry.tokens, 0);
  assert(summed === perFile.total, "perPath tokens sum to total");

  // The summed estimate must track the joined count closely (differs only by join-boundary tokens).
  const joined = TokenCounter.countFilesContent(files, DEFAULT_LLM_MODEL);
  const delta = Math.abs(joined.inputTokens - perFile.total);
  assert(delta <= files.length * 2, `summed estimate within boundary tolerance (delta ${delta})`);

  assert(perFile.method === joined.method, "per-file method matches single-pass method");
  assert(perFile.approximate === joined.approximate, "per-file approximate flag matches");

  // Aggregating per-file counts up the directory chain reproduces the directory subtree sums.
  const dirTotals = new Map();
  for (const { path: relativePath, tokens } of perFile.perPath) {
    const segments = relativePath.split("/");
    segments.pop();
    dirTotals.set("", (dirTotals.get("") ?? 0) + tokens);
    let prefix = "";
    for (const segment of segments) {
      prefix = prefix ? `${prefix}/${segment}` : segment;
      dirTotals.set(prefix, (dirTotals.get(prefix) ?? 0) + tokens);
    }
  }
  assert(dirTotals.get("") === perFile.total, "root aggregates every file");
  assert(
    dirTotals.get("src") === perFile.perPath[1].tokens + perFile.perPath[2].tokens,
    "src subtree sums its descendants"
  );
  assert(dirTotals.get("src/utils") === perFile.perPath[2].tokens, "nested folder sums its own file");

  console.log(`per-file aggregation: ok (total ${perFile.total}, joined ${joined.inputTokens})`);
}

function testManifestHygiene() {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  const commands = pkg.contributes.commands;

  const bucketCommands = commands.filter((cmd) => cmd.command.startsWith("export2ai.zip.bucket."));
  assert(bucketCommands.length === 0, "no token-bucket commands remain in the manifest");

  const generated = commands.filter(
    (cmd) => cmd.command.startsWith("export2ai.modelTarget.") || cmd.command.startsWith("export2ai.zipFor.")
  );
  assert(generated.length > 0, "model-target commands present");

  const palette = pkg.contributes.menus.commandPalette ?? [];
  for (const cmd of generated) {
    const hidden = palette.find((item) => item.command === cmd.command);
    assert(hidden && hidden.when === "false", `${cmd.command} hidden from command palette`);
  }

  assert(commands.length < 200, `manifest command count is lean (got ${commands.length})`);
  assert(
    getConfigurationProperty(pkg, "export2ai.llmModel").default === DEFAULT_LLM_MODEL,
    "package.json default matches DEFAULT_LLM_MODEL"
  );
  assert(
    getConfigurationProperty(pkg, "export2ai.enableTokenCounting").default === true,
    "token counting remains enabled by default"
  );
  assert(
    getConfigurationProperty(pkg, "export2ai.showExplorerTokenBadges").default === false,
    "Explorer token badges are opt-in by default"
  );
  console.log(`manifest hygiene: ok (${commands.length} commands, no bucket commands, generated rows hidden from palette)`);
}

(async () => {
  testDefaultModelRouting();
  testOpusModernSupport();
  testFormatters();
  testLiveTokenizer();
  testPerFileAggregation();
  testManifestHygiene();
  console.log("All token format tests passed.");
})().catch((error) => {
  console.error("Token format tests failed:", error);
  process.exit(1);
});
