# AGENTS.md — Export2AI developer & agent guide

This document is for **AI coding agents** and **human contributors** working on the Export2AI VS Code / Cursor extension.

**Source of truth:** TypeScript under `src/` and `package.slim.json`. Extended documentation lives in **[docs/](./docs/README.md)**.

> **Read first:** **[docs/agent-chokepoints.md](./docs/agent-chokepoints.md)** — known hangs, performance traps, and patterns you must not regress. Skipping it has caused real Cursor freezes.

---

## Project summary

| Field | Value |
|-------|-------|
| **Name** | `export2ai` |
| **Display name** | Export2AI |
| **Type** | VS Code extension (CommonJS, TypeScript → `out/`) |
| **Purpose** | Create AI-ready zip archives from workspace folders with ignore rules, optional code compression, language-aware comment stripping, and offline token estimates |
| **Entry point** | `src/extension.ts` → `out/extension.js` |
| **Config namespace** | `export2ai.*` |
| **Command prefix** | `export2ai.*` |
| **Marketplace icon** | `icons/icon-1254x1254.png` |
| **Publisher** | `avnsx` |
| **Default `llmModel`** | `gpt-5.5` (`DEFAULT_LLM_MODEL` in `modelRegistry.ts`) |

Former names: **repozip4ai / RepoZip4AI**, **copy4ai**. All identifiers must use `export2ai` / `Export2AI`. Do not reintroduce old names.

---

## Repository layout

```
Export2AI/
├── src/                          # TypeScript source (not shipped in VSIX)
├── out/                          # compiled JS (shipped in VSIX)
├── scripts/                      # build & test utilities (not shipped)
├── tests/                        # targetable critical smoke-test runner (not shipped)
├── docs/                         # technical documentation
├── icons/                        # packaged marketplace icon + README banner
├── build/                        # generated VSIX output (ignored)
├── package.slim.json             # **manifest source of truth** (hand-edited)
├── package.json                  # generated working manifest; ~22.6 KB after slim, ~40.5 KB after compile
├── CHANGELOG.md
├── README.md                     # user-facing quick start
├── tsconfig.json
└── .vscodeignore
```

Full file-by-file map: **[docs/source-modules.md](./docs/source-modules.md)**

---

## Critical: do not regress these fixes

| Area | Wrong (causes hangs / confusion) | Right (current code) |
|------|----------------------------------|----------------------|
| **Token-count menu** | Pre-generate thousands of `zip.bucket.{N}` commands to show a live count in a menu | No per-count commands. Count lives in **status bar + notification**; Explorer badges are opt-in only |
| **Explorer badges** | Turn badges on by default, add new automatic badge sources, or fire URI badge refreshes while disabled | `export2ai.showExplorerTokenBadges` stays default `false`; disabled mode must return `undefined` and fire full clears |
| **Command Palette** | Leave generated commands with a `title` visible | Hide generated `modelTarget.*` / `zipFor.*` with `when: "false"` |
| **Settings open** | Global settings search; await in command handler | `@ext:{id}` route; `void openOwnExtensionSettings(...)` |
| **Token scan vs settings** | Full-repo scan on activate while opening Settings | 5 s deferred scan; 5 s post-settings cooldown; `settingsNavigationInProgress` |
| **Model display** | Hardcoded “ChatGPT” in menus / `*-chatgpt-context-*.zip` | Unified `export2ai.llmModel` — see [target-model-ui.md](./docs/target-model-ui.md) |
| **Manifest edit** | Hand-edit generated `package.json` | Edit `package.slim.json` + run `generate-all-menus.js` |
| **Package VSIX** | Let `vsce package` write into repo root | `npm run package` compiles once and writes `build/export2ai-x.x.x.vsix` |
| **Dead context keys** | Add `setContext` keys no menu reads | Only `export2ai.enableTokenCounting` is consumed by menus |

Details and rationale: **[docs/agent-chokepoints.md](./docs/agent-chokepoints.md)**

> **History (1.2.3):** the ~10,900 `export2ai.zip.bucket.{N}` command system was **removed**. It bloated `package.json` to ~1.9–4 MB, polluted the Command Palette, and was the root cause of Cursor settings/activate hangs — while duplicating status-bar and notification estimates. `package.json` is now small (~22.6 KB after `slim:package`, ~40.5 KB after compile). **Do not bring it back.** See [docs/agent-chokepoints.md](./docs/agent-chokepoints.md) §1.

---

## Architecture (summary)

Detailed flows: **[docs/architecture.md](./docs/architecture.md)**

- **Zip:** `extension.ts` → `zipService.ts` → `FileProcessor.collectFiles()` → archiver
- **Token estimate:** `TokenEstimateManager` in `tokenEstimate.ts` (deferred scan; status bar with counted scope; optional opt-in decoration badge)
- **Copy structure:** `projectService.ts` → `projectTree.ts` + `formatters.ts`
- **Copy file content:** `projectService.ts` → validate one file → raw UTF-8 clipboard copy (+ token label if enabled)
- **Settings nav:** `extensionSettings.ts` + `@ext:` route with fallbacks
- **Debug logging:** `debugLogger.ts` gates full-extension diagnostics behind `export2ai.debug` and writes local-time lines to the Export2AI output channel
- **Comments:** `commentStripper.ts` + `commentProfiles.ts` when `removeComments` is on
- **Target model UI:** `modelFormat.ts` + generated model-target menus (config `when`-clauses)

---

## Token count display (NO bucket commands)

The token estimate is shown in **three places**, none of which is a menu command:

1. **Status bar** — `gpt-5.5 · (est. ~47,382 tokens)` via `formatStatusBarZipLabel()`; hover tooltip names the counted scope; click opens Settings.
2. **Optional Explorer decoration badge** — disabled by default. If the user explicitly enables `export2ai.showExplorerTokenBadges`, folders can show a 2-char badge via `formatTokenBadge()` (badge only, no tooltip). Populated by **one** workspace walk (`aggregateDirectoryEstimates`); `provideFileDecoration` is a synchronous cache read — do not restore per-folder subtree scans (see [docs/agent-chokepoints.md](./docs/agent-chokepoints.md) §3).
3. **Post-zip notification** — exact/approx count after creating the archive.

VS Code **cannot** compute a menu row's title at runtime, so there is **no** way to show a live token number *inside a menu* without pre-generating one command per number. The old design generated **~10,900** such commands and was removed in 1.2.3 (manifest bloat, Command Palette pollution, activate/settings hangs — all for a number already shown three other ways).

**Rule:** never reintroduce `export2ai.zip.bucket.*` or any per-count command set. If a future requirement genuinely needs an in-menu count, use a **small coarse bucket set (≤ ~25 rows)** and hide the commands from the Command Palette — never thousands. Full rationale: [docs/agent-chokepoints.md](./docs/agent-chokepoints.md) §1.

**Badge rule:** do not reintroduce automatic Explorer badges. The only allowed badge path is the existing user opt-in setting, default `false`, guarded in `TokenEstimateManager.provideDecoration()`. Disabled mode must clear stale decorations and `npm run test:explorer-badges` must pass before release.

### Generated menus (small, build-time)

`scripts/generate-model-target-menu.js` emits ~34 `modelTarget.*` / `zipFor.*` commands with `config.export2ai.llmModel == '…'` when-clauses (the **Target model: …** row). `scripts/merge-package.js`:
- merges them into `package.json` (kept the hand-written base commands from `package.slim.json`),
- adds **one** zip row (`export2ai.zipSelectedFolder`) to the Explorer submenu,
- hides every generated command from the Command Palette with `when: "false"`.

Keep `src/utils/menuTargetModels.ts` and `scripts/menu-target-models.js` in sync (model list mirror).

---

## Build & test

```bash
npm install
npm run compile           # precompile (menus) → tsc → postcompile (comment sync + merge)
npm run slim:package      # before commit — strips fat manifest
npm run test:tokens
npm run test:soft-delete
npm run test:debug-logger
npm run test:comments
npm run test:model-format
npm run test:menu-merge   # submenu shape + palette hides + no bucket rows
npm run test:explorer-badges # runtime provider gate: badges off by default, opt-in only
npm run test:critical        # 11 targetable release smoke checks
npm run test:marketplace-assets
npm run test:live
npm run test:settings-nav
npm run package           # compile once + build/export2ai-x.x.x.vsix
```

Full pipeline: **[docs/build-and-test.md](./docs/build-and-test.md)**

**Note:** `tsc` is fast (~2–3 s). `package.json` is now small (~22.6 KB after `slim:package`, ~40.5 KB / ~41 commands after compile), so manifest parse is no longer a hang source. `npm run package` writes VSIX files only to `build/`. If you ever see the manifest grow into the MB range again, you have reintroduced a generated-command explosion — stop and reconsider.

---

## Configuration

All settings: **[docs/configuration.md](./docs/configuration.md)**

Runtime reader: `getConfiguration()` in `src/config.ts`.

Read-only display settings (not read at runtime): `export2ai.extensionInfo`, `export2ai.commentStripLanguages`.

### Add a settings knob

1. Property in the correct **category** inside **`package.slim.json`** (`contributes.configuration` array — see [configuration.md](./docs/configuration.md))
2. `Export2AIConfiguration` in `types.ts`
3. Read in `config.ts` (clamps if numeric)
4. Wire through services
5. `npm run compile`

---

## Comment stripping

Full reference: **[docs/comment-stripping.md](./docs/comment-stripping.md)**

- 18 syntax families, 175 extensions in `commentProfiles.ts`
- String-aware scanner in `commentStripper.ts`
- Settings markdown synced via `scripts/sync-comment-settings.js` on `postcompile`

---

## Coding conventions

1. **Minimal diffs** — do not refactor unrelated code.
2. **Match existing style** — CommonJS output, strict TypeScript, async/await.
3. **Config keys** must stay `export2ai.*`.
4. **User-visible strings** — prefix `Export2AI:` for errors/warnings where applicable.
5. **Manifest inside zip:** `_EXPORT2AI_MANIFEST.txt` includes `Target model:` from `llmModel`, the source folder basename, redacted source-path status, soft-delete settings, and collection counts. It must not leak the absolute local source path.
6. **Zip naming:** `{folderBasename}-{model-slug}-context-{YYYY-MM-DD-HHMMSS}.zip` — folder **basename only** (capped at 40 chars) + compact timestamp; see `modelFormat.ts` (`formatFolderNameSegment`, `formatCompactTimestamp`).

---

## Pitfalls & gotchas

| Issue | Detail |
|-------|--------|
| **No per-count menu commands** | **Never** generate `export2ai.zip.bucket.*` (or any per-number command set). It bloats the manifest, pollutes the palette, and hangs Cursor. Token count is in status bar + notification; folder badges are explicit opt-in only. |
| **No automatic Explorer badges** | Keep `export2ai.showExplorerTokenBadges` default `false`. Do not add another badge provider/path, do not show tooltips on badges, and do not fire URI-specific badge refreshes while disabled. |
| **Command Palette hygiene** | Any **generated** command with a `title` must be hidden via a `commandPalette` `when: "false"` row (handled in `merge-package.js`). |
| **Dead context keys** | Only `export2ai.enableTokenCounting` is consumed by menus. Don't add `setContext` keys nothing reads (we removed `tokenBucket`, `tokenCountExact`, `tokenCountFormatted`, `activeLlmModel`, `llmModelKnown`). |
| **Submenu = one zip row** | The Explorer submenu uses a single `export2ai.zipSelectedFolder` row. Don't add many `when`-gated zip rows. |
| **compile before tests** | Tests import from `out/utils/`. |
| **postcompile merge** | `merge:package` runs after tsc; needs `model-target-contributes.json`. |
| **generate:menus** | Runs `generate-all-menus.js` (model-target only now). |
| **File decoration badge** | Max **2 characters** — use `formatTokenBadge()`. Populate via **single-pass aggregation** (`aggregateDirectoryEstimates`); never scan per folder in `provideFileDecoration`. |
| **Opus 4.7+ counts** | Heuristic uplift, not API-exact. |
| **Comment stripping** | `.json`, `.md`, unknown extensions unchanged. |
| **Settings + token scan** | `settingsNavigationInProgress` + 5 s cooldown; decoration scans paused during navigation. |
| **npm.autoDetect** | Kept `off` as belt-and-suspenders; no longer critical now the manifest is small. |
| **vsce DEP0040** | Suppressed in `npm run package` only. |
| **Legacy zip names** | `*-chatgpt-context-*.zip` excluded by default; new pattern `*-*-context-*.zip`. |
| **Git metadata soft-delete** | Keep real repository-control files (`.github/**`, `.gitignore`, `.gitattributes`, `.gitmodules`, `.mailmap`, `.gitkeep`, `.git-blame-ignore-revs`) but never create `.git/` by default. The default marker is `_EXPORT2AI_PLACEHOLDERS/git/EXPORT2AI_SOFT_DELETE_PLACEHOLDER.txt`; `.git/EXPORT2AI_SOFT_DELETE_PLACEHOLDER.txt` is allowed only when `export2ai.softDeleteGitMetadata.realGitPathPlaceholder` is explicitly true. |
| **Context include policy** | Keep `AGENTS.md`, `README.md`, `pyproject.toml`, `docs/**`, `tests/**`, and `tools/**` available even when broad ignore rules hide them. Actual credential/key material stays excluded, but source/script files and `.github/workflows/*.yml|*.yaml` are not dropped only because their filename mentions token/key words. |
| **Built-in excludes UI** | Keep the 40 safe defaults enabled via `export2ai.useBuiltInExcludePatterns` default `true`; `export2ai.excludePatterns` defaults to `[]` for additional project patterns so Settings does not render a long array. The full list is managed by the `export2ai.showBuiltInExcludePatterns` Command Palette action; unchecked built-ins are stored in the intentionally editable enum-backed `export2ai.disabledBuiltInExcludePatterns` array and are included again. |

Full write-up: **[docs/agent-chokepoints.md](./docs/agent-chokepoints.md)**

---

## Checklist before PR / release

- [ ] Read [docs/agent-chokepoints.md](./docs/agent-chokepoints.md) if you touched activate, menus, settings nav, or build
- [ ] `npm run compile` succeeds
- [ ] `npm run test:critical` passes for release-level smoke, or a named `npm run test:critical:<target>` is run for scoped changes
- [ ] `npm run test:tokens` passes (includes manifest-hygiene: no bucket commands, palette hides)
- [ ] `npm run test:soft-delete` passes
- [ ] `npm run test:debug-logger` passes
- [ ] `npm run test:comments` passes
- [ ] `npm run test:model-format` passes
- [ ] `npm run test:menu-merge` passes (if menus/build changed)
- [ ] `npm run test:explorer-badges` passes
- [ ] `npm run test:marketplace-assets` passes after `npm run package` if manifest/package assets or VSIX hygiene changed
- [ ] `npm run test:live` passes
- [ ] `npm run test:settings-nav` passes
- [ ] `npm run slim:package` if committing
- [ ] Docs updated if behavior changed (`docs/`, README, CHANGELOG)
- [ ] No legacy name references in source or docs
- [ ] `CHANGELOG.md` updated; `version` bumped in `package.slim.json` if releasing

---

## Reference

- [docs/agent-chokepoints.md](./docs/agent-chokepoints.md) — **performance & hang prevention**
- [docs/target-model-ui.md](./docs/target-model-ui.md) — unified model display
- [docs/README.md](./docs/README.md) — documentation index
- [VS Code Extension API](https://code.visualstudio.com/api)
- [contributes.menus](https://code.visualstudio.com/api/references/contribution-points#contributes.menus)
