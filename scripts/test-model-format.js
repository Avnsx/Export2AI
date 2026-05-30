const assert = require("assert");
const {
  buildZipArchiveFileName,
  formatModelFileSlug,
  formatModelCommandSlug
} = require("../out/utils/modelFormat");

assert.strictEqual(formatModelFileSlug("gpt-5.5"), "gpt-5.5", "file slug keeps version dots");
assert.strictEqual(formatModelCommandSlug("gpt-5.5"), "gpt-5-5", "command slug dashes dots");
assert.strictEqual(
  buildZipArchiveFileName("my-app", "claude-opus-4-8", "2026-05-30T12-00-00-000Z"),
  "my-app-claude-opus-4-8-context-2026-05-30T12-00-00-000Z.zip",
  "zip archive name"
);

console.log("test-model-format: ok");
