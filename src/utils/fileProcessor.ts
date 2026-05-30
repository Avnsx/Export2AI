import { TextDecoder } from "util";
import * as vscode from "vscode";
import { isBinaryFile } from "isbinaryfile";
import ignore from "ignore";
import { CollectFilesOptions, FileContent } from "../types";
import { AsyncPool, DirectoryQueue } from "./asyncPool";
import { IgnoreUtils } from "./ignoreUtils";
import { UriUtils } from "./uriUtils";
import { stripCommentsForFile } from "./commentStripper";
import { debugError, debugLog } from "./debugLogger";

type IgnoreInstance = ReturnType<typeof ignore>;

interface PendingFile {
  uri: vscode.Uri;
  relativePath: string;
}

export class FileProcessor {
  public static async collectFiles(
    rootUri: vscode.Uri,
    sourceUri: vscode.Uri,
    workspaceUri: vscode.Uri,
    ig: IgnoreInstance,
    options: CollectFilesOptions
  ): Promise<FileContent[]> {
    const started = Date.now();
    const pendingFiles: PendingFile[] = [];
    const directoryQueue = new DirectoryQueue();
    let directoriesVisited = 0;
    let ignoredDirectories = 0;
    let ignoredEntries = 0;
    let excludedEntries = 0;
    directoryQueue.enqueue(sourceUri);

    while (directoryQueue.size > 0) {
      if (options.cancellationToken?.isCancellationRequested) {
        throw new vscode.CancellationError();
      }

      const dirUri = directoryQueue.dequeue();
      if (!dirUri) {
        break;
      }
      directoriesVisited += 1;

      const relativeDirPath = UriUtils.relativePath(rootUri, dirUri);
      if (relativeDirPath && IgnoreUtils.isIgnored(ig, relativeDirPath, true)) {
        ignoredDirectories += 1;
        continue;
      }

      if (options.isExcludedByResourcePath(dirUri)) {
        excludedEntries += 1;
        continue;
      }

      let entries: [string, vscode.FileType][];
      try {
        entries = await vscode.workspace.fs.readDirectory(dirUri);
      } catch (error) {
        debugError("file-processor: failed to read directory", error, {
          details: { directory: dirUri.toString(), root: rootUri.toString() }
        });
        continue;
      }

      for (const [name, fileType] of entries) {
        if (options.cancellationToken?.isCancellationRequested) {
          throw new vscode.CancellationError();
        }

        const fileUri = vscode.Uri.joinPath(dirUri, name);
        const relativePath = UriUtils.relativePath(rootUri, fileUri);
        const isDirectory = Boolean(fileType & vscode.FileType.Directory);

        if (IgnoreUtils.isIgnored(ig, relativePath, isDirectory)) {
          ignoredEntries += 1;
          continue;
        }

        if (options.isExcludedByResourcePath(fileUri)) {
          excludedEntries += 1;
          continue;
        }

        if (isDirectory) {
          directoryQueue.enqueue(fileUri);
        } else if (fileType & vscode.FileType.File) {
          pendingFiles.push({ uri: fileUri, relativePath });
        }
      }
    }

    const concurrency = Math.max(1, options.fileConcurrency ?? 4);
    let processedCount = 0;
    debugLog("file-processor: discovery finished", {
      details: {
        root: rootUri.fsPath,
        source: sourceUri.fsPath,
        workspace: workspaceUri.fsPath,
        directoriesVisited,
        ignoredDirectories,
        ignoredEntries,
        excludedEntries,
        candidateFiles: pendingFiles.length,
        concurrency
      }
    });

    const processed = await AsyncPool.map(
      pendingFiles,
      concurrency,
      async (pending) => {
        const result = await this.processFile(pending.uri, pending.relativePath, ig, options);
        return result;
      },
      {
        cancellationToken: options.cancellationToken,
        onProgress: (_completed, _total, item) => {
          processedCount += 1;
          options.onProgress?.({
            filesProcessed: processedCount,
            totalFiles: pendingFiles.length,
            currentPath: item.relativePath
          });
        }
      }
    );

    const files = processed.filter((file): file is FileContent => file !== null);
    debugLog("file-processor: processing finished", {
      details: {
        root: rootUri.fsPath,
        includedFiles: files.length,
        skippedFiles: processed.length - files.length,
        elapsedMs: Date.now() - started
      }
    });
    return files;
  }

  public static async processFile(
    fileUri: vscode.Uri,
    relativePath: string,
    ig: IgnoreInstance,
    options: CollectFilesOptions
  ): Promise<FileContent | null> {
    try {
      if (IgnoreUtils.isIgnored(ig, relativePath, false)) {
        return null;
      }

      if (options.isExcludedByResourcePath(fileUri)) {
        return null;
      }

      if (fileUri.fsPath && options.zipOutputPath &&
          fileUri.fsPath.toLowerCase() === options.zipOutputPath.toLowerCase()) {
        return null;
      }

      const stats = await vscode.workspace.fs.stat(fileUri);
      if (stats.size > options.maxFileSize) {
        return {
          path: relativePath,
          content: `[File too large: ${stats.size} bytes > ${options.maxFileSize} bytes]`
        };
      }

      const fileBytes = await vscode.workspace.fs.readFile(fileUri);
      const fileBuffer = Buffer.from(fileBytes);

      try {
        const isBinary = await isBinaryFile(fileBuffer, stats.size);
        if (isBinary) {
          return {
            path: relativePath,
            content: "[Binary file content not included]"
          };
        }
      } catch {
        // Fall through to text handling.
      }

      try {
        let content = new TextDecoder("utf-8", { fatal: true }).decode(fileBuffer);
        content = this.processContent(content, relativePath, options.removeComments, options.compressCode);
        return { path: relativePath, content };
      } catch {
        return {
          path: relativePath,
          content: "[File has encoding issues. Please convert to UTF-8 for inclusion.]"
        };
      }
    } catch (error) {
      debugError("file-processor: error processing file", error, {
        details: { file: fileUri.toString(), relativePath }
      });
      return null;
    }
  }

  public static removeCodeComments(content: string, relativePath = "legacy.ts"): string {
    return stripCommentsForFile(content, relativePath);
  }

  public static compressCodeContent(content: string): string {
    return content
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join("\n");
  }

  public static processContent(
    content: string,
    relativePath: string,
    removeComments: boolean,
    compressCode: boolean
  ): string {
    let processedContent = content;

    if (removeComments) {
      processedContent = stripCommentsForFile(processedContent, relativePath);
    }

    if (compressCode) {
      processedContent = this.compressCodeContent(processedContent);
    }

    return processedContent;
  }
}
