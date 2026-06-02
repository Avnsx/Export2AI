# FAQ ❓

Frequently asked questions about Export2AI, AI-ready zip archives, Cursor/VS Code project handoff, ChatGPT project uploads, Claude code review context, and offline token estimates.

---

## Is Export2AI a backup tool?

No. Export2AI creates a **source context archive for AI analysis**. It intentionally omits local Git internals, credentials, dependency caches, generated output, and other machine-local noise.

Use Git, proper backups, or artifact storage for backups.

---

## Does Export2AI upload my code anywhere?

No. Export2AI writes a local zip file and optionally copies its path to your clipboard. Token estimates are calculated offline. You choose whether and where to upload the resulting archive.

---

## Does token counting consume API tokens?

No. Token counting is local. No OpenAI, Anthropic, Google, xAI, DeepSeek, Mistral, or other provider API call is made.

---

## Why is there a `~` before some token counts?

`~` means approximate. OpenAI/ChatGPT model families supported by `gpt-tokenizer` display exact offline counts. Claude and unknown families use approximate local methods.

See [Token Estimates & AI Model Support](Token-Estimates-and-AI-Model-Support).

---

## Why is `.git/` missing from the zip?

Because local `.git/` internals contain machine-local repository state, remotes, refs, hooks, object databases, local history, and possible credentials. Export2AI keeps useful repository-control files but omits unsafe `.git/` internals.

See [Git Metadata Soft-Delete](Git-Metadata-Soft-Delete).

---

## Why are `.github/` and `.gitignore` included if dotfiles are ignored?

They are repository-control context. AI agents and tests often need CI workflows, Dependabot config, ignore rules, and repository validation files. Soft-delete preserves those while still blocking actual credential material.

---

## Why are `node_modules` and build folders excluded?

They are usually huge, generated, and not useful for LLM context. Source files, lockfiles, docs, tests, and config usually provide better AI review context.

---

## Can I include a default-excluded folder?

Yes. Use **Export2AI: Manage Built-in Exclude Patterns** to disable a built-in pattern, or tune `export2ai.excludePatterns` and `export2ai.excludePaths`.

Be careful with dependency folders and generated output: they can make the zip large and less useful.

---

## Can I exclude more files?

Yes.

```json
{
  "export2ai.excludePatterns": ["coverage", "*.sqlite"],
  "export2ai.excludePaths": ["fixtures/private-data"]
}
```

---

## Should I enable comment stripping?

Usually no. Comments often contain rationale, warnings, and maintenance knowledge that AI agents need. Enable `export2ai.removeComments` only when smaller context is more important than readability.

---

## Should I enable compression?

Zip compression level `9` is already the default and only affects upload byte size. `export2ai.compressCode` removes whitespace from exported text and can harm readability; keep it off unless you accept that tradeoff.

---

## Why are Explorer token badges not visible?

They are off by default:

```json
"export2ai.showExplorerTokenBadges": false
```

The status bar and zip notification still show token estimates.

---

## Can Export2AI copy only the folder tree?

Yes. Use **Copy Project Structure**. It can output plaintext, Markdown, or XML based on `export2ai.outputFormat`.

---

## Can Export2AI copy one exact file?

Yes. Right-click one file and choose **Export2AI: Copy Content to Clipboard**. It copies exact UTF-8 text without zip processing, comment stripping, or whitespace compression.

---

## Where is the zip created?

The zip is written to the workspace root, even if you export a nested folder.

---

## Can I change the target model?

Yes.

```json
"export2ai.llmModel": "claude-opus-4-8"
```

The model affects token estimates, menu display, zip filenames, notifications, and manifest text.

---

## What should I upload to ChatGPT or Claude?

Upload the generated `*-context-*.zip` file. In your prompt, tell the AI it is an Export2AI context archive and to read `_EXPORT2AI_MANIFEST.txt`, `README.md`, and `AGENTS.md` first when present.
