# Target model UI — unified display

Export2AI uses **`export2ai.llmModel`** as the single source of truth for which AI agent the zip is prepared for. That value must appear consistently in menus, status bar, filenames, and notifications.

## Setting

- **Key:** `export2ai.llmModel` (default: `gpt-5.5`)
- **Reader:** `getConfiguration()` in `src/config.ts`
- **Tokenizer:** `TokenCounter.selectTokenizer(model)` in `src/utils/tokenCounter.ts`

Keep `DEFAULT_LLM_MODEL` in `modelRegistry.ts` in sync with the default in `package.slim.json`.

## Zip filename

```
{folderBasename}-{model-slug}-context-{YYYY-MM-DD-HHMMSS}.zip
```

Examples:
- `my-app-gpt-5.5-context-2026-05-30-140000.zip`
- `backend-claude-opus-4-8-context-2026-05-30-140000.zip`

Built by **`buildZipArchiveFileName()`** in `src/utils/modelFormat.ts`. Only the folder's **basename** is used (not the nested path), sanitized and capped at 40 chars via `formatFolderNameSegment()`; the timestamp comes from `formatCompactTimestamp()`.

Default exclude patterns skip `*-chatgpt-context-*.zip` (legacy) and `*-*-context-*.zip` (new).

## Explorer menu structure

When **token counting is enabled**:

1. **`Target model: gpt-5.5`** — from `generate-model-target-menu.js`, visible when `config.export2ai.llmModel == 'gpt-5.5'`. Click opens Settings.
2. **`Zip Folder`** — the single static `export2ai.zipSelectedFolder` row.

When **token counting is disabled**:

- **`Zip Folder for gpt-5.5`** — model-specific `export2ai.zipFor.*` command when config matches
- **`Zip Folder (custom model in Settings)`** — fallback when model not in known list

There is **no per-token-count menu row** — the count appears in the status bar and post-zip notification. Explorer folder badges are optional (`export2ai.showExplorerTokenBadges`, default `false`; see [agent-chokepoints.md](./agent-chokepoints.md) §1).

Known models list: **`MENU_TARGET_MODELS`** in `src/utils/menuTargetModels.ts` (mirror in `scripts/menu-target-models.js`). All generated `modelTarget.*` / `zipFor.*` commands are hidden from the Command Palette (`when: "false"`).

## Status bar

Format: **`{model} · (est. ~47,382 tokens)`** (exact counts omit `~`)

Implementation: `formatStatusBarZipLabel()` in `src/utils/tokenFormat.ts`, updated by `TokenEstimateManager.updateStatusBar()`.

Hover → compact tooltip: counted scope (`workspace Export2AI` or `folder src`), model, token count, exact/approx offline estimate, and Settings hint.

Click → opens Export2AI settings.

## Optional Explorer Folder Badges

Explorer folder badges are controlled by **`export2ai.showExplorerTokenBadges`** and are **off by default**. Do not add another automatic badge path or turn this default on. When enabled, each folder that contains included source files shows a **2-character badge** (`formatTokenBadge`) — e.g. `47` for ~47k tokens. When disabled, `TokenEstimateManager` still computes the workspace status-bar estimate, but `provideFileDecoration` returns `undefined` and fires a full decoration refresh to clear stale badges.

Implementation (`TokenEstimateManager` in `tokenEstimate.ts`):

1. **One workspace walk** — `collectFilesUnder(workspaceRoot)` reads every included file once per refresh.
2. **Per-file tokenize** — `TokenCounter.countFilesPerPath()` selects the tokenizer once and counts each file.
3. **Aggregate up the tree** — `aggregateDirectoryEstimates()` sums each file's count into its ancestor folders and caches every folder in one pass.
4. **Refresh all badges** — `onDidChangeFileDecorations(undefined)` updates every visible folder in one event (same pattern as VS Code's Git decoration provider), or clears stale badges when the setting is off.
5. **Synchronous serve** — `provideFileDecoration` returns the cached badge only when badge display is enabled; no per-folder subtree rescans after aggregation.

The first scan is **deferred ~5 s** after activation (cold-start guard; see [agent-chokepoints.md](./agent-chokepoints.md) §3). File save/create/delete/rename triggers a debounced full refresh. Badge totals may differ from the zip notification by a few newline-boundary tokens — negligible at badge granularity.

## Runtime sync

**None needed.** The target-menu rows use `config.export2ai.llmModel == '…'` `when`-clauses, which VS Code re-evaluates automatically whenever the setting changes. The earlier `activeModelContext.ts` (which set `export2ai.activeLlmModel` / `llmModelKnown` context keys) was removed in 1.2.3 because no menu consumed those keys.

## Limitation (VS Code)

**Model name in the target row** is dynamic via config `when`-clauses for known models; custom models show the fallback target row. A live **token number cannot appear in a menu title** (VS Code limitation) — it is shown in the status bar and notification instead. Explorer folder badges are optional.

The **status bar** and **zip filename** always reflect the live setting immediately.

## Changing copy

| User-visible string | Edit |
|---------------------|------|
| Zip filename | `src/utils/modelFormat.ts` |
| Status bar | `src/utils/tokenFormat.ts` |
| Progress / notification | `src/extension.ts` |
| Target menu rows | `scripts/generate-model-target-menu.js` + `menu-target-models.js` |
| Status bar token label | `src/utils/tokenFormat.ts` (`formatStatusBarZipLabel`) |
| Optional Explorer folder badge | `formatTokenBadge()` in `src/utils/tokenFormat.ts`; gated by `export2ai.showExplorerTokenBadges` |
| Zip manifest | `src/zipService.ts` |
| Folder aggregation | `aggregateDirectoryEstimates()` in `src/tokenEstimate.ts` |

After changing token UI: `npm run compile`, `npm run test:tokens`, and `npm run test:explorer-badges`.
