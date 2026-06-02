# Export2AI Wiki 📦

**Export2AI is a VS Code and Cursor extension for AI-ready project zip archives, ChatGPT project uploads, Claude code review context, Cursor workspace handoff, and offline LLM token estimates.**

The README stays compact on purpose. This wiki is the deeper human guide: visual, searchable, and organized by what a reader wants to do next.

---

## Pick Your Path

| I want to... | Go here |
|--------------|---------|
| Install the extension and create my first AI context zip | [🚀 Quick Start](Quick-Start) |
| Understand every command in the Export2AI menu | [🛠️ Features & Workflow](Features-and-Workflow) |
| Know what is included, excluded, replaced, or protected | [🛡️ Safe Exports & Excludes](Safe-Exports-and-Excludes) |
| Understand `.git` handling and repository-control files | [🌿 Git Metadata Soft-Delete](Git-Metadata-Soft-Delete) |
| Pick a target model and interpret token counts | [🧮 Token Estimates & AI Model Support](Token-Estimates-and-AI-Model-Support) |
| Change extension settings safely | [⚙️ Settings & Configuration](Settings-and-Configuration) |
| Reduce context size without breaking review quality | [🧹 Comment Stripping & Compression](Comment-Stripping-and-Compression) |
| Fix settings, zips, tokens, or file-collection issues | [🧯 Troubleshooting](Troubleshooting) |
| Contribute code or review architecture | [👩‍💻 Developer Guide](Developer-Guide) |
| Build, test, package, and release the VSIX | [🧪 Build, Test & Release](Build-Test-and-Release) |
| Give an AI coding agent the repo safely | [🤖 Agent Chokepoints](Agent-Chokepoints) |

---

## What Export2AI Solves

AI coding tools need a useful project snapshot. Manual zip files often include the wrong files: build folders, dependency caches, old exports, local secrets, or missing CI/test/docs context.

Export2AI creates a source-focused archive for:

| Workflow | Why it helps |
|----------|--------------|
| **ChatGPT codebase analysis** | Upload one clean project zip instead of pasting files manually. |
| **Claude code review** | Keep docs, tests, CI workflows, and architecture notes together. |
| **Cursor AI workspace handoff** | Give an agent a compact project archive without local machine noise. |
| **LLM context-window planning** | See an offline token estimate before you upload. |
| **Repository validation by AI agents** | Keep `.github/`, `.gitignore`, tests, docs, and `AGENTS.md` visible. |

---

## Current Documentation Map

| Layer | Location | Purpose |
|-------|----------|---------|
| Compact overview | [README.md](https://github.com/Avnsx/Export2AI/blob/main/README.md) | short public landing page with direct wiki links |
| Human guide | this GitHub Wiki | searchable user docs and feature explanations |
| Technical docs | [`docs/`](https://github.com/Avnsx/Export2AI/tree/main/docs) | maintainer and contributor reference |
| Agent rules | [`AGENTS.md`](https://github.com/Avnsx/Export2AI/blob/main/AGENTS.md) | constraints for AI coding agents |
| Tests | [`tests/`](https://github.com/Avnsx/Export2AI/tree/main/tests) and [`scripts/test-*.js`](https://github.com/Avnsx/Export2AI/tree/main/scripts) | smoke checks and regression coverage |

---

## Core Concepts in One Screen

| Concept | Plain meaning |
|---------|---------------|
| **AI-ready zip archive** | A `.zip` written to the workspace root with source text and useful context. |
| **Safe defaults** | Built-in ignore patterns skip common noise and credential-like material. |
| **Soft-delete Git metadata** | Real repo-control files stay; local `.git/` internals become a harmless marker. |
| **Offline token estimate** | Token counting happens locally; no provider API call is made. |
| **Target model** | `export2ai.llmModel` controls zip names, tokenizers, menus, manifest text, and status bar labels. |
| **Manifest** | `_EXPORT2AI_MANIFEST.txt` explains what was counted, omitted, and redacted. |

---

## Good Defaults

```json
{
  "export2ai.llmModel": "gpt-5.5",
  "export2ai.enableTokenCounting": true,
  "export2ai.softDeleteGitMetadata": true,
  "export2ai.useBuiltInExcludePatterns": true,
  "export2ai.removeComments": false,
  "export2ai.compressCode": false,
  "export2ai.showExplorerTokenBadges": false
}
```

These defaults preserve source readability, prevent common accidental leaks, and avoid cluttering the VS Code/Cursor Explorer with token badges unless the user opts in.

---

## Fast Links

- [Open VSX listing](https://open-vsx.org/extension/avnsx/export2ai)
- [GitHub releases](https://github.com/Avnsx/Export2AI/releases)
- [Root README](https://github.com/Avnsx/Export2AI/blob/main/README.md)
- [Technical docs index](https://github.com/Avnsx/Export2AI/blob/main/docs/README.md)
- [License](https://github.com/Avnsx/Export2AI/blob/main/LICENSE.txt)
