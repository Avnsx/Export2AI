import * as vscode from "vscode";
import ignore from "ignore";
import { getConfiguration } from "./config";
import { CollectProgress, Export2AIConfiguration } from "./types";
import { OutputFormatter } from "./utils/formatters";
import { IgnoreUtils } from "./utils/ignoreUtils";
import { ProjectTreeGenerator } from "./utils/projectTree";
import { TokenCounter } from "./utils/tokenCounter";
import { UriUtils } from "./utils/uriUtils";

type IgnoreInstance = ReturnType<typeof ignore>;

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
  const context = createIgnoreContext(workspaceFolder, config);

  if (config.ignoreGitIgnore) {
    await IgnoreUtils.addGitIgnoreRules(workspaceFolder.uri, context.ig);
  }

  return context;
}

export async function copyProjectStructure(rootUri?: vscode.Uri): Promise<void> {
  const workspaceFolder = rootUri
    ? vscode.workspace.getWorkspaceFolder(rootUri)
    : vscode.workspace.workspaceFolders?.[0];

  if (!workspaceFolder) {
    vscode.window.showErrorMessage("Export2AI: No workspace folder found.");
    return;
  }

  let targetUri = rootUri ?? workspaceFolder.uri;

  if (rootUri) {
    const stats = await vscode.workspace.fs.stat(rootUri);
    if (!(stats.type & vscode.FileType.Directory)) {
      targetUri = workspaceFolder.uri;
    }
  }

  const config = getConfiguration(workspaceFolder.uri);

  try {
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

        progress.report({ message: "Copying to clipboard..." });
        await vscode.env.clipboard.writeText(formatted);

        if (config.enableTokenCounting) {
          const tokenInfo = TokenCounter.countTokens(formatted, config.llmModel);
          vscode.window.showInformationMessage(
            `Export2AI copied project structure (${config.outputFormat}) ${TokenCounter.formatTokenLabel(tokenInfo.inputTokens, tokenInfo.approximate)}`
          );
          return;
        }

        vscode.window.showInformationMessage(
          `Export2AI copied project structure (${config.outputFormat}) to clipboard.`
        );
      }
    );
  } catch (error) {
    if (error instanceof vscode.CancellationError) {
      vscode.window.showInformationMessage("Export2AI: Copy project structure cancelled.");
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Export2AI failed: ${message}`);
  }
}

export type ZipProgressReporter = (progress: CollectProgress) => void;
