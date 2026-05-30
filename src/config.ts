import * as vscode from "vscode";
import { Export2AIConfiguration } from "./types";
import { DEFAULT_LLM_MODEL } from "./utils/modelRegistry";

const CONFIG_SECTION = "export2ai";

const DEFAULT_EXCLUDE_PATTERNS = [
  "node_modules",
  "*.log",
  "*.tmp",
  "*.temp",
  "*.bak",
  "dist",
  "build",
  "out",
  ".git",
  "*-chatgpt-context-*.zip",
  "*-*-context-*.zip"
];

export function getConfiguration(resource?: vscode.Uri): Export2AIConfiguration {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION, resource);

  const legacyExclude = config.get<string[]>("exclude");
  const excludePatterns = config.get<string[]>("excludePatterns")
    ?? (legacyExclude?.length ? legacyExclude : DEFAULT_EXCLUDE_PATTERNS);

  return {
    ignoreGitIgnore: config.get<boolean>("ignoreGitIgnore", true),
    ignoreDotFiles: config.get<boolean>("ignoreDotFiles", true),
    ignoreDollarFiles: config.get<boolean>("ignoreDollarFiles", true),
    excludePatterns,
    excludePaths: config.get<string[]>("excludePaths") ?? [],
    compressCode: config.get<boolean>("compressCode", false),
    removeComments: config.get<boolean>("removeComments", false),
    enableTokenCounting: config.get<boolean>("enableTokenCounting", true),
    llmModel: config.get<string>("llmModel", DEFAULT_LLM_MODEL),
    compressionLevel: Math.min(9, Math.max(0, config.get<number>("compressionLevel", 9))),
    includeManifest: config.get<boolean>("includeManifest", true),
    copyPathAfterCreate: config.get<boolean>("copyPathAfterCreate", true),
    maxFileSize: Math.max(0, config.get<number>("maxFileSize", 1024 * 1024)),
    maxDepth: Math.max(0, config.get<number>("maxDepth", 5)),
    fileConcurrency: Math.min(32, Math.max(1, config.get<number>("fileConcurrency", 4))),
    outputFormat: config.get<"plaintext" | "markdown" | "xml">("outputFormat", "plaintext"),
    debug: config.get<boolean>("debug", false)
  };
}
