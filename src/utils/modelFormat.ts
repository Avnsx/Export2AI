import { DEFAULT_LLM_MODEL } from "./modelRegistry";

/** Safe filesystem segment from export2ai.llmModel (e.g. gpt-5.5 → gpt-5-5). */
export function formatModelFileSlug(model: string): string {
  const trimmed = model.trim().toLowerCase();
  if (!trimmed) {
    return "unknown-model";
  }
  const slug = trimmed
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "unknown-model";
}

/** User-facing model label (trimmed setting value). */
export function formatModelDisplayName(model: string): string {
  const trimmed = model.trim();
  return trimmed || DEFAULT_LLM_MODEL;
}

/** Command-id segment for model-specific menu commands (gpt-5.5 → gpt-5-5). */
export function formatModelCommandSlug(model: string): string {
  return formatModelFileSlug(model).replace(/\./g, "-");
}

export function buildZipArchiveFileName(
  folderSafeName: string,
  model: string,
  timestamp: string
): string {
  return `${folderSafeName}-${formatModelFileSlug(model)}-context-${timestamp}.zip`;
}
