import * as vscode from "vscode";
import { getConfiguration } from "./config";
import { copyFileContentToClipboard, copyProjectStructure } from "./projectService";
import { TokenEstimateManager } from "./tokenEstimate";
import { openOwnExtensionSettings } from "./utils/extensionSettings";
import { MENU_TARGET_MODELS } from "./utils/menuTargetModels";
import { formatModelCommandSlug } from "./utils/modelFormat";
import { TokenCounter } from "./utils/tokenCounter";
import { revealInSystemExplorer } from "./utils/systemExplorer";
import { createZipArchive, ZipResult } from "./zipService";
import { debugError, debugLog, disposeDebugOutputChannel, isDebugLoggingEnabled } from "./utils/debugLogger";

let lastZipPath: string | undefined;
let tokenEstimateManager: TokenEstimateManager | undefined;

async function revealZipInSystemExplorer(zipPath: string): Promise<void> {
  try {
    await revealInSystemExplorer(zipPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debugError("zip: reveal in system explorer failed", error, { details: { zipPath } });
    vscode.window.showErrorMessage(`Export2AI: Could not open zip in file manager: ${message}`);
  }
}

function formatProgressMessage(progress: {
  filesProcessed: number;
  totalFiles: number;
  currentPath: string;
  phase?: string;
}): string {
  if (progress.phase === "writing") {
    return "Writing zip archive...";
  }

  if (progress.totalFiles > 0) {
    return `Processing ${progress.filesProcessed}/${progress.totalFiles}: ${progress.currentPath}`;
  }

  return progress.currentPath
    ? `Scanning ${progress.currentPath}...`
    : "Scanning project files...";
}

async function updateTokenEstimateForUri(uri: vscode.Uri, phase: string): Promise<boolean> {
  try {
    await tokenEstimateManager?.updateContextForUri(uri);
    return true;
  } catch (error) {
    debugError("zip: token estimate refresh failed", error, {
      details: { phase, uri: uri.toString() }
    });
    return false;
  }
}

async function copyZipPathToClipboard(zipPath: string): Promise<void> {
  try {
    await vscode.env.clipboard.writeText(zipPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debugError("zip: failed to copy zip path", error, { details: { zipPath } });
    vscode.window.showErrorMessage(`Export2AI: Failed to copy zip path to clipboard: ${message}`);
  }
}

async function zipFolder(rootUri?: vscode.Uri): Promise<void> {
  const started = Date.now();
  const workspaceFolder = rootUri
    ? vscode.workspace.getWorkspaceFolder(rootUri)
    : vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    debugLog("zip: command aborted", { details: { reason: "no workspace folder", requestedUri: rootUri?.toString() } });
    vscode.window.showErrorMessage("Export2AI: No workspace folder found.");
    return;
  }

  const sourceUri = rootUri ?? workspaceFolder.uri;
  const config = getConfiguration(workspaceFolder.uri);

  debugLog("zip: command start", {
    resource: workspaceFolder.uri,
    details: {
      source: sourceUri.fsPath,
      workspace: workspaceFolder.uri.fsPath,
      config
    }
  });

  if (config.enableTokenCounting) {
    debugLog("zip: preflight token estimate start", {
      resource: workspaceFolder.uri,
      details: { source: sourceUri.fsPath, model: config.llmModel }
    });
    if (await updateTokenEstimateForUri(sourceUri, "preflight")) {
      debugLog("zip: preflight token estimate finished", {
        resource: workspaceFolder.uri,
        details: { source: sourceUri.fsPath, model: config.llmModel }
      });
    }
  }

  let result: ZipResult | undefined;

  try {
    result = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Export2AI: Creating zip for ${config.llmModel}...`,
        cancellable: true
      },
      async (progress, token) => {
        progress.report({ message: "Scanning project files..." });

        const zipResult = await createZipArchive(sourceUri, workspaceFolder, config, {
          cancellationToken: token,
          onProgress: (collectProgress) => {
            progress.report({ message: formatProgressMessage(collectProgress) });
          }
        });

        if (zipResult.tokenCount !== null) {
          progress.report({
            message: TokenCounter.formatTokenLabel(zipResult.tokenCount, zipResult.tokenApproximate)
          });
        }

        return zipResult;
      }
    );
  } catch (error) {
    if (error instanceof vscode.CancellationError) {
      debugLog("zip: command cancelled", {
        resource: workspaceFolder.uri,
        details: { source: sourceUri.fsPath, elapsedMs: Date.now() - started }
      });
      vscode.window.showInformationMessage("Export2AI: Zip creation cancelled.");
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    debugError("zip: command failed", error, {
      resource: workspaceFolder.uri,
      details: { source: sourceUri.fsPath, elapsedMs: Date.now() - started }
    });
    vscode.window.showErrorMessage(`Export2AI failed: ${message}`);
    return;
  }

  if (!result) {
    return;
  }

  lastZipPath = result.zipPath;
  await updateTokenEstimateForUri(sourceUri, "post-zip");

  debugLog("zip: command finished", {
    resource: workspaceFolder.uri,
    details: {
      source: sourceUri.fsPath,
      zipPath: result.zipPath,
      files: result.fileCount,
      bytes: result.totalBytes,
      tokenCount: result.tokenCount,
      tokenApproximate: result.tokenApproximate,
      model: result.llmModel,
      elapsedMs: Date.now() - started
    }
  });

  const open = "Show in Explorer";
  const copied = "Copy Path";
  const relativeZip = vscode.workspace.asRelativePath(result.zipUri, false);
  const tokenSuffix = result.tokenCount !== null
    ? ` ${TokenCounter.formatTokenLabel(result.tokenCount, result.tokenApproximate)}`
    : "";

  const choice = await vscode.window.showInformationMessage(
    `Export2AI created for ${result.llmModel}: ${relativeZip} (${result.fileCount} files)${tokenSuffix}`,
    open,
    copied
  );

  if (choice === open) {
    debugLog("zip: notification action", {
      resource: workspaceFolder.uri,
      details: { action: open, zipPath: result.zipPath }
    });
    await revealZipInSystemExplorer(result.zipPath);
  } else if (choice === copied) {
    debugLog("zip: notification action", {
      resource: workspaceFolder.uri,
      details: { action: copied, zipPath: result.zipPath }
    });
    await copyZipPathToClipboard(result.zipPath);
  } else if (config.copyPathAfterCreate) {
    debugLog("zip: copied path after create", {
      resource: workspaceFolder.uri,
      details: { zipPath: result.zipPath }
    });
    await copyZipPathToClipboard(result.zipPath);
  }
}

async function openOutputFolder(): Promise<void> {
  debugLog("zip: open last zip requested", { details: { lastZipPath } });
  if (!lastZipPath) {
    vscode.window.showWarningMessage("Export2AI: No zip has been created yet in this session.");
    return;
  }

  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(lastZipPath));
  } catch {
    debugLog("zip: last zip missing", { details: { lastZipPath } });
    vscode.window.showWarningMessage(`Export2AI: Zip file no longer exists: ${lastZipPath}`);
    lastZipPath = undefined;
    return;
  }

  await revealZipInSystemExplorer(lastZipPath);
}

function registerModelTargetCommands(context: vscode.ExtensionContext): void {
  const openSettings = () => {
    void openOwnExtensionSettings(context).catch(error => {
      const message = error instanceof Error ? error.message : String(error);
      debugError("settings: unhandled openSettings failure", error, { show: true });
      void vscode.window.showErrorMessage(`Export2AI: Failed to open settings: ${message}`);
    });
  };

  for (const model of MENU_TARGET_MODELS) {
    const slug = formatModelCommandSlug(model);
    context.subscriptions.push(
      vscode.commands.registerCommand(`export2ai.modelTarget.${slug}`, openSettings),
      vscode.commands.registerCommand(`export2ai.zipFor.${slug}`, (uri?: vscode.Uri) => zipFolder(uri))
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand("export2ai.modelTarget.custom", openSettings),
    vscode.commands.registerCommand("export2ai.zipFor.custom", (uri?: vscode.Uri) => zipFolder(uri))
  );
}

function registerZipHandlers(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("export2ai.zipWorkspace", () => zipFolder()),
    vscode.commands.registerCommand("export2ai.zipSelectedFolder", (uri?: vscode.Uri) => zipFolder(uri)),
    vscode.commands.registerCommand("export2ai.copyProjectStructure", (uri?: vscode.Uri) => copyProjectStructure(uri)),
    vscode.commands.registerCommand(
      "export2ai.copyFileContent",
      (uri?: vscode.Uri, selectedUris?: vscode.Uri[]) => copyFileContentToClipboard(uri, selectedUris)
    ),
    vscode.commands.registerCommand("export2ai.openOutputFolder", openOutputFolder),
    vscode.commands.registerCommand("export2ai.openSettings", () => {
      void openOwnExtensionSettings(context).catch(error => {
        const message = error instanceof Error ? error.message : String(error);
        debugError("settings: unhandled openSettings failure", error, { show: true });
        void vscode.window.showErrorMessage(`Export2AI: Failed to open settings: ${message}`);
      });
    })
  );
}

function registerDebugConfigurationWatcher(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(event => {
      if (!event.affectsConfiguration("export2ai.debug")) {
        return;
      }

      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!isDebugLoggingEnabled(workspaceFolder?.uri)) {
        return;
      }

      debugLog("debug: enabled", {
        resource: workspaceFolder?.uri,
        show: true,
        details: {
          workspace: workspaceFolder?.uri.fsPath
        }
      });
    })
  );
}

export function activate(context: vscode.ExtensionContext): void {
  debugLog("extension: activate", {
    show: true,
    details: {
      extensionId: context.extension.id,
      version: context.extension.packageJSON?.version,
      workspaceFolders: vscode.workspace.workspaceFolders?.map(folder => folder.uri.fsPath) ?? []
    }
  });
  registerDebugConfigurationWatcher(context);
  registerZipHandlers(context);
  registerModelTargetCommands(context);
  debugLog("extension: commands registered", {
    details: { modelTargetCommands: MENU_TARGET_MODELS.length + 1 }
  });

  // The "Target model: …" menu rows use config.export2ai.llmModel when-clauses,
  // which VS Code re-evaluates automatically — no manual context sync needed.
  tokenEstimateManager = new TokenEstimateManager(context);
  context.subscriptions.push(tokenEstimateManager);

  if (process.env.EXPORT2AI_AUTO_TEST_SETTINGS === "1") {
    debugLog("settings: automatic navigation test scheduled", { show: true, details: { delayMs: 3500 } });
    setTimeout(() => {
      void openOwnExtensionSettings(context).catch(error => {
        debugError("settings: automatic navigation test failed", error, { show: true });
      });
    }, 3500);
  }
}

export function deactivate(): void {
  debugLog("extension: deactivate");
  tokenEstimateManager?.dispose();
  tokenEstimateManager = undefined;
  disposeDebugOutputChannel();
}
