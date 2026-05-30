# Configuration

All settings use the `export2ai.*` namespace. Runtime reader: `getConfiguration()` in `src/config.ts`.

Open settings via **Export2AI → Settings**, status bar click, or `@ext:{publisher}.{name}` in VS Code settings search.

## Settings categories (UI)

The extension contributes **categorized settings** (array form in `package.slim.json`) so Cursor/VS Code shows a table-of-contents submenu:

| Category | Settings |
|----------|----------|
| **Export2AI** | Extension info (read-only) |
| **Token estimates** | `enableTokenCounting`, `llmModel` |
| **File collection** | Ignore rules, exclude patterns/paths, `maxFileSize`, `fileConcurrency` |
| **Zip archive** | `compressCode`, `compressionLevel`, `includeManifest`, `copyPathAfterCreate` |
| **Comments** | `removeComments`, `commentStripLanguages` (read-only reference) |
| **Copy structure** | `maxDepth`, `outputFormat` |
| **Advanced** | `debug`, deprecated keys |

When adding a setting, place it in the matching category object in `package.slim.json` (each category needs a unique `id`).

## Active settings

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `export2ai.extensionInfo` | string (read-only) | Auto-synced | Version + last-updated label |
| `export2ai.commentStripLanguages` | string (read-only) | Auto-synced | Full syntax-family / extension map — **Comments** category |
| `export2ai.ignoreGitIgnore` | boolean | `true` | Merge workspace `.gitignore` into exclude rules |
| `export2ai.ignoreDotFiles` | boolean | `true` | Skip paths matching `.*` |
| `export2ai.ignoreDollarFiles` | boolean | `true` | Skip `$*` and `**/$*` (temp files) |
| `export2ai.excludePatterns` | string[] | See below | Glob patterns to exclude |
| `export2ai.excludePaths` | string[] | `[]` | Workspace-relative paths to exclude entirely |
| `export2ai.compressCode` | boolean | `true` | Trim blank lines and trailing whitespace per line |
| `export2ai.removeComments` | boolean | `true` | Strip comments per file type (see [comment-stripping.md](./comment-stripping.md)) |
| `export2ai.enableTokenCounting` | boolean | `true` | Token estimates in menu, status bar, notifications |
| `export2ai.llmModel` | string | `gpt-5.5` | **Target AI model** for token estimates, Explorer menu target row, status bar label, zip filename, and zip manifest — see [target-model-ui.md](./target-model-ui.md) |
| `export2ai.maxFileSize` | number | `1048576` | Max bytes per file (larger → placeholder) |
| `export2ai.maxDepth` | number | `5` | Tree depth for copy project structure |
| `export2ai.fileConcurrency` | number | `4` | Parallel file reads (clamped 1–32) |
| `export2ai.outputFormat` | enum | `markdown` | `plaintext`, `markdown`, or `xml` for copy structure |
| `export2ai.includeManifest` | boolean | `true` | Add `_EXPORT2AI_MANIFEST.txt` inside zip |
| `export2ai.compressionLevel` | number | `9` | Zip level 0–9 (clamped at read time) |
| `export2ai.copyPathAfterCreate` | boolean | `true` | Copy zip path to clipboard after create |
| `export2ai.debug` | boolean | `false` | Log settings navigation to Export2AI output channel |

### Default `excludePatterns`

```
node_modules, *.log, *.tmp, *.temp, *.bak, dist, build, out, .git, *-chatgpt-context-*.zip, *-*-context-*.zip
```

The `*-*-context-*.zip` pattern excludes zips named `{folder}-{model}-context-{timestamp}.zip`.

### Read-only settings (display only)

- **`extensionInfo`** — built by `scripts/extension-metadata.js` from `package.slim.json` version + `CHANGELOG.md` release date.
- **`commentStripLanguages`** — built by `scripts/sync-comment-settings.js` from `commentProfiles.ts` at compile time.

Neither is read by extension runtime logic.

### Value clamps (applied in `config.ts`)

- `fileConcurrency`: 1–32
- `compressionLevel`: 0–9
- `maxFileSize`: ≥ 0

## Deprecated settings

| Key | Replacement |
|-----|-------------|
| `export2ai.exclude` | `export2ai.excludePatterns` |
| `export2ai.outputFolder` | Ignored — zips always written to workspace root |

Legacy `export2ai.exclude` is still read as a fallback when `excludePatterns` is unset.

## Adding a new setting

1. Add property under `contributes.configuration` in **`package.slim.json`**
2. Extend `Export2AIConfiguration` in `src/types.ts`
3. Read in `src/config.ts` (add clamps if numeric)
4. Wire through services as needed
5. Run `npm run compile` to merge manifest and sync metadata
