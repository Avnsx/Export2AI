import * as fs from "fs";
import * as vscode from "vscode";
import { finished } from "stream/promises";
import { ZipArchive } from "archiver";
import { getConfiguration } from "./config";
import { prepareIgnoreContext } from "./projectService";
import { CollectProgress, FileContent, Export2AIConfiguration } from "./types";
import { FileProcessor } from "./utils/fileProcessor";
import { buildZipArchiveFileName, formatCompactTimestamp } from "./utils/modelFormat";
import { TokenCounter } from "./utils/tokenCounter";
import { UriUtils } from "./utils/uriUtils";

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

async function collectFiles(
  sourceUri: vscode.Uri,
  workspaceFolder: vscode.WorkspaceFolder,
  config: Export2AIConfiguration,
  zipOutputPath: string,
  options: ZipOptions
): Promise<FileContent[]> {
  const { ig, isExcludedByResourcePath } = await prepareIgnoreContext(workspaceFolder, config);

  return FileProcessor.collectFiles(
    sourceUri,
    sourceUri,
    workspaceFolder.uri,
    ig,
    {
      maxFileSize: config.maxFileSize,
      compressCode: config.compressCode,
      removeComments: config.removeComments,
      isExcludedByResourcePath,
      zipOutputPath,
      fileConcurrency: config.fileConcurrency,
      cancellationToken: options.cancellationToken,
      onProgress: options.onProgress
    }
  );
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

  options.onProgress?.({
    filesProcessed: 0,
    totalFiles: 0,
    currentPath: "",
    phase: "collecting"
  });

  const files = await collectFiles(sourceUri, workspaceFolder, config, zipPath, options);
  const tokenInfo = config.enableTokenCounting
    ? TokenCounter.countFilesContent(files, config.llmModel)
    : null;
  const tokenCount = tokenInfo?.inputTokens ?? null;
  const tokenApproximate = tokenInfo?.approximate ?? true;

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
      const manifest = [
        "Export2AI Manifest",
        `Target model: ${config.llmModel}`,
        `Source: ${sourcePath}`,
        `Created: ${new Date().toISOString()}`,
        `Files: ${files.length}`,
        `Processed bytes: ${totalBytes}`,
        tokenCount !== null ? `Estimated tokens: ${tokenCount.toLocaleString()}` : "",
        `Ignore .gitignore: ${config.ignoreGitIgnore}`,
        `Ignore dot files: ${config.ignoreDotFiles}`,
        `Ignore dollar files: ${config.ignoreDollarFiles}`,
        `Compress code: ${config.compressCode}`,
        `Remove comments: ${config.removeComments}`,
        `File concurrency: ${config.fileConcurrency}`,
        `Exclude patterns: ${config.excludePatterns.join(", ")}`
      ].filter(Boolean).join("\n");

      archive.append(manifest, { name: "_EXPORT2AI_MANIFEST.txt" });
    }

    await archive.finalize();
    await finished(output);

    const stat = await fs.promises.stat(zipPath);
    if (stat.size === 0) {
      throw new Error("Archive file is empty after writing.");
    }
  } catch (error) {
    await fs.promises.rm(zipPath, { force: true }).catch(() => undefined);
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
