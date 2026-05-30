import * as vscode from "vscode";
import { debugError, debugLog, isDebugLoggingEnabled } from "./debugLogger";
import { buildExtensionSettingsQuery, resolveExtensionId } from "./extensionId";

export { buildExtensionSettingsQuery, resolveExtensionId } from "./extensionId";
export { OUTPUT_CHANNEL_NAME } from "./debugLogger";

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
      debugError("settings: navigation listener failed", error);
    }
  }
}

function nowMs(): number {
  return Date.now();
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
export async function openOwnExtensionSettings(context: vscode.ExtensionContext): Promise<void> {
  const configTarget = vscode.workspace.workspaceFolders?.[0]?.uri;
  const started = nowMs();

  let extensionId: string;
  try {
    extensionId = resolveExtensionId(context);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debugError("settings: extension id resolution failed", error, { resource: configTarget, show: true });
    await vscode.window.showErrorMessage(`Export2AI: ${message}`);
    return;
  }

  const pkg = context.extension.packageJSON as { publisher?: string; name?: string };
  const settingsQuery = buildExtensionSettingsQuery(extensionId);
  const commandCount = countContributedCommands(context);
  const debug = isDebugLoggingEnabled(configTarget);

  debugLog("settings: navigation start", {
    resource: configTarget,
    show: true,
    details: {
      debug,
      contextExtensionId: context.extension.id,
      packagePublisher: pkg.publisher ?? "(missing)",
      packageName: pkg.name ?? "(missing)",
      resolvedExtensionId: extensionId,
      settingsQuery,
      contributedCommands: commandCount,
      manifestStatus: commandCount > 500
        ? "warning: large command manifest may slow Cursor/VS Code settings UI"
        : "normal"
    }
  });

  settingsNavigationInProgress = true;
  try {
    // Yield so the status-bar click handler returns before the workbench opens Settings.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    debugLog("settings: navigation command", {
      resource: configTarget,
      details: { command: "workbench.action.openSettings", args: settingsQuery }
    });
    const openSettings = await raceCommand(
      "workbench.action.openSettings",
      [settingsQuery],
      15000
    );

    if (openSettings.ok) {
      debugLog("settings: navigation success", {
        resource: configTarget,
        details: {
          method: "workbench.action.openSettings",
          elapsedMs: openSettings.elapsedMs,
          totalMs: nowMs() - started
        }
      });
      return;
    }

    debugLog("settings: navigation failed", {
      resource: configTarget,
      details: {
        method: "workbench.action.openSettings",
        elapsedMs: openSettings.elapsedMs,
        error: openSettings.error
      }
    });

    debugLog("settings: navigation fallback", {
      resource: configTarget,
      details: { command: "extension.open", extensionId }
    });
    const openExtension = await raceCommand("extension.open", [extensionId], 10000);
    if (openExtension.ok) {
      debugLog("settings: navigation success", {
        resource: configTarget,
        details: {
          method: "extension.open",
          elapsedMs: openExtension.elapsedMs,
          totalMs: nowMs() - started
        }
      });
      return;
    }

    debugLog("settings: navigation failed", {
      resource: configTarget,
      details: {
        method: "extension.open",
        elapsedMs: openExtension.elapsedMs,
        error: openExtension.error
      }
    });

    debugLog("settings: navigation fallback", {
      resource: configTarget,
      details: { command: "vscode.env.openExternal", uri: `vscode:extension/${extensionId}` }
    });
    try {
      const uri = vscode.Uri.parse(`vscode:extension/${extensionId}`);
      const opened = await vscode.env.openExternal(uri);
      if (opened) {
        debugLog("settings: navigation success", {
          resource: configTarget,
          details: {
            method: "vscode.env.openExternal",
            totalMs: nowMs() - started
          }
        });
        return;
      }
      debugLog("settings: navigation failed", {
        resource: configTarget,
        details: { method: "vscode.env.openExternal", error: "returned false" }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      debugError("settings: openExternal failed", error, {
        resource: configTarget,
        details: { method: "vscode.env.openExternal", message }
      });
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
      debugLog("settings: copied extension id", {
        resource: configTarget,
        details: { extensionId }
      });
      vscode.window.showInformationMessage(`Export2AI: copied extension ID ${extensionId}`);
      return;
    }

    if (choice === openExtensions) {
      debugLog("settings: opening extensions view fallback", {
        resource: configTarget,
        details: { extensionId }
      });
      await raceCommand("workbench.view.extensions", undefined, 5000);
      await raceCommand("workbench.extensions.action.showExtensionsWithIds", [[extensionId]], 5000);
    }
  } finally {
    setTimeout(() => {
      settingsNavigationInProgress = false;
      notifySettingsNavigationFinished();
      debugLog("settings: navigation cooldown finished", {
        resource: configTarget,
        details: {
          cooldownMs: SETTINGS_NAV_COOLDOWN_MS,
          totalMs: nowMs() - started
        }
      });
    }, SETTINGS_NAV_COOLDOWN_MS);
    debugLog("settings: navigation finished; token scans deferred", {
      resource: configTarget,
      details: {
        cooldownMs: SETTINGS_NAV_COOLDOWN_MS,
        totalMs: nowMs() - started
      }
    });
  }
}
