import * as path from "path";
import * as vscode from "vscode";

export class UriUtils {
  public static relativePath(rootUri: vscode.Uri, resourceUri: vscode.Uri): string {
    if (rootUri.scheme === "file" && resourceUri.scheme === "file") {
      const relative = path.relative(rootUri.fsPath, resourceUri.fsPath);
      if (relative === "") {
        return "";
      }
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error(`Resource ${resourceUri.toString()} is outside ${rootUri.toString()}`);
      }
      return relative.replace(/\\/g, "/");
    }

    if (rootUri.scheme !== resourceUri.scheme || rootUri.authority !== resourceUri.authority) {
      throw new Error(`Resource ${resourceUri.toString()} is not in the same file system as ${rootUri.toString()}`);
    }

    const rootPath = this.trimTrailingSlash(rootUri.path);
    const resourcePath = this.trimTrailingSlash(resourceUri.path);

    if (resourcePath === rootPath) {
      return "";
    }

    const prefix = rootPath.endsWith("/") ? rootPath : `${rootPath}/`;
    if (!resourcePath.startsWith(prefix)) {
      throw new Error(`Resource ${resourceUri.toString()} is outside ${rootUri.toString()}`);
    }

    return resourcePath.slice(prefix.length);
  }

  public static basename(resourceUri: vscode.Uri): string {
    return path.posix.basename(this.trimTrailingSlash(resourceUri.path));
  }

  private static trimTrailingSlash(value: string): string {
    if (value === "/") {
      return value;
    }
    return value.replace(/\/+$/, "");
  }
}
