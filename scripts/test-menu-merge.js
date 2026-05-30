const assert = require("assert");
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

console.log(`test-menu-merge: ok (${submenu.length} submenu rows).`);
