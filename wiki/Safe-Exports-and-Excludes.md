# Safe Exports & Excludes 🛡️

Export2AI is designed for **AI code context**, not for publishing a repository or backing up a local machine. Its defaults try to keep useful source and repository context while excluding generated noise, local credentials, and unsafe Git internals.

---

## Safety Model

| Goal | Implementation |
|------|----------------|
| Keep useful code context | include normal source text, docs, tests, CI workflows, repo-control files |
| Avoid huge noisy archives | skip dependency folders, build output, caches, logs, old context zips |
| Avoid accidental credential exposure | block `.env*`, local auth files, SSH keys, private key/certificate extensions, likely dumps |
| Avoid false repository detection | omit local `.git/`; add an external placeholder by default |
| Avoid path escape | skip symlink entries instead of following them |
| Keep AI honest | add a manifest explaining omissions and redaction |

---

## Built-in Default Exclude Patterns

`export2ai.useBuiltInExcludePatterns` defaults to `true`. Current built-ins:

```text
node_modules
*.log
*.tmp
*.temp
*.bak
dist
site
build
out
.git
__pycache__
.pytest_cache
.cache
.tmp
**/*.pem
**/*.key
**/*.p8
**/*.p12
**/*.pfx
**/id_rsa
**/id_dsa
**/id_ecdsa
**/id_ed25519
**/*.asc
**/*.gpg
**/.env
**/.env.*
out*.json
*-chatgpt-context-*.zip
*-*-context-*.zip
```

You can edit the effective built-ins with **Export2AI: Manage Built-in Exclude Patterns**.

---

## Additional User Excludes

Use these when a project has its own special files that should never be exported.

| Setting | Use for | Example |
|---------|---------|---------|
| `export2ai.excludePatterns` | glob-style patterns | `"coverage"`, `"*.sqlite"` |
| `export2ai.excludePaths` | exact workspace-relative files/folders | `"local-fixtures/private"` |
| `export2ai.disabledBuiltInExcludePatterns` | disabling built-in patterns | managed by the checklist |

Example:

```json
{
  "export2ai.excludePatterns": ["coverage", "*.sqlite"],
  "export2ai.excludePaths": ["fixtures/private-data"]
}
```

`excludePaths` entries are workspace-relative. Empty entries are ignored. On Windows, path matching is case-insensitive.

---

## Repository Context That Stays Included

With `export2ai.softDeleteGitMetadata` enabled, repository-control and project-context paths can override broad dotfile or `.gitignore` rules:

```text
.github/**
.gitignore
.gitattributes
.gitmodules
.mailmap
.gitkeep
.git-blame-ignore-revs
AGENTS.md
README.md
pyproject.toml
docs/**
tests/**
tools/**
```

This helps AI agents understand CI, tests, repository conventions, and validation files.

Actual credential/key material still wins over these includes.

---

## Credential and Key Guard

Export2AI blocks local auth and likely credential material, including:

| Category | Examples |
|----------|----------|
| environment files | `.env`, `.env.*`, `.envrc` |
| package/auth files | `.npmrc`, `.pnpmrc`, `.pypirc`, `.yarnrc`, `.yarnrc.yml` |
| machine auth | `.netrc`, `_netrc`, `.dockercfg`, `.docker/config.json` |
| SSH keys | `id_rsa`, `id_dsa`, `id_ecdsa`, `id_ed25519` |
| private key/cert material | `*.pem`, `*.key`, `*.p8`, `*.p12`, `*.pfx`, `*.asc`, `*.gpg` |
| likely dumps | filenames containing token/credential/secrets/private-key patterns, unless source-aware exemptions apply |
| generated auth JSON | `out*.json` |

---

## Source-Aware Keyword Handling

Older broad ignore rules often removed normal source files just because their filenames contained suspicious words.

Export2AI avoids that problem:

| File | Included? | Why |
|------|-----------|-----|
| `src/tokenEstimate.ts` | yes | normal source file |
| `src/utils/tokenCounter.ts` | yes | normal source file |
| `src/credentialParser.ts` | yes | source extension is exempt from keyword-only blocking |
| `.github/workflows/token-rotation.yml` | yes | CI workflow context is important |
| `.env.production` | no | environment file |
| `private-key.pem` | no | private key extension/pattern |
| `customer-tokens.json` | likely no | likely credential dump |

Use `export2ai.excludePatterns` if your project needs stricter keyword blocking.

---

## Binary, Large, Invalid, and Unreadable Files

Archive collection is text-first.

| Case | Zip content |
|------|-------------|
| binary file | `[Binary file content not included]` |
| file larger than `export2ai.maxFileSize` | `[File too large: ...]` |
| invalid UTF-8 | `[File has encoding issues. Please convert to UTF-8 for inclusion.]` |
| unreadable normal file | skipped and logged in debug output |
| unreadable repository-control path | visible read-error placeholder |

Default max file size is `1048576` bytes (1 MB).

---

## Manifest Hygiene

When `export2ai.includeManifest` is enabled, `_EXPORT2AI_MANIFEST.txt` records:

- target model
- source folder name
- `Source path redacted: true`
- included/candidate/excluded counts
- ignored directories and entries
- skipped files
- soft-deleted entries
- processed bytes
- optional token estimate
- ignore settings
- compression/comment settings
- file concurrency
- active exclude patterns

It explicitly states that `.git`, credentials, and private key material were intentionally omitted and that the archive is for code-context analysis, not publishing.

---

## What Changed in v1.2.9

v1.2.9 hardened file collection:

- malformed scalar settings fall back to documented defaults
- empty `excludePaths` entries no longer exclude the workspace root
- Windows `excludePaths` matching is case-insensitive
- symlink entries are skipped instead of followed
- local auth files such as `.npmrc`, `.pypirc`, `.netrc`, `_netrc`, `.dockercfg`, and `.docker/config.json` are treated as credential material

---

## Related Pages

- [Git Metadata Soft-Delete](Git-Metadata-Soft-Delete)
- [Settings & Configuration](Settings-and-Configuration)
- [Troubleshooting](Troubleshooting)
