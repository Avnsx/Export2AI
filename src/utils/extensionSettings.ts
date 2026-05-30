import * as vscode from "vscode";
import { buildExtensionSettingsQuery, resolveExtensionId } from "./extensionId";

export { buildExtensionSettingsQuery, resolveExtensionId } from "./extensionId";

export const OUTPUT_CHANNEL_NAME = "Export2AI";

/** While true, token rescans defer so settings navigation is not competing with file scans. */
export let settingsNavigationInProgress = false;

/** Keep scans paused briefly after settings opens so the workbench can render without contention. */
export const SETTINGS_NAV_COOLDOWN_MS = 5000;

const settingsNavigationFinishedCallbacks = new Set<() => void>();

/** Subscribe to run work (e.g. deferred token rescans) after settings navigation completes. */
export function onSettingsNavigationFinished(callback: () => void): vscode.Disposable {
  settingsNavigationFinishedCallbacks.add(callback);
  return new vscode.Disposable(() => {
    settingsNavigationFinishedCallbacks.delete(callback);
  });
}

function notifySettingsNavigationFinished(): void {
  for (const callback of settingsNavigationFinishedCallbacks) {
    try {
      callback();
    } catch (error) {
      console.error("Export2AI: settings navigation listener failed", error);
    }
  }
}

function nowMs(): number {
  return Date.now();
}

function logLine(
  output: vscode.OutputChannel | undefined,
  message: string,
  force = false,
  debug = false
): void {
  if (force || debug) {
    console.log(`Export2AI: ${message}`);
  }
  if (!output || (!force && !debug)) {
    return;
  }
  output.appendLine(`[${new Date().toISOString()}] ${message}`);
}

function logDiagnostic(
  output: vscode.OutputChannel | undefined,
  message: string,
  debug: boolean
): void {
  logLine(output, message, false, debug);
}

function countContributedCommands(context: vscode.ExtensionContext): number {
  const commands = context.extension.packageJSON?.contributes?.commands;
  return Array.isArray(commands) ? commands.length : 0;
}

async function raceCommand(
  commandId: string,
  args: unknown[] | undefined,
  timeoutMs: number
): Promise<{ ok: true; elapsedMs: number } | { ok: false; elapsedMs: number; error: string }> {
  const started = nowMs();
  try {
    await Promise.race([
      vscode.commands.executeCommand(commandId, ...(args ?? [])),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
    return { ok: true, elapsedMs: nowMs() - started };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, elapsedMs: nowMs() - started, error: message };
  }
}

/**
 * Opens this extension's settings via the `@ext:publisher.name` route (fast, no global search).
 * Falls back to extension details / extensions view without blocking the UI.
 */
export async function openOwnExtensionSettings(
  context: vscode.ExtensionContext,
  outputChannel?: vscode.OutputChannel
): Promise<void> {
  const configTarget = vscode.workspace.workspaceFolders?.[0]?.uri;
  const debug = vscode.workspace.getConfiguration("export2ai", configTarget).get<boolean>("debug", false);
  const started = nowMs();

  if (debug && outputChannel) {
    outputChannel.show(true);
  }

  let extensionId: string;
  try {
    extensionId = resolveExtensionId(context);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel?.appendLine(message);
    await vscode.window.showErrorMessage(`Export2AI: ${message}`);
    return;
  }

  const pkg = context.extension.packageJSON as { publisher?: string; name?: string };
  const settingsQuery = buildExtensionSettingsQuery(extensionId);
  const commandCount = countContributedCommands(context);

  logLine(outputChannel, `settings navigation start (debug=${debug})`, true, debug);
  logDiagnostic(outputChannel, `context.extension.id = ${context.extension.id}`, debug);
  logDiagnostic(outputChannel, `packageJSON.publisher = ${pkg.publisher ?? "(missing)"}`, debug);
  logDiagnostic(outputChannel, `packageJSON.name = ${pkg.name ?? "(missing)"}`, debug);
  logDiagnostic(outputChannel, `resolved extensionId = ${extensionId}`, debug);
  logDiagnostic(outputChannel, `settings query = ${settingsQuery}`, debug);
  logDiagnostic(outputChannel, `contributed commands in manifest = ${commandCount}`, debug);
  logDiagnostic(
    outputChannel,
    commandCount > 500
      ? "warning: large command manifest may slow Cursor/VS Code settings UI"
      : "manifest command count looks normal for settings navigation",
    debug
  );

  settingsNavigationInProgress = true;
  try {
    // Yield so the status-bar click handler returns before the workbench opens Settings.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    logDiagnostic(outputChannel, "navigation: workbench.action.openSettings (@ext)", debug);
    const openSettings = await raceCommand(
      "workbench.action.openSettings",
      [settingsQuery],
      15000
    );

    if (openSettings.ok) {
      logLine(
        outputChannel,
        `navigation success: openSettings @ext in ${openSettings.elapsedMs}ms (total ${nowMs() - started}ms)`,
        true,
        debug
      );
      return;
    }

    outputChannel?.appendLine(`openSettings @ext failed after ${openSettings.elapsedMs}ms: ${openSettings.error}`);
    logDiagnostic(outputChannel, `navigation: openSettings failed — ${openSettings.error}`, debug);

    logDiagnostic(outputChannel, "navigation: extension.open (fallback)", debug);
    const openExtension = await raceCommand("extension.open", [extensionId], 10000);
    if (openExtension.ok) {
      logLine(
        outputChannel,
        `navigation success: extension.open in ${openExtension.elapsedMs}ms (total ${nowMs() - started}ms)`,
        true,
        debug
      );
      return;
    }

    outputChannel?.appendLine(`extension.open failed after ${openExtension.elapsedMs}ms: ${openExtension.error}`);
    logDiagnostic(outputChannel, `navigation: extension.open failed — ${openExtension.error}`, debug);

    logDiagnostic(outputChannel, "navigation: vscode.env.openExternal vscode:extension/…", debug);
    try {
      const uri = vscode.Uri.parse(`vscode:extension/${extensionId}`);
      const opened = await vscode.env.openExternal(uri);
      if (opened) {
        logLine(outputChannel, `navigation success: openExternal (total ${nowMs() - started}ms)`, true, debug);
        return;
      }
      outputChannel?.appendLine("vscode.env.openExternal returned false.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      outputChannel?.appendLine(`openExternal failed: ${message}`);
      logDiagnostic(outputChannel, `navigation: openExternal failed — ${message}`, debug);
    }

    const copyId = "Copy Extension ID";
    const openExtensions = "Open Extensions View";
    const choice = await vscode.window.showWarningMessage(
      `Export2AI could not open settings directly. Extension ID: ${extensionId}`,
      copyId,
      openExtensions
    );

    if (choice === copyId) {
      await vscode.env.clipboard.writeText(extensionId);
      vscode.window.showInformationMessage(`Export2AI: copied extension ID ${extensionId}`);
      return;
    }

    if (choice === openExtensions) {
      await raceCommand("workbench.view.extensions", undefined, 5000);
      await raceCommand("workbench.extensions.action.showExtensionsWithIds", [[extensionId]], 5000);
    }
  } finally {
    setTimeout(() => {
      settingsNavigationInProgress = false;
      notifySettingsNavigationFinished();
      logLine(
        outputChannel,
        `settings navigation cooldown finished (${SETTINGS_NAV_COOLDOWN_MS}ms, total ${nowMs() - started}ms)`,
        true,
        debug
      );
    }, SETTINGS_NAV_COOLDOWN_MS);
    logLine(
      outputChannel,
      `settings navigation finished — deferring token scans ${SETTINGS_NAV_COOLDOWN_MS}ms (total ${nowMs() - started}ms)`,
      true,
      debug
    );
  }
}
