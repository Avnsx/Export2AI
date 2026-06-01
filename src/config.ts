import * as vscode from "vscode";
import { Export2AIConfiguration } from "./types";
import { isDebugLoggingEnabled } from "./utils/debugLogger";
import { DEFAULT_LLM_MODEL } from "./utils/modelRegistry";

const CONFIG_SECTION = "export2ai";

export const DEFAULT_EXCLUDE_PATTERNS = [
  "node_modules",
  "*.log",
  "*.tmp",
  "*.temp",
  "*.bak",
  "dist",
  "site",
  "build",
  "out",
  ".git",
  "__pycache__",
  ".pytest_cache",
  ".cache",
  ".tmp",
  "**/*private*key*",
  "**/*private-key*",
  "**/*secret*key*",
  "**/*signing*key*",
  "**/*ed25519*key*",
  "**/*rsa*key*",
  "**/*.pem",
  "**/*.key",
  "**/*.p8",
  "**/*.p12",
  "**/*.pfx",
  "**/id_rsa",
  "**/id_dsa",
  "**/id_ecdsa",
  "**/id_ed25519",
  "**/*.asc",
  "**/*.gpg",
  "**/.env",
  "**/.env.*",
  "**/*token*",
  "**/*credential*",
  "**/*credentials*",
  "**/*secrets*",
  "out*.json",
  "*-chatgpt-context-*.zip",
  "*-*-context-*.zip"
];

const BUILT_IN_EXCLUDE_PATTERN_SET = new Set(DEFAULT_EXCLUDE_PATTERNS);

function getStringArray(config: vscode.WorkspaceConfiguration, key: string): string[] {
  const value = config.get<unknown>(key, []);
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export function getBooleanSetting(
  config: vscode.WorkspaceConfiguration,
  key: string,
  defaultValue: boolean
): boolean {
  const value = config.get<unknown>(key, defaultValue);
  return typeof value === "boolean" ? value : defaultValue;
}

export function normalizeDisabledBuiltInExcludePatterns(patterns: unknown): string[] {
  if (!Array.isArray(patterns)) {
    return [];
  }
  return [
    ...new Set(
      patterns
        .filter((pattern): pattern is string => typeof pattern === "string")
        .map(pattern => pattern.trim())
        .filter(pattern => BUILT_IN_EXCLUDE_PATTERN_SET.has(pattern))
    )
  ];
}

function mergeExcludePatterns(
  useBuiltInExcludePatterns: boolean,
  disabledBuiltInExcludePatterns: string[],
  configuredExcludePatterns: string[],
  legacyExcludePatterns: string[]
): string[] {
  const disabledBuiltIns = new Set(normalizeDisabledBuiltInExcludePatterns(disabledBuiltInExcludePatterns));
  const builtIns = useBuiltInExcludePatterns
    ? DEFAULT_EXCLUDE_PATTERNS.filter(pattern => !disabledBuiltIns.has(pattern))
    : [];
  const merged = useBuiltInExcludePatterns
    ? [...builtIns, ...configuredExcludePatterns, ...legacyExcludePatterns]
    : [...configuredExcludePatterns, ...legacyExcludePatterns];
  return [...new Set(merged)];
}

export function getConfiguration(resource?: vscode.Uri): Export2AIConfiguration {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION, resource);

  const legacyExclude = getStringArray(config, "exclude");
  const configuredExcludePatterns = getStringArray(config, "excludePatterns");
  const useBuiltInExcludePatterns = getBooleanSetting(config, "useBuiltInExcludePatterns", true);
  const disabledBuiltInExcludePatterns = normalizeDisabledBuiltInExcludePatterns(
    getStringArray(config, "disabledBuiltInExcludePatterns")
  );
  const excludePatterns = mergeExcludePatterns(
    useBuiltInExcludePatterns,
    disabledBuiltInExcludePatterns,
    configuredExcludePatterns,
    legacyExclude
  );

  return {
    ignoreGitIgnore: config.get<boolean>("ignoreGitIgnore", true),
    ignoreDotFiles: config.get<boolean>("ignoreDotFiles", true),
    ignoreDollarFiles: config.get<boolean>("ignoreDollarFiles", true),
    softDeleteGitMetadata: config.get<boolean>("softDeleteGitMetadata", true),
    softDeleteGitMetadataRealGitPathPlaceholder: config.get<boolean>("softDeleteGitMetadata.realGitPathPlaceholder", false),
    useBuiltInExcludePatterns,
    disabledBuiltInExcludePatterns,
    excludePatterns,
    excludePaths: config.get<string[]>("excludePaths") ?? [],
    compressCode: config.get<boolean>("compressCode", false),
    removeComments: config.get<boolean>("removeComments", false),
    enableTokenCounting: config.get<boolean>("enableTokenCounting", true),
    showExplorerTokenBadges: config.get<boolean>("showExplorerTokenBadges", false),
    llmModel: config.get<string>("llmModel", DEFAULT_LLM_MODEL),
    compressionLevel: Math.min(9, Math.max(0, config.get<number>("compressionLevel", 9))),
    includeManifest: config.get<boolean>("includeManifest", true),
    copyPathAfterCreate: config.get<boolean>("copyPathAfterCreate", true),
    maxFileSize: Math.max(0, config.get<number>("maxFileSize", 1024 * 1024)),
    maxDepth: Math.max(0, config.get<number>("maxDepth", 5)),
    fileConcurrency: Math.min(32, Math.max(1, config.get<number>("fileConcurrency", 4))),
    outputFormat: config.get<"plaintext" | "markdown" | "xml">("outputFormat", "plaintext"),
    debug: isDebugLoggingEnabled()
  };
}
