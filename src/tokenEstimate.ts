import * as vscode from "vscode";
import { getConfiguration } from "./config";
import { TokenCounter } from "./utils/tokenCounter";
import { onSettingsNavigationFinished, settingsNavigationInProgress } from "./utils/extensionSettings";

/** Defer first full-repo scan so cold-start (e.g. opening Settings) stays responsive. */
const INITIAL_SCAN_DELAY_MS = 5000;

/** Extra debounce after settings navigation before resuming scans. */
const POST_SETTINGS_REFRESH_DELAY_MS = 1500;
import {
  formatTokenBadge,
  formatTokenTooltip,
  formatStatusBarZipLabel
} from "./utils/tokenFormat";

export class TokenEstimateManager implements vscode.Disposable {
  private readonly cache = new Map<string, { count: number; approximate: boolean; methodLabel: string }>();
  private readonly pending = new Map<string, Promise<number>>();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly decorationEmitter = new vscode.EventEmitter<vscode.Uri | undefined>();
  private debounceTimer: NodeJS.Timeout | undefined;
  private statusBarItem: vscode.StatusBarItem | undefined;
  private enabled = false;
  private refreshGeneration = 0;
  private initialScanTimer: NodeJS.Timeout | undefined;

  constructor(private readonly context: vscode.ExtensionContext) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const config = getConfiguration(workspaceFolder?.uri);
    this.enabled = config.enableTokenCounting;

    void vscode.commands.executeCommand("setContext", "export2ai.enableTokenCounting", this.enabled);

    this.disposables.push(
      onSettingsNavigationFinished(() => {
        setTimeout(() => this.scheduleRefresh(), POST_SETTINGS_REFRESH_DELAY_MS);
      }),
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration("export2ai")) {
          this.cache.clear();
          this.scheduleRefresh();
        }
      }),
      vscode.workspace.onDidSaveTextDocument(() => this.scheduleRefresh()),
      vscode.workspace.onDidCreateFiles(() => this.scheduleRefresh()),
      vscode.workspace.onDidDeleteFiles(() => this.scheduleRefresh()),
      vscode.workspace.onDidRenameFiles(() => this.scheduleRefresh()),
      vscode.window.registerFileDecorationProvider({
        onDidChangeFileDecorations: this.decorationEmitter.event,
        provideFileDecoration: (uri) => this.provideDecoration(uri)
      })
    );

    // Defer the first scan so cold-start (e.g. opening Settings) is not competing with a full-repo token walk.
    this.initialScanTimer = setTimeout(() => {
      if (!settingsNavigationInProgress) {
        this.scheduleRefresh();
      }
    }, INITIAL_SCAN_DELAY_MS);
  }

  public getCachedEstimate(folderPath: string): number | undefined {
    return this.cache.get(folderPath.toLowerCase())?.count;
  }

  public async estimateForUri(uri: vscode.Uri): Promise<number | undefined> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
      return undefined;
    }

    const config = getConfiguration(workspaceFolder.uri);
    if (!config.enableTokenCounting) {
      return undefined;
    }

    return this.estimateAndCache(uri, workspaceFolder, config.enableTokenCounting);
  }

  public async updateContextForUri(uri: vscode.Uri): Promise<void> {
    const count = await this.estimateForUri(uri);
    const cached = this.cache.get(uri.fsPath.toLowerCase());
    await this.publishEstimate(
      count ?? 0,
      this.enabled,
      cached?.approximate ?? true,
      cached?.methodLabel
    );
  }

  private async estimateAndCache(
    uri: vscode.Uri,
    workspaceFolder: vscode.WorkspaceFolder,
    enabled: boolean
  ): Promise<number> {
    const cacheKey = uri.fsPath.toLowerCase();
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      return cached.count;
    }

    const inflight = this.pending.get(cacheKey);
    if (inflight) {
      return inflight;
    }

    const config = getConfiguration(workspaceFolder.uri);
    const task = this.getTokenInfo(uri, workspaceFolder, config)
      .then(async tokenInfo => {
        const estimate = {
          count: tokenInfo.inputTokens,
          approximate: tokenInfo.approximate,
          methodLabel: TokenCounter.getMethodLabel(tokenInfo.method)
        };
        this.cache.set(cacheKey, estimate);
        this.pending.delete(cacheKey);
        this.decorationEmitter.fire(uri);
        if (this.isWorkspaceRoot(uri, workspaceFolder)) {
          await this.publishEstimate(
            estimate.count,
            enabled,
            estimate.approximate,
            estimate.methodLabel
          );
        }
        return estimate.count;
      })
      .catch(error => {
        this.pending.delete(cacheKey);
        console.error(`Export2AI: token estimate failed for ${cacheKey}`, error);
        throw error;
      });

    this.pending.set(cacheKey, task);
    return task;
  }

  private async getTokenInfo(
    uri: vscode.Uri,
    workspaceFolder: vscode.WorkspaceFolder,
    config: ReturnType<typeof getConfiguration>
  ) {
    const { prepareIgnoreContext } = await import("./projectService");
    const { FileProcessor } = await import("./utils/fileProcessor");
    const { ig, isExcludedByResourcePath } = await prepareIgnoreContext(workspaceFolder, config);
    const files = await FileProcessor.collectFiles(
      uri,
      uri,
      workspaceFolder.uri,
      ig,
      {
        maxFileSize: config.maxFileSize,
        compressCode: config.compressCode,
        removeComments: config.removeComments,
        isExcludedByResourcePath,
        zipOutputPath: "",
        fileConcurrency: config.fileConcurrency
      }
    );
    return TokenCounter.countFilesContent(files, config.llmModel);
  }

  private provideDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (!this.enabled || settingsNavigationInProgress) {
      return undefined;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
      return undefined;
    }

    void (async () => {
      try {
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.type & vscode.FileType.Directory) {
          await this.estimateAndCache(uri, workspaceFolder, this.enabled);
        }
      } catch {
        // Ignore decoration errors for inaccessible paths.
      }
    })();

    const cached = this.cache.get(uri.fsPath.toLowerCase());
    if (cached !== undefined) {
      const badge = formatTokenBadge(cached.count);
      return badge ? { badge } : undefined;
    }
  }

  /** Status bar reflects the workspace root estimate, not per-folder decoration scans. */
  private isWorkspaceRoot(uri: vscode.Uri, workspaceFolder: vscode.WorkspaceFolder): boolean {
    return uri.toString() === workspaceFolder.uri.toString()
      || uri.fsPath.toLowerCase() === workspaceFolder.uri.fsPath.toLowerCase();
  }

  private scheduleRefresh(): void {
    if (settingsNavigationInProgress) {
      return;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      void this.refreshWorkspaceEstimates();
    }, 750);
  }

  private async refreshWorkspaceEstimates(): Promise<void> {
    const generation = ++this.refreshGeneration;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      this.enabled = false;
      if (generation === this.refreshGeneration) {
        await this.publishEstimate(0, false, true);
      }
      return;
    }

    const config = getConfiguration(workspaceFolder.uri);
    this.enabled = config.enableTokenCounting;
    await vscode.commands.executeCommand("setContext", "export2ai.enableTokenCounting", this.enabled);

    if (!this.enabled) {
      this.statusBarItem?.hide();
      this.decorationEmitter.fire(undefined);
      if (generation === this.refreshGeneration) {
        await this.publishEstimate(0, false, true);
      }
      return;
    }

    try {
      const count = await this.estimateAndCache(workspaceFolder.uri, workspaceFolder, true);
      if (generation !== this.refreshGeneration) {
        return;
      }
      const cached = this.cache.get(workspaceFolder.uri.fsPath.toLowerCase());
      this.updateStatusBar(count, cached?.approximate ?? true, cached?.methodLabel);
      this.decorationEmitter.fire(workspaceFolder.uri);
    } catch (error) {
      console.error("Export2AI: token estimate failed", error);
    }
  }

  private updateStatusBar(count: number, approximate: boolean, methodLabel?: string): void {
    if (!this.statusBarItem) {
      this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90);
      this.statusBarItem.command = "export2ai.openSettings";
      this.context.subscriptions.push(this.statusBarItem);
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const llmModel = workspaceFolder ? getConfiguration(workspaceFolder.uri).llmModel : undefined;

    this.statusBarItem.text = `$(file-zip) ${formatStatusBarZipLabel(llmModel ?? "", count, approximate)}`;
    this.statusBarItem.tooltip = formatTokenTooltip(count, approximate, methodLabel, llmModel);
    this.statusBarItem.show();
  }

  private async publishEstimate(
    count: number,
    enabled: boolean,
    approximate: boolean,
    methodLabel?: string
  ): Promise<void> {
    await vscode.commands.executeCommand("setContext", "export2ai.enableTokenCounting", enabled);
    if (enabled) {
      this.updateStatusBar(count, approximate, methodLabel);
    }
  }

  public dispose(): void {
    if (this.initialScanTimer) {
      clearTimeout(this.initialScanTimer);
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.statusBarItem?.dispose();
    this.decorationEmitter.dispose();
  }
}
