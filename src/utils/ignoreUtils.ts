import * as path from "path";
import * as vscode from "vscode";
import ignore from "ignore";

type IgnoreInstance = ReturnType<typeof ignore>;
import { UriUtils } from "./uriUtils";

function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function normalizeComparePath(value: string): string {
  return process.platform === "win32" ? value.toLowerCase() : value;
}

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
    const posix = toPosixPath(relativePath);
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
      const trimmedInput = excludePath.trim();
      if (!trimmedInput) {
        continue;
      }
      const normalizedInput = toPosixPath(trimmedInput).replace(/\/+$/, "");

      if (path.isAbsolute(trimmedInput) && workspaceUri.scheme === "file") {
        absoluteFileExcludePaths.push(normalizeComparePath(path.normalize(trimmedInput)));
        continue;
      }

      const relativeExcludePath = normalizedInput.replace(/^\.\//, "").replace(/^\/+/, "");
      if (relativeExcludePath) {
        relativeExcludePaths.push(normalizeComparePath(relativeExcludePath));
      }
    }

    if (!relativeExcludePaths.length && !absoluteFileExcludePaths.length) {
      return () => false;
    }

    return (resourceUri: vscode.Uri): boolean => {
      if (workspaceUri.scheme === "file" && resourceUri.scheme === "file") {
        const normalizedFilePath = normalizeComparePath(path.normalize(resourceUri.fsPath));
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

      const comparableRelativePath = normalizeComparePath(relativePath);
      return relativeExcludePaths.some(excludePath =>
        comparableRelativePath === excludePath ||
        comparableRelativePath.startsWith(`${excludePath}/`)
      );
    };
  }
}
