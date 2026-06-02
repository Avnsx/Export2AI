# Export2AI documentation

Technical documentation for the Export2AI VS Code / Cursor extension. The compact user-facing entry point is the root [README.md](../README.md). The visually guided, human-readable documentation lives in the [GitHub Wiki](https://github.com/Avnsx/Export2AI/wiki) and is mirrored from the repository-maintained [`wiki/`](../wiki/Home.md) source folder.

| Document | Audience | Contents |
|----------|----------|----------|
| [configuration.md](./configuration.md) | maintainers, power users | all `export2ai.*` settings, defaults, clamps, deprecated keys |
| [architecture.md](./architecture.md) | contributors | command flow, ignore/soft-delete pipeline, token estimates, runtime dependencies |
| [target-model-ui.md](./target-model-ui.md) | contributors | unified `llmModel` display in menus, status bar, filenames, notifications |
| [comment-stripping.md](./comment-stripping.md) | maintainers, users | supported comment syntax families and limitations |
| [build-and-test.md](./build-and-test.md) | release maintainers | build pipeline, tests, VSIX packaging, release checklist |
| [source-modules.md](./source-modules.md) | contributors, AI agents | `src/` and `scripts/` module map |
| [agent-chokepoints.md](./agent-chokepoints.md) | AI coding agents | performance traps and rules that must not regress |
| [../AGENTS.md](../AGENTS.md) | AI coding agents | repository conventions and pre-PR checklist |
| [../wiki/Home.md](../wiki/Home.md) | readers, users, SEO | source files for the public GitHub Wiki pages |

The `wiki/` folder is intentionally documentation-only. When wiki content changes, publish those Markdown files to the existing GitHub Wiki at <https://github.com/Avnsx/Export2AI/wiki>; do not create a new repository and do not upload generated context zips.
