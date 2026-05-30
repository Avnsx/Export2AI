# Target model UI — unified display

Export2AI uses **`export2ai.llmModel`** as the single source of truth for which AI agent the zip is prepared for. That value must appear consistently in menus, status bar, filenames, and notifications.

## Setting

- **Key:** `export2ai.llmModel` (default: `gpt-5.5`)
- **Reader:** `getConfiguration()` in `src/config.ts`
- **Tokenizer:** `TokenCounter.selectTokenizer(model)` in `src/utils/tokenCounter.ts`

Keep `DEFAULT_LLM_MODEL` in `modelRegistry.ts` in sync with the default in `package.slim.json`.

## Zip filename

```
{folderSafeName}-{model-slug}-context-{ISO-timestamp}.zip
```

Examples:
- `my-app-gpt-5.5-context-2026-05-30T14-00-00-000Z.zip`
- `backend-claude-opus-4-8-context-2026-05-30T14-00-00-000Z.zip`

Built by **`buildZipArchiveFileName()`** in `src/utils/modelFormat.ts`.

Default exclude patterns skip `*-chatgpt-context-*.zip` (legacy) and `*-*-context-*.zip` (new).

## Explorer menu structure

When **token counting is enabled**:

1. **`Target model: gpt-5.5`** — from `generate-model-target-menu.js`, visible when `config.export2ai.llmModel == 'gpt-5.5'`. Click opens Settings.
2. **`Zip Folder`** — the single static `export2ai.zipSelectedFolder` row.

When **token counting is disabled**:

- **`Zip Folder for gpt-5.5`** — model-specific `export2ai.zipFor.*` command when config matches
- **`Zip Folder (custom model in Settings)`** — fallback when model not in known list

There is **no per-token-count menu row** — the count appears in the status bar, the Explorer decoration badge, and the post-zip notification (see [agent-chokepoints.md](./agent-chokepoints.md) §1).

Known models list: **`MENU_TARGET_MODELS`** in `src/utils/menuTargetModels.ts` (mirror in `scripts/menu-target-models.js`). All generated `modelTarget.*` / `zipFor.*` commands are hidden from the Command Palette (`when: "false"`).

## Status bar

Format: **`{model} · (~N tokens will be used)`**

Implementation: `formatStatusBarZipLabel()` in `src/utils/tokenFormat.ts`, updated by `TokenEstimateManager.updateStatusBar()`.

Click → opens Export2AI settings.

## Runtime sync

**None needed.** The target-menu rows use `config.export2ai.llmModel == '…'` `when`-clauses, which VS Code re-evaluates automatically whenever the setting changes. The earlier `activeModelContext.ts` (which set `export2ai.activeLlmModel` / `llmModelKnown` context keys) was removed in 1.2.3 because no menu consumed those keys.

## Limitation (VS Code)

**Model name in the target row** is dynamic via config `when`-clauses for known models; custom models show the fallback target row. A live **token number cannot appear in a menu title** (VS Code limitation) — it is shown in the status bar, Explorer decoration badge, and notification instead.

The **status bar** and **zip filename** always reflect the live setting immediately.

## Changing copy

| User-visible string | Edit |
|---------------------|------|
| Zip filename | `src/utils/modelFormat.ts` |
| Status bar | `src/utils/tokenFormat.ts` |
| Progress / notification | `src/extension.ts` |
| Target menu rows | `scripts/generate-model-target-menu.js` + `menu-target-models.js` |
| Status bar token label | `src/utils/tokenFormat.ts` (`formatStatusBarZipLabel`) |
| Zip manifest | `src/zipService.ts` |

After changing generators: `npm run compile`.
