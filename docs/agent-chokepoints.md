# Agent chokepoints — read before changing menus, activate, settings nav, or build

This document captures **known failure modes** discovered during Export2AI development. Treat these as hard constraints unless you are deliberately redesigning the feature **and** have re-validated the manifest size and Command Palette.

**Related:** [AGENTS.md](../AGENTS.md) (summary), [architecture.md](./architecture.md), [build-and-test.md](./build-and-test.md).

---

## 1. Never generate thousands of commands for a dynamic menu label

### Symptom
Cursor/VS Code **freezes or hangs** on extension load, when opening Settings, or when clicking the status bar — often misattributed to `node_modules` or “slow compile.” The Command Palette is also flooded with near-duplicate rows.

### History (what went wrong, twice)
VS Code **cannot** compute a context-menu row's title at runtime — the label is the static `title` from `contributes.commands`. To show a live `Zip (~12,450 tokens)` label in the Explorer menu, an earlier design pre-generated **~10,900** `export2ai.zip.bucket.{N}` commands (one per token range) toggled by `when: export2ai.tokenBucket == N`.

This caused a cascade of problems:
1. **Activate hang** — registering ~10,900 handlers synchronously on `activate` blocked the extension host. (A later "fix" moved registration to background batches — still wasteful.)
2. **Manifest bloat** — `package.json` grew to ~1.9–4 MB / ~120k lines, slowing the Settings UI, npm task detection, and manifest parse.
3. **Command Palette pollution** — every command with a `title` shows in the palette by default; 10,900 `Zip (~N tokens…)` rows drowned it.
4. **Dead `setContext`** — once the bucket rows were dropped from the submenu (Cursor won't render thousands of rows), `setContext('export2ai.tokenBucket', …)` had **no** consumer at all.

### Resolution (1.2.3 — keep it this way)
**The entire bucket system was deleted.** The token estimate is already shown in three places that need no menu command:
- **Status bar** — `gpt-5.5 · (est. ~47,382 tokens)` (`formatStatusBarZipLabel`); compact hover tooltip.
- **Explorer decoration badge** — 2-char folder badge only (`formatTokenBadge`); no badge tooltip. One workspace walk populates every folder; `provideFileDecoration` reads the cache synchronously.
- **Post-zip notification** — exact/approx count after the archive is written.

`package.json` is now **~34 KB / ~40 commands**. Deleted: `src/utils/{tokenBuckets,zipBucketCommands,zipBucketRegistry}.ts`, `scripts/{token-bucket-config,generate-token-menu,test-zip-bucket-commands}.js`, and context keys `tokenBucket` / `tokenCountExact` / `tokenCountFormatted`.

### Do not
- Reintroduce `export2ai.zip.bucket.*` or any "one command per number" set.
- Add `setContext` keys that no menu `when`-clause reads.
- Assume a menu can show a computed number — it cannot.

### If you *truly* need an in-menu count later
Use a **small coarse bucket set (≤ ~25 rows)**, e.g. ranges like `<1k`, `1–5k`, `5–10k`, `10–50k`, …, and **hide every generated command from the Command Palette** (`when: "false"`). Never thousands. Re-measure `package.json` size after.

### Verify
```bash
npm run test:tokens       # includes manifest-hygiene: 0 bucket commands, palette hides present
npm run test:menu-merge
```

---

## 2. Manifest size is the canary

| Artifact | Size | Slows `tsc`? | Slows Cursor/VS Code? |
|----------|------|--------------|------------------------|
| `node_modules/` | ~170 MB | No (not compiled) | Slightly on disk scan |
| `package.json` (generated) | **~34 KB now** (was ~1.9–4 MB) | No | Only if it balloons again |
| `src/` | ~24 files | Yes (~2–3 s) | No |

### Rules
- **Edit `package.slim.json`**, never the generated `package.json`.
- If `package.json` exceeds a few hundred KB, you have reintroduced a generated-command explosion — **stop**.
- `"npm.autoDetect": "off"` is kept as belt-and-suspenders; it is no longer critical now the manifest is small.
- Run **`npm run slim:package`** before committing if you regenerated `package.json` locally.

### Compile pipeline order (do not invert)
```
precompile  → generate:menus (generate-all-menus.js → model-target only)
compile     → tsc
postcompile → sync-comment-settings.js → merge:package
```

`merge:package` runs **after** `tsc` and requires `scripts/generated/model-target-contributes.json`.

---

## 3. Settings navigation vs token scan (race)

### Symptom
Opening Export2AI settings **hangs** or stutters while a full-repo token walk runs on cold start.

### Guards (do not remove)
| Mechanism | Location | Purpose |
|-----------|----------|---------|
| `settingsNavigationInProgress` | `extensionSettings.ts` | Blocks token rescans during settings open |
| `SETTINGS_NAV_COOLDOWN_MS` (5 s) | `extensionSettings.ts` | Keeps scans paused after navigation so Settings UI can render |
| `INITIAL_SCAN_DELAY_MS` (5 s) | `tokenEstimate.ts` | Defers first workspace scan on activate |
| `POST_SETTINGS_REFRESH_DELAY_MS` (1.5 s) | `tokenEstimate.ts` | Extra debounce after navigation callback |
| Skip decoration scans | `tokenEstimate.ts` `provideDecoration` | No folder walks during settings navigation |
| `@ext:` route | `extensionSettings.ts` | **Never** use global settings text search as primary path |
| `void openOwnExtensionSettings(...)` | `extension.ts` | Command handler returns immediately |

### Settings open flow
```
workbench.action.openSettings("@ext:{publisher}.{name}")
  → fallback: extension.open → vscode:extension/ URI → user prompts
```

Enable **`export2ai.debug`** and **View → Output → Export2AI** to diagnose. Debug logging is now shared across the extension (activation, commands, zip/copy, single-file copy, token scans, file collection, and settings navigation), not only the settings page. Routine debug entries must stay gated by the live setting; turning `export2ai.debug` off must stop later Output lines. F5 configs in `.vscode/launch.json`:
- **Run Extension** — normal
- **Run Extension (auto settings test)** — sets `EXPORT2AI_AUTO_TEST_SETTINGS=1`

### Verify
```bash
npm run test:settings-nav
```

### Folder badges: aggregate once, do not scan per folder
`provideFileDecoration` must stay a **synchronous cache read**. Do **not** restore the old pattern where each folder decoration launched its own `collectFiles()` subtree walk — that re-read and re-tokenized every file once per ancestor folder (`O(depth × files)`), made badges appear one folder at a time, and multiplied I/O on large repos.

Current design (`tokenEstimate.ts`):
- One `collectFilesUnder(workspaceRoot)` walk per refresh.
- `TokenCounter.countFilesPerPath()` tokenizes each file **once**.
- `aggregateDirectoryEstimates()` sums each file's count up its ancestor chain → caches the root **and every folder** in a single pass, then fires `onDidChangeFileDecorations(undefined)` (one event, no 250-resource cap).
- `fullyScannedRoots` gates the per-folder fallback: it runs **only** before the first full aggregation (initial deferred-scan window) or for non-primary multi-root folders.

Keep `countFilesPerPath` (per-file) distinct from `countFilesContent` (joined-corpus). The zip notification uses the joined count for the real archive; badges/status bar use the summed estimate. The two differ only by newline-boundary tokens.

---

## 4. Showing the model in the menu (the small, allowed generated layer)

VS Code can't compute titles at runtime, but showing the **active model** needs only one row per *known model* (~17), not per *count*. That is acceptable.

| Generator | Output | Purpose |
|-----------|--------|---------|
| `generate-model-target-menu.js` | `model-target-contributes.json` | `modelTarget.*` / `zipFor.*` rows via `when: config.export2ai.llmModel == '…'` + Command Palette hides |

`merge-package.js` then:
- merges the generated commands with the hand-written base commands from `package.slim.json`,
- builds the Explorer submenu = `modelTarget.*` rows + **one** `export2ai.zipSelectedFolder` zip row + base rows,
- hides every generated command from the Command Palette (`when: "false"`).

### Runtime model display (unified UX)
| Surface | How model appears |
|---------|-------------------|
| Explorer menu (counting on) | `Target model: gpt-5.5` row + `Zip Folder` row |
| Explorer menu (counting off) | `Zip Folder for gpt-5.5` (when config matches) |
| Status bar | `gpt-5.5 · (est. ~47,382 tokens)` via `formatStatusBarZipLabel()` |
| Explorer folder badges | 2-char badge per folder (`formatTokenBadge`); single-pass aggregation in `tokenEstimate.ts` |
| Zip filename | `{folder}-gpt-5-5-context-{timestamp}.zip` via `buildZipArchiveFileName()` |
| Progress / notification | Includes `config.llmModel` |
| Manifest in zip | `Target model: …` line |

**Single source of truth:** `export2ai.llmModel` (read by `getConfiguration()`). The menu rows read it directly via config `when`-clauses — VS Code re-evaluates them automatically, so **no manual `setContext` sync is needed** (the old `activeModelContext.ts` was removed).

### Do not
- Hardcode **“ChatGPT”** in menu titles, zip names, or progress strings.
- Add a `model × count` command matrix — that is the bucket explosion again.
- Leave generated commands visible in the Command Palette.

### Adding a model to the target menu row
1. Add to **`src/utils/menuTargetModels.ts`** and **`scripts/menu-target-models.js`** (keep in sync).
2. `npm run compile` to regenerate `model-target-contributes.json`.
3. Register the handler in `registerModelTargetCommands()` (`extension.ts`).

---

## 5. Build & packaging chokepoints

### Double compile on `npm run package` (fixed)
- **`vscode:prepublish`** runs `scripts/verify-build.js` only (checks `out/extension.js` exists).
- **`npm run package`** runs `compile` once, then `scripts/package-vsix.js` writes `build/export2ai-{version}.vsix`.

### VSIX hygiene
- **`package.slim.json`** is in `.vscodeignore` (dev-only).
- **VSIX output** belongs under `build/` only; do not rely on vsce's repo-root default.
- No unused direct **`minimatch`** dependency (still transitive via archiver).

### What repo files are for
| File | Keep in git? | Needed at runtime? | Purpose |
|------|--------------|-------------------|---------|
| `package.slim.json` | Yes | No (dev manifest source) | Edit settings, scripts, base commands |
| `package.json` (generated, ~34 KB) | Regenerated | Yes in VSIX | Base + generated model-target commands |
| `package-lock.json` | Yes | No | Reproducible `npm install` |
| `node_modules/` | No (local) | Yes in VSIX (prod deps) | Build + runtime |
| `scripts/generated/model-target-contributes.json` | Optional / regen | No | Build intermediate |
| `build/` | No | No | Generated VSIX output |

---

## 6. Common agent mistakes checklist

Before submitting changes, confirm you did **not**:

- [ ] Reintroduce `export2ai.zip.bucket.*` or any per-count command set
- [ ] Let `package.json` grow into the MB range
- [ ] Leave a generated command visible in the Command Palette (must be `when: "false"`)
- [ ] Add a `setContext` key no menu reads
- [ ] Remove `settingsNavigationInProgress` / cooldown / deferred scan guards
- [ ] Use global settings search instead of `@ext:` for `openSettings`
- [ ] Run `merge:package` before `generate-all-menus.js` (missing `model-target-contributes.json`)
- [ ] Reintroduce `*-chatgpt-context-*` zip naming without model slug
- [ ] Hardcode “ChatGPT” instead of using `export2ai.llmModel`
- [ ] Block the settings command handler with `await openOwnExtensionSettings(...)` without `void`

---

## 7. Performance expectations (sanity checks)

| Step | ~Duration |
|------|-----------|
| `generate:menus` | < 0.1 s |
| `tsc` | 2–3 s |
| `merge:package` | < 0.1 s |
| Full `npm run compile` | 3–4 s |
| `npm run package` | 8–10 s (includes compile + vsce zip) |

If activate feels slow after your change, check **manifest size and command count** first (`package.json` should stay ~34 KB), not TypeScript compile time.
