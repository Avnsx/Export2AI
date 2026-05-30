# Changelog

All notable changes to Export2AI are documented in this file.

## [1.2.5] - 2026-05-30

### Changed

- **Instant Explorer folder badges (single-pass aggregation)** — token badges for every folder are now computed from **one** workspace walk instead of a separate subtree scan per folder. `TokenCounter.countFilesPerPath()` tokenizes each file once and `aggregateDirectoryEstimates()` sums those counts up each file's ancestor directories, caching the root and every folder in a single pass before firing one decoration-refresh event. `provideFileDecoration` is now a synchronous cache read (the same approach VS Code's built-in Git decoration provider uses).

### Fixed

- **Redundant token scanning** — the old design re-read and re-tokenized each file once per ancestor folder (`O(depth × files)`), so badges appeared one folder at a time and large repos paid repeated I/O. Files are now read and tokenized exactly once per refresh; per-folder on-demand scans remain only as a fallback during the initial ~5 s deferred-scan window (and for non-primary roots in multi-root workspaces).
- **Stale estimates after edits** — a workspace refresh now performs a fresh walk and rebuilds the folder cache, so saving, creating, deleting, or renaming files updates the status bar and badges (previously the cached root short-circuited the refresh).

## [1.2.4] - 2026-05-30

### Added

- **Clearer Settings copy** — plain-language descriptions under **Compress code**, **Remove comments**, and **ZIP compression level** (Zip archive / Comments categories). Each keeps a **Technical:** block in `markdownDescription` for implementation detail. Humane intro for Remove comments is synced at compile via `REMOVE_COMMENTS_USER_DESCRIPTION` in `commentProfiles.ts`.

### Changed

- **Shorter, cleaner zip names** — the archive name uses only the selected folder's **basename** (not the full nested path; no more `y--HOST_ROOT-…` clutter) and a compact `YYYY-MM-DD-HHMMSS` timestamp. Example: `WinMGT-gpt-5.5-context-2026-05-30-182617.zip`. Folder segment capped at 40 characters. Helpers: `formatFolderNameSegment()` and `formatCompactTimestamp()` in `modelFormat.ts`.
- **Safer export defaults** — `export2ai.compressCode` and `export2ai.removeComments` default to **`false`** so zips preserve full source unless you opt in to trimming or comment stripping.
- **Token estimate UI** — status bar label uses `(est. ~N tokens)` / `(est. N tokens)` via `formatTokenUsageLabel()`; status-bar hover tooltip is compact (active model + exact/approx offline estimate + settings footer). Explorer decoration badges are **badge-only** (no per-folder tooltip).
- **Status bar stability** — workspace-root token estimate is published from the root scan only, so the status bar no longer jumps when Explorer folder decoration scans finish.

### Fixed

- **`scripts/live-test.js`** — comment assertion respects `removeComments` default (`false`: comments preserved; `true`: stripped).
- **Documentation** — README, `AGENTS.md`, and `docs/` synced with current token UI, zip naming, settings copy, and defaults.

## [1.2.3] - 2026-05-30

### Added

- **GNU General Public License v3.0** — added `LICENSE.txt` (full GPL-3.0 text) and set the manifest `license` to `GPL-3.0-only`.
- **Automated releases** — `.github/workflows/release.yml` builds the VSIX on every `v*.*.*` tag, attaches it to a GitHub Release, and generates human-friendly notes from this changelog via `scripts/release-notes.js`. Optional VS Code Marketplace (`VSCE_PAT`) and Open VSX / Cursor (`OVSX_PAT`) publish steps activate automatically once those secrets are added.

### Removed

- **Token-bucket command system (~10,900 commands)** — deleted `export2ai.zip.bucket.*` generation and all supporting code (`tokenBuckets.ts`, `zipBucketCommands.ts`, `zipBucketRegistry.ts`, `generate-token-menu.js`, `token-bucket-config.js`). VS Code cannot set menu titles at runtime, so the old design pre-generated one command per token range — which bloated `package.json` to ~1.9–4 MB, flooded the Command Palette, and was the root cause of Cursor activate/settings hangs. The token estimate was already shown in the status bar, the Explorer decoration badge, and the post-zip notification, so nothing user-facing was lost.
- **Dead context keys** — `export2ai.tokenBucket`, `export2ai.tokenCountExact`, `export2ai.tokenCountFormatted`, `export2ai.activeLlmModel`, `export2ai.llmModelKnown` (no menu consumed them). Removed `activeModelContext.ts`; the `Target model: …` rows read `config.export2ai.llmModel` directly.
- **Dead helpers** — `estimateTokensForFolder()` (`zipService.ts`) and `formatZipMenuTitle()` (`tokenFormat.ts` / `TokenCounter`).

### Fixed

- **`package.json` size** — ~1.9 MB → **~32 KB** (~39 commands instead of ~10,939). Settings UI, manifest parse, and npm task detection are no longer at risk of hanging.
- **Command Palette pollution** — generated `modelTarget.*` / `zipFor.*` commands are now hidden from the palette with `when: "false"` (added in `merge-package.js`).
- **`maxDepth` clamp** — copy-structure depth is clamped to ≥ 0.

### Changed

- Build pipeline simplified: `generate-all-menus.js` now generates only the model-target layer; `slim-package.js` strips all generated command prefixes; `test:menu-merge` replaces `test:zip-buckets`; `test:tokens` now asserts manifest hygiene (zero bucket commands, palette hides present).
- Docs (`AGENTS.md`, `docs/agent-chokepoints.md`, `architecture.md`, `target-model-ui.md`, `source-modules.md`, `build-and-test.md`) rewritten to explain why the bucket system must not be reintroduced.

## [1.2.2] - 2026-05-30

### Added

- **Unified target model across UI** — zip filenames use `{folder}-{model}-context-{timestamp}.zip`; Explorer menu shows `Target model: …` from `export2ai.llmModel`; status bar leads with the active model; progress and success notifications include the model. — `removeComments` strips comments per file extension using string-aware rules in `commentStripper.ts` (18 syntax families: C-family, PHP, Python/shell `#`, SQL, HTML, CSS, Lua, Haskell, OCaml/F#, VB, MATLAB, Erlang, PowerShell, batch, Lisp, Vim, LaTeX). Read-only `export2ai.commentStripLanguages` and expanded `export2ai.removeComments` markdown in Settings; synced at compile via `scripts/sync-comment-settings.js`.
- **GPT-5.5 default tokenizer** — `export2ai.llmModel` defaults to `gpt-5.5` (exact o200k via `gpt-tokenizer`). Central constant: `DEFAULT_LLM_MODEL` in `modelRegistry.ts`.
- **Claude Opus 4.7 / 4.8 support** — `claude-opus-4-7*` and `claude-opus-4-8*` use content-aware uplift on the legacy Anthropic baseline (`anthropicTokenizer.ts`) because Anthropic’s updated Opus tokenizer is not shipped as an offline npm package.
- **Compact extension info in Settings** — read-only `export2ai.extensionInfo` at the top of the settings page (e.g. `Extension version v.1.2.2 · Last updated May 30, 2026`), synced from `package.json` version + `CHANGELOG.md` at merge time via `scripts/extension-metadata.js`.
- **Tokenizer tooltip chart** — status bar / explorer tooltips list compatible models; footer links to Extension Settings.
- **`$`-prefixed file ignore** — `export2ai.ignoreDollarFiles` (default `true`) skips temp paths like `$RECYCLE.BIN`.
- **Dynamic extension ID resolution** — settings navigation uses `context.extension.id` (fallback: `publisher.name` from manifest).
- **Safer settings fallbacks** — `extension.open`, `vscode:extension/` URI, then Copy Extension ID / Open Extensions View. Global text search is never the primary path.
- **Export2AI output channel** — diagnostics when `export2ai.debug` is enabled.
- **Slim manifest workflow** — `package.slim.json` is the source of truth; bucket commands merge into fat `package.json` only at compile/package time.
- **Tests** — `test:tokens`, `test:comments`, `test:live`, `test:settings-nav`.
- **`/docs` folder** — architecture, source modules, configuration, comment stripping, build & test guides synced with the codebase.
- **`docs/agent-chokepoints.md`** — documents activate hangs, settings navigation races, fat manifest traps, and lazy bucket registration (for future agents).
- **`docs/target-model-ui.md`** — unified `export2ai.llmModel` display across menus, status bar, and zip filenames.

### Fixed

- **Extension activation hang** — lazy registration for `export2ai.zip.bucket.*` commands (~1 handler at a time instead of ~10,900 on every activate).
- **VSIX packaging efficiency** — `npm run package` compiles once; `vscode:prepublish` only verifies `out/extension.js`. Removed unused direct `minimatch` dependency. `package.slim.json` excluded from VSIX.
- **npm task detection / Cursor hang on huge `package.json`** — workspace recommends `npm.autoDetect: off`; run npm scripts from the terminal.
- **Settings navigation vs token scan race** — deferred initial scan (5s), 5s post-settings cooldown, decoration scans paused during navigation, lazy zip-bucket command registration.
- **Zip token labels always approximate** — notifications and progress now respect `tokenApproximate` (OpenAI exact, Claude `~`).
- **Config clamps** — `fileConcurrency` 1–32, `compressionLevel` 0–9, `maxFileSize` ≥ 0.
- **vsce punycode DEP0040 warning** — suppressed during `npm run package` (dev dependency chain only; not used at extension runtime).

## [1.2.1] - 2026-05-30

- Token bucket menu generation and approximate token display improvements.
- Renamed from repozip4ai to export2ai.
- System file manager reveal for last created zip.
