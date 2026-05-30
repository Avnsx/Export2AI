import * as vscode from "vscode";

/**
 * Reveal a local file in the OS file manager with the file selected.
 * Windows: Explorer, macOS: Finder, Linux: default file manager (Nautilus, Dolphin, etc.).
 */
export async function revealInSystemExplorer(filePath: string): Promise<void> {
  const uri = vscode.Uri.file(filePath);

  if (uri.scheme !== "file") {
    throw new Error("Only local files can be revealed in the system file manager.");
  }

  if (vscode.env.remoteName === "wsl") {
    await vscode.commands.executeCommand("remote-wsl.revealInExplorer", uri);
    return;
  }

  await vscode.commands.executeCommand("revealFileInOS", uri);
}
