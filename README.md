# Export2AI 📦

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](./LICENSE.txt)
[![Release](https://img.shields.io/github/v/release/Avnsx/Export2AI?sort=semver)](https://github.com/Avnsx/Export2AI/releases)
[![Open VSX](https://img.shields.io/open-vsx/v/avnsx/export2ai)](https://open-vsx.org/extension/avnsx/export2ai)

<p align="center">
  <img src="https://i.imgur.com/RpgluFc.png" alt="Export2AI banner">
</p>

**AI-ready project zips for VS Code, Cursor, ChatGPT, Claude, and LLM coding agents.**

Export2AI turns a workspace or selected folder into a clean `.zip` archive for AI handoff. It skips generated noise, protects local Git metadata and credential-like files, keeps useful repository context, and shows an **offline token estimate** before you upload the archive.

**Start here:** [Quick Start](https://github.com/Avnsx/Export2AI/wiki/Quick-Start) · [Features](https://github.com/Avnsx/Export2AI/wiki/Features-and-Workflow) · [Safe Exports](https://github.com/Avnsx/Export2AI/wiki/Safe-Exports-and-Excludes) · [Token Estimates](https://github.com/Avnsx/Export2AI/wiki/Token-Estimates-and-AI-Model-Support) · [Settings](https://github.com/Avnsx/Export2AI/wiki/Settings-and-Configuration) · [Troubleshooting](https://github.com/Avnsx/Export2AI/wiki/Troubleshooting)

---

## Why Export2AI?

| Manual AI handoff | Export2AI handoff |
|-------------------|-------------------|
| Manually pick files and hope the zip is useful | Right-click a folder and export it |
| Upload `node_modules`, caches, build output, or old context zips | Built-in safe excludes are on by default |
| Lose `.github/`, `.gitignore`, docs, tests, or `AGENTS.md` | Repository-control and validation files stay readable |
| Risk leaking `.git/`, `.env`, keys, auth files, or local history | Git internals and credential-like paths are blocked |
| Guess whether the archive fits an LLM context window | Offline token estimate appears before and after export |

**Use it for:** ChatGPT project uploads, Claude code review context, Cursor workspace handoff, AI codebase analysis, and reproducible source archives for coding agents.

---

## Quick Start 🚀

1. Install **Export2AI** from [Open VSX](https://open-vsx.org/extension/avnsx/export2ai), or download a `.vsix` from [Releases](https://github.com/Avnsx/Export2AI/releases).
2. Open a project in **VS Code** or **Cursor**.
3. Right-click a folder in the Explorer.
4. Choose **Export2AI → Zip Folder**.
5. Upload the generated `*-context-*.zip` to ChatGPT, Claude, Cursor, or another AI tool.

Example output in the workspace root:

```text
my-project-gpt-5.5-context-2026-06-02-201700.zip
```

Full walkthrough: [Quick Start](https://github.com/Avnsx/Export2AI/wiki/Quick-Start).

---

## What It Can Do 🛠️

| Feature | What you get |
|---------|--------------|
| 📁 Zip folder/workspace | Clean AI-ready source archive in the workspace root |
| 🌳 Copy project structure | Folder tree only, copied as plaintext, Markdown, or XML |
| 📄 Copy one file | Exact UTF-8 text from one file, no zip needed |
| 🔢 Token estimate | Offline estimate in status bar and zip notification |
| 🛡️ Git metadata soft-delete | Keeps repo-control files, omits unsafe local `.git/` internals |
| ⚙️ Editable safe excludes | Command Palette checklist for built-in excludes |
| 📂 Open last zip | Reveals the most recent zip in the OS file manager |

Command details: [Features & Workflow](https://github.com/Avnsx/Export2AI/wiki/Features-and-Workflow).

---

## Safe by Default 🛡️

Export2AI is built for **AI context sharing**, not for publishing secrets or backing up a local checkout.

| Included for context | Excluded or replaced for safety/noise |
|----------------------|---------------------------------------|
| source text, `.github/`, `.gitignore`, `.gitattributes`, `.gitmodules`, `AGENTS.md`, `README.md`, `docs/`, `tests/`, `tools/`, `pyproject.toml` | `.git/`, `node_modules/`, `dist/`, `build/`, `out/`, caches, `.env*`, local auth files, private keys, binary/oversized/invalid UTF-8 placeholders, previous context zips |

Normal source files are **not excluded only because their filename mentions** `token`, `credential`, `secret`, or `key`. Actual credential/key material still wins over these includes.

Default Git marker:

```text
_EXPORT2AI_PLACEHOLDERS/git/EXPORT2AI_SOFT_DELETE_PLACEHOLDER.txt
```

Details: [Safe Exports](https://github.com/Avnsx/Export2AI/wiki/Safe-Exports-and-Excludes) and [Git Metadata Soft-Delete](https://github.com/Avnsx/Export2AI/wiki/Git-Metadata-Soft-Delete).

---

## Token Estimates 🧮

Export2AI counts locally. Nothing is sent to OpenAI, Anthropic, Google, xAI, or any other API.

| Model family | Examples | Display |
|--------------|----------|---------|
| OpenAI / ChatGPT modern | `gpt-5.5`, `gpt-5.5-pro`, `gpt-5.4`, `gpt-5`, `gpt-4.1`, `gpt-4o`, `o3-mini`, `o4-mini` | exact, no `~` |
| OpenAI legacy | `gpt-4`, `gpt-3.5-turbo` | exact, no `~` |
| Claude | `claude-opus-4-8`, `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5` | approximate, `~` |
| Other/unknown | `gemini-*`, `grok-*`, `deepseek-*`, `mistral-*` | approximate, `~` |

Default target model:

```json
"export2ai.llmModel": "gpt-5.5"
```

More: [Token Estimates & AI Model Support](https://github.com/Avnsx/Export2AI/wiki/Token-Estimates-and-AI-Model-Support).

---

## Main Settings ⚙️

Open settings from **Export2AI → Settings**, the Command Palette, or by clicking the status bar token estimate.

| Setting | Default | Meaning |
|---------|---------|---------|
| `export2ai.llmModel` | `gpt-5.5` | Target model for estimates, menu rows, zip names, manifest |
| `export2ai.enableTokenCounting` | `true` | Status bar and notification estimates |
| `export2ai.softDeleteGitMetadata` | `true` | Keep repo-control files; omit local `.git/` internals |
| `export2ai.useBuiltInExcludePatterns` | `true` | Use Export2AI's safe default excludes |
| `export2ai.excludePatterns` | `[]` | Extra glob excludes |
| `export2ai.excludePaths` | `[]` | Hard-exclude specific paths |
| `export2ai.removeComments` | `false` | Optional language-aware comment stripping |
| `export2ai.compressCode` | `false` | Optional whitespace compaction |
| `export2ai.includeManifest` | `true` | Adds `_EXPORT2AI_MANIFEST.txt` |

Full reference: [Settings & Configuration](https://github.com/Avnsx/Export2AI/wiki/Settings-and-Configuration) and [docs/configuration.md](./docs/configuration.md).

---

## More Guides 📚

| Guide | Best for |
|-------|----------|
| [GitHub Wiki](https://github.com/Avnsx/Export2AI/wiki) | human-friendly documentation hub |
| [Comment Stripping & Compression](https://github.com/Avnsx/Export2AI/wiki/Comment-Stripping-and-Compression) | context-size tradeoffs |
| [Developer Guide](https://github.com/Avnsx/Export2AI/wiki/Developer-Guide) | source map and architecture |
| [Build, Test & Release](https://github.com/Avnsx/Export2AI/wiki/Build-Test-and-Release) | local build and VSIX packaging |
| [Agent Chokepoints](https://github.com/Avnsx/Export2AI/wiki/Agent-Chokepoints) | performance traps for AI coding agents |
| [Technical docs](./docs/README.md) | repository-maintained documentation index |

---

## Build From Source

```bash
npm install
npm run compile
npm run package
npm run test:critical
```

VSIX output: `build/export2ai-x.y.z.vsix`

---

## Links

- [Open VSX / Cursor listing](https://open-vsx.org/extension/avnsx/export2ai)
- [GitHub releases](https://github.com/Avnsx/Export2AI/releases)
- [Project wiki](https://github.com/Avnsx/Export2AI/wiki)
- [GPL-3.0-only license](./LICENSE.txt)
