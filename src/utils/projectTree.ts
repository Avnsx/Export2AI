import * as vscode from "vscode";
import ignore from "ignore";
import { IgnoreUtils } from "./ignoreUtils";
import { UriUtils } from "./uriUtils";

type IgnoreInstance = ReturnType<typeof ignore>;

export class ProjectTreeGenerator {
  public static async generateProjectTree(
    dir: vscode.Uri,
    ig: IgnoreInstance,
    maxDepth: number,
    currentDepth: number = 0,
    prefix: string = "",
    isExcludedByResourcePath: (resourceUri: vscode.Uri) => boolean,
    cancellationToken: vscode.CancellationToken,
    rootUri?: vscode.Uri
  ): Promise<string> {
    if (cancellationToken.isCancellationRequested) {
      throw new vscode.CancellationError();
    }

    if (currentDepth > maxDepth) {
      return "";
    }

    if (!rootUri) {
      rootUri = dir;
    }

    try {
      if (currentDepth > 0) {
        const relativePath = UriUtils.relativePath(rootUri, dir);
        if (IgnoreUtils.isIgnored(ig, relativePath, true)) {
          return "";
        }
        if (isExcludedByResourcePath(dir)) {
          return "";
        }
      }

      const entries = await vscode.workspace.fs.readDirectory(dir);
      const visibleEntries: Array<{ name: string; isDirectory: boolean; uri: vscode.Uri }> = [];

      for (const [name, fileType] of entries) {
        if (cancellationToken.isCancellationRequested) {
          throw new vscode.CancellationError();
        }

        const fileUri = vscode.Uri.joinPath(dir, name);
        const isDirectory = Boolean(fileType & vscode.FileType.Directory);
        const rootRelative = UriUtils.relativePath(rootUri, fileUri);

        let isIgnored = false;
        let isExcludedByPath = false;

        try {
          isIgnored = IgnoreUtils.isIgnored(ig, rootRelative, isDirectory);
        } catch (error) {
          console.error(`Export2AI: ignore check failed for ${rootRelative}`, error);
        }

        try {
          isExcludedByPath = isExcludedByResourcePath(fileUri);
        } catch (error) {
          console.error(`Export2AI: path exclusion failed for ${fileUri.toString()}`, error);
        }

        if (!isIgnored && !isExcludedByPath) {
          visibleEntries.push({ name, isDirectory, uri: fileUri });
        }
      }

      if (visibleEntries.length === 0) {
        return "";
      }

      const sortedEntries = this.sortEntries(visibleEntries);
      let result = "";

      for (let i = 0; i < sortedEntries.length; i++) {
        if (cancellationToken.isCancellationRequested) {
          throw new vscode.CancellationError();
        }

        const { name, isDirectory, uri } = sortedEntries[i];
        const isLast = i === sortedEntries.length - 1;
        const connector = isLast ? "└── " : "├── ";
        const newPrefix = isLast ? "    " : "│   ";

        result += `${prefix}${connector}${name}\n`;

        if (isDirectory) {
          const subTree = await this.generateProjectTree(
            uri,
            ig,
            maxDepth,
            currentDepth + 1,
            prefix + newPrefix,
            isExcludedByResourcePath,
            cancellationToken,
            rootUri
          );
          result += subTree;
        }
      }

      return result;
    } catch (error) {
      if (error instanceof vscode.CancellationError) {
        throw error;
      }
      console.error(`Export2AI: error reading directory ${dir.toString()}`, error);
      return "";
    }
  }

  private static sortEntries<T extends { name: string; isDirectory: boolean }>(entries: T[]): T[] {
    return entries.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) {
        return -1;
      }
      if (!a.isDirectory && b.isDirectory) {
        return 1;
      }
      return a.name.localeCompare(b.name);
    });
  }
}
