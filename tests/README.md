# Critical Smoke Tests

This folder defines the 10 targetable checks we should run before release. The runner can execute the full matrix or one named target, so small changes do not require the whole suite every time.

## Run

```bash
npm run test:critical
npm run test:critical:list
npm run test:critical:tokens
npm run test:critical -- tokens live
npm run test:critical -- --target explorer-badges,settings-nav
```

Target-specific runs compile first when the target imports `out/`. Use `-- --skip-compile` only when you intentionally want to reuse existing compiled output.

## The 10 Critical Targets

| Target | What it protects |
|--------|------------------|
| `compile` | Menu generation, TypeScript, settings sync, generated manifest |
| `tokens` | Token labels, tokenizer routing, manifest hygiene, no bucket commands |
| `explorer-badges` | Badge gate: off by default, opt-in only, scoped status-bar tooltip |
| `debug-logger` | Debug setting scopes and Output-channel reveal behavior |
| `comments` | Language-aware comment stripping |
| `model-format` | Model slugs and zip filename shape |
| `menu-merge` | Explorer submenu, palette hides, single zip row |
| `settings-nav` | Extension ID resolution and settings metadata |
| `live` | End-to-end zip creation smoke test |
| `package-assets` | VSIX build plus packaged marketplace asset validation |
