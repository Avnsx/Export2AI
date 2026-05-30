const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { buildExport2AISubmenu, isGeneratedCommand } = require("./merge-package");

const baseSubmenu = [
  { command: "export2ai.copyProjectStructure", group: "1_zip@2" },
  { command: "export2ai.openOutputFolder", group: "2_zip@2" },
  { command: "export2ai.openSettings", group: "3_zip@3" }
];

const modelTargetSubmenu = [
  {
    command: "export2ai.modelTarget.gpt-5-5",
    when: "config.export2ai.llmModel == 'gpt-5.5' && export2ai.enableTokenCounting",
    group: "0_model@1"
  }
];

const submenu = buildExport2AISubmenu(modelTargetSubmenu, baseSubmenu);

assert.ok(submenu.length < 50, "submenu stays small (no generated bucket rows)");
assert.ok(
  submenu.some(
    (item) =>
      item.command === "export2ai.zipSelectedFolder"
      && item.when === "export2ai.enableTokenCounting"
      && item.group === "1_zip@1"
  ),
  "token-counting zip uses stable export2ai.zipSelectedFolder row"
);

const bucketSubmenuRows = submenu.filter((item) =>
  String(item.command).startsWith("export2ai.zip.bucket.")
);
assert.strictEqual(bucketSubmenuRows.length, 0, "no token-bucket rows in the Explorer submenu");

assert.strictEqual(isGeneratedCommand("export2ai.modelTarget.gpt-5-5"), true, "modelTarget is generated");
assert.strictEqual(isGeneratedCommand("export2ai.zipFor.gpt-5-5"), true, "zipFor is generated");
assert.strictEqual(isGeneratedCommand("export2ai.zipSelectedFolder"), false, "base command is not generated");
assert.strictEqual(isGeneratedCommand("export2ai.zip.bucket.0"), false, "bucket commands no longer exist");

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
const commands = pkg.contributes.commands ?? [];
assert.ok(
  commands.some(
    (cmd) =>
      cmd.command === "export2ai.copyFileContent"
      && cmd.title === "Export2AI: Copy Content to Clipboard"
  ),
  "single-file copy command is contributed"
);

const explorerContext = pkg.contributes.menus["explorer/context"] ?? [];
assert.ok(
  explorerContext.some(
    (item) =>
      item.command === "export2ai.copyFileContent"
      && item.when === "!explorerResourceIsFolder && !explorerResourceIsRoot"
  ),
  "single-file right-click menu shows Copy Content to Clipboard"
);
assert.ok(
  !explorerContext.some(
    (item) =>
      item.command === "export2ai.copyProjectStructure"
      && String(item.when).includes("!explorerResourceIsFolder")
  ),
  "file right-click no longer shows Copy Project Structure"
);

const palette = pkg.contributes.menus.commandPalette ?? [];
assert.ok(
  palette.some((item) => item.command === "export2ai.copyFileContent" && item.when === "false"),
  "single-file copy command is hidden from Command Palette"
);

console.log(`test-menu-merge: ok (${submenu.length} submenu rows).`);
