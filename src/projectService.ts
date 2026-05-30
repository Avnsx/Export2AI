import { TextDecoder } from "util";
import * as vscode from "vscode";
import ignore from "ignore";
import { isBinaryFile } from "isbinaryfile";
import { getConfiguration } from "./config";
import { CollectProgress, Export2AIConfiguration } from "./types";
import { OutputFormatter } from "./utils/formatters";
import { IgnoreUtils } from "./utils/ignoreUtils";
import { ProjectTreeGenerator } from "./utils/projectTree";
import { TokenCounter } from "./utils/tokenCounter";
import { UriUtils } from "./utils/uriUtils";
import { debugError, debugLog } from "./utils/debugLogger";

type IgnoreInstance = ReturnType<typeof ignore>;

function formatDisplayPath(uri: vscode.Uri): string {
  try {
    return vscode.workspace.asRelativePath(uri, false);
  } catch {
    return uri.fsPath || uri.toString();
  }
}

function resolveSingleFileUri(
  uri?: vscode.Uri,
  selectedUris?: readonly vscode.Uri[]
): { uri?: vscode.Uri; error?: string; warning?: string } {
  if (selectedUris && selectedUris.length > 1) {
    return { warning: `Copy content supports one file at a time. Selected: ${selectedUris.length}.` };
  }

  if (selectedUris && selectedUris.length === 1) {
    return { uri: selectedUris[0] };
  }

  if (uri) {
    return { uri };
  }

  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (activeUri && activeUri.scheme !== "untitled") {
    return { uri: activeUri };
  }

  return { error: "No file selected." };
}

export function createIgnoreContext(
  workspaceFolder: vscode.WorkspaceFolder,
  config: Export2AIConfiguration
): {
  ig: IgnoreInstance;
  isExcludedByResourcePath: (resourceUri: vscode.Uri) => boolean;
} {
  const ig = IgnoreUtils.createIgnoreInstance(
    config.excludePatterns,
    config.ignoreDotFiles,
    config.ignoreDollarFiles
  );

  return {
    ig,
    isExcludedByResourcePath: IgnoreUtils.createResourcePathExclusionFn(
      workspaceFolder.uri,
      config.excludePaths
    )
  };
}

export async function prepareIgnoreContext(
  workspaceFolder: vscode.WorkspaceFolder,
  config: Export2AIConfiguration
): Promise<{
  ig: IgnoreInstance;
  isExcludedByResourcePath: (resourceUri: vscode.Uri) => boolean;
}> {
  debugLog("ignore: preparing context", {
    resource: workspaceFolder.uri,
    details: {
      workspace: workspaceFolder.uri.fsPath,
      ignoreGitIgnore: config.ignoreGitIgnore,
      ignoreDotFiles: config.ignoreDotFiles,
      ignoreDollarFiles: config.ignoreDollarFiles,
      excludePatterns: config.excludePatterns,
      excludePaths: config.excludePaths
    }
  });
  const context = createIgnoreContext(workspaceFolder, config);

  if (config.ignoreGitIgnore) {
    await IgnoreUtils.addGitIgnoreRules(workspaceFolder.uri, context.ig);
    debugLog("ignore: gitignore rules merged", {
      resource: workspaceFolder.uri,
      details: { workspace: workspaceFolder.uri.fsPath }
    });
  }

  return context;
}

export async function copyProjectStructure(rootUri?: vscode.Uri): Promise<void> {
  const started = Date.now();
  const workspaceFolder = rootUri
    ? vscode.workspace.getWorkspaceFolder(rootUri)
    : vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    debugLog("copy-structure: command aborted", { details: { reason: "no workspace folder", requestedUri: rootUri?.toString() } });
    vscode.window.showErrorMessage("Export2AI: No workspace folder found.");
    return;
  }

  let targetUri = rootUri ?? workspaceFolder.uri;

  const config = getConfiguration(workspaceFolder.uri);
  debugLog("copy-structure: command start", {
    resource: workspaceFolder.uri,
    details: {
      requestedTarget: targetUri.fsPath,
      workspace: workspaceFolder.uri.fsPath,
      config
    }
  });

  try {
    if (rootUri) {
      try {
        const stats = await vscode.workspace.fs.stat(rootUri);
        if (!(stats.type & vscode.FileType.Directory)) {
          debugLog("copy-structure: non-directory target; using workspace root", {
            resource: workspaceFolder.uri,
            details: { requestedTarget: rootUri.toString(), workspace: workspaceFolder.uri.fsPath }
          });
          targetUri = workspaceFolder.uri;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        debugError("copy-structure: failed to inspect target", error, {
          resource: workspaceFolder.uri,
          details: { requestedTarget: rootUri.toString(), elapsedMs: Date.now() - started }
        });
        vscode.window.showErrorMessage(`Export2AI: Failed to inspect selected path: ${message}`);
        return;
      }
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Export2AI: Copying project structure...",
        cancellable: true
      },
      async (progress, token) => {
        progress.report({ message: "Setting up filters..." });
        const { ig, isExcludedByResourcePath } = await prepareIgnoreContext(workspaceFolder, config);

        const rootName = `${UriUtils.basename(targetUri)}/\n`;
        progress.report({ message: "Generating project tree..." });

        const projectTree = await ProjectTreeGenerator.generateProjectTree(
          targetUri,
          ig,
          config.maxDepth,
          0,
          "",
          isExcludedByResourcePath,
          token,
          targetUri
        );

        const formatted = OutputFormatter.formatProjectStructureOnly(
          config.outputFormat,
          rootName + projectTree
        );
        debugLog("copy-structure: tree generated", {
          resource: workspaceFolder.uri,
          details: {
            target: targetUri.fsPath,
            outputFormat: config.outputFormat,
            characters: formatted.length
          }
        });

        progress.report({ message: "Copying to clipboard..." });
        await vscode.env.clipboard.writeText(formatted);

        if (config.enableTokenCounting) {
          const tokenInfo = TokenCounter.countTokens(formatted, config.llmModel);
          debugLog("copy-structure: copied with token estimate", {
            resource: workspaceFolder.uri,
            details: {
              target: targetUri.fsPath,
              outputFormat: config.outputFormat,
              tokenCount: tokenInfo.inputTokens,
              tokenApproximate: tokenInfo.approximate,
              method: tokenInfo.method,
              model: config.llmModel,
              elapsedMs: Date.now() - started
            }
          });
          vscode.window.showInformationMessage(
            `Export2AI copied project structure (${config.outputFormat}) ${TokenCounter.formatTokenLabel(tokenInfo.inputTokens, tokenInfo.approximate)}`
          );
          return;
        }

        debugLog("copy-structure: copied without token estimate", {
          resource: workspaceFolder.uri,
          details: {
            target: targetUri.fsPath,
            outputFormat: config.outputFormat,
            elapsedMs: Date.now() - started
          }
        });
        vscode.window.showInformationMessage(
          `Export2AI copied project structure (${config.outputFormat}) to clipboard.`
        );
      }
    );
  } catch (error) {
    if (error instanceof vscode.CancellationError) {
      debugLog("copy-structure: command cancelled", {
        resource: workspaceFolder.uri,
        details: { target: targetUri.fsPath, elapsedMs: Date.now() - started }
      });
      vscode.window.showInformationMessage("Export2AI: Copy project structure cancelled.");
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    debugError("copy-structure: command failed", error, {
      resource: workspaceFolder.uri,
      details: { target: targetUri.fsPath, elapsedMs: Date.now() - started }
    });
    vscode.window.showErrorMessage(`Export2AI failed: ${message}`);
  }
}

export async function copyFileContentToClipboard(
  uri?: vscode.Uri,
  selectedUris?: readonly vscode.Uri[]
): Promise<void> {
  const started = Date.now();
  const resolved = resolveSingleFileUri(uri, selectedUris);

  if (resolved.warning) {
    debugLog("copy-file-content: command rejected", { details: { reason: resolved.warning } });
    vscode.window.showWarningMessage(`Export2AI: ${resolved.warning}`);
    return;
  }

  if (resolved.error || !resolved.uri) {
    debugLog("copy-file-content: command rejected", { details: { reason: resolved.error ?? "missing uri" } });
    vscode.window.showErrorMessage(`Export2AI: ${resolved.error ?? "No file selected."}`);
    return;
  }

  const targetUri = resolved.uri;
  const displayPath = formatDisplayPath(targetUri);
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(targetUri);
  const config = getConfiguration(workspaceFolder?.uri ?? targetUri);

  debugLog("copy-file-content: command start", {
    resource: workspaceFolder?.uri ?? targetUri,
    details: {
      target: targetUri.toString(),
      displayPath,
      workspace: workspaceFolder?.uri.fsPath,
      tokenCounting: config.enableTokenCounting,
      model: config.llmModel
    }
  });

  try {
    const stat = await vscode.workspace.fs.stat(targetUri);
    if (stat.type & vscode.FileType.Directory) {
      debugLog("copy-file-content: command rejected", {
        resource: workspaceFolder?.uri ?? targetUri,
        details: { reason: "target is directory", target: targetUri.toString() }
      });
      vscode.window.showWarningMessage("Export2AI: Copy Content to Clipboard is only for files.");
      return;
    }

    if (!(stat.type & vscode.FileType.File)) {
      debugLog("copy-file-content: command rejected", {
        resource: workspaceFolder?.uri ?? targetUri,
        details: { reason: "target is not a regular file", target: targetUri.toString(), fileType: stat.type }
      });
      vscode.window.showWarningMessage(`Export2AI: ${displayPath} is not a regular file.`);
      return;
    }

    const fileBytes = await vscode.workspace.fs.readFile(targetUri);
    const fileBuffer = Buffer.from(fileBytes);

    let binary = false;
    try {
      binary = await isBinaryFile(fileBuffer, stat.size);
    } catch (error) {
      debugError("copy-file-content: binary detection failed; attempting text decode", error, {
        resource: workspaceFolder?.uri ?? targetUri,
        details: { target: targetUri.toString(), bytes: stat.size }
      });
    }

    if (binary) {
      debugLog("copy-file-content: binary file rejected", {
        resource: workspaceFolder?.uri ?? targetUri,
        details: { target: targetUri.toString(), bytes: stat.size }
      });
      vscode.window.showWarningMessage(`Export2AI: ${displayPath} is binary. Content was not copied.`);
      return;
    }

    let content: string;
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(fileBuffer);
    } catch (error) {
      debugError("copy-file-content: UTF-8 decode failed", error, {
        resource: workspaceFolder?.uri ?? targetUri,
        details: { target: targetUri.toString(), bytes: stat.size }
      });
      vscode.window.showErrorMessage(`Export2AI: ${displayPath} is not valid UTF-8 text. Content was not copied.`);
      return;
    }

    await vscode.env.clipboard.writeText(content);

    if (config.enableTokenCounting) {
      const tokenInfo = TokenCounter.countTokens(content, config.llmModel);
      debugLog("copy-file-content: copied with token estimate", {
        resource: workspaceFolder?.uri ?? targetUri,
        details: {
          target: targetUri.toString(),
          bytes: stat.size,
          characters: content.length,
          tokenCount: tokenInfo.inputTokens,
          tokenApproximate: tokenInfo.approximate,
          method: tokenInfo.method,
          model: config.llmModel,
          elapsedMs: Date.now() - started
        }
      });
      vscode.window.showInformationMessage(
        `Export2AI copied content from ${displayPath} (${stat.size.toLocaleString()} bytes) ${TokenCounter.formatTokenLabel(tokenInfo.inputTokens, tokenInfo.approximate)}`
      );
      return;
    }

    debugLog("copy-file-content: copied", {
      resource: workspaceFolder?.uri ?? targetUri,
      details: {
        target: targetUri.toString(),
        bytes: stat.size,
        characters: content.length,
        elapsedMs: Date.now() - started
      }
    });
    vscode.window.showInformationMessage(
      `Export2AI copied content from ${displayPath} (${stat.size.toLocaleString()} bytes).`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debugError("copy-file-content: command failed", error, {
      resource: workspaceFolder?.uri ?? targetUri,
      details: { target: targetUri.toString(), elapsedMs: Date.now() - started }
    });
    vscode.window.showErrorMessage(`Export2AI: Failed to copy content from ${displayPath}: ${message}`);
  }
}

export type ZipProgressReporter = (progress: CollectProgress) => void;
