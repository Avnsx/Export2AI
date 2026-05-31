#!/usr/bin/env node
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

function resolveNpmCliFromPath() {
  if (process.platform !== "win32") {
    return undefined;
  }

  for (const entry of (process.env.PATH || "").split(path.delimiter)) {
    const npmCmd = path.join(entry, "npm.cmd");
    const npmCli = path.join(entry, "node_modules", "npm", "bin", "npm-cli.js");
    if (fs.existsSync(npmCmd) && fs.existsSync(npmCli)) {
      return npmCli;
    }
  }

  return undefined;
}

function resolveNpmBaseCommand() {
  const npmExecPath = process.env.npm_execpath || resolveNpmCliFromPath();
  if (npmExecPath) {
    return [process.execPath, npmExecPath];
  }

  try {
    return [process.execPath, require.resolve("npm/bin/npm-cli.js")];
  } catch {
    return [process.platform === "win32" ? "npm.cmd" : "npm"];
  }
}

const npmBaseCommand = resolveNpmBaseCommand();

function npmRun(scriptName) {
  return [...npmBaseCommand, "run", scriptName];
}

const TARGETS = [
  {
    name: "compile",
    description: "Generate menus, compile TypeScript, sync settings, and merge package.json.",
    commands: [npmRun("compile")]
  },
  {
    name: "tokens",
    description: "Token format, tokenizer routing, status labels, and manifest hygiene.",
    needsCompile: true,
    commands: [npmRun("test:tokens")]
  },
  {
    name: "explorer-badges",
    description: "Explorer decoration provider guard: badges off by default, opt-in only, outside-workspace clear.",
    needsCompile: true,
    commands: [npmRun("test:explorer-badges")]
  },
  {
    name: "debug-logger",
    description: "Debug setting scopes and Output-channel reveal behavior.",
    needsCompile: true,
    commands: [npmRun("test:debug-logger")]
  },
  {
    name: "comments",
    description: "Language-aware comment stripping and unchanged unknown file types.",
    needsCompile: true,
    commands: [npmRun("test:comments")]
  },
  {
    name: "model-format",
    description: "Model slugs, command slugs, folder-name caps, and zip filename shape.",
    needsCompile: true,
    commands: [npmRun("test:model-format")]
  },
  {
    name: "menu-merge",
    description: "Explorer submenu shape, palette hides, and no token-bucket commands.",
    needsCompile: true,
    commands: [npmRun("test:menu-merge")]
  },
  {
    name: "settings-nav",
    description: "Extension ID resolution, @ext settings route, and metadata sync.",
    needsCompile: true,
    commands: [npmRun("test:settings-nav")]
  },
  {
    name: "live",
    description: "End-to-end zip smoke test against the local source tree.",
    needsCompile: true,
    commands: [npmRun("test:live")]
  },
  {
    name: "package-assets",
    description: "Build the VSIX and verify packaged marketplace assets.",
    commands: [
      npmRun("package"),
      npmRun("test:marketplace-assets")
    ]
  }
];

function printUsage() {
  console.log("Usage:");
  console.log("  node tests/run-critical-tests.js                 # run all critical targets");
  console.log("  node tests/run-critical-tests.js --list          # list targets");
  console.log("  node tests/run-critical-tests.js tokens live     # run selected targets");
  console.log("  node tests/run-critical-tests.js --target tokens,live");
  console.log("  node tests/run-critical-tests.js tokens --skip-compile");
}

function listTargets() {
  console.log("Critical Export2AI test targets:");
  for (const [index, target] of TARGETS.entries()) {
    console.log(`${String(index + 1).padStart(2, " ")}. ${target.name} - ${target.description}`);
  }
}

function parseArgs(argv) {
  const selected = [];
  let list = false;
  let skipCompile = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    if (arg === "--list" || arg === "-l") {
      list = true;
      continue;
    }
    if (arg === "--skip-compile") {
      skipCompile = true;
      continue;
    }
    if (arg === "--target" || arg === "-t") {
      const value = argv[++i];
      if (!value) {
        throw new Error("--target requires a comma-separated target list");
      }
      selected.push(...value.split(",").map(item => item.trim()).filter(Boolean));
      continue;
    }
    if (arg.startsWith("--target=")) {
      selected.push(...arg.slice("--target=".length).split(",").map(item => item.trim()).filter(Boolean));
      continue;
    }
    selected.push(arg);
  }

  return { selected, list, skipCompile };
}

function resolveTargets(names) {
  if (names.length === 0) {
    return [...TARGETS];
  }

  const byName = new Map(TARGETS.map(target => [target.name, target]));
  const resolved = [];
  const seen = new Set();

  for (const name of names) {
    const target = byName.get(name);
    if (!target) {
      throw new Error(`Unknown critical test target "${name}". Run with --list to see valid targets.`);
    }
    if (!seen.has(target.name)) {
      resolved.push(target);
      seen.add(target.name);
    }
  }

  return resolved;
}

function commandLabel(command) {
  return command.map(part => (/\s/.test(part) ? JSON.stringify(part) : part)).join(" ");
}

function runCommand(command, targetName) {
  console.log(`\n[critical:${targetName}] ${commandLabel(command)}`);
  const useShellForCommandShim = process.platform === "win32" && /\.cmd$/i.test(command[0]);
  const result = spawnSync(command[0], command.slice(1), {
    cwd: repoRoot,
    env: process.env,
    shell: useShellForCommandShim,
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function needsCompileSetup(targets, skipCompile) {
  if (skipCompile) {
    return false;
  }
  const selectedCompile = targets.some(target => target.name === "compile");
  const selectedPackageAssets = targets.length === 1 && targets[0].name === "package-assets";
  return !selectedCompile && !selectedPackageAssets && targets.some(target => target.needsCompile);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.list) {
    listTargets();
    return;
  }

  const targets = resolveTargets(args.selected);
  const compileTarget = TARGETS[0];

  if (needsCompileSetup(targets, args.skipCompile)) {
    console.log("Preparing compiled output for selected target(s). Use --skip-compile to reuse existing out/.");
    for (const command of compileTarget.commands) {
      runCommand(command, "compile");
    }
  }

  for (const target of targets) {
    for (const command of target.commands) {
      runCommand(command, target.name);
    }
  }

  console.log(`\nCritical smoke targets passed: ${targets.map(target => target.name).join(", ")}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
