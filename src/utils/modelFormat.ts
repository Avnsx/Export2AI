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

/** Max characters kept from the folder name in a zip filename (keeps paths short on Windows). */
export const MAX_FOLDER_NAME_SEGMENT = 40;

/**
 * Compact, filesystem-safe segment from a folder name.
 * Uses only the **last** path segment (no nested clutter like `y--HOST_ROOT-…`),
 * strips illegal characters, and caps the length.
 */
export function formatFolderNameSegment(name: string): string {
  const lastSegment = name.split(/[\\/]/).filter(Boolean).pop() ?? "";
  const cleaned = lastSegment
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const trimmed = cleaned.slice(0, MAX_FOLDER_NAME_SEGMENT).replace(/-+$/, "");
  return trimmed || "workspace";
}

/** Compact, filesystem-safe timestamp: `YYYY-MM-DD-HHMMSS` (e.g. 2026-05-30-182617). */
export function formatCompactTimestamp(date: Date = new Date()): string {
  const [datePart, timePart] = date.toISOString().split("T");
  const hms = timePart.slice(0, 8).replace(/:/g, "");
  return `${datePart}-${hms}`;
}

export function buildZipArchiveFileName(
  folderName: string,
  model: string,
  timestamp: string
): string {
  return `${formatFolderNameSegment(folderName)}-${formatModelFileSlug(model)}-context-${timestamp}.zip`;
}
