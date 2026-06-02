# Troubleshooting 🧯

This page lists practical fixes for Export2AI issues in VS Code, Cursor, ChatGPT project upload workflows, Claude code review archives, and local VSIX builds.

---

## Zip Was Not Created

| Check | What to do |
|-------|------------|
| No workspace folder | Open a folder/workspace first. |
| Selected path is outside a workspace | Use a folder inside the current workspace. |
| Export was cancelled | Run **Export2AI → Zip Folder** again. |
| Zip write failed | Check workspace write permissions and disk space. |
| Empty archive error | Verify the folder has readable included files after excludes. |

Enable debug logging for details:

```json
"export2ai.debug": true
```

Then open **View → Output → Export2AI**.

---

## Important Files Are Missing

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| expected build output missing | built-ins exclude `dist`, `build`, `out`, `site` | disable the built-in or add a narrower export folder |
| a fixture folder missing | `.gitignore` or `excludePaths` | check `.gitignore`, `excludePatterns`, `excludePaths` |
| `.github/` missing | credential guard or path exclusion | inspect file names and explicit excludes |
| source file with `token` in name missing | likely non-source extension or explicit rule | use source extension or adjust excludes |
| dependency folder missing | `node_modules` is intentionally excluded | upload lockfiles/source instead of dependencies |

Run **Export2AI: Manage Built-in Exclude Patterns** to inspect default excludes.

---

## Sensitive Files Are Still Included

Export2AI blocks common credential patterns, but project-specific secrets can use unusual names.

Add explicit excludes:

```json
{
  "export2ai.excludePaths": ["fixtures/private-data", "local-secrets"],
  "export2ai.excludePatterns": ["*.sqlite", "private-*.json"]
}
```

Then recreate the zip and inspect it before uploading.

---

## Token Count Looks Wrong

| Situation | Explanation |
|-----------|-------------|
| `~` appears before count | the selected model uses an approximate offline method |
| Claude differs from API | offline Claude estimates are approximate |
| Explorer badge differs from zip notification | folder aggregation counts per file; zip count may count joined corpus text |
| unknown model is rough | unsupported families use `characters ÷ 4` |
| token count disappeared | `export2ai.enableTokenCounting` may be false |

Check:

```json
{
  "export2ai.enableTokenCounting": true,
  "export2ai.llmModel": "gpt-5.5"
}
```

---

## Explorer Token Badges Do Not Show

This is usually expected.

```json
"export2ai.showExplorerTokenBadges": false
```

Explorer badges are off by default. Enable them explicitly if you want compact folder badges.

After enabling, save/create/delete/rename a file or reload the window to trigger refresh. The first scan is intentionally deferred after startup to keep activation responsive.

---

## Settings Page Opens Slowly or Not at All

Export2AI uses extension-specific settings navigation to avoid broad Settings search.

If it fails:

1. Enable debug logging.
2. Run **Export2AI → Settings** again.
3. Check **View → Output → Export2AI**.
4. Confirm the log shows an `@ext:` settings query for the installed extension ID.
5. Use fallback actions such as opening the Extensions view and selecting the Export2AI gear icon.

---

## Copy File Content Fails

| Message | Meaning |
|---------|---------|
| `Copy content supports one file at a time` | multi-select is not supported |
| `Copy Content to Clipboard is only for files` | selected item is a directory |
| binary/UTF-8 issue | file is not readable as exact UTF-8 text |
| clipboard failure | OS/editor clipboard API failed |

Single-file copy intentionally copies exact UTF-8 text and does not apply zip ignore/comment/compression behavior.

---

## Git Metadata Confusion

Expected behavior:

- real `.git/` internals are not exported
- `.github/`, `.gitignore`, `.gitattributes`, docs, tests, tools, and `AGENTS.md` can stay included
- default marker is `_EXPORT2AI_PLACEHOLDERS/git/EXPORT2AI_SOFT_DELETE_PLACEHOLDER.txt`
- the archive is a source snapshot, not a Git clone

See [Git Metadata Soft-Delete](Git-Metadata-Soft-Delete).

---

## Build or VSIX Packaging Fails

Run the standard sequence:

```bash
npm install
npm run compile
npm run test:critical
npm run package
```

If generated menu/settings data is stale:

```bash
npm run compile
```

If `package.json` is unexpectedly huge, read [Agent Chokepoints](Agent-Chokepoints). The old token-bucket command explosion must not be reintroduced.

---

## Debug Logging

```json
"export2ai.debug": true
```

When enabled, Export2AI writes diagnostics to the **Export2AI** Output channel and reveals it automatically. Routine debug entries are not written when the setting is off.

Useful log areas:

- activation
- settings navigation
- ignore preparation
- file collection
- token estimate scans
- zip creation
- copy project structure
- copy file content
- system file-manager reveal

Turn debug off again when finished.
