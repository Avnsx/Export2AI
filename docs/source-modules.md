# Source modules

## `src/` — TypeScript (compiled to `out/`, shipped in VSIX)

| File | Responsibility |
|------|----------------|
| `extension.ts` | Activate/deactivate, command registration, zip UX, session `lastZipPath`, progress notifications |
| `config.ts` | Reads `export2ai.*` from VS Code configuration; default exclude patterns; value clamps |
| `types.ts` | `Export2AIConfiguration`, `FileContent`, `TokenCountMethod`, collect/zip option interfaces |
| `zipService.ts` | `createZipArchive()`; archiver integration, in-zip manifest |
| `projectService.ts` | Ignore context, copy project structure, tree + formatter orchestration |
| `tokenEstimate.ts` | `TokenEstimateManager` — status bar, Explorer decoration badge, deferred scans |
| `archiver-v8.d.ts` | Type declarations for archiver v8 `ZipArchive` |
| `ignore.d.ts` | Type declarations for `ignore` package |

### `src/utils/`

| File | Responsibility |
|------|----------------|
| `fileProcessor.ts` | Recursive file collection, binary detection, UTF-8 decode, `processContent()` |
| `commentProfiles.ts` | Extension → comment syntax profile map; settings markdown builders |
| `commentStripper.ts` | String-aware comment removal per profile |
| `ignoreUtils.ts` | Gitignore loading, glob ignore instance, `excludePaths` checks |
| `projectTree.ts` | Folder tree generation for copy-structure |
| `formatters.ts` | Plaintext / markdown / XML structure output |
| `tokenCounter.ts` | `selectTokenizer()` → family-specific counting |
| `anthropicTokenizer.ts` | Opus 4.7+ content-aware uplift heuristics |
| `tokenFormat.ts` | Display strings, badge formatting, status-bar label, compact status-bar tooltip |
| `modelRegistry.ts` | `MODEL_REGISTRY`, `detectFamily`, `DEFAULT_LLM_MODEL` |
| `modelFormat.ts` | Model file slug, command-id slug, compact folder-name + timestamp helpers, zip filename builder |
| `menuTargetModels.ts` | `MENU_TARGET_MODELS` — models with config-scoped Explorer menu rows |
| `extensionSettings.ts` | `openOwnExtensionSettings()`, navigation guards, output channel |
| `extensionId.ts` | `resolveExtensionId`, `buildExtensionSettingsQuery` |
| `systemExplorer.ts` | Reveal zip in OS file manager (WSL fallback) |
| `uriUtils.ts` | Path / URI helpers |
| `asyncPool.ts` | Bounded concurrency + directory queue for parallel reads |

## `scripts/` — build & test (not shipped in VSIX)

| File | Responsibility |
|------|----------------|
| `generate-all-menus.js` | Runs the model-target menu generator (only generator now) |
| `generate-model-target-menu.js` | Writes `model-target-contributes.json` (Target model / ZipFor rows + Command Palette hides) |
| `menu-target-models.js` | Shared list of models for config `when` clauses (mirror `menuTargetModels.ts`) |
| `merge-package.js` | Merges slim + model-target JSON → `package.json`; builds submenu; hides generated commands from palette |
| `slim-package.js` | Strips generated commands/menus from `package.json` back to slim |
| `extension-metadata.js` | Syncs `export2ai.extensionInfo` from version + `CHANGELOG.md` |
| `configuration-utils.js` | Read settings from categorized or flat `contributes.configuration` |
| `sync-comment-settings.js` | Syncs comment-strip markdown into `package.slim.json` from compiled `out/` |
| `verify-build.js` | Ensures `out/extension.js` exists before VSIX pack (avoids double compile) |
| `submenu-base.json` | Static Explorer submenu items (copy structure, settings, open zip) |
| `test-token-format.js` | Token format, Opus routing, status-bar labels, manifest hygiene |
| `test-comment-strip.js` | Language-aware comment stripping assertions |
| `test-model-format.js` | Model slug and zip filename helpers |
| `test-menu-merge.js` | Submenu shape, single zip row, palette hides, no bucket rows |
| `test-extension-settings.js` | Extension ID resolution + metadata sync |
| `live-test.js` | End-to-end zip creation smoke test |

## Root config

| File | Role |
|------|------|
| `package.slim.json` | **Manifest source of truth** — edit settings, commands, scripts here |
| `package.json` | Generated after compile (~32 KB) — do not hand-edit |
| `tsconfig.json` | TypeScript compile options (`src/` → `out/`) |
| `.vscodeignore` | Controls VSIX contents |
| `CHANGELOG.md` | Release history; feeds `export2ai.extensionInfo` date |
