# Architecture

## Purpose

Export2AI creates AI-ready zip archives from workspace folders. It applies ignore rules, optional whitespace compression, language-aware comment stripping, and offline token estimates. Secondary features copy project tree structure or one selected text file to the clipboard.

## Entry point

`src/extension.ts` — activates after workbench startup (`onStartupFinished`), registers commands, owns session state (`lastZipPath`), wires `TokenEstimateManager`, and delegates zip creation to `zipService.ts`.

## Data flow: zip creation

```
User command (zipFolder)
  → getConfiguration()                    [config.ts]
  → TokenEstimateManager.updateContextForUri()  [optional]
  → createZipArchive()                    [zipService.ts]
       → prepareIgnoreContext()           [projectService.ts]
       → FileProcessor.collectFiles()     [fileProcessor.ts]
            → stripCommentsForFile()      [commentStripper.ts] if removeComments
            → compress whitespace         if compressCode
       → TokenCounter.countFilesContent() if enableTokenCounting
       → archiver ZipArchive → workspace root *.zip
  → revealInSystemExplorer() / notification / clipboard
```

Zip naming: `{folderBasename}-{model-slug}-context-{YYYY-MM-DD-HHMMSS}.zip` in the workspace root. Only the folder's own name is used (not its nested path), capped at 40 chars, with a compact timestamp — e.g. `WinMGT-gpt-5.5-context-2026-05-30-182617.zip`.

Optional manifest: `_EXPORT2AI_MANIFEST.txt` when `includeManifest` is true.

## Data flow: token estimate

```
TokenEstimateManager [tokenEstimate.ts]
  → initial scan deferred 5s (avoids cold-start vs settings navigation)
  → debounced refresh on file save/create/delete/rename/config change
  → skips/reschedules while settingsNavigationInProgress
  → onSettingsNavigationFinished() → scheduleRefresh() (+ 1.5s extra delay)
  → refreshGeneration counter drops stale publish results
  → ONE FileProcessor.collectFiles() walk over the workspace root
  → TokenCounter.countFilesPerPath() — tokenize each file once
  → aggregateDirectoryEstimates() — sum tokens up each file's ancestor chain,
       caching the root + every folder that contains an included file
  → setContext: export2ai.enableTokenCounting (drives menu visibility)
  → status bar (counted scope + model + `(est. N tokens)`; click → openSettings; compact tooltip)
  → decorationEmitter.fire(undefined) → optional folder badges refresh or stale badges clear in one event
  → optional Explorer file-decoration badge per folder (formatTokenBadge; badge only, served from cache when enabled)
```

The token estimate is surfaced in the status bar and post-zip notification. The status-bar tooltip names what was counted: the first workspace folder during the automatic scan, or the folder passed to the command. Optional Explorer decoration badges can be enabled with `export2ai.showExplorerTokenBadges` (default `false`); do not add automatic badge behavior outside that opt-in. There are **no per-count menu commands** (see "Why there is no token-bucket menu" below).

### Single-pass folder aggregation (why badges no longer lazy-scan per folder)

Earlier, `provideFileDecoration` kicked off a **separate** full subtree `collectFiles()` for each folder VS Code asked about, returning the badge only after that folder's scan completed and was cached. Two problems followed: badges appeared late (one folder at a time), and a file at depth *d* was read and tokenized **once per ancestor folder** (`O(depth × files)` redundant work).

When Explorer badges are enabled, a refresh does **one** walk of the workspace root, tokenizes each file **once** (`countFilesPerPath`), and propagates each file's count up its ancestor directories (`aggregateDirectoryEstimates`). This caches the root and every folder in a single pass, then fires `onDidChangeFileDecorations(undefined)` so all visible badges update together. `provideFileDecoration` is then a synchronous cache read — the same pattern VS Code's built-in Git decoration provider uses (precompute a full map, serve synchronously). When badges are disabled, the same refresh clears stale decorations and caches only the root status-bar estimate.

The summed per-folder estimate can differ from `countFilesContent()` (the joined-corpus count used by the zip notification) by a handful of newline-boundary tokens — negligible for an estimate and invisible at 2-character badge granularity. Per-folder on-demand scans survive **only** as a fallback during the initial ~5 s deferred-scan window (and for non-primary roots in multi-root workspaces); once a root is fully aggregated, uncached folders simply have no included files and show no badge.

## Data flow: copy project structure

```
export2ai.copyProjectStructure
  → prepareIgnoreContext()
  → ProjectTreeGenerator [projectTree.ts]
  → OutputFormatter [formatters.ts] (plaintext | markdown | xml)
  → clipboard (+ token label if counting enabled)
```

## Data flow: copy one file's content

```
export2ai.copyFileContent
  → validate exactly one target file (no folders, multi-selects, or missing URI)
  → vscode.workspace.fs.stat/readFile()
  → binary check via isbinaryfile
  → UTF-8 decode via fatal TextDecoder
  → clipboard (+ token label if counting enabled)
```

This command is intentionally raw: it copies the file's exact UTF-8 text. It does **not** apply ignore rules, `maxFileSize`, whitespace compression, comment stripping, manifest formatting, or masking. Binary files, invalid UTF-8, directories, multi-selects, read failures, and clipboard failures produce visible Export2AI messages and debug/error logs.

## Data flow: settings navigation

```
export2ai.openSettings / status bar click
  → openOwnExtensionSettings() [extensionSettings.ts]
  → resolveExtensionId() [extensionId.ts]
  → workbench.action.openSettings("@ext:{id}")
  → fallbacks: extension.open → vscode:extension/ URI → user prompts
  → settingsNavigationInProgress guard during navigation (+ 5s cooldown after)
  → Export2AI output channel diagnostics when export2ai.debug is on
```

See **[agent-chokepoints.md](./agent-chokepoints.md)** for why these guards exist.

## Data flow: debug logging

```
High-level extension work
  → debugLog() / debugError() [debugLogger.ts]
  → live read of export2ai.debug
  → export2ai.debug config changes reveal the channel and write "debug: enabled"
  → View -> Output -> Export2AI
  → [Export2AI {local short date/time}] scope: message key=value
```

Debug mode covers activation/deactivation, command registration, settings navigation, zip creation, copy-structure, single-file copy, token estimate refreshes, ignore setup, and file collection. The Output channel is revealed automatically when debug mode is already enabled at activation or when the setting is turned on at runtime. Routine debug entries are skipped when `export2ai.debug` is off; user-facing errors still surface through notifications/errors.

## Ignore pipeline

Shared by zip and copy-structure:

1. `excludePatterns` → `ignore` package globs
2. Optional `.gitignore` merge (`ignoreGitIgnore`)
3. Optional dot-file rule (`.*`) when `ignoreDotFiles`
4. Optional `$*` / `**/$*` when `ignoreDollarFiles`
5. `excludePaths` → workspace-relative or absolute path exclusion
6. Binary check via `isbinaryfile`
7. `maxFileSize` cap (placeholder text if exceeded)
8. Skip output zip path if it appears during collection

`export2ai.copyFileContent` does not use the ignore pipeline because a user explicitly selected one file and asked for its content.

## Commands

| Command ID | Purpose |
|------------|---------|
| `export2ai.zipWorkspace` | Zip entire workspace root |
| `export2ai.zipSelectedFolder` | Zip right-clicked folder (the single zip row in the submenu) |
| `export2ai.modelTarget.*` | Generated (~17); shows **Target model: …** when `config.export2ai.llmModel` matches; hidden from Command Palette |
| `export2ai.zipFor.*` | Generated (~17); **Zip Folder for {model}** when token counting off; hidden from Command Palette |
| `export2ai.copyProjectStructure` | Clipboard tree (+ token label if counting on) |
| `export2ai.copyFileContent` | Right-click a single file → copy exact UTF-8 text to clipboard (+ token label if counting on); hidden from Command Palette |
| `export2ai.openOutputFolder` | Open last zip in OS file manager (session-scoped) |
| `export2ai.openSettings` | Open extension settings via `@ext:` route |

The manifest holds **~40 commands total** — there is no longer a per-token-count command set. Generated `modelTarget.*` / `zipFor.*` commands and the right-click-only single-file copy command are hidden from the Command Palette with `when: false` so it stays clean.

### Settings navigation (no hang)

- Opens via `@ext:publisher.name` (not global settings search)
- Command handler returns immediately (`void openOwnExtensionSettings(...)`)
- Token scans paused while `settingsNavigationInProgress` is true
- **5s cooldown** after navigation before scans resume
- Initial workspace scan deferred **5s** on cold start
- Explorer decoration scans skipped during settings navigation

Static folder-submenu items (settings, copy structure, open last zip) come from `scripts/submenu-base.json`. The single-file right-click row is a direct `explorer/context` command, not a submenu. Generated menus come from `scripts/generate-all-menus.js`.

### Target model in UI

Unified display of `export2ai.llmModel`: **[target-model-ui.md](./target-model-ui.md)**

## Why there is no token-bucket menu (removed in 1.2.3)

VS Code **cannot** set context-menu titles at runtime — a menu row's label is the static `title` from `contributes.commands`. Earlier versions worked around this by pre-generating **~10,900** `export2ai.zip.bucket.{N}` commands (one per token range) and toggling visibility with a `when: export2ai.tokenBucket == N` clause.

That approach was removed because it was **pure cost with no surviving benefit**:

- **Command Palette pollution** — VS Code lists every command that has a `title` in the palette by default. 10,900 `Zip (~N tokens…)` rows flooded it.
- **Manifest bloat** — `package.json` ballooned to ~1.9–4 MB, which slows the Settings UI, npm task detection, and extension-host parse (the original Cursor hang).
- **No menu surface left** — the Explorer submenu can only render a handful of rows, so the bucket rows were already dropped from the submenu; the `setContext('export2ai.tokenBucket', …)` had no consumer.
- **Already covered elsewhere** — the exact token count shows in the **status bar** and **post-zip notification**. Per-folder Explorer decoration badges (`formatTokenBadge`) are optional, off by default, and must stay behind `export2ai.showExplorerTokenBadges`.

Result: the manifest is ~34 KB with ~40 commands. **Do not reintroduce a per-count command set.** If a future requirement truly needs an in-menu count, use a *small* coarse bucket set (≤ ~25 rows) and hide the commands from the palette — never thousands.

## Token counting

`src/utils/tokenCounter.ts` → `selectTokenizer(model)`:

| `TokenCountMethod` | When | `approximate` |
|--------------------|------|---------------|
| `openai-o200k` | Modern GPT (`gpt-5.5`, `gpt-4o`, `o3-mini`, …) | `false` |
| `openai-cl100k` | Legacy GPT (`gpt-4`, `gpt-3.5-*`) | `false` |
| `anthropic-opus-modern` | `claude-opus-4-7*`, `claude-opus-4-8*` | `true` |
| `anthropic-legacy` | Other `claude-*` | `true` |
| `chars-heuristic` | gemini, grok, deepseek, unknown | `true` |

Dependencies: `@anthropic-ai/tokenizer`, `gpt-tokenizer`. **No network calls** for counting.

Default model: `gpt-5.5` (`DEFAULT_LLM_MODEL` in `modelRegistry.ts`).

Display helpers: `src/utils/tokenFormat.ts` (`formatTokenUsageLabel`, `formatStatusBarZipLabel`, `formatTokenTooltip`, settings footer).

## Runtime dependencies

| Package | Use |
|---------|-----|
| `archiver` | Zip creation (`ZipArchive`) |
| `ignore` | Glob / gitignore matching |
| `isbinaryfile` | Skip binary content |
| `gpt-tokenizer` | OpenAI exact counts |
| `@anthropic-ai/tokenizer` | Claude legacy counts |

(`minimatch` may appear transitively via archiver; not a direct dependency.)
