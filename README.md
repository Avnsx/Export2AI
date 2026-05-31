# Export2AI 📦

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](./LICENSE.txt)
[![Release](https://img.shields.io/github/v/release/Avnsx/Export2AI?sort=semver)](https://github.com/Avnsx/Export2AI/releases)

**Zip your project for AI — clean, compact, and ready to upload.**

Export2AI is a [Cursor](https://cursor.com) / [VS Code](https://code.visualstudio.com) extension that turns your workspace (or any folder) into a tidy `.zip` file you can drop into ChatGPT, Claude, or any other AI chat. It skips junk like `node_modules`, shrinks code where it can, and tells you how many tokens you're about to use (exact for OpenAI models, approximate for others).

<p align="center">
  <img src="https://i.imgur.com/RpgluFc.png" alt="Export2AI banner">
</p>

---

## ✨ Why use this?

| Without Export2AI | With Export2AI |
|-------------------|----------------|
| Manually pick files | One click on a folder |
| Huge zips full of `node_modules` | Smart ignore rules |
| No idea how big the context is | Live token estimate |
| Comments & whitespace bloat the zip | Optional compression |

---

## 🚀 Quick start

### 1️⃣ Install

**From a marketplace:**

Search for **Export2AI** in Cursor, VS Code Marketplace, or Open VSX.
Published marketplace identity: `avnsx.export2ai`.

**From a `.vsix` file (local build):**

```bash
npm install
npm run compile
npm run package
```

Then in Cursor/VS Code: **Extensions → `...` → Install from VSIX** → pick `build/export2ai-1.2.8.vsix`.

### 2️⃣ Zip your project

1. Open a folder in Cursor or VS Code.
2. In the **Explorer**, right-click a folder (or use the **Export2AI** toolbar menu).
3. Choose **Zip Folder** (or **Zip Folder for {model}**) — the status bar shows a token estimate when counting is enabled.
4. Your zip appears in the **workspace root** as something like:

   `my-project-gpt-5.5-context-2026-05-30-140000.zip`

   The name uses the folder's own name, the **`export2ai.llmModel`** setting (e.g. `gpt-5.5`, `claude-opus-4-8`), and a compact timestamp.

5. Upload that file to your AI chat, or copy the path from the notification.

That's it.

---

## 🛠 What you can do

### 📁 Zip a folder or workspace

- **Right-click a folder** → **Export2AI** submenu → zip command with token estimate.
- **Command Palette** (`Ctrl+Shift+P`) → `Export2AI: Zip Current Workspace`.
- **Explorer title bar** → **Export2AI** zip icon (when token counting is on).

The zip includes **text source files only**. Binaries are replaced with a short placeholder. Files over the size limit get a `[File too large: …]` note instead of full content. Unreadable files are skipped (logged to the developer console).

### 🌳 Copy project structure

Need just the folder tree, not every file? Use **Copy Project Structure** from the same menu. Output goes to your clipboard as plain text, Markdown, or XML (see settings).

### 📄 Copy one file's content

Right-click a single file (for example, a `.md` file) and choose **Export2AI: Copy Content to Clipboard**. This copies the file's exact UTF-8 text to your clipboard without creating a zip, applying ignore rules, stripping comments, compressing whitespace, or masking content. Binary files, directories, invalid UTF-8, multi-selects, and clipboard failures show a visible Export2AI message instead of failing silently.

### 📂 Open the last zip

**Export2AI → Open Last Zip** opens the most recently created zip in your **system file manager** (Explorer on Windows, Finder on macOS, your default file manager on Linux) with the file selected. Tracks the last zip for the current session only.

### 🔢 Token estimate (status bar)

When token counting is on, the bottom-right status bar shows something like:

`(est. 12,450 tokens)` — exact for OpenAI / ChatGPT models

or

`(est. ~12,450 tokens)` — approximate for Claude and other families

**Click the status bar** to open Export2AI settings. **Hover the status bar** for a short tooltip that says what was counted (`workspace ...` or `folder ...`), the active model, and whether the estimate is exact or approximate. Counts are **offline estimates** — nothing is sent to an API, and zipping does not consume tokens.

When token counting is on, the Explorer menu shows **`Target model: …`** (from your setting) plus a **`Zip Folder`** action. The live token estimate appears in the **status bar** (e.g. `gpt-5.5 · (est. ~12,450 tokens)`) and in the post-zip notification. Optional Explorer folder badges can be enabled with `export2ai.showExplorerTokenBadges`, but they are off by default so Cursor/VS Code Explorer stays clean.

---

## ⚙️ Settings

Open Export2AI settings from:

- **Export2AI → Settings** (submenu or Command Palette)
- **Status bar** token count (click)

These open the **extension-specific settings page** via VS Code’s `@ext:` route (e.g. `@ext:avnsx.export2ai`). The extension ID is resolved at runtime from your installed copy — not hardcoded.

At the **top** of the settings page, a read-only row shows:

`Extension version v.1.2.8 · Last updated June 01, 2026`

That string is synced automatically from `package.json` version and `CHANGELOG.md` when the extension is built.

This avoids slow global Settings search, which could freeze Cursor when filtering by a plain text query like `export2ai`.

### Troubleshooting settings navigation

1. Enable **`export2ai.debug`** in `settings.json` if needed. The **Export2AI** Output channel opens automatically when debug mode turns on.
2. Repeat the workflow. Debug lines are written only while the setting is on and use the local PC's short date/time format, e.g. `[Export2AI 05/30/26, 09:05:07 PM] ...`. If the panel is hidden, open **View → Output → Export2AI**.
3. For settings problems, confirm the log shows `settingsQuery=@ext:...` matching your extension ID (`publisher.name` from the manifest).
4. If direct navigation fails, use the fallback actions (**Copy Extension ID**, **Open Extensions View**) and open settings from the extension’s gear icon.

| Setting | What it does | Default |
|---------|--------------|---------|
| `export2ai.extensionInfo` | Read-only version + last-updated (display only) | Auto-synced at build |
| `export2ai.ignoreGitIgnore` | Skip files listed in `.gitignore` | `true` |
| `export2ai.ignoreDotFiles` | Skip `.env`, `.git`, etc. | `true` |
| `export2ai.ignoreDollarFiles` | Skip `$`-prefixed temp files (e.g. `$RECYCLE.BIN`) | `true` |
| `export2ai.softDeleteGitMetadata` | Keep repository control files (`.github`, `.gitignore`, `.gitattributes`, …) while replacing unsafe local `.git` data with a harmless marker outside `.git` by default | `true` |
| `export2ai.softDeleteGitMetadata.realGitPathPlaceholder` | Advanced compatibility mode: put the `.git` marker at `.git/EXPORT2AI_SOFT_DELETE_PLACEHOLDER.txt` instead of outside `.git` | `false` |
| `export2ai.excludePatterns` | Glob patterns to skip (`node_modules`, `dist`, …); use `excludePaths` to hard-exclude repository-control files restored by Soft-Delete | See defaults |
| `export2ai.excludePaths` | Workspace-relative paths to skip entirely | `[]` |
| `export2ai.commentStripLanguages` | Read-only list of supported comment syntax families | Auto-synced at build |
| `export2ai.compressCode` | Trim whitespace & blank lines in exported text (see Settings for guidance) | `false` |
| `export2ai.removeComments` | Strip comments per file type (18 syntax families; string-aware) | `false` |
| `export2ai.enableTokenCounting` | Show token estimates in status bar, Explorer menu state, and zip notifications | `true` |
| `export2ai.showExplorerTokenBadges` | Opt-in compact token badges on Explorer folders | `false` |
| `export2ai.llmModel` | Target model for token estimates (see below) | `gpt-5.5` |
| `export2ai.maxFileSize` | Max bytes per file (larger = placeholder) | `1048576` (1 MB) |
| `export2ai.maxDepth` | Tree depth for **Copy Project Structure** | `5` |
| `export2ai.fileConcurrency` | Parallel file reads (1–32) | `4` |
| `export2ai.outputFormat` | Structure format: `plaintext`, `markdown`, `xml` | `plaintext` |
| `export2ai.includeManifest` | Add `_EXPORT2AI_MANIFEST.txt` inside zip | `true` |
| `export2ai.compressionLevel` | Zip file pack tightness 0 (fast) – 9 (smallest upload); does not change token count after extract | `9` |
| `export2ai.copyPathAfterCreate` | Copy zip path to clipboard after create | `true` |
| `export2ai.debug` | Log full extension diagnostics to Output and reveal the Export2AI channel when enabled (activation, commands, zip/copy, single-file copy, token scans, settings navigation) | `false` |

---

## 🧮 Token counting explained

Export2AI estimates how many **tokens** your zip would use if pasted into an AI chat.

- **`~` prefix** = approximate (Claude, Opus uplift, and non-OpenAI models).
- **No `~`** = exact offline count (OpenAI / ChatGPT models using `gpt-tokenizer`).
- Set **`export2ai.llmModel`** to the model you plan to use. Default is **`gpt-5.5`** (ChatGPT flagship, exact o200k count).

### Example model names

**OpenAI / ChatGPT (exact count, no `~`)**

| Model name | Notes |
|------------|-------|
| `gpt-5.5`, `gpt-5.5-pro` | **Default setting** — o200k tokenizer |
| `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`, `gpt-5`, `gpt-5.4` | o200k tokenizer |
| `o1`, `o3-mini`, `o4-mini` | o200k tokenizer |
| `gpt-4`, `gpt-3.5-turbo` | Legacy cl100k tokenizer |

**Anthropic (approximate, `~` shown)**

| Model name | Notes |
|------------|-------|
| `claude-opus-4-8`, `claude-opus-4-7` | Updated Opus tokenizer (offline content-aware uplift) |
| `claude-sonnet-4-6`, `claude-opus-4-6`, `claude-haiku-4-5` | Legacy Claude npm tokenizer (~1–2% off) |

**Other providers (rough estimate only)**

| Model name | Notes |
|------------|-------|
| `gemini-2.5-pro`, `grok-3`, `deepseek-*` | `characters ÷ 4` heuristic — no exact tokenizer bundled |

Partial names match by prefix (e.g. `gpt-5.5-thinking` → o200k; `claude-opus-4-7-20260416` → Opus uplift).

### How counting works (by family)

| Model family | Method |
|--------------|--------|
| OpenAI modern (`gpt-5.5`, `gpt-4o`, `o3-mini`, …) | Exact — `gpt-tokenizer` o200k |
| OpenAI legacy (`gpt-4`, `gpt-3.5-turbo`) | Exact — `gpt-tokenizer` cl100k |
| Claude Opus 4.7+ | Approx — legacy baseline + content uplift heuristics |
| Other Claude (`claude-*`) | Approx — `@anthropic-ai/tokenizer` |
| Gemini, Grok, DeepSeek, etc. | Approx — `characters ÷ 4` |

For API-exact Opus 4.7+ counts, use Anthropic’s [token counting API](https://platform.claude.com/docs/en/build-with-claude/token-counting) — Export2AI stays fully offline.

---

## 🚫 What gets excluded by default?

- `node_modules`, `dist`, `build`, `out`
- Python/tool caches such as `__pycache__`, `.pytest_cache`, `.cache`, `.tmp`
- `.git` internals (external soft-delete marker by default)
- Log/temp/backup files (`*.log`, `*.tmp`, …)
- Previous Export2AI zips (`*-chatgpt-context-*.zip`, `*-*-context-*.zip`)
- Dot files (if `ignoreDotFiles` is on)
- Dollar-prefixed files (if `ignoreDollarFiles` is on)
- Anything in `.gitignore` (if `ignoreGitIgnore` is on)

By default, Git/GitHub metadata uses **soft-delete** instead of broad dotfile removal. Repository control files such as `.github/**`, `.gitignore`, `.gitattributes`, `.gitmodules`, `.mailmap`, `.gitkeep`, and `.git-blame-ignore-revs` are exported with their real contents so CI/workflow/archive tests can inspect them. The unsafe local `.git` directory is not traversed and is not created in the zip by default; Export2AI writes `_EXPORT2AI_PLACEHOLDERS/git/EXPORT2AI_SOFT_DELETE_PLACEHOLDER.txt` outside `.git` so tests that check `Path(".git").exists()` do not mistake the export for a real Git repository. Remotes, refs, branches, hooks, object database, credentials, and local history are not exported.

The zip manifest records the source folder name and `Source path redacted: true`; it does not include the absolute local source path. If you need the older `.git/EXPORT2AI_SOFT_DELETE_PLACEHOLDER.txt` layout for a specialized workflow, enable `export2ai.softDeleteGitMetadata.realGitPathPlaceholder`.

If a repository-control file or folder cannot be read, the zip keeps that path visible with an explicit `Export2AI Repository-Control Read Error` placeholder or `EXPORT2AI_READ_ERROR.txt` marker instead of silently dropping it.

---

## ⚠️ Known limitations

- The automatic background token scan reflects the **first workspace folder** in multi-root workspaces; selected folders use that folder's workspace-specific settings.
- **`removeComments`** uses language-aware rules by file extension (C-family, Python `#`, SQL `--`, HTML `<!-- -->`, PowerShell `<# #>`, batch `REM`, etc.). String literals are preserved where possible; edge cases inside regex or nested strings may still lose text. Plain `.json`, `.md`, and unknown extensions are unchanged.
- The live token count is shown in the status bar and post-zip notification — **not** inside a menu row (VS Code menu titles are static). Explorer folder badges are opt-in and off by default.
- **`lastZipPath`** is session-only and lost on window reload.

---

## 📋 Requirements

- **VS Code / Cursor** `^1.105.0`
- **Node.js** 24+ (for building from source and matching the release workflow)

---

## 👩‍💻 Development (contributors)

```bash
npm install              # install deps
npm run compile          # generate menus → tsc → sync settings → merge package.json
npm run slim:package     # shrink package.json before commit (recommended)
npm run watch            # compile on save
npm run test:tokens      # token format, Opus routing, manifest hygiene
npm run test:soft-delete # repository control files + .git marker guard
npm run test:debug-logger # debug setting scopes + Output channel reveal
npm run test:menu-merge  # submenu shape + Command Palette hides
npm run test:explorer-badges # Explorer badge provider gate
npm run test:critical:list # list targetable smoke checks
npm run test:critical:tokens # run one critical target
npm run test:marketplace-assets # packaged icon asset hygiene
npm run test:live        # smoke-test zip creation
npm run test:settings-nav      # extension ID + extensionInfo metadata
npm run package          # compile once + build build/export2ai-x.x.x.vsix
```

**Manifest workflow:** edit `package.slim.json` (not the generated `package.json`). `npm run compile` runs `precompile` (menu generation), TypeScript compile, then `postcompile` (comment settings sync + manifest merge). `npm run package` always writes VSIX files under `build/`. `package.json` stays small (~35 KB); if it ever balloons into the MB range you have reintroduced a generated-command explosion — see [docs/agent-chokepoints.md](./docs/agent-chokepoints.md).

### Documentation

| Doc | Purpose |
|-----|---------|
| [docs/README.md](./docs/README.md) | Documentation index |
| [AGENTS.md](./AGENTS.md) | **Agent guide — read before structural changes** |
| [docs/agent-chokepoints.md](./docs/agent-chokepoints.md) | Hang prevention & performance traps |
| [docs/architecture.md](./docs/architecture.md) | Data flows, commands, why there is no token-bucket menu |
| [docs/target-model-ui.md](./docs/target-model-ui.md) | Unified `llmModel` display |
| [docs/source-modules.md](./docs/source-modules.md) | Every `src/` and `scripts/` file |
| [docs/configuration.md](./docs/configuration.md) | All `export2ai.*` settings |
| [docs/comment-stripping.md](./docs/comment-stripping.md) | Comment removal by language |
| [docs/build-and-test.md](./docs/build-and-test.md) | Build pipeline, tests, VSIX |
| [AGENTS.md](./AGENTS.md) | AI agent & contributor conventions |

---

## License

[GNU General Public License v3.0](./LICENSE.txt) — see [`LICENSE.txt`](./LICENSE.txt) for the full text.

---

## 🔗 Links

- Repository: [github.com/Avnsx/Export2AI](https://github.com/Avnsx/Export2AI)
- Releases (VSIX downloads): [github.com/Avnsx/Export2AI/releases](https://github.com/Avnsx/Export2AI/releases)
