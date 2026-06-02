# Comment Stripping & Compression 🧹

Export2AI can reduce exported text size, but both options trade away readability. They are **off by default** so code review and AI agent handoff preserve full source context.

---

## Two Separate Features

| Setting | Default | What it does | Token impact |
|---------|---------|--------------|--------------|
| `export2ai.removeComments` | `false` | strips language comments by file extension/syntax family | may reduce tokens, but removes rationale |
| `export2ai.compressCode` | `false` | trims lines and removes blank lines | may reduce tokens, but removes layout |
| `export2ai.compressionLevel` | `9` | compresses the zip file bytes | does not reduce tokens after extraction |

---

## Recommendation

| Use case | Recommended settings |
|----------|----------------------|
| AI debugging | keep comments and formatting |
| security review | keep comments and formatting |
| architecture review | keep comments and formatting |
| minimal context upload | consider comment stripping only after reviewing tradeoffs |
| generated code archive | compression may be acceptable |

Default review-quality profile:

```json
{
  "export2ai.removeComments": false,
  "export2ai.compressCode": false
}
```

---

## Comment Stripping Behavior

Export2AI uses language-aware rules selected by file extension or special filename. The stripper is string-aware where possible, so it tries not to remove comment markers inside strings.

Supported syntax families include common forms such as:

| Syntax family | Examples |
|---------------|----------|
| C-style line/block | JavaScript, TypeScript, C, C++, C#, Java, Go, Rust, Swift, Kotlin |
| Hash comments | Python, shell, Ruby, YAML, TOML, Dockerfile-style files |
| SQL comments | `--` and block comments |
| HTML/XML comments | `<!-- -->` |
| CSS comments | `/* */` |
| PowerShell | `#` and `<# #>` |
| Batch/CMD | `REM`, `::` |
| Lua | `--`, `--[[ ]]` |
| Lisp-like | `;` |

The read-only `export2ai.commentStripLanguages` setting is generated at build time from `commentProfiles.ts`.

---

## Files That Stay Unchanged

Some file types are intentionally skipped or should not be treated as comment-strip targets:

| File type | Reason |
|-----------|--------|
| Markdown | prose and code fences can contain comment-like text |
| plain JSON | comments are not valid JSON; content should remain exact |
| unknown extensions | no safe syntax profile |
| exact single-file copy | `Copy Content to Clipboard` does not run the export processing pipeline |

---

## Compression Behavior

`export2ai.compressCode` applies simple whitespace compaction:

1. split content by line
2. trim each line
3. drop empty lines
4. join with `\n`

This can make code harder to read and can damage formatting-sensitive examples. Use it only when upload size or context size matters more than exact layout.

---

## Zip Compression Is Different

`export2ai.compressionLevel` controls only the zip archive byte size.

| Setting | Meaning |
|---------|---------|
| `0` | faster, larger zip |
| `9` | smaller upload, default |

This does **not** reduce LLM tokens after the archive is extracted by a tool. Token count depends on the text content, not the compressed zip byte count.

---

## Known Limitations

- Comment stripping can have edge cases in regex literals, nested strings, unusual heredocs, or mixed embedded languages.
- Comments may contain important instructions, warnings, generated-code notes, or architecture rationale.
- Compression removes blank-line structure that human reviewers and AI agents may use for orientation.

For best AI code review quality, leave both `removeComments` and `compressCode` off.
