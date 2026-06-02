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
  return value
    .filter((item): item is string => typeof item === "string")
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

export function getBooleanSetting(
  config: vscode.WorkspaceConfiguration,
  key: string,
  defaultValue: boolean
): boolean {
  const value = config.get<unknown>(key, defaultValue);
  return typeof value === "boolean" ? value : defaultValue;
}

function getStringSetting(
  config: vscode.WorkspaceConfiguration,
  key: string,
  defaultValue: string
): string {
  const value = config.get<unknown>(key, defaultValue);
  return typeof value === "string" && value.trim().length > 0 ? value : defaultValue;
}

function getNumberSetting(
  config: vscode.WorkspaceConfiguration,
  key: string,
  defaultValue: number,
  min: number,
  max?: number
): number {
  const value = config.get<unknown>(key, defaultValue);
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : defaultValue;
  const lowerBounded = Math.max(min, numeric);
  return max === undefined ? lowerBounded : Math.min(max, lowerBounded);
}

function getOutputFormat(config: vscode.WorkspaceConfiguration): "plaintext" | "markdown" | "xml" {
  const value = config.get<unknown>("outputFormat", "plaintext");
  return value === "markdown" || value === "xml" ? value : "plaintext";
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
    ignoreGitIgnore: getBooleanSetting(config, "ignoreGitIgnore", true),
    ignoreDotFiles: getBooleanSetting(config, "ignoreDotFiles", true),
    ignoreDollarFiles: getBooleanSetting(config, "ignoreDollarFiles", true),
    softDeleteGitMetadata: getBooleanSetting(config, "softDeleteGitMetadata", true),
    softDeleteGitMetadataRealGitPathPlaceholder: getBooleanSetting(config, "softDeleteGitMetadata.realGitPathPlaceholder", false),
    useBuiltInExcludePatterns,
    disabledBuiltInExcludePatterns,
    excludePatterns,
    excludePaths: getStringArray(config, "excludePaths"),
    compressCode: getBooleanSetting(config, "compressCode", false),
    removeComments: getBooleanSetting(config, "removeComments", false),
    enableTokenCounting: getBooleanSetting(config, "enableTokenCounting", true),
    showExplorerTokenBadges: getBooleanSetting(config, "showExplorerTokenBadges", false),
    llmModel: getStringSetting(config, "llmModel", DEFAULT_LLM_MODEL),
    compressionLevel: getNumberSetting(config, "compressionLevel", 9, 0, 9),
    includeManifest: getBooleanSetting(config, "includeManifest", true),
    copyPathAfterCreate: getBooleanSetting(config, "copyPathAfterCreate", true),
    maxFileSize: getNumberSetting(config, "maxFileSize", 1024 * 1024, 0),
    maxDepth: getNumberSetting(config, "maxDepth", 5, 0),
    fileConcurrency: getNumberSetting(config, "fileConcurrency", 4, 1, 32),
    outputFormat: getOutputFormat(config),
    debug: isDebugLoggingEnabled()
  };
}
