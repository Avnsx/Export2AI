const fs = require("fs");
const path = require("path");
const { isGeneratedCommand } = require("./merge-package");

const root = path.join(__dirname, "..");
const pkgPath = path.join(root, "package.json");
const slimPath = path.join(root, "package.slim.json");

/** Strip generated commands/menus so the slim manifest stays the hand-written source of truth. */
function slimPackageJson(pkg) {
  const next = structuredClone(pkg);

  next.contributes.commands = pkg.contributes.commands.filter(
    (cmd) => !isGeneratedCommand(cmd.command)
  );

  next.contributes.menus["export2ai.submenu"] = [];

  if (Array.isArray(next.contributes.menus.commandPalette)) {
    next.contributes.menus.commandPalette = next.contributes.menus.commandPalette.filter(
      (item) => !isGeneratedCommand(item.command)
    );
  }

  return next;
}

if (require.main === module) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const slim = slimPackageJson(pkg);
  fs.writeFileSync(slimPath, `${JSON.stringify(slim, null, 2)}\n`);
  fs.writeFileSync(pkgPath, `${JSON.stringify(slim, null, 2)}\n`);
  console.log(
    `Slim package.json written (${(fs.statSync(pkgPath).size / 1024).toFixed(1)} KB). Source copy: package.slim.json`
  );
}

module.exports = { slimPackageJson };
