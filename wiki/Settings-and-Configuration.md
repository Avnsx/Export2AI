# Settings & Configuration ⚙️

This page lists the current `export2ai.*` settings, defaults, and safe usage notes for Export2AI v1.2.9.

Open settings from:

- **Export2AI → Settings**
- Command Palette: **Export2AI: Settings**
- status bar token estimate click

---

## Recommended Defaults

```json
{
  "export2ai.llmModel": "gpt-5.5",
  "export2ai.enableTokenCounting": true,
  "export2ai.showExplorerTokenBadges": false,
  "export2ai.softDeleteGitMetadata": true,
  "export2ai.useBuiltInExcludePatterns": true,
  "export2ai.removeComments": false,
  "export2ai.compressCode": false,
  "export2ai.includeManifest": true
}
```

These defaults preserve readable source context and minimize accidental leaks.

---

## Token Estimates

| Setting | Default | Meaning |
|---------|---------|---------|
| `export2ai.enableTokenCounting` | `true` | show token estimates in status bar, Explorer menu state, and zip notifications |
| `export2ai.showExplorerTokenBadges` | `false` | opt-in compact token badges on Explorer folders |
| `export2ai.llmModel` | `gpt-5.5` | target model for token estimates, zip names, menu rows, and manifest |

Details: [Token Estimates & AI Model Support](Token-Estimates-and-AI-Model-Support).

---

## File Collection

| Setting | Default | Meaning |
|---------|---------|---------|
| `export2ai.ignoreGitIgnore` | `true` | merge workspace `.gitignore` rules into the ignore list |
| `export2ai.ignoreDotFiles` | `true` | skip files/folders whose names start with `.` unless soft-delete preserves them |
| `export2ai.ignoreDollarFiles` | `true` | skip `$*` and `**/$*` temp-like paths |
| `export2ai.softDeleteGitMetadata` | `true` | keep repo-control files; omit unsafe local `.git/` internals |
| `export2ai.softDeleteGitMetadata.realGitPathPlaceholder` | `false` | advanced: write marker at `.git/EXPORT2AI_SOFT_DELETE_PLACEHOLDER.txt` |
| `export2ai.useBuiltInExcludePatterns` | `true` | use Export2AI's built-in safe default excludes |
| `export2ai.disabledBuiltInExcludePatterns` | `[]` | built-ins disabled through the checklist or enum-backed array |
| `export2ai.excludePatterns` | `[]` | additional glob patterns to exclude |
| `export2ai.excludePaths` | `[]` | workspace-relative files/folders to hard-exclude |
| `export2ai.maxFileSize` | `1048576` | max bytes per file; larger files become placeholders |
| `export2ai.fileConcurrency` | `4` | parallel file reads, clamped `1–32` |

---

## Zip Archive

| Setting | Default | Meaning |
|---------|---------|---------|
| `export2ai.compressCode` | `false` | optional whitespace compaction for exported text |
| `export2ai.compressionLevel` | `9` | zip compression level `0–9`; affects upload size, not post-extract token count |
| `export2ai.includeManifest` | `true` | add `_EXPORT2AI_MANIFEST.txt` |
| `export2ai.copyPathAfterCreate` | `true` | copy new zip path to clipboard after create |

Compression level is archive compression, not LLM token compression. To reduce token count, reduce included files or opt into comment/whitespace processing.

---

## Comments

| Setting | Default | Meaning |
|---------|---------|---------|
| `export2ai.removeComments` | `false` | strip comments by syntax family when exporting |
| `export2ai.commentStripLanguages` | generated display string | read-only list of supported syntax families/extensions |

Keep `removeComments` off for debugging, audits, architecture review, or AI agent handoff where comments may contain rationale.

Details: [Comment Stripping & Compression](Comment-Stripping-and-Compression).

---

## Copy Structure

| Setting | Default | Meaning |
|---------|---------|---------|
| `export2ai.maxDepth` | `5` | maximum folder depth for Copy Project Structure |
| `export2ai.outputFormat` | `plaintext` | one of `plaintext`, `markdown`, `xml` |

---

## Advanced

| Setting | Default | Meaning |
|---------|---------|---------|
| `export2ai.debug` | `false` | log diagnostics to the Export2AI Output channel and reveal it when enabled |
| `export2ai.extensionInfo` | generated | read-only version and last-updated display |
| `export2ai.exclude` | `[]` | deprecated; use `excludePatterns` |
| `export2ai.outputFolder` | `.` | deprecated; zips always go to workspace root |

---

## Built-in Exclude Management

Use the Command Palette action:

```text
Export2AI: Manage Built-in Exclude Patterns
```

This opens a multi-select checklist:

- checked = excluded
- unchecked = disabled and included again if no other rule blocks it

Disabled built-ins are stored in:

```json
"export2ai.disabledBuiltInExcludePatterns": []
```

This keeps `export2ai.excludePatterns` clean for project-specific additions.

---

## Example Profiles

### Maximum readability for AI review

```json
{
  "export2ai.removeComments": false,
  "export2ai.compressCode": false,
  "export2ai.includeManifest": true
}
```

### Smaller upload with formatting tradeoffs

```json
{
  "export2ai.removeComments": true,
  "export2ai.compressCode": true
}
```

### Project-specific sensitive folders

```json
{
  "export2ai.excludePaths": ["fixtures/private-data", "local-secrets"],
  "export2ai.excludePatterns": ["*.sqlite", "coverage"]
}
```

### Enable Explorer token badges

```json
{
  "export2ai.showExplorerTokenBadges": true
}
```

---

## Runtime Clamps and Fallbacks

| Setting | Clamp / fallback |
|---------|------------------|
| `fileConcurrency` | `1–32` |
| `compressionLevel` | `0–9` |
| `maxFileSize` | minimum `0` |
| `maxDepth` | minimum `0` |
| malformed booleans/numbers/strings | fall back to documented defaults |
| malformed arrays | non-string or empty entries are ignored |

v1.2.9 specifically hardened malformed scalar settings and empty `excludePaths` entries.

---

## Deprecated Settings

| Deprecated | Replacement |
|------------|-------------|
| `export2ai.exclude` | `export2ai.excludePatterns` |
| `export2ai.outputFolder` | none; zips are always written to workspace root |

Legacy `export2ai.exclude` is still read and appended as additional patterns for compatibility.
