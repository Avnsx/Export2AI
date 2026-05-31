import * as fs from "fs";
import * as vscode from "vscode";
import { finished } from "stream/promises";
import { ZipArchive } from "archiver";
import { getConfiguration } from "./config";
import { prepareIgnoreContext } from "./projectService";
import { CollectProgress, FileContent, Export2AIConfiguration, FileCollectionSummary } from "./types";
import { FileProcessor } from "./utils/fileProcessor";
import { buildZipArchiveFileName, formatCompactTimestamp } from "./utils/modelFormat";
import { TokenCounter } from "./utils/tokenCounter";
import { UriUtils } from "./utils/uriUtils";
import { debugError, debugLog } from "./utils/debugLogger";

export interface ZipResult {
  zipPath: string;
  zipUri: vscode.Uri;
  fileCount: number;
  totalBytes: number;
  tokenCount: number | null;
  tokenApproximate: boolean;
  llmModel: string;
}

export interface ZipOptions {
  cancellationToken?: vscode.CancellationToken;
  onProgress?: (progress: CollectProgress) => void;
}

interface CollectedFiles {
  files: FileContent[];
  summary: FileCollectionSummary;
}

async function collectFiles(
  sourceUri: vscode.Uri,
  workspaceFolder: vscode.WorkspaceFolder,
  config: Export2AIConfiguration,
  zipOutputPath: string,
  options: ZipOptions
): Promise<CollectedFiles> {
  const started = Date.now();
  debugLog("file-collection: start", {
    resource: workspaceFolder.uri,
    details: {
      source: sourceUri.fsPath,
      workspace: workspaceFolder.uri.fsPath,
      zipOutputPath,
      maxFileSize: config.maxFileSize,
      compressCode: config.compressCode,
      removeComments: config.removeComments,
      softDeleteGitMetadata: config.softDeleteGitMetadata,
      softDeleteGitMetadataRealGitPathPlaceholder: config.softDeleteGitMetadataRealGitPathPlaceholder,
      fileConcurrency: config.fileConcurrency
    }
  });
  const { ig, isExcludedByResourcePath } = await prepareIgnoreContext(workspaceFolder, config);

  let summary: FileCollectionSummary | undefined;
  const files = await FileProcessor.collectFiles(
    sourceUri,
    sourceUri,
    workspaceFolder.uri,
    ig,
    {
      maxFileSize: config.maxFileSize,
      compressCode: config.compressCode,
      removeComments: config.removeComments,
      softDeleteGitMetadata: config.softDeleteGitMetadata,
      softDeleteGitMetadataRealGitPathPlaceholder: config.softDeleteGitMetadataRealGitPathPlaceholder,
      isExcludedByResourcePath,
      zipOutputPath,
      fileConcurrency: config.fileConcurrency,
      cancellationToken: options.cancellationToken,
      onProgress: options.onProgress,
      onSummary: collectedSummary => {
        summary = collectedSummary;
      }
    }
  );
  debugLog("file-collection: finished", {
    resource: workspaceFolder.uri,
    details: {
      source: sourceUri.fsPath,
      files: files.length,
      elapsedMs: Date.now() - started
    }
  });
  return {
    files,
    summary: summary ?? {
      directoriesVisited: 0,
      ignoredDirectories: 0,
      ignoredEntries: 0,
      excludedEntries: 0,
      softDeletedEntries: 0,
      candidateFiles: files.length,
      includedFiles: files.length,
      skippedFiles: 0
    }
  };
}

export function buildExportManifest(
  sourceName: string,
  config: Export2AIConfiguration,
  files: ReadonlyArray<FileContent>,
  totalBytes: number,
  tokenCount: number | null,
  summary: FileCollectionSummary,
  createdAt: Date = new Date()
): string {
  const excludedTotal = summary.ignoredDirectories
    + summary.ignoredEntries
    + summary.excludedEntries
    + summary.skippedFiles;

  return [
    "Export2AI Manifest",
    `Target model: ${config.llmModel}`,
    `Source folder: ${sourceName}`,
    "Source path redacted: true",
    `Created: ${createdAt.toISOString()}`,
    `Included files: ${files.length}`,
    `Candidate files: ${summary.candidateFiles}`,
    `Excluded entries: ${excludedTotal}`,
    `Ignored directories: ${summary.ignoredDirectories}`,
    `Ignored entries: ${summary.ignoredEntries}`,
    `Explicitly excluded entries: ${summary.excludedEntries}`,
    `Skipped files: ${summary.skippedFiles}`,
    `Soft-deleted entries: ${summary.softDeletedEntries}`,
    `Processed bytes: ${totalBytes}`,
    tokenCount !== null ? `Estimated tokens: ${tokenCount.toLocaleString()}` : "",
    `Ignore .gitignore: ${config.ignoreGitIgnore}`,
    `Ignore dot files: ${config.ignoreDotFiles}`,
    `Ignore dollar files: ${config.ignoreDollarFiles}`,
    `Soft-delete Git/GitHub metadata: ${config.softDeleteGitMetadata}`,
    `Real .git path placeholder: ${config.softDeleteGitMetadataRealGitPathPlaceholder}`,
    `Compress code: ${config.compressCode}`,
    `Remove comments: ${config.removeComments}`,
    `File concurrency: ${config.fileConcurrency}`,
    `Exclude patterns: ${config.excludePatterns.join(", ")}`
  ].filter(Boolean).join("\n");
}

export async function createZipArchive(
  sourceUri: vscode.Uri,
  workspaceFolder: vscode.WorkspaceFolder,
  config: Export2AIConfiguration,
  options: ZipOptions = {}
): Promise<ZipResult> {
  const sourcePath = sourceUri.fsPath;
  // Use only the folder's own name (not its nested path) so zip names stay short.
  const sourceName = UriUtils.basename(sourceUri) || UriUtils.basename(workspaceFolder.uri);

  const timestamp = formatCompactTimestamp();
  const zipFileName = buildZipArchiveFileName(sourceName, config.llmModel, timestamp);
  const zipUri = vscode.Uri.joinPath(workspaceFolder.uri, zipFileName);
  const zipPath = zipUri.fsPath;
  const started = Date.now();

  debugLog("zip-service: create start", {
    resource: workspaceFolder.uri,
    details: {
      source: sourcePath,
      workspace: workspaceFolder.uri.fsPath,
      zipPath,
      zipFileName,
      config
    }
  });

  options.onProgress?.({
    filesProcessed: 0,
    totalFiles: 0,
    currentPath: "",
    phase: "collecting"
  });

  const { files, summary } = await collectFiles(sourceUri, workspaceFolder, config, zipPath, options);
  const tokenInfo = config.enableTokenCounting
    ? TokenCounter.countFilesContent(files, config.llmModel)
    : null;
  const tokenCount = tokenInfo?.inputTokens ?? null;
  const tokenApproximate = tokenInfo?.approximate ?? true;
  debugLog("zip-service: token count complete", {
    resource: workspaceFolder.uri,
    details: {
      enabled: config.enableTokenCounting,
      model: config.llmModel,
      tokenCount,
      tokenApproximate,
      method: tokenInfo?.method
    }
  });

  let totalBytes = 0;
  for (const file of files) {
    totalBytes += Buffer.byteLength(file.content, "utf8");
  }

  options.onProgress?.({
    filesProcessed: files.length,
    totalFiles: files.length,
    currentPath: zipFileName,
    phase: "writing"
  });

  try {
    debugLog("zip-service: writing archive", {
      resource: workspaceFolder.uri,
      details: {
        zipPath,
        files: files.length,
        processedBytes: totalBytes,
        compressionLevel: config.compressionLevel,
        includeManifest: config.includeManifest
      }
    });
    const output = fs.createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: config.compressionLevel } });
    archive.pipe(output);

    for (const file of files) {
      if (options.cancellationToken?.isCancellationRequested) {
        throw new vscode.CancellationError();
      }
      archive.append(file.content, { name: file.path });
    }

    if (config.includeManifest) {
      const manifest = buildExportManifest(sourceName, config, files, totalBytes, tokenCount, summary);
      archive.append(manifest, { name: "_EXPORT2AI_MANIFEST.txt" });
    }

    await archive.finalize();
    await finished(output);

    const stat = await fs.promises.stat(zipPath);
    if (stat.size === 0) {
      throw new Error("Archive file is empty after writing.");
    }
    debugLog("zip-service: archive written", {
      resource: workspaceFolder.uri,
      details: {
        zipPath,
        archiveBytes: stat.size,
        files: files.length,
        processedBytes: totalBytes,
        elapsedMs: Date.now() - started
      }
    });
  } catch (error) {
    await fs.promises.rm(zipPath, { force: true }).catch(() => undefined);
    debugError("zip-service: archive write failed", error, {
      resource: workspaceFolder.uri,
      details: { zipPath, elapsedMs: Date.now() - started }
    });
    throw error;
  }

  return {
    zipPath,
    zipUri,
    fileCount: files.length,
    totalBytes,
    tokenCount,
    tokenApproximate,
    llmModel: config.llmModel
  };
}
