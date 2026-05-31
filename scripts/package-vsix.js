const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const packageJsonPath = path.join(root, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const buildDir = path.join(root, "build");
const vscePath = path.join(root, "node_modules", "@vscode", "vsce", "vsce");
const outputPath = path.join(buildDir, `export2ai-${packageJson.version}.vsix`);

fs.mkdirSync(buildDir, { recursive: true });

console.log(`Packaging VSIX to ${path.relative(root, outputPath)}`);

const result = spawnSync(
  process.execPath,
  ["--disable-warning=DEP0040", vscePath, "package", "--out", outputPath],
  {
    cwd: root,
    env: process.env,
    stdio: "inherit"
  }
);

if (result.error) {
  console.error(`Failed to run vsce: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
