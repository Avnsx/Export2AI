/** Models with dedicated Explorer menu rows (when config.export2ai.llmModel matches). */
const MENU_TARGET_MODELS = [
  "gpt-5.5",
  "gpt-5.5-pro",
  "gpt-5.4",
  "gpt-4o",
  "gpt-4.1",
  "gpt-4",
  "gpt-3.5-turbo",
  "o3-mini",
  "o4-mini",
  "claude-opus-4-8",
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-opus-4-6",
  "claude-haiku-4-5",
  "gemini-2.5-pro",
  "grok-3"
];

function formatModelCommandSlug(model) {
  const trimmed = model.trim().toLowerCase();
  const slug = trimmed
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .replace(/\./g, "-");
  return slug || "unknown-model";
}

module.exports = {
  MENU_TARGET_MODELS,
  formatModelCommandSlug
};
