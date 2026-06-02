# Configuration

All settings use the `export2ai.*` namespace. Runtime reader: `getConfiguration()` in `src/config.ts`.

Open settings via **Export2AI → Settings**, status bar click, or `@ext:{publisher}.{name}` in VS Code settings search.

## Settings categories (UI)

The extension contributes **categorized settings** (array form in `package.slim.json`) so Cursor/VS Code shows a table-of-contents submenu:

| Category | Settings |
|----------|----------|
| **Export2AI** | Extension info (read-only) |
| **Token estimates** | `enableTokenCounting`, `showExplorerTokenBadges`, `llmModel` |
| **File collection** | Ignore rules, Git/GitHub metadata soft-delete, exclude patterns/paths, `maxFileSize`, `fileConcurrency` |
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
| `export2ai.softDeleteGitMetadata` | boolean | `true` | Preserve repository control files with real contents while replacing unsafe local `.git` internals with a harmless marker outside `.git` by default |
| `export2ai.softDeleteGitMetadata.realGitPathPlaceholder` | boolean | `false` | Advanced opt-in to write `.git/EXPORT2AI_SOFT_DELETE_PLACEHOLDER.txt`; default writes `_EXPORT2AI_PLACEHOLDERS/git/EXPORT2AI_SOFT_DELETE_PLACEHOLDER.txt` so test suites do not see a fake Git repository |
| `export2ai.useBuiltInExcludePatterns` | boolean | `true` | Keep Export2AI's built-in safe exclude list active |
| `export2ai.disabledBuiltInExcludePatterns` | string[] | `[]` | Built-in exclude patterns disabled through the **Manage Built-in Exclude Patterns** checklist or enum-backed array so matching files can be included again |
| `export2ai.excludePatterns` | string[] | `[]` | Additional glob patterns appended to the built-in safe excludes unless `useBuiltInExcludePatterns` is disabled |
| `export2ai.excludePaths` | string[] | `[]` | Workspace-relative paths to exclude entirely |
| `export2ai.compressCode` | boolean | `false` | Reduces exported text size (trim whitespace, drop blank lines); see Settings UI for full guidance |
| `export2ai.removeComments` | boolean | `false` | Strip comments per file type (see [comment-stripping.md](./comment-stripping.md)) |
| `export2ai.enableTokenCounting` | boolean | `true` | Token estimates in status bar, Explorer menu state, and zip notifications |
| `export2ai.showExplorerTokenBadges` | boolean | `false` | Opt-in compact token badges on Explorer folders; off by default to keep Cursor/VS Code Explorer clean |
| `export2ai.llmModel` | string | `gpt-5.5` | **Target AI model** for token estimates, Explorer menu target row, status bar label, zip filename, and zip manifest — see [target-model-ui.md](./target-model-ui.md) |
| `export2ai.maxFileSize` | number | `1048576` | Max bytes per file (larger → placeholder) |
| `export2ai.maxDepth` | number | `5` | Tree depth for copy project structure |
| `export2ai.fileConcurrency` | number | `4` | Parallel file reads (clamped 1–32) |
| `export2ai.outputFormat` | enum | `plaintext` | `plaintext`, `markdown`, or `xml` for copy structure |
| `export2ai.includeManifest` | boolean | `true` | Add `_EXPORT2AI_MANIFEST.txt` inside zip |
| `export2ai.compressionLevel` | number | `9` | Zip archive pack level 0–9 (upload size only; not token count after extract) |
| `export2ai.copyPathAfterCreate` | boolean | `true` | Copy zip path to clipboard after create |
| `export2ai.debug` | boolean | `false` | Log full Export2AI diagnostics and auto-reveal the Export2AI output channel |

### Debug logging

When `export2ai.debug` is `true`, Export2AI writes diagnostic lines to **View -> Output -> Export2AI** for activation/deactivation, command registration, settings navigation, zip creation, copy-structure, single-file copy, token-estimate refreshes, ignore setup, and file collection. If debug mode is already on during activation, the Export2AI output channel is revealed automatically; if you turn it on while the extension is running, the channel is revealed immediately and a `debug: enabled` line is written. Debug is enabled when either User or Workspace scope is checked; this prevents a checked User setting from being hidden by a stale workspace `false`.

Log lines are prefixed with the extension name and a compact timestamp formatted by the local PC locale/time settings, for example:

```
[Export2AI 05/31/26, 09:05:07 PM] settings: navigation start settingsQuery=@ext:avnsx.export2ai contributedCommands=40
```

### Settings UI copy (Zip archive & Comments)

These settings show a **plain-language `description`** under the control plus a **`markdownDescription`** with a **Technical:** block (or stripper details for comments). Edit humane text in **`package.slim.json`**; Remove comments intro is also defined as `REMOVE_COMMENTS_USER_DESCRIPTION` in `commentProfiles.ts` and prepended at compile by `extension-metadata.js`.

| Setting | Humane summary (shown first) |
|---------|------------------------------|
| `compressCode` | Reduces exported source for smaller context; may remove formatting or layout — keep OFF for faithful review |
| `removeComments` | Strips comments to save space; removes rationale and warnings — keep OFF for debugging or agent handoff |
| `compressionLevel` | Controls `.zip` pack tightness for upload size only; does not change code or tokens after extract |

Run `npm run compile` after editing manifest or `commentProfiles.ts`.

### Built-in default exclude patterns

```
node_modules, *.log, *.tmp, *.temp, *.bak, dist, site, build, out, .git, __pycache__, .pytest_cache, .cache, .tmp, **/*.pem, **/*.key, **/*.p8, **/*.p12, **/*.pfx, **/id_rsa, **/id_dsa, **/id_ecdsa, **/id_ed25519, **/*.asc, **/*.gpg, **/.env, **/.env.*, out*.json, *-chatgpt-context-*.zip, *-*-context-*.zip
```

The `*-*-context-*.zip` pattern excludes zips named `{folder}-{model}-context-{timestamp}.zip`.

The Settings UI copy for `export2ai.useBuiltInExcludePatterns` intentionally shows a compact Markdown preview with the first six built-in patterns. Run **Export2AI: Manage Built-in Exclude Patterns** from the Command Palette to open the full built-in list inside the IDE through Export2AI as an editable checklist. Checked patterns stay excluded; unchecked patterns are written to `export2ai.disabledBuiltInExcludePatterns`, which includes those files again. `export2ai.disabledBuiltInExcludePatterns` is also an intentionally editable enum-backed array, so every built-in can be toggled manually from Settings JSON or the Settings array editor. `export2ai.excludePatterns` defaults to `[]` and is only for project-specific extra patterns, which prevents the native Settings page from rendering all 30 built-ins as editable array rows. VS Code/Cursor contributed settings support static `markdownDescription` text and simple array editors, but not custom inline expand/collapse buttons with extension-owned click state inside the native Settings page.

With `export2ai.softDeleteGitMetadata` enabled, repository control and context files override broad dot-file or `.gitignore` rules and are exported with real contents. This covers `.github/**`, `.gitignore`, `.gitattributes`, `.gitmodules`, `.mailmap`, `.gitkeep`, `.git-blame-ignore-revs`, `AGENTS.md`, `README.md`, `pyproject.toml`, `docs/**`, `tests/**`, and `tools/**`. Actual credential/key material still wins over these includes. The credential guard blocks `.env*`, local auth files such as `.npmrc`, `.pypirc`, `.netrc`, `_netrc`, `.dockercfg`, and `.docker/config.json`, SSH key filenames, key/archive extensions, `out*.json`, and likely token/credential/private-key dump filenames, but it does not drop normal source/script files or `.github/workflows/*.yml|*.yaml` only because the filename mentions token/key words. That keeps files such as `src/tokenEstimate.ts`, `src/utils/tokenCounter.ts`, `src/credentialParser.ts`, and `.github/workflows/token-rotation.yml` available. Add `export2ai.excludePatterns` for project-specific broad keyword excludes; explicit `excludePaths` entries still hard-exclude matching paths. Empty `excludePaths` entries are ignored; on Windows, path matching is case-insensitive. The unsafe local `.git` directory is not traversed and is not created in the export by default; Export2AI writes `_EXPORT2AI_PLACEHOLDERS/git/EXPORT2AI_SOFT_DELETE_PLACEHOLDER.txt` outside `.git` so tests that check `Path(".git").exists()` do not mistake the archive for a real Git repository. Symlink entries are skipped instead of followed, preventing links from pulling content from outside the selected project. The advanced `export2ai.softDeleteGitMetadata.realGitPathPlaceholder` setting can opt back into `.git/EXPORT2AI_SOFT_DELETE_PLACEHOLDER.txt`. If a repository-control path cannot be read, Export2AI keeps the path visible with an `Export2AI Repository-Control Read Error` placeholder or `EXPORT2AI_READ_ERROR.txt` marker.

When `export2ai.includeManifest` is enabled, `_EXPORT2AI_MANIFEST.txt` records the target model, source folder name, ISO creation timestamp, included/candidate/excluded collection counts, processed bytes, optional token estimate, ignore settings, soft-delete settings, compression/comment settings, file concurrency, and the active exclude-pattern list. The absolute local source path is redacted by default with `Source path redacted: true`, and the manifest states that `.git`, credentials, and private key material were intentionally omitted and that the archive is for code-context analysis, not publishing.

### Read-only settings (display only)

- **`extensionInfo`** — built by `scripts/extension-metadata.js` from `package.slim.json` version + `CHANGELOG.md` release date.
- **`commentStripLanguages`** — built by `scripts/sync-comment-settings.js` from `commentProfiles.ts` at compile time.

Neither is read by extension runtime logic.

### Value clamps (applied in `config.ts`)

- `fileConcurrency`: 1–32
- `compressionLevel`: 0–9
- `maxFileSize`: ≥ 0

Invalid scalar settings fall back to their documented defaults instead of producing runtime `NaN`, string booleans, or malformed option lists.

## Deprecated settings

| Key | Replacement |
|-----|-------------|
| `export2ai.exclude` | `export2ai.excludePatterns` |
| `export2ai.outputFolder` | Ignored — zips always written to workspace root |

Legacy `export2ai.exclude` is still read and appended as additional patterns. Disable individual built-ins with `export2ai.disabledBuiltInExcludePatterns`; disable `export2ai.useBuiltInExcludePatterns` only if you intentionally want to replace the entire built-in safe list with your own list.

## Adding a new setting

1. Add property under `contributes.configuration` in **`package.slim.json`**
2. Extend `Export2AIConfiguration` in `src/types.ts`
3. Read in `src/config.ts` (add clamps if numeric)
4. Wire through services as needed
5. Run `npm run compile` to merge manifest and sync metadata
