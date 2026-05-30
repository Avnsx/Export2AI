const fs = require("fs");
const path = require("path");
const {
  applyExtensionMetadataSettings,
  defaultChangelogPath,
  readChangelogText
} = require("./extension-metadata");

function loadCommentStripModule(root) {
  const compiledPath = path.join(root, "out", "utils", "commentProfiles.js");
  if (!fs.existsSync(compiledPath)) {
    return undefined;
  }
  try {
    return require(compiledPath);
  } catch {
    return undefined;
  }
}

const root = path.join(__dirname, "..");
const slimPath = path.join(root, "package.slim.json");
const pkgPath = path.join(root, "package.json");
const modelTargetPath = path.join(__dirname, "generated", "model-target-contributes.json");
const baseMenuPath = path.join(__dirname, "submenu-base.json");

/** Commands produced by the model-target generator (never hand-written in the slim manifest). */
function isGeneratedCommand(commandId) {
  return (
    commandId.startsWith("export2ai.modelTarget.")
    || commandId.startsWith("export2ai.zipFor.")
  );
}

function buildExport2AISubmenu(modelTargetSubmenuItems, baseSubmenu) {
  return [
    ...modelTargetSubmenuItems,
    {
      command: "export2ai.zipSelectedFolder",
      when: "export2ai.enableTokenCounting",
      group: "1_zip@1"
    },
    ...baseSubmenu
  ];
}

function mergePackageManifest() {
  if (!fs.existsSync(slimPath)) {
    throw new Error("package.slim.json is missing. Run: node scripts/slim-package.js");
  }
  if (!fs.existsSync(modelTargetPath)) {
    throw new Error("model-target-contributes.json is missing. Run: npm run generate:menus");
  }

  const slim = JSON.parse(fs.readFileSync(slimPath, "utf8"));
  const modelTarget = JSON.parse(fs.readFileSync(modelTargetPath, "utf8"));
  const baseSubmenu = JSON.parse(fs.readFileSync(baseMenuPath, "utf8"));
  const changelogText = readChangelogText(defaultChangelogPath(root));

  if (!Array.isArray(modelTarget.commands) || modelTarget.commands.length === 0) {
    throw new Error("model-target-contributes.json has no commands. Run: npm run generate:menus");
  }

  const merged = structuredClone(slim);

  merged.contributes.commands = [
    ...slim.contributes.commands.filter((cmd) => !isGeneratedCommand(cmd.command)),
    ...modelTarget.commands
  ];

  merged.contributes.menus["export2ai.submenu"] = buildExport2AISubmenu(
    modelTarget.submenuItems,
    baseSubmenu
  );

  // Keep the Command Palette lean: only the hand-written base commands appear there.
  const slimPalette = (slim.contributes.menus.commandPalette ?? []).filter(
    (item) => !isGeneratedCommand(item.command)
  );
  merged.contributes.menus.commandPalette = [
    ...slimPalette,
    ...(modelTarget.commandPaletteItems ?? [])
  ];

  applyExtensionMetadataSettings(merged, changelogText, loadCommentStripModule(root));

  fs.writeFileSync(pkgPath, `${JSON.stringify(merged, null, 2)}\n`);

  const sizeKb = (fs.statSync(pkgPath).size / 1024).toFixed(1);
  console.log(
    `Merged package.json (${sizeKb} KB): ${merged.contributes.commands.length} commands, `
    + `${merged.contributes.menus["export2ai.submenu"].length} submenu items, `
    + `${merged.contributes.menus.commandPalette.length} command-palette rows.`
  );
}

if (require.main === module) {
  mergePackageManifest();
}

module.exports = { mergePackageManifest, buildExport2AISubmenu, isGeneratedCommand };
