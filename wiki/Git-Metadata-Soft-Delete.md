# Git Metadata Soft-Delete 🌿

Export2AI keeps repository context useful without exporting local Git internals. This is called **Git metadata soft-delete**.

---

## Why It Exists

AI agents and repository tests often need files like:

```text
.github/workflows/release.yml
.github/dependabot.yml
.gitignore
.gitattributes
.gitmodules
.git-blame-ignore-revs
README.md
AGENTS.md
docs/**
tests/**
tools/**
```

But a real local `.git/` directory contains unsafe and irrelevant machine-local data:

| Local `.git/` data | Why it should not be exported |
|--------------------|-------------------------------|
| remotes | can reveal private origin URLs |
| refs and branches | local checkout state is not project source |
| hooks | machine-local scripts should not become AI context |
| object database | huge and not readable source context |
| reflog/local history | not needed for a project snapshot |
| credentials/auth helpers | unsafe to upload |

Soft-delete keeps the former and blocks the latter.

---

## Default Placeholder Layout

By default, Export2AI does **not** create a `.git/` folder in the archive.

Instead it writes one marker outside `.git/`:

```text
_EXPORT2AI_PLACEHOLDERS/git/EXPORT2AI_SOFT_DELETE_PLACEHOLDER.txt
```

Why this matters:

- Python tests that check `Path(".git").exists()` will not mistake the export for a real repository.
- Git commands will not run against a fake `.git/` directory.
- The AI sees a clear note that local Git metadata was intentionally omitted.

---

## Placeholder Message

The marker explains that it is artificial and should not be treated as project code, CI configuration, dependency evidence, credential evidence, or repository truth.

It also states that remotes, refs, branches, local history, hooks, object database, and credentials were not exported.

---

## Advanced Compatibility Mode

Some specialized workflows may expect a `.git/` path to exist in the archive. You can opt into the older real-path marker layout:

```json
{
  "export2ai.softDeleteGitMetadata.realGitPathPlaceholder": true
}
```

Then Export2AI may write:

```text
.git/EXPORT2AI_SOFT_DELETE_PLACEHOLDER.txt
```

Use this only when a downstream workflow requires the `.git/` path. The safer default keeps the marker outside `.git/`.

---

## Repository-Control Read Errors

Repository-control files are important enough that Export2AI tries to keep their paths visible. If such a path cannot be read, the archive gets an explicit placeholder instead of silently dropping it.

Examples:

```text
.github/EXPORT2AI_READ_ERROR.txt
docs/EXPORT2AI_READ_ERROR.txt
```

The placeholder says that Export2AI could not read the original path and includes the reason when available.

---

## Credential Material Still Wins

Repository-control inclusion is not a credential bypass.

| Path | Outcome |
|------|---------|
| `.github/workflows/build.yml` | included |
| `.github/workflows/token-rotation.yml` | included as workflow context |
| `.env` | excluded |
| `.npmrc` | excluded |
| `.docker/config.json` | excluded |
| `id_ed25519` | excluded |
| `private-key.pem` | excluded |

---

## Settings

| Setting | Default | Meaning |
|---------|---------|---------|
| `export2ai.softDeleteGitMetadata` | `true` | keep repo-control files but omit local `.git/` internals |
| `export2ai.softDeleteGitMetadata.realGitPathPlaceholder` | `false` | advanced mode: write the marker inside `.git/` |
| `export2ai.ignoreDotFiles` | `true` | broad dotfile ignore; soft-delete can preserve important repo-control files |
| `export2ai.ignoreGitIgnore` | `true` | merge `.gitignore`; soft-delete can preserve important repo-control files |

---

## Mental Model

Think of the archive as a **reviewable source snapshot**, not a clone.

```text
✅ useful repository evidence
✅ docs/tests/tools/CI context
✅ source files needed by AI agents
❌ local Git history
❌ remotes and hooks
❌ credentials and auth files
❌ fake .git directory by default
```

Related: [Safe Exports & Excludes](Safe-Exports-and-Excludes).
