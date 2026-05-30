import * as path from "path";
import * as vscode from "vscode";
import ignore from "ignore";

type IgnoreInstance = ReturnType<typeof ignore>;
import { UriUtils } from "./uriUtils";

export class IgnoreUtils {
  public static createIgnoreInstance(
    patterns: string[] = [],
    ignoreDotFiles: boolean = true,
    ignoreDollarFiles: boolean = true
  ): IgnoreInstance {
    const ig = ignore().add(patterns);

    if (ignoreDotFiles) {
      ig.add(".*");
    }

    if (ignoreDollarFiles) {
      ig.add(["$*", "**/$*"]);
    }

    return ig;
  }

  public static isIgnored(ig: IgnoreInstance, relativePath: string, isDirectory: boolean): boolean {
    if (!relativePath) {
      return false;
    }
    const posix = relativePath.split(path.sep).join("/");
    return ig.ignores(isDirectory ? `${posix}/` : posix);
  }

  public static async addGitIgnoreRules(rootUri: vscode.Uri, ig: IgnoreInstance): Promise<void> {
    try {
      const gitIgnoreUri = vscode.Uri.joinPath(rootUri, ".gitignore");
      const gitIgnoreContent = await vscode.workspace.fs.readFile(gitIgnoreUri);
      ig.add(Buffer.from(gitIgnoreContent).toString("utf8"));
    } catch {
      // No .gitignore or unreadable — skip.
    }
  }

  public static createResourcePathExclusionFn(
    workspaceUri: vscode.Uri,
    pathsToExclude: ReadonlyArray<string> = []
  ): (resourceUri: vscode.Uri) => boolean {
    if (!pathsToExclude.length) {
      return () => false;
    }

    const relativeExcludePaths: string[] = [];
    const absoluteFileExcludePaths: string[] = [];

    for (const excludePath of pathsToExclude) {
      const normalizedInput = excludePath.replace(/\\/g, "/").replace(/\/+$/, "");

      if (path.isAbsolute(excludePath) && workspaceUri.scheme === "file") {
        absoluteFileExcludePaths.push(path.normalize(excludePath));
        continue;
      }

      relativeExcludePaths.push(
        normalizedInput.replace(/^\.\//, "").replace(/^\/+/, "")
      );
    }

    return (resourceUri: vscode.Uri): boolean => {
      if (workspaceUri.scheme === "file" && resourceUri.scheme === "file") {
        const normalizedFilePath = path.normalize(resourceUri.fsPath);
        if (absoluteFileExcludePaths.some(excludePath =>
          normalizedFilePath === excludePath ||
          normalizedFilePath.startsWith(excludePath + path.sep)
        )) {
          return true;
        }
      }

      let relativePath: string;
      try {
        relativePath = UriUtils.relativePath(workspaceUri, resourceUri);
      } catch {
        return false;
      }

      return relativeExcludePaths.some(excludePath =>
        relativePath === excludePath ||
        relativePath.startsWith(`${excludePath}/`)
      );
    };
  }
}
