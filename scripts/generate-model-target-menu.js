const fs = require("fs");
const path = require("path");
const { MENU_TARGET_MODELS, formatModelCommandSlug } = require("./menu-target-models");

const generatedDir = path.join(__dirname, "generated");
const generatedPath = path.join(generatedDir, "model-target-contributes.json");

function buildKnownModelWhenClause(model) {
  return `config.export2ai.llmModel == '${model}'`;
}

function buildCustomModelWhenClause(models) {
  const parts = models.map((model) => `config.export2ai.llmModel != '${model}'`);
  return parts.join(" && ");
}

function generateModelTargetMenu() {
  const commands = [];
  const submenuItems = [];

  for (const model of MENU_TARGET_MODELS) {
    const slug = formatModelCommandSlug(model);
    const when = buildKnownModelWhenClause(model);

    commands.push({
      command: `export2ai.modelTarget.${slug}`,
      title: `Target model: ${model}`,
      category: "Export2AI",
      icon: "$(sparkle)"
    });
    submenuItems.push({
      command: `export2ai.modelTarget.${slug}`,
      when: `${when} && export2ai.enableTokenCounting`,
      group: "0_model@1"
    });

    commands.push({
      command: `export2ai.zipFor.${slug}`,
      title: `Zip Folder for ${model}`,
      category: "Export2AI",
      icon: "$(file-zip)"
    });
    submenuItems.push({
      command: `export2ai.zipFor.${slug}`,
      when: `${when} && !export2ai.enableTokenCounting`,
      group: "1_zip@1"
    });
  }

  commands.push({
    command: "export2ai.modelTarget.custom",
    title: "Target model: (custom — see Settings)",
    category: "Export2AI",
    icon: "$(sparkle)"
  });
  submenuItems.push({
    command: "export2ai.modelTarget.custom",
    when: `${buildCustomModelWhenClause(MENU_TARGET_MODELS)} && export2ai.enableTokenCounting`,
    group: "0_model@1"
  });

  commands.push({
    command: "export2ai.zipFor.custom",
    title: "Zip Folder (custom model in Settings)",
    category: "Export2AI",
    icon: "$(file-zip)"
  });
  submenuItems.push({
    command: "export2ai.zipFor.custom",
    when: `${buildCustomModelWhenClause(MENU_TARGET_MODELS)} && !export2ai.enableTokenCounting`,
    group: "1_zip@1"
  });

  // These commands only make sense inside the Explorer submenu (where the active model is known).
  // Hide them from the Command Palette so it is not polluted with one row per model.
  const commandPaletteItems = commands.map((cmd) => ({
    command: cmd.command,
    when: "false"
  }));

  fs.mkdirSync(generatedDir, { recursive: true });
  fs.writeFileSync(
    generatedPath,
    `${JSON.stringify({ commands, submenuItems, commandPaletteItems }, null, 2)}\n`
  );

  console.log(
    `Generated model-target-contributes.json with ${commands.length} commands, ${submenuItems.length} submenu entries, ${commandPaletteItems.length} command-palette hides.`
  );
}

if (require.main === module) {
  generateModelTargetMenu();
}

module.exports = { generateModelTargetMenu };
