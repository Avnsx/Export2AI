# Export2AI 📦

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](./LICENSE.txt)
[![Release](https://img.shields.io/github/v/release/Avnsx/Export2AI?sort=semver)](https://github.com/Avnsx/Export2AI/releases)
[![Open VSX](https://img.shields.io/open-vsx/v/avnsx/export2ai)](https://open-vsx.org/extension/avnsx/export2ai)

**Make clean AI-ready zip files from your VS Code or Cursor workspace.**

Export2AI packages the folder you choose, skips noisy or sensitive files, keeps useful repository context, and shows an offline token estimate before you upload the zip to ChatGPT, Claude, Cursor, or another AI tool.

<p align="center">
  <img src="https://i.imgur.com/RpgluFc.png" alt="Export2AI banner">
</p>

---

## Why It Exists

AI tools are useful only when the project archive is actually useful.

| Common handoff problem | Export2AI behavior |
|------------------------|-------------------|
| Huge zips full of `node_modules` and caches | Skips common junk by default |
| Missing `.github`, `.gitignore`, or test files | Keeps repository-control and validation files |
| Accidentally shipping `.git` internals or keys | Excludes local Git metadata and secret-like files |
| No idea how much context you are uploading | Shows an offline token estimate |
| Too much setup for every AI handoff | Right-click a folder and create the zip |

---

## Quick Start

1. Install **Export2AI** from [Open VSX](https://open-vsx.org/extension/avnsx/export2ai) or download the latest `.vsix` from [Releases](https://github.com/Avnsx/Export2AI/releases).
2. Open a project in **VS Code** or **Cursor**.
3. Right-click a folder in the Explorer.
4. Choose **Export2AI → Zip Folder**.
5. Upload the generated `*-context-*.zip` to your AI tool.

The zip is written to the workspace root, for example:

```text
my-project-gpt-5.5-context-2026-06-01-140000.zip
```

---

## What It Can Do

| Feature | What you get |
|---------|--------------|
| 📁 Zip folder/workspace | Clean AI-ready source archive |
| 🌳 Copy project structure | Folder tree only, copied to clipboard |
| 📄 Copy one file | Exact UTF-8 file text, no zip needed |
| 🔢 Token estimate | Offline estimate in status bar and zip notification |
| 🛡️ Git metadata soft-delete | Keeps `.github/**`, `.gitignore`, `.gitattributes`, but not `.git/` |
| ⚙️ Editable safe excludes | Built-in excludes are on by default and can be managed from the Command Palette |

---

## Safe by Default

Export2AI is built for AI handoff, not for publishing secrets.

It keeps useful project context:

```text
.github/
.gitignore
.gitattributes
AGENTS.md
README.md
docs/
tests/
tools/
```

It excludes local or sensitive material:

```text
.git/
node_modules/
.env*
*.pem
*.key
__pycache__/
.pytest_cache/
build/
dist/
site/
```

The archive manifest also states that `.git`, credentials, and private key material were intentionally omitted.

---

## Main Settings

Open settings from **Export2AI → Settings**, the Command Palette, or by clicking the token count in the status bar.

| Setting | Default | Plain meaning |
|---------|---------|---------------|
| `export2ai.llmModel` | `gpt-5.5` | Model used for token estimates and zip names |
| `export2ai.softDeleteGitMetadata` | `true` | Keep repo-control files, omit local `.git` internals |
| `export2ai.useBuiltInExcludePatterns` | `true` | Use Export2AI's safe default excludes |
| `export2ai.excludePatterns` | `[]` | Add your own extra exclude globs |
| `export2ai.removeComments` | `false` | Optional comment stripping |
| `export2ai.compressCode` | `false` | Optional whitespace compaction |
| `export2ai.showExplorerTokenBadges` | `false` | Optional folder badges; off by default |

Use **Export2AI: Manage Built-in Exclude Patterns** from the Command Palette to include or exclude individual built-in patterns.

---

## Learn More

The README stays short on purpose. Detailed docs live here:

- [Wiki home](https://github.com/Avnsx/Export2AI/wiki) — human guide, settings, safety behavior, troubleshooting
- [Configuration](./docs/configuration.md) — complete `export2ai.*` setting reference
- [Architecture](./docs/architecture.md) — how collection, soft-delete, zipping, and token estimates work
- [Build & test](./docs/build-and-test.md) — local development and release pipeline
- [Agent guide](./AGENTS.md) — rules for AI coding agents and contributors

---

## Build From Source

```bash
npm install
npm run compile
npm run package
```

The built extension appears under:

```text
build/export2ai-x.y.z.vsix
```

For release-level checks:

```bash
npm run test:critical
```

---

## Links

- [Open VSX / Cursor marketplace](https://open-vsx.org/extension/avnsx/export2ai)
- [GitHub releases](https://github.com/Avnsx/Export2AI/releases)
- [Project wiki](https://github.com/Avnsx/Export2AI/wiki)
- [GPL-3.0 license](./LICENSE.txt)
