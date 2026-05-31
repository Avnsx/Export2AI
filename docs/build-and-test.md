# Build & test

## Prerequisites

- **Node.js** 24+ (matches the GitHub release workflow)
- **VS Code / Cursor** `^1.105.0` (for extension host)

## Install

```bash
npm install
```

## Compile pipeline

`npm run compile` runs three lifecycle steps:

| Step | Script | Action |
|------|--------|--------|
| `precompile` | `generate:menus` → `generate-all-menus.js` | Write `model-target-contributes.json` |
| `compile` | `tsc -p ./` | TypeScript `src/` → `out/` |
| `postcompile` | `sync-comment-settings.js` + `merge:package` | Sync comment settings into slim manifest; build `package.json` |

### Slim vs generated `package.json`

| File | Size | Role |
|------|------|------|
| `package.slim.json` | ~30 KB | **Source of truth** — edit settings, commands, npm scripts |
| `package.json` (generated) | **~34 KB** | Produced by merge — base + model-target commands |
| `scripts/generated/model-target-contributes.json` | Small | Model-target + zipFor menu rows + palette hides |

> **Note:** before 1.2.3 `package.json` was ~1.9–4 MB because of ~10,900 token-bucket commands. Those were removed (see [agent-chokepoints.md](./agent-chokepoints.md) §1); the manifest is now small.

After local compile, run `npm run slim:package` to refresh `package.slim.json` for git (strips generated commands/menus):

```bash
npm run slim:package
```

### Workspace note

`"npm.autoDetect": "off"` is kept in `.vscode/settings.json` as a precaution. With the small manifest it is no longer load-bearing, but run npm scripts from the terminal anyway.

### Metadata sync at merge

`scripts/merge-package.js` calls `extension-metadata.js` to inject:

- `export2ai.extensionInfo` from version + `CHANGELOG.md`

`scripts/sync-comment-settings.js` injects comment-strip settings from compiled `out/utils/commentProfiles.js`.

### Marketplace assets

`package.slim.json` sets the shared marketplace icon to `icons/icon-1254x1254.png`. VS Code documents the extension icon as at least 128x128, with 256x256 for Retina screens, and the current packaging flow accepts the larger square PNG. The generated `package.json`, Cursor, VS Code Marketplace, and Open VSX all read that manifest field from the packaged VSIX. The README banner source is kept at `icons/gh_banner.png`, while README uses the HTTPS copy `https://i.imgur.com/RpgluFc.png` so GitHub, Cursor, and Open VSX can render it without relying on packaged relative paths.

### Local Publishing Env

Local marketplace publishing credentials live in `.env.local`, which is ignored by Git and excluded from VSIX packages by `.vscodeignore`. Expected keys:

```bash
OVSX_PAT=...
OPENVSX_NAMESPACE=avnsx
REPO=https://github.com/Avnsx/Export2AI
```

## npm scripts

| Script | Purpose |
|--------|---------|
| `npm run compile` | Full build (menus + tsc + settings sync + merge) |
| `npm run watch` | TypeScript watch mode |
| `npm run generate:menus` | Regenerate model-target menus |
| `npm run merge:package` | Merge slim + generated → `package.json` |
| `npm run slim:package` | Strip generated commands/menus for git commit |
| `npm run package` | Compile once + build `build/export2ai-x.x.x.vsix` |
| `npm run test:tokens` | Token format, Opus routing, status-bar labels, manifest hygiene |
| `npm run test:debug-logger` | Debug setting scope handling + Output channel reveal calls |
| `npm run test:comments` | Language-aware comment stripping |
| `npm run test:model-format` | Zip filename / model slug helpers |
| `npm run test:menu-merge` | Submenu shape, single zip row, palette hides, no bucket rows |
| `npm run test:explorer-badges` | Runtime smoke test for the Explorer file-decoration provider; badges off by default, opt-in only, tooltip scope labels |
| `npm run test:settings-nav` | Extension ID + extensionInfo metadata |
| `npm run test:marketplace-assets` | Verifies `build/*.vsix` embeds the marketplace icon path and PNG dimensions |
| `npm run test:live` | End-to-end zip smoke test |

**Tests require compile first** — they import from `out/`.

## VSIX packaging

```bash
npm run package
```

Runs **one** full compile, verifies `out/extension.js`, then builds the VSIX through `scripts/package-vsix.js`. `vscode:prepublish` only checks that compile output exists (avoids double compile).

Output: `build/export2ai-{version}.vsix`. Do not write release VSIX files to the repo root.

Install: **Extensions → … → Install from VSIX**.

Or press **F5** (`.vscode/launch.json`) for Extension Development Host.

### VSIX contents (`.vscodeignore`)

**Ships:** `out/`, generated `package.json`, production `node_modules/`, `README.md`, `CHANGELOG.md`, `AGENTS.md`, `docs/`, `icons/`

**Does not ship:** `src/`, `scripts/`, `package.slim.json`, `tsconfig.json`, `build/`, `*.vsix`, test zips

## Performance notes

See **[agent-chokepoints.md](./agent-chokepoints.md)** for full detail. Short version:

- **`tsc` is ~2–3 s** — not the main IDE hang source
- **`package.json` is ~34 KB** — if it balloons into the MB range, you reintroduced a generated-command explosion
- **Never generate per-token-count commands** — the count lives in the status bar / notification. Explorer badges are opt-in only (`test:tokens` enforces zero bucket commands; `test:explorer-badges` enforces the badge gate).

## Releases (GitHub)

Push a semver tag to trigger [`.github/workflows/release.yml`](../.github/workflows/release.yml):

```bash
git tag v1.2.6
git push origin v1.2.6
```

The workflow compiles, runs tests, builds `build/export2ai-{version}.vsix`, generates release notes from `CHANGELOG.md` via `scripts/release-notes.js`, and attaches the VSIX to a GitHub Release. Optional marketplace publish when `VSCE_PAT` / `OVSX_PAT` secrets are set.

## Release checklist

- [ ] `npm run compile` succeeds
- [ ] `npm run test:tokens` passes (manifest hygiene: 0 bucket commands, palette hides)
- [ ] `npm run test:debug-logger` passes
- [ ] `npm run test:comments` passes
- [ ] `npm run test:model-format` passes
- [ ] `npm run test:menu-merge` passes (if menus/build changed)
- [ ] `npm run test:explorer-badges` passes
- [ ] `npm run package` then `npm run test:marketplace-assets` passes (if manifest/package assets changed)
- [ ] `npm run test:live` passes
- [ ] `npm run test:settings-nav` passes
- [ ] `npm run slim:package` before commit
- [ ] `CHANGELOG.md` updated (feeds extension info date)
- [ ] `version` bumped in `package.slim.json` if releasing VSIX
- [ ] No legacy name references (`repozip4ai`, `copy4ai`) in source or docs
