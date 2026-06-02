# Token Estimates & AI Model Support 🧮

Export2AI provides an **offline token estimate** so you can judge whether a source archive is likely to fit an AI model's context window before uploading it.

No provider API call is made. Zipping does not consume OpenAI, Anthropic, Google, xAI, DeepSeek, Mistral, or other model tokens.

---

## Where Token Estimates Appear

| Location | Example | Notes |
|----------|---------|-------|
| status bar | `gpt-5.5 · (est. 47,382 tokens)` | click opens Export2AI settings |
| hover tooltip | model, scope, exact/approx method | compact explanation |
| zip notification | `(est. 47,382 tokens)` | shown after archive creation |
| Copy Project Structure notification | `(est. 1,204 tokens)` | counts the copied tree text |
| optional Explorer folder badges | `47`, `9k`, `1m` | off by default; badge-only and compact |

`~` means approximate. No `~` means an exact offline tokenizer was used for that model family.

---

## Default Model

```json
"export2ai.llmModel": "gpt-5.5"
```

This setting is the single source of truth for:

- token estimation method
- status bar model label
- Explorer target-model row
- zip filename model segment
- progress/notification copy
- `_EXPORT2AI_MANIFEST.txt`

---

## Supported Model Families

| Family | Example model names | Method | Display |
|--------|---------------------|--------|---------|
| OpenAI / ChatGPT modern | `gpt-5.5`, `gpt-5.5-pro`, `gpt-5.4`, `gpt-5`, `gpt-4.1`, `gpt-4o`, `gpt-4o-mini`, `o1`, `o3-mini`, `o4-mini` | `gpt-tokenizer` `o200k_base` | exact, no `~` |
| OpenAI legacy | `gpt-4`, `gpt-3.5-turbo` | `gpt-tokenizer` `cl100k_base` | exact, no `~` |
| Claude Opus modern | `claude-opus-4-8`, `claude-opus-4-7` | legacy Anthropic tokenizer plus content-aware uplift | approximate, `~` |
| Other Claude | `claude-sonnet-4-6`, `claude-opus-4-6`, `claude-haiku-4-5` | `@anthropic-ai/tokenizer` | approximate, `~` |
| Google Gemini | `gemini-3-pro`, `gemini-2.5-pro`, `gemini-*` | character heuristic unless explicitly handled later | approximate, `~` |
| xAI, DeepSeek, Mistral, unknown | `grok-*`, `deepseek-*`, `mistral-*`, `mixtral-*` | `characters ÷ 4` heuristic | approximate, `~` |

Partial names match by prefix. For example, `gpt-5.5-thinking` is treated as an OpenAI modern model and `claude-opus-4-7-20260416` is treated as Opus modern.

---

## Known Target Menu Models

The Explorer target-model menu recognizes these names:

```text
gpt-5.5
gpt-5.5-pro
gpt-5.4
gpt-4o
gpt-4.1
gpt-4
gpt-3.5-turbo
o3-mini
o4-mini
claude-opus-4-8
claude-opus-4-7
claude-sonnet-4-6
claude-opus-4-6
claude-haiku-4-5
gemini-2.5-pro
grok-3
```

Custom model names still work for filenames and estimates. Unknown families fall back to the approximate character heuristic.

---

## How Counting Works

| Step | Behavior |
|------|----------|
| Collect files | Export2AI applies ignore, exclude, soft-delete, binary, size, and UTF-8 rules. |
| Build token input | Included text content is counted. Placeholder content is counted as placeholder text. |
| Select tokenizer | `export2ai.llmModel` determines tokenizer family. |
| Format result | exact counts omit `~`; approximate counts include `~`. |
| Publish UI | status bar and notification update with model and token label. |

When Explorer folder badges are enabled, Export2AI uses a single-pass aggregation: it reads included files once, tokenizes each file, sums counts into ancestor directories, and serves badges from cache.

---

## Why Explorer Badges Are Off by Default

```json
"export2ai.showExplorerTokenBadges": false
```

Badges can be useful, but they add visual noise to the Explorer. The default keeps the IDE clean while still showing the workspace estimate in the status bar and zip notification.

If you enable badges:

- first full scan is deferred after startup
- saves/creates/deletes/renames trigger a debounced refresh
- badge text is limited to two characters by VS Code
- badge totals may differ slightly from zip totals because per-folder aggregation tokenizes per file

---

## Interpreting Counts

| Label | Meaning |
|-------|---------|
| `(est. 47,382 tokens)` | exact offline tokenizer for the selected model family |
| `(est. ~47,382 tokens)` | approximate offline estimate |
| `approx - Claude tokenizer` | Claude legacy npm tokenizer |
| `approx - Opus 4.7+ tokenizer uplift` | Claude Opus modern heuristic uplift |
| `approx - chars/4 heuristic` | rough fallback for unsupported families |

Approximate estimates are for planning, not billing.

---

## Settings

```json
{
  "export2ai.enableTokenCounting": true,
  "export2ai.showExplorerTokenBadges": false,
  "export2ai.llmModel": "gpt-5.5"
}
```

Related pages:

- [Quick Start](Quick-Start)
- [Settings & Configuration](Settings-and-Configuration)
- [Agent Chokepoints](Agent-Chokepoints)
