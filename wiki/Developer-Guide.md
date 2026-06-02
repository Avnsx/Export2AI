# Developer Guide 👩‍💻

This page summarizes the codebase for contributors and AI coding agents working on Export2AI.

For strict agent rules, read [Agent Chokepoints](Agent-Chokepoints) and [`AGENTS.md`](https://github.com/Avnsx/Export2AI/blob/main/AGENTS.md) before structural changes.

---

## Project Summary

Export2AI is a TypeScript VS Code/Cursor extension that creates AI-ready source archives with safe excludes, Git metadata soft-delete, project tree copy, single-file copy, and offline token estimates.

Runtime entry:

```text
src/extension.ts
```

Compiled output:

```text
out/
```

Packaged VSIX output:

```text
build/export2ai-x.y.z.vsix
```

---

## Repository Layout

| Path | Purpose |
|------|---------|
| `src/extension.ts` | activation, command registration, zip workflow, notifications |
| `src/projectService.ts` | ignore context, copy project structure, copy one file |
| `src/zipService.ts` | archive creation, manifest, token count after collection |
| `src/tokenEstimate.ts` | status bar, optional Explorer badges, cached folder aggregation |
| `src/config.ts` | settings read, defaults, clamps, built-in excludes |
| `src/types.ts` | shared configuration and file collection types |
| `src/utils/` | tokenization, file processing, soft-delete, tree generation, formatting, debug logging |
| `scripts/` | manifest merge, menu generation, packaging, tests, release helpers |
| `docs/` | technical documentation |
| `wiki/` | source files for public GitHub Wiki pages |
| `tests/` | critical smoke target runner |

---

## Main Runtime Flow: Zip Creation

```text
extension.ts
  → zipFolder()
  → zipService.createZipArchive()
  → projectService.prepareIgnoreContext()
  → FileProcessor.collectFiles()
  → TokenCounter.countFilesContent()
  → archiver writes .zip
  → optional _EXPORT2AI_MANIFEST.txt
  → notification + clipboard/system reveal actions
```

Key behaviors:

- selected folder or first workspace folder is the source
- output zip is written to the workspace root
- built-in excludes and `.gitignore` merge into an ignore instance
- `excludePaths` is a separate hard path filter
- symlinks are skipped
- binary/large/invalid UTF-8 files become placeholders
- unreadable repository-control paths get visible read-error placeholders

---

## Token Estimate Flow

```text
TokenEstimateManager
  → collectFilesUnder()
  → FileProcessor.collectFiles()
  → TokenCounter.countFilesContent() or countFilesPerPath()
  → tokenFormat helpers
  → status bar / notification / optional Explorer badges
```

Important constraints:

- first full scan is deferred after activation
- settings navigation temporarily delays scans
- config changes clear cache and pending estimates
- optional Explorer badges aggregate once; they do not scan per folder
- stale in-flight estimates are dropped when config/model changes

---

## Ignore and Soft-Delete Flow

```text
config.ts
  → DEFAULT_EXCLUDE_PATTERNS
  → merge built-ins + disabled built-ins + user excludes + legacy excludes
projectService.ts
  → create ignore instance
  → optionally merge .gitignore
fileProcessor.ts
  → skip credentials/symlinks/excluded paths
  → preserve repository-control files when soft-delete allows
  → add Git placeholder for .git internals
```

Relevant utilities:

| File | Responsibility |
|------|----------------|
| `src/utils/ignoreUtils.ts` | ignore instance, dot/dollar rules, `.gitignore`, path exclusions |
| `src/utils/gitMetadataSoftDelete.ts` | repo-control detection, credential guard, placeholders |
| `src/utils/fileProcessor.ts` | traversal and content processing |
| `src/utils/projectTree.ts` | structure-only tree generation |

---

## Target Model UI

`export2ai.llmModel` is the single source of truth for:

- zip filename
- status bar label
- target-model menu row
- progress and notification copy
- token estimate method
- manifest metadata

Generated menu rows are intentionally small. Do not reintroduce token-count bucket commands.

Relevant files:

| File | Purpose |
|------|---------|
| `src/utils/modelRegistry.ts` | model family and default model |
| `src/utils/menuTargetModels.ts` | known target menu models |
| `src/utils/modelFormat.ts` | filename/model display formatting |
| `src/utils/tokenFormat.ts` | status bar, tooltip, token badge formatting |
| `scripts/generate-model-target-menu.js` | generated target-model submenu commands |
| `scripts/merge-package.js` | merge slim manifest + generated commands |

---

## Adding a Setting

1. Add the property to `package.slim.json` under the right contributed settings group.
2. Extend `Export2AIConfiguration` in `src/types.ts`.
3. Read and clamp it in `src/config.ts`.
4. Wire it through the relevant service.
5. Update docs and wiki pages.
6. Add or update tests.
7. Run:

```bash
npm run compile
npm run test:critical
```

---

## Documentation Rules

| File | Role |
|------|------|
| `README.md` | compact landing page, under ~160 lines |
| `wiki/*.md` | human-readable deep guides and SEO-friendly docs |
| `docs/*.md` | technical maintainer reference |
| `AGENTS.md` | AI agent operating rules |
| `CHANGELOG.md` | release notes |

README should link to wiki pages instead of growing into a long manual.

---

## Before a PR

Run at least:

```bash
npm run compile
npm run test:critical
```

For focused changes, add relevant target tests:

```bash
npm run test:tokens
npm run test:soft-delete
npm run test:settings-nav
npm run test:explorer-badges
npm run test:menu-merge
```

See [Build, Test & Release](Build-Test-and-Release).
