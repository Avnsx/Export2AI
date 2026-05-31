#!/usr/bin/env node
/**
 * Build a compact, human-friendly GitHub Release body for a given version.
 *
 * - Reads the version from package.slim.json (or --version).
 * - Extracts that version's section from CHANGELOG.md.
 * - Wraps it with a short intro + install instructions.
 *
 * Usage:
 *   node scripts/release-notes.js                 # current version → stdout
 *   node scripts/release-notes.js --version 1.2.3
 *   node scripts/release-notes.js --output notes.md
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--version" || token === "-v") {
      args.version = argv[++i];
    } else if (token === "--output" || token === "-o") {
      args.output = argv[++i];
    }
  }
  return args;
}

function readVersion(explicit) {
  if (explicit) {
    return explicit.replace(/^v/i, "").trim();
  }
  const slim = JSON.parse(fs.readFileSync(path.join(root, "package.slim.json"), "utf8"));
  return String(slim.version).trim();
}

/** Pull the `## [version] - date` block out of CHANGELOG.md (until the next `## [` heading). */
function extractChangelogSection(version) {
  const changelogPath = path.join(root, "CHANGELOG.md");
  if (!fs.existsSync(changelogPath)) {
    return { body: "", date: "" };
  }
  const lines = fs.readFileSync(changelogPath, "utf8").split(/\r?\n/);
  const headingRe = /^##\s+\[([^\]]+)\]\s*-?\s*(.*)$/;

  let start = -1;
  let date = "";
  for (let i = 0; i < lines.length; i += 1) {
    const match = headingRe.exec(lines[i]);
    if (match && match[1].trim() === version) {
      start = i + 1;
      date = match[2].trim();
      break;
    }
  }
  if (start === -1) {
    return { body: "", date: "" };
  }

  const collected = [];
  for (let i = start; i < lines.length; i += 1) {
    if (headingRe.test(lines[i])) {
      break;
    }
    collected.push(lines[i]);
  }

  return { body: collected.join("\n").trim(), date };
}

function buildReleaseBody(version, section) {
  const vsixName = `export2ai-${version}.vsix`;
  const localVsixPath = `build/${vsixName}`;
  const dateLine = section.date ? `_Released ${section.date}._\n\n` : "";

  const changelog = section.body
    ? section.body
    : "_See [CHANGELOG.md](./CHANGELOG.md) for details._";

  return `## Export2AI v${version}

${dateLine}**Export2AI** turns any workspace folder into a clean, AI-ready \`.zip\` — it skips junk like \`node_modules\`, optionally strips comments and compresses code, and shows an offline token estimate for your target model (exact for OpenAI, approximate for others).

### What's in this release

${changelog}

### Install

**From the VSIX (this release):**

1. Download \`${vsixName}\` from the assets below.
2. In Cursor / VS Code: **Extensions → ⋯ → Install from VSIX…** and pick the file.
   _Or from a terminal:_ \`code --install-extension ${vsixName}\`

**From source:**

\`\`\`bash
npm install
npm run package   # builds ${localVsixPath}
\`\`\`

---

Licensed under the [GNU General Public License v3.0](./LICENSE.txt).
`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const version = readVersion(args.version);
  const section = extractChangelogSection(version);
  const body = buildReleaseBody(version, section);

  if (args.output) {
    fs.writeFileSync(path.join(root, args.output), body);
    console.error(`Release notes for v${version} written to ${args.output}`);
  } else {
    process.stdout.write(body);
  }
}

main();
