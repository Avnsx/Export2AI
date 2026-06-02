# Quick Start 🚀

This page gets you from installation to your first **AI-ready zip archive** for ChatGPT, Claude, Cursor, VS Code, or another LLM coding workflow.

---

## 1. Install Export2AI

| Method | Use when | Steps |
|--------|----------|-------|
| **Open VSX / Cursor** | normal installation | Open Extensions, search **Export2AI**, install `avnsx.export2ai`. |
| **GitHub Release VSIX** | marketplace is unavailable or you want a specific version | Download `export2ai-x.y.z.vsix` from [Releases](https://github.com/Avnsx/Export2AI/releases), then install from VSIX. |
| **Local build** | contributor workflow | Run `npm install`, `npm run compile`, `npm run package`, then install `build/export2ai-x.y.z.vsix`. |

Requirements for running the extension: **VS Code / Cursor `^1.105.0`**.

Requirements for building from source: **Node.js 24+** is recommended to match the release workflow.

---

## 2. Create an AI Context Zip

1. Open a project folder in VS Code or Cursor.
2. In the Explorer, right-click the folder you want to export.
3. Choose **Export2AI → Zip Folder**.
4. Wait for the progress notification to finish scanning and writing.
5. Upload the generated zip to ChatGPT, Claude, Cursor, or your AI coding tool.

The zip is written to the workspace root:

```text
{folder}-{model}-context-{YYYY-MM-DD-HHMMSS}.zip
```

Example:

```text
backend-gpt-5.5-context-2026-06-02-201700.zip
```

The filename uses:

| Segment | Source |
|---------|--------|
| `backend` | selected folder basename, sanitized and capped |
| `gpt-5.5` | `export2ai.llmModel` |
| `context` | stable marker for AI handoff archives |
| timestamp | compact local creation time |

---

## 3. Check the Token Estimate

When token counting is enabled, Export2AI shows an estimate in:

| Location | Example |
|----------|---------|
| status bar | `gpt-5.5 · (est. 47,382 tokens)` |
| zip notification | `Export2AI created for gpt-5.5: ... (est. 47,382 tokens)` |
| optional Explorer folder badges | compact 2-character folder badges when explicitly enabled |

A `~` prefix means approximate. No `~` means an exact offline tokenizer was used for that model family.

More detail: [Token Estimates & AI Model Support](Token-Estimates-and-AI-Model-Support).

---

## 4. Upload the Zip to an AI Tool

Use the archive as a project snapshot. Good prompts usually state what the archive represents:

```text
I uploaded an Export2AI project context zip. Please inspect the codebase, docs, tests,
and CI files first. Treat _EXPORT2AI_MANIFEST.txt as archive metadata, not source code.
Do not assume omitted .git internals or credentials are part of the project.
```

For coding agents, also tell them to read `AGENTS.md` when it is present.

---

## 5. Common First-Time Settings

Open **Export2AI → Settings** from the menu, Command Palette, or by clicking the status bar token estimate.

| Goal | Setting |
|------|---------|
| Change target AI model | `export2ai.llmModel` |
| Disable token counting | `export2ai.enableTokenCounting` |
| Keep token badges out of Explorer | leave `export2ai.showExplorerTokenBadges` as `false` |
| Add project-specific excludes | `export2ai.excludePatterns` or `export2ai.excludePaths` |
| Preserve all code comments | leave `export2ai.removeComments` as `false` |
| Preserve formatting | leave `export2ai.compressCode` as `false` |

Full reference: [Settings & Configuration](Settings-and-Configuration).

---

## Quick Sanity Check

After creating a zip, open it once and verify:

- `_EXPORT2AI_MANIFEST.txt` exists unless you disabled it.
- `node_modules/`, `dist/`, `build/`, `.env*`, private keys, and `.git/` internals are absent.
- `.github/`, `.gitignore`, docs, tests, and `AGENTS.md` are present when they exist in the project.
- Large or binary files are represented by short placeholders, not raw binary content.
- The filename includes the target model you intended to use.
