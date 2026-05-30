import * as vscode from "vscode";
import { getConfiguration } from "./config";
import { copyProjectStructure } from "./projectService";
import { TokenEstimateManager } from "./tokenEstimate";
import { openOwnExtensionSettings, OUTPUT_CHANNEL_NAME } from "./utils/extensionSettings";
import { MENU_TARGET_MODELS } from "./utils/menuTargetModels";
import { formatModelCommandSlug } from "./utils/modelFormat";
import { TokenCounter } from "./utils/tokenCounter";
import { revealInSystemExplorer } from "./utils/systemExplorer";
import { createZipArchive, ZipResult } from "./zipService";

let lastZipPath: string | undefined;
let tokenEstimateManager: TokenEstimateManager | undefined;
let outputChannel: vscode.OutputChannel | undefined;

async function revealZipInSystemExplorer(zipPath: string): Promise<void> {
  try {
    await revealInSystemExplorer(zipPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
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

async function zipFolder(rootUri?: vscode.Uri): Promise<void> {
  const workspaceFolder = rootUri
    ? vscode.workspace.getWorkspaceFolder(rootUri)
    : vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    vscode.window.showErrorMessage("Export2AI: No workspace folder found.");
    return;
  }

  const sourceUri = rootUri ?? workspaceFolder.uri;
  const config = getConfiguration(workspaceFolder.uri);

  if (config.enableTokenCounting) {
    await tokenEstimateManager?.updateContextForUri(sourceUri);
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
      vscode.window.showInformationMessage("Export2AI: Zip creation cancelled.");
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Export2AI failed: ${message}`);
    return;
  }

  if (!result) {
    return;
  }

  lastZipPath = result.zipPath;
  await tokenEstimateManager?.updateContextForUri(sourceUri);

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
    await revealZipInSystemExplorer(result.zipPath);
  } else if (choice === copied) {
    await vscode.env.clipboard.writeText(result.zipPath);
  } else if (config.copyPathAfterCreate) {
    await vscode.env.clipboard.writeText(result.zipPath);
  }
}

async function openOutputFolder(): Promise<void> {
  if (!lastZipPath) {
    vscode.window.showWarningMessage("Export2AI: No zip has been created yet in this session.");
    return;
  }

  try {
    await vscode.workspace.fs.stat(vscode.Uri.file(lastZipPath));
  } catch {
    vscode.window.showWarningMessage(`Export2AI: Zip file no longer exists: ${lastZipPath}`);
    lastZipPath = undefined;
    return;
  }

  await revealZipInSystemExplorer(lastZipPath);
}

function registerModelTargetCommands(context: vscode.ExtensionContext): void {
  const openSettings = () => {
    void openOwnExtensionSettings(context, outputChannel).catch(error => {
      const message = error instanceof Error ? error.message : String(error);
      outputChannel?.appendLine(`openSettings unhandled: ${message}`);
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
    vscode.commands.registerCommand("export2ai.openOutputFolder", openOutputFolder),
    vscode.commands.registerCommand("export2ai.openSettings", () => {
      void openOwnExtensionSettings(context, outputChannel).catch(error => {
        const message = error instanceof Error ? error.message : String(error);
        outputChannel?.appendLine(`openSettings unhandled: ${message}`);
        void vscode.window.showErrorMessage(`Export2AI: Failed to open settings: ${message}`);
      });
    })
  );
}

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  context.subscriptions.push(outputChannel);
  registerZipHandlers(context);
  registerModelTargetCommands(context);

  // The "Target model: …" menu rows use config.export2ai.llmModel when-clauses,
  // which VS Code re-evaluates automatically — no manual context sync needed.
  tokenEstimateManager = new TokenEstimateManager(context);
  context.subscriptions.push(tokenEstimateManager);

  if (process.env.EXPORT2AI_AUTO_TEST_SETTINGS === "1") {
    outputChannel.appendLine("Export2AI: scheduling automatic settings-navigation test...");
    setTimeout(() => {
      void openOwnExtensionSettings(context, outputChannel).catch(error => {
        const message = error instanceof Error ? error.message : String(error);
        outputChannel?.appendLine(`auto settings test failed: ${message}`);
      });
    }, 3500);
  }
}

export function deactivate(): void {
  tokenEstimateManager?.dispose();
  tokenEstimateManager = undefined;
  outputChannel = undefined;
}
