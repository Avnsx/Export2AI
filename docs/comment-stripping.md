# Comment stripping

When `export2ai.removeComments` is enabled (default `false`), Export2AI strips comments from text files included in zips. Rules are chosen **by file extension** using string-aware parsing in `commentStripper.ts`. Profile definitions live in `commentProfiles.ts`.

## Skipped file types

These are **never** modified:

- Plain text and unknown extensions (no profile match)
- `.json` (strict JSON has no comments)
- `.md` / Markdown

## Supported syntax families

| Syntax | Languages (representative) |
|--------|---------------------------|
| `//` · `/* */` | C, C++, C#, Java, JavaScript, TypeScript, Go, Rust, Swift, Kotlin, Vue, Svelte, … |
| `//` · `#` · `/* */` | PHP |
| `#` | Python, Ruby, Shell, Perl, YAML, TOML, Terraform, Dockerfile, Makefile, … |
| `;` | Assembly (GAS/NASM-style) |
| `--` · `/* */` | SQL, MySQL, PostgreSQL, PL/SQL |
| `<!-- -->` | HTML, XML, SVG, XAML |
| `/* */` | CSS, SCSS, Sass, Less |
| `--` · `--[[ ]]` | Lua |
| `--` · `{- -}` | Haskell (nested blocks supported) |
| `(* *)` | OCaml, F#, Standard ML (nested blocks supported) |
| `'` | Visual Basic, VBScript |
| `%` · `%{ %}` | MATLAB, Octave |
| `%` | Erlang |
| `#` · `<# #>` | PowerShell (nested blocks supported) |
| `REM` · `::` (line start) | Windows Batch (`.bat`, `.cmd`) |
| `;` | Lisp, Scheme, Racket |
| `"` | Vim script |
| `%` | LaTeX, TeX, BibTeX |

The full extension map is in `EXTENSION_TO_PROFILE` inside `src/utils/commentProfiles.ts` (175 extensions).

## Special cases

- **Shebang** — preserved on line 1 for `#`-family profiles (`preserveShebang: true`)
- **`.m` files** — content heuristic chooses MATLAB (`%`) vs Objective-C (`//`, `/* */`)
- **Batch** — line-based `REM` / `::` stripping (not character scanner)
- **Nested block comments** — supported for Rust-style nesting in Haskell, OCaml/F#, PowerShell profiles

## String awareness

The scanner tracks `"`, `'`, and `` ` `` string literals and does not strip comment markers inside them. Edge cases remain:

- Comments inside regex literals may be misclassified
- Nested or escaped strings in unusual syntax may lose text

## Settings UI sync

At compile time, `scripts/sync-comment-settings.js` updates:

- `export2ai.removeComments` → humane intro (`REMOVE_COMMENTS_USER_DESCRIPTION`) + technical `markdownDescription` (syntax families, string-aware stripper)
- `export2ai.commentStripLanguages` → read-only summary string and full extension table

Run `npm run compile` after editing `commentProfiles.ts` to refresh Settings text.

## Tests

```bash
npm run test:comments
```

Covers C-family strings, Python shebang, SQL, HTML, Lua, PowerShell, batch, `.m` heuristic, and unchanged unknown extensions.
