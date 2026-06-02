# Features & Workflow 🛠️

Export2AI provides a small set of commands designed around one job: make project context easier to hand to AI tools without flooding the archive with machine-local noise.

---

## Feature Overview

| Feature | Entry point | Output |
|---------|-------------|--------|
| **Zip folder/workspace** | Explorer context menu, Command Palette, Explorer title menu | `.zip` in workspace root |
| **Copy project structure** | Export2AI submenu | clipboard tree in plaintext, Markdown, or XML |
| **Copy one file** | right-click a file | exact UTF-8 text copied to clipboard |
| **Open last zip** | Export2AI submenu | reveals most recent zip in system file manager |
| **Settings** | submenu, Command Palette, status bar click | extension-specific VS Code/Cursor settings page |
| **Manage built-in excludes** | Command Palette | checklist for default exclude patterns |
| **Token estimate** | status bar, notification, optional badges | offline LLM context estimate |

---

## Zip Folder / Zip Current Workspace 📁

Use this when you want a full **ChatGPT project zip**, **Claude code review archive**, or **Cursor AI context handoff**.

What happens:

1. Export2AI reads the selected folder or current workspace.
2. It builds the ignore context from built-ins, `.gitignore`, dotfile rules, dollar-file rules, and user settings.
3. It applies safe collection rules and Git metadata soft-delete.
4. It converts included text files to UTF-8 strings.
5. It replaces unsupported content with short placeholders.
6. It optionally estimates tokens for the selected model.
7. It writes a zip to the workspace root.
8. It shows a notification with file count, target model, and token estimate.

The command is cancellable while scanning/writing.

---

## Copy Project Structure 🌳

Use this when an AI only needs a map of the repository, not every file.

Settings that affect it:

| Setting | Effect |
|---------|--------|
| `export2ai.maxDepth` | maximum folder depth, default `5` |
| `export2ai.outputFormat` | `plaintext`, `markdown`, or `xml` |
| ignore/exclude settings | same safe filtering as archive collection |
| `export2ai.softDeleteGitMetadata` | shows the Git marker instead of traversing `.git/` |

Example plaintext tree:

```text
Export2AI/
├── docs/
│   ├── architecture.md
│   └── configuration.md
├── src/
│   ├── extension.ts
│   └── zipService.ts
└── README.md
```

When token counting is enabled, the completion message includes a token estimate for the copied tree.

---

## Copy One File 📄

Use this for one Markdown file, prompt file, source file, or config file.

Important behavior:

| Behavior | Detail |
|----------|--------|
| Exact text | copies the file's UTF-8 text without zipping |
| One file only | multi-select is rejected with a visible warning |
| No silent binary copy | binary files are blocked with a visible message |
| No comment/compression pipeline | it does not strip comments or compress whitespace |
| Visible failures | unreadable files and clipboard failures show Export2AI messages |

This is intentionally different from a zip export: it is a precise single-file clipboard action.

---

## Open Last Zip 📂

**Export2AI → Open Last Zip** reveals the most recently created zip in the system file manager:

| OS | Behavior |
|----|----------|
| Windows | opens Explorer with the zip selected |
| macOS | opens Finder with the zip selected |
| Linux | opens the default file manager when supported |

The remembered path is session-only. It is lost after a VS Code/Cursor window reload.

---

## Settings Navigation ⚙️

Export2AI opens the extension-specific Settings page through VS Code's `@ext:` route. The extension ID is resolved from the installed manifest instead of hardcoding it.

This is deliberate: direct extension settings navigation avoids slow global Settings search and reduces the risk of Cursor freezing on broad queries like `export2ai`.

At the top of Settings, `export2ai.extensionInfo` shows a generated display string such as:

```text
Extension version v.1.2.9 · Last updated June 02, 2026
```

That field is display-only and generated from `package.slim.json` plus `CHANGELOG.md` during build.

---

## Built-in Exclude Checklist ✅

Command Palette:

```text
Export2AI: Manage Built-in Exclude Patterns
```

The checklist lets users disable individual built-in patterns without dumping all built-ins into `export2ai.excludePatterns`.

| Checked | Meaning |
|---------|---------|
| yes | matching files stay excluded |
| no | that built-in is disabled and matching files may be included |

Disabled built-ins are stored in:

```json
"export2ai.disabledBuiltInExcludePatterns": []
```

---

## Target Model Menu Rows

When token counting is enabled, the Explorer submenu shows a static target row such as:

```text
Target model: gpt-5.5
Zip Folder
```

When token counting is disabled, the menu uses model-specific zip rows such as:

```text
Zip Folder for gpt-5.5
```

A live token number cannot appear in a VS Code menu title. Export2AI shows token counts in the status bar and notifications instead.

---

## Recommended Workflow for AI Uploads

1. Keep `removeComments` and `compressCode` off for review-quality handoffs.
2. Export the smallest folder that still contains enough context.
3. Check the token estimate.
4. Upload the zip with a prompt that says it is an Export2AI context archive.
5. Tell the AI to read `_EXPORT2AI_MANIFEST.txt`, `README.md`, and `AGENTS.md` first when present.
