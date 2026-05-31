import * as path from "path";
import * as vscode from "vscode";
import { getConfiguration } from "./config";
import { FileContent } from "./types";
import { TokenCounter } from "./utils/tokenCounter";
import { onSettingsNavigationFinished, settingsNavigationInProgress } from "./utils/extensionSettings";
import { debugError, debugLog } from "./utils/debugLogger";

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
  private explorerBadgesEnabled = false;
  private refreshGeneration = 0;
  private initialScanTimer: NodeJS.Timeout | undefined;
  /** Workspace roots whose entire subtree has been aggregated, so badges come from cache only. */
  private readonly fullyScannedRoots = new Set<string>();

  constructor(private readonly context: vscode.ExtensionContext) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const config = getConfiguration(workspaceFolder?.uri);
    this.enabled = config.enableTokenCounting;
    this.explorerBadgesEnabled = this.enabled && config.showExplorerTokenBadges;
    debugLog("token-estimate: manager initialized", {
      resource: workspaceFolder?.uri,
      details: {
        enabled: this.enabled,
        explorerBadgesEnabled: this.explorerBadgesEnabled,
        initialScanDelayMs: INITIAL_SCAN_DELAY_MS,
        workspace: workspaceFolder?.uri.fsPath
      }
    });

    void vscode.commands.executeCommand("setContext", "export2ai.enableTokenCounting", this.enabled);

    this.disposables.push(
      onSettingsNavigationFinished(() => {
        debugLog("token-estimate: refresh scheduled after settings navigation", {
          resource: workspaceFolder?.uri,
          details: { delayMs: POST_SETTINGS_REFRESH_DELAY_MS }
        });
        setTimeout(() => this.scheduleRefresh(), POST_SETTINGS_REFRESH_DELAY_MS);
      }),
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration("export2ai")) {
          debugLog("token-estimate: configuration changed", {
            resource: vscode.workspace.workspaceFolders?.[0]?.uri,
            details: { section: "export2ai" }
          });
          this.cache.clear();
          this.fullyScannedRoots.clear();
          this.decorationEmitter.fire(undefined);
          this.scheduleRefresh();
        }
      }),
      vscode.workspace.onDidSaveTextDocument(document => {
        debugLog("token-estimate: file saved", { details: { file: document.uri.fsPath } });
        this.scheduleRefresh();
      }),
      vscode.workspace.onDidCreateFiles(event => {
        debugLog("token-estimate: files created", { details: { files: event.files.map(file => file.fsPath) } });
        this.scheduleRefresh();
      }),
      vscode.workspace.onDidDeleteFiles(event => {
        debugLog("token-estimate: files deleted", { details: { files: event.files.map(file => file.fsPath) } });
        this.scheduleRefresh();
      }),
      vscode.workspace.onDidRenameFiles(event => {
        debugLog("token-estimate: files renamed", {
          details: { files: event.files.map(file => ({ oldUri: file.oldUri.fsPath, newUri: file.newUri.fsPath })) }
        });
        this.scheduleRefresh();
      }),
      vscode.window.registerFileDecorationProvider({
        onDidChangeFileDecorations: this.decorationEmitter.event,
        provideFileDecoration: (uri) => this.provideDecoration(uri)
      })
    );

    if (!this.explorerBadgesEnabled) {
      queueMicrotask(() => this.decorationEmitter.fire(undefined));
    }

    // Defer the first scan so cold-start (e.g. opening Settings) is not competing with a full-repo token walk.
    this.initialScanTimer = setTimeout(() => {
      if (!settingsNavigationInProgress) {
        debugLog("token-estimate: initial scan timer fired", {
          resource: vscode.workspace.workspaceFolders?.[0]?.uri
        });
        this.scheduleRefresh();
      } else {
        debugLog("token-estimate: initial scan deferred by settings navigation", {
          resource: vscode.workspace.workspaceFolders?.[0]?.uri
        });
      }
    }, INITIAL_SCAN_DELAY_MS);
  }

  public getCachedEstimate(folderPath: string): number | undefined {
    return this.cache.get(folderPath.toLowerCase())?.count;
  }

  public async estimateForUri(uri: vscode.Uri): Promise<number | undefined> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
      debugLog("token-estimate: estimate skipped", { details: { reason: "no workspace folder", uri: uri.fsPath } });
      return undefined;
    }

    const config = getConfiguration(workspaceFolder.uri);
    if (!config.enableTokenCounting) {
      debugLog("token-estimate: estimate skipped", {
        resource: workspaceFolder.uri,
        details: { reason: "token counting disabled", uri: uri.fsPath }
      });
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
      debugLog("token-estimate: cache hit", {
        resource: workspaceFolder.uri,
        details: { uri: uri.fsPath, count: cached.count, approximate: cached.approximate, method: cached.methodLabel }
      });
      return cached.count;
    }

    const inflight = this.pending.get(cacheKey);
    if (inflight) {
      debugLog("token-estimate: awaiting in-flight estimate", {
        resource: workspaceFolder.uri,
        details: { uri: uri.fsPath }
      });
      return inflight;
    }

    const config = getConfiguration(workspaceFolder.uri);
    debugLog("token-estimate: estimate start", {
      resource: workspaceFolder.uri,
      details: { uri: uri.fsPath, model: config.llmModel }
    });
    const task = this.getTokenInfo(uri, workspaceFolder, config)
      .then(async tokenInfo => {
        const estimate = {
          count: tokenInfo.inputTokens,
          approximate: tokenInfo.approximate,
          methodLabel: TokenCounter.getMethodLabel(tokenInfo.method)
        };
        this.cache.set(cacheKey, estimate);
        this.pending.delete(cacheKey);
        this.decorationEmitter.fire(this.explorerBadgesEnabled ? uri : undefined);
        if (this.isWorkspaceRoot(uri, workspaceFolder)) {
          await this.publishEstimate(
            estimate.count,
            enabled,
            estimate.approximate,
            estimate.methodLabel
          );
        }
        debugLog("token-estimate: estimate finished", {
          resource: workspaceFolder.uri,
          details: {
            uri: uri.fsPath,
            count: estimate.count,
            approximate: estimate.approximate,
            method: estimate.methodLabel
          }
        });
        return estimate.count;
      })
      .catch(error => {
        this.pending.delete(cacheKey);
        debugError("token-estimate: estimate failed", error, {
          resource: workspaceFolder.uri,
          details: { cacheKey, uri: uri.fsPath }
        });
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
    const files = await this.collectFilesUnder(uri, workspaceFolder, config);
    return TokenCounter.countFilesContent(files, config.llmModel);
  }

  /** Walk a folder once, returning processed files with paths relative to `rootUri`. */
  private async collectFilesUnder(
    rootUri: vscode.Uri,
    workspaceFolder: vscode.WorkspaceFolder,
    config: ReturnType<typeof getConfiguration>
  ): Promise<FileContent[]> {
    const { prepareIgnoreContext } = await import("./projectService");
    const { FileProcessor } = await import("./utils/fileProcessor");
    const started = Date.now();
    debugLog("token-estimate: collect files start", {
      resource: workspaceFolder.uri,
      details: { root: rootUri.fsPath, workspace: workspaceFolder.uri.fsPath, model: config.llmModel }
    });
    const { ig, isExcludedByResourcePath } = await prepareIgnoreContext(workspaceFolder, config);
    const files = await FileProcessor.collectFiles(rootUri, rootUri, workspaceFolder.uri, ig, {
      maxFileSize: config.maxFileSize,
      compressCode: config.compressCode,
      removeComments: config.removeComments,
      isExcludedByResourcePath,
      zipOutputPath: "",
      fileConcurrency: config.fileConcurrency
    });
    debugLog("token-estimate: collect files finished", {
      resource: workspaceFolder.uri,
      details: { root: rootUri.fsPath, files: files.length, elapsedMs: Date.now() - started }
    });
    return files;
  }

  /**
   * Single-pass aggregation. Tokenizes every collected file once, then propagates each
   * file's count up its ancestor directories so the workspace root and every folder that
   * contains at least one included file get a cached estimate from one walk. This replaces
   * the old behaviour where each folder decoration triggered its own full subtree scan
   * (re-reading and re-tokenizing the same files once per ancestor), which is why badges
   * only appeared after a per-folder scan completed.
   *
   * Mirrors VS Code's own Git decoration provider, which precomputes a full decoration map
   * and serves `provideFileDecoration` synchronously from it.
   *
   * @returns the root subtree estimate for the status bar headline.
   */
  private aggregateDirectoryEstimates(
    workspaceFolder: vscode.WorkspaceFolder,
    files: ReadonlyArray<FileContent>,
    model: string
  ): { count: number; approximate: boolean; methodLabel: string } {
    const { method, approximate, perPath } = TokenCounter.countFilesPerPath(files, model);
    const methodLabel = TokenCounter.getMethodLabel(method);

    // Relative directory path ("" = workspace root) -> summed token count.
    const dirTotals = new Map<string, number>();
    for (const { path: relativePath, tokens } of perPath) {
      const segments = relativePath.split("/");
      segments.pop(); // drop the filename; keep ancestor directories
      let prefix = "";
      dirTotals.set("", (dirTotals.get("") ?? 0) + tokens);
      for (const segment of segments) {
        prefix = prefix ? `${prefix}/${segment}` : segment;
        dirTotals.set(prefix, (dirTotals.get(prefix) ?? 0) + tokens);
      }
    }

    const rootKey = workspaceFolder.uri.fsPath.toLowerCase();
    this.clearCacheUnderRoot(rootKey);
    for (const [relativeDir, count] of dirTotals) {
      const dirUri = relativeDir
        ? vscode.Uri.joinPath(workspaceFolder.uri, ...relativeDir.split("/"))
        : workspaceFolder.uri;
      this.cache.set(dirUri.fsPath.toLowerCase(), { count, approximate, methodLabel });
    }

    return { count: dirTotals.get("") ?? 0, approximate, methodLabel };
  }

  private countWorkspaceRootOnly(
    workspaceFolder: vscode.WorkspaceFolder,
    files: ReadonlyArray<FileContent>,
    model: string
  ): { count: number; approximate: boolean; methodLabel: string } {
    const tokenInfo = TokenCounter.countFilesContent(files, model);
    const methodLabel = TokenCounter.getMethodLabel(tokenInfo.method);
    const rootKey = workspaceFolder.uri.fsPath.toLowerCase();
    this.clearCacheUnderRoot(rootKey);
    this.cache.set(rootKey, {
      count: tokenInfo.inputTokens,
      approximate: tokenInfo.approximate,
      methodLabel
    });
    return {
      count: tokenInfo.inputTokens,
      approximate: tokenInfo.approximate,
      methodLabel
    };
  }

  /** Drop cached estimates for a root and its descendants before repopulating from a fresh walk. */
  private clearCacheUnderRoot(rootKey: string): void {
    const prefix = rootKey.endsWith(path.sep) ? rootKey : `${rootKey}${path.sep}`;
    for (const key of [...this.cache.keys()]) {
      if (key === rootKey || key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  private provideDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
    if (!this.enabled || !this.explorerBadgesEnabled || settingsNavigationInProgress) {
      return undefined;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
      return undefined;
    }

    const cached = this.cache.get(uri.fsPath.toLowerCase());
    if (cached !== undefined) {
      const badge = formatTokenBadge(cached.count);
      return badge ? { badge } : undefined;
    }

    // Once the root's whole subtree has been aggregated, an uncached folder has no included
    // files — show no badge instead of launching a redundant per-folder scan. New/changed
    // files re-trigger a full aggregation via the workspace file-event listeners.
    if (this.fullyScannedRoots.has(workspaceFolder.uri.fsPath.toLowerCase())) {
      return undefined;
    }

    // Fallback only during the initial deferred-scan window (before the first full
    // aggregation): estimate this folder on demand, then refresh its badge.
    void (async () => {
      try {
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.type & vscode.FileType.Directory) {
          debugLog("token-estimate: decoration fallback scan", {
            resource: workspaceFolder.uri,
            details: { uri: uri.fsPath }
          });
          await this.estimateAndCache(uri, workspaceFolder, this.enabled);
        }
      } catch {
        // Ignore decoration errors for inaccessible paths.
      }
    })();

    return undefined;
  }

  /** Status bar reflects the workspace root estimate, not per-folder decoration scans. */
  private isWorkspaceRoot(uri: vscode.Uri, workspaceFolder: vscode.WorkspaceFolder): boolean {
    return uri.toString() === workspaceFolder.uri.toString()
      || uri.fsPath.toLowerCase() === workspaceFolder.uri.fsPath.toLowerCase();
  }

  private scheduleRefresh(): void {
    if (settingsNavigationInProgress) {
      debugLog("token-estimate: refresh skipped during settings navigation", {
        resource: vscode.workspace.workspaceFolders?.[0]?.uri
      });
      return;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      debugLog("token-estimate: refresh debounce fired", {
        resource: vscode.workspace.workspaceFolders?.[0]?.uri
      });
      void this.refreshWorkspaceEstimates();
    }, 750);
  }

  private async refreshWorkspaceEstimates(): Promise<void> {
    const generation = ++this.refreshGeneration;
    const started = Date.now();
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      this.enabled = false;
      debugLog("token-estimate: refresh skipped", { details: { reason: "no workspace folder", generation } });
      if (generation === this.refreshGeneration) {
        await this.publishEstimate(0, false, true);
      }
      return;
    }

    const config = getConfiguration(workspaceFolder.uri);
    this.enabled = config.enableTokenCounting;
    this.explorerBadgesEnabled = this.enabled && config.showExplorerTokenBadges;
    debugLog("token-estimate: refresh start", {
      resource: workspaceFolder.uri,
      details: { generation, enabled: this.enabled, explorerBadgesEnabled: this.explorerBadgesEnabled, model: config.llmModel, config }
    });
    await vscode.commands.executeCommand("setContext", "export2ai.enableTokenCounting", this.enabled);

    if (!this.enabled) {
      this.statusBarItem?.hide();
      this.fullyScannedRoots.delete(workspaceFolder.uri.fsPath.toLowerCase());
      this.decorationEmitter.fire(undefined);
      if (generation === this.refreshGeneration) {
        await this.publishEstimate(0, false, true);
      }
      debugLog("token-estimate: refresh disabled token counting", {
        resource: workspaceFolder.uri,
        details: { generation, elapsedMs: Date.now() - started }
      });
      return;
    }

    try {
      // One fresh walk feeds every folder's badge — no stale cache short-circuit, no
      // per-folder rescans. Clearing pending lets the aggregated values win over any
      // in-flight fallback scans started during the initial window.
      const files = await this.collectFilesUnder(workspaceFolder.uri, workspaceFolder, config);
      if (generation !== this.refreshGeneration) {
        debugLog("token-estimate: stale refresh dropped", {
          resource: workspaceFolder.uri,
          details: { generation, activeGeneration: this.refreshGeneration }
        });
        return;
      }

      this.pending.clear();
      const root = this.explorerBadgesEnabled
        ? this.aggregateDirectoryEstimates(workspaceFolder, files, config.llmModel)
        : this.countWorkspaceRootOnly(workspaceFolder, files, config.llmModel);
      if (this.explorerBadgesEnabled) {
        this.fullyScannedRoots.add(workspaceFolder.uri.fsPath.toLowerCase());
      } else {
        this.fullyScannedRoots.delete(workspaceFolder.uri.fsPath.toLowerCase());
      }

      this.updateStatusBar(root.count, root.approximate, root.methodLabel);
      // Refresh every visible folder badge in one event. When Explorer badges are off,
      // this clears stale decorations left by earlier builds or previous setting states.
      this.decorationEmitter.fire(undefined);
      debugLog("token-estimate: refresh finished", {
        resource: workspaceFolder.uri,
        details: {
          generation,
          files: files.length,
          rootCount: root.count,
          approximate: root.approximate,
          method: root.methodLabel,
          explorerBadgesEnabled: this.explorerBadgesEnabled,
          cachedFolders: this.cache.size,
          elapsedMs: Date.now() - started
        }
      });
    } catch (error) {
      debugError("token-estimate: refresh failed", error, {
        resource: workspaceFolder.uri,
        details: { generation, elapsedMs: Date.now() - started }
      });
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
    debugLog("token-estimate: manager disposed", {
      resource: vscode.workspace.workspaceFolders?.[0]?.uri,
      details: { cacheEntries: this.cache.size, pending: this.pending.size }
    });
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
