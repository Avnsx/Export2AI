import * as vscode from "vscode";

export interface Export2AIConfiguration {
  ignoreGitIgnore: boolean;
  ignoreDotFiles: boolean;
  ignoreDollarFiles: boolean;
  softDeleteGitMetadata: boolean;
  softDeleteGitMetadataRealGitPathPlaceholder: boolean;
  useBuiltInExcludePatterns: boolean;
  disabledBuiltInExcludePatterns: string[];
  excludePatterns: string[];
  excludePaths: string[];
  compressCode: boolean;
  removeComments: boolean;
  enableTokenCounting: boolean;
  showExplorerTokenBadges: boolean;
  llmModel: string;
  compressionLevel: number;
  includeManifest: boolean;
  copyPathAfterCreate: boolean;
  maxFileSize: number;
  maxDepth: number;
  fileConcurrency: number;
  outputFormat: "plaintext" | "markdown" | "xml";
  debug: boolean;
}

export interface FileContent {
  path: string;
  content: string;
}

export interface CollectProgress {
  filesProcessed: number;
  totalFiles: number;
  currentPath: string;
  phase?: "collecting" | "writing";
}

export interface ProcessFileOptions {
  maxFileSize: number;
  compressCode: boolean;
  removeComments: boolean;
  softDeleteGitMetadata: boolean;
  softDeleteGitMetadataRealGitPathPlaceholder: boolean;
  isExcludedByResourcePath: (resourceUri: vscode.Uri) => boolean;
  zipOutputPath: string;
}

export interface FileCollectionSummary {
  directoriesVisited: number;
  ignoredDirectories: number;
  ignoredEntries: number;
  excludedEntries: number;
  softDeletedEntries: number;
  candidateFiles: number;
  includedFiles: number;
  skippedFiles: number;
}

export interface CollectFilesOptions extends ProcessFileOptions {
  fileConcurrency?: number;
  cancellationToken?: vscode.CancellationToken;
  onProgress?: (progress: CollectProgress) => void;
  onSummary?: (summary: FileCollectionSummary) => void;
}

export type TokenCountMethod =
  | "openai-o200k"
  | "openai-cl100k"
  | "anthropic-opus-modern"
  | "anthropic-legacy"
  | "chars-heuristic";

export interface TokenInfo {
  inputTokens: number;
  method: TokenCountMethod;
  approximate: boolean;
}
