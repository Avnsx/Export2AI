# Export2AI documentation

Technical documentation for the Export2AI VS Code / Cursor extension. User-facing quick start remains in the root [README.md](../README.md). Agent and contributor conventions live in [AGENTS.md](../AGENTS.md).

| Document | Audience | Contents |
|----------|----------|----------|
| [Agent chokepoints](./agent-chokepoints.md) | **Agents (read first)** | Hang prevention, lazy registration, settings race, build traps |
| [Target model UI](./target-model-ui.md) | Contributors, agents | Unified `llmModel` in menus, status bar, Explorer folder badges, zip filenames |
| [Architecture](./architecture.md) | Contributors, agents | Data flows, single-pass folder aggregation, commands, ignore pipeline |
| [Source modules](./source-modules.md) | Contributors, agents | Every `src/` file and `scripts/` utility |
| [Configuration](./configuration.md) | Users, contributors | All `export2ai.*` settings |
| [Comment stripping](./comment-stripping.md) | Users, contributors | Language profiles, extension map, limitations |
| [Build & test](./build-and-test.md) | Contributors | Slim manifest, npm scripts, tests, marketplace assets, `build/` VSIX output |

**Source of truth:** TypeScript under `src/` and `package.slim.json`. When docs diverge from code, fix the docs.
