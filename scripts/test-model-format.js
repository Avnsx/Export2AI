const assert = require("assert");
const {
  buildZipArchiveFileName,
  formatModelFileSlug,
  formatModelCommandSlug,
  formatFolderNameSegment,
  formatCompactTimestamp,
  MAX_FOLDER_NAME_SEGMENT
} = require("../out/utils/modelFormat");

assert.strictEqual(formatModelFileSlug("gpt-5.5"), "gpt-5.5", "file slug keeps version dots");
assert.strictEqual(formatModelCommandSlug("gpt-5.5"), "gpt-5-5", "command slug dashes dots");

// Compact timestamp: YYYY-MM-DD-HHMMSS
assert.strictEqual(
  formatCompactTimestamp(new Date("2026-05-30T18:26:17.906Z")),
  "2026-05-30-182617",
  "compact timestamp drops T/Z/millis"
);

// Folder segment: only the last path piece, no nested clutter.
assert.strictEqual(
  formatFolderNameSegment("y/HOST_ROOT/WinMGT"),
  "WinMGT",
  "uses last path segment only"
);
assert.strictEqual(
  formatFolderNameSegment("C:\\Users\\me\\My Project"),
  "My-Project",
  "backslash path + spaces collapsed"
);
assert.strictEqual(formatFolderNameSegment(""), "workspace", "empty falls back to workspace");
assert.ok(
  formatFolderNameSegment("a".repeat(120)).length <= MAX_FOLDER_NAME_SEGMENT,
  "long folder name is capped"
);

// Full filename, compact and descriptive.
assert.strictEqual(
  buildZipArchiveFileName("my-app", "claude-opus-4-8", "2026-05-30-120000"),
  "my-app-claude-opus-4-8-context-2026-05-30-120000.zip",
  "zip archive name"
);
assert.strictEqual(
  buildZipArchiveFileName("y/HOST_ROOT/WinMGT", "gpt-5.5", "2026-05-30-182617"),
  "WinMGT-gpt-5.5-context-2026-05-30-182617.zip",
  "nested source path collapses to folder basename"
);

console.log("test-model-format: ok");
