export interface ExtensionIdentityContext {
  extension?: {
    id?: string;
    packageJSON?: {
      publisher?: string;
      name?: string;
    };
  };
}

/** VS Code / Cursor settings filter for one extension's contributed settings. */
export function buildExtensionSettingsQuery(extensionId: string): string {
  return `@ext:${extensionId}`;
}

/**
 * Resolve the installed extension ID (`publisher.name`) from activation context.
 * Prefers `context.extension.id` (canonical at runtime for VSIX, dev host, and marketplace).
 */
export function resolveExtensionId(context: ExtensionIdentityContext): string {
  const fromRuntime = context.extension?.id?.trim();
  if (fromRuntime) {
    return fromRuntime;
  }

  const pkg = context.extension?.packageJSON;
  const publisher = pkg?.publisher?.trim();
  const name = pkg?.name?.trim();
  if (publisher && name) {
    return `${publisher}.${name}`;
  }

  throw new Error("Export2AI: could not resolve extension ID from ExtensionContext.");
}
