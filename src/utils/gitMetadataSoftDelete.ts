import * as path from "path";

const GIT_METADATA_FILE_NAMES = new Set([
  ".git-blame-ignore-revs",
  ".gitattributes",
  ".gitignore",
  ".gitkeep",
  ".gitmodules",
  ".mailmap"
]);

const PROJECT_CONTEXT_FILE_NAMES = new Set([
  "agents.md",
  "readme.md",
  "pyproject.toml"
]);

const PROJECT_CONTEXT_DIRECTORY_NAMES = new Set([
  "docs",
  "tests",
  "tools"
]);

const PROTECTED_CREDENTIAL_EXTENSIONS = [
  ".pem",
  ".key",
  ".p8",
  ".p12",
  ".pfx",
  ".asc",
  ".gpg"
];

const PROTECTED_CREDENTIAL_FILE_NAMES = new Set([
  ".dockercfg",
  ".env",
  ".envrc",
  ".netrc",
  ".npmrc",
  ".pnpmrc",
  ".pypirc",
  ".yarnrc",
  ".yarnrc.yml",
  "id_dsa",
  "id_ecdsa",
  "id_ed25519",
  "id_rsa",
  "_netrc"
]);

const PROTECTED_CREDENTIAL_SEGMENT_PATTERNS = [
  /private.*key/,
  /private-key/,
  /secret.*key/,
  /signing.*key/,
  /ed25519.*key/,
  /rsa.*key/,
  /token/,
  /credential/,
  /credentials/,
  /secrets/
];

const KEYWORD_EXEMPT_SOURCE_EXTENSIONS = new Set([
  ".bat",
  ".c",
  ".cc",
  ".cjs",
  ".cmd",
  ".cpp",
  ".cs",
  ".cxx",
  ".go",
  ".h",
  ".hpp",
  ".ini",
  ".java",
  ".js",
  ".jsx",
  ".kt",
  ".kts",
  ".lua",
  ".mjs",
  ".php",
  ".pl",
  ".pm",
  ".ps1",
  ".py",
  ".rb",
  ".rs",
  ".sh",
  ".swift",
  ".ts",
  ".tsx",
  ".zsh"
]);

const GITHUB_WORKFLOW_EXTENSIONS = new Set([
  ".yaml",
  ".yml"
]);

export const GIT_DIRECTORY_PLACEHOLDER_FILE = "EXPORT2AI_SOFT_DELETE_PLACEHOLDER.txt";
export const EXTERNAL_GIT_METADATA_PLACEHOLDER_PATH = `_EXPORT2AI_PLACEHOLDERS/git/${GIT_DIRECTORY_PLACEHOLDER_FILE}`;
export const REPOSITORY_CONTROL_READ_ERROR_FILE = "EXPORT2AI_READ_ERROR.txt";

export interface GitMetadataSoftDeleteAction {
  originalPath: string;
  placeholder: boolean;
}

export function normalizeGitMetadataPath(relativePath: string | undefined): string {
  return (relativePath ?? "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function splitPath(relativePath: string | undefined): string[] {
  const normalized = normalizeGitMetadataPath(relativePath);
  return normalized ? normalized.split("/") : [];
}

export function isGitMetadataPath(relativePath: string | undefined): boolean {
  return isSensitiveGitMetadataPath(relativePath) || isRepositoryControlPath(relativePath);
}

export function isSensitiveGitMetadataPath(relativePath: string | undefined): boolean {
  const segments = splitPath(relativePath);
  if (segments.length === 0) {
    return false;
  }

  return segments.some(segment => segment === ".git");
}

export function isRepositoryControlPath(relativePath: string | undefined): boolean {
  const segments = splitPath(relativePath);
  if (segments.length === 0) {
    return false;
  }

  return segments.some(segment => {
    const lower = segment.toLowerCase();
    return segment === ".github"
      || GIT_METADATA_FILE_NAMES.has(segment)
      || PROJECT_CONTEXT_FILE_NAMES.has(lower)
      || PROJECT_CONTEXT_DIRECTORY_NAMES.has(lower);
  });
}

export function isProtectedCredentialPath(relativePath: string | undefined): boolean {
  const segments = splitPath(relativePath).map(segment => segment.toLowerCase());
  if (segments.length === 0) {
    return false;
  }

  return segments.some((segment, index) => {
    if (segment === "config.json" && index > 0 && segments[index - 1] === ".docker") {
      return true;
    }

    if (PROTECTED_CREDENTIAL_FILE_NAMES.has(segment) || segment.startsWith(".env.")) {
      return true;
    }

    if (segment.startsWith("out") && segment.endsWith(".json")) {
      return true;
    }

    if (PROTECTED_CREDENTIAL_EXTENSIONS.some(ext => segment.endsWith(ext))) {
      return true;
    }

    if (!PROTECTED_CREDENTIAL_SEGMENT_PATTERNS.some(pattern => pattern.test(segment))) {
      return false;
    }

    const extension = path.posix.extname(segment);
    if (KEYWORD_EXEMPT_SOURCE_EXTENSIONS.has(extension)) {
      return false;
    }

    if (GITHUB_WORKFLOW_EXTENSIONS.has(extension)
      && index >= 2
      && segments[index - 2] === ".github"
      && segments[index - 1] === "workflows") {
      return false;
    }

    return true;
  });
}

function resolveGitMetadataPath(relativePath: string | undefined): string | undefined {
  const normalized = normalizeGitMetadataPath(relativePath);
  return isGitMetadataPath(normalized) ? normalized : undefined;
}

export function resolveGitMetadataSoftDeleteAction(
  archiveRelativePath: string | undefined,
  workspaceRelativePath?: string
): GitMetadataSoftDeleteAction | undefined {
  const originalPath = resolveGitMetadataPath(workspaceRelativePath)
    ?? resolveGitMetadataPath(archiveRelativePath);

  if (!originalPath) {
    return undefined;
  }

  return {
    originalPath,
    placeholder: isSensitiveGitMetadataPath(originalPath)
  };
}

export function isGitDirectoryPath(relativePath: string | undefined): boolean {
  return isSensitiveGitMetadataPath(relativePath);
}

export function buildGitDirectoryPlaceholderPath(directoryRelativePath: string | undefined): string {
  const normalized = normalizeGitMetadataPath(directoryRelativePath);
  return normalized
    ? `${normalized}/${GIT_DIRECTORY_PLACEHOLDER_FILE}`
    : GIT_DIRECTORY_PLACEHOLDER_FILE;
}

export function buildGitMetadataPlaceholderPath(
  archiveRelativePath: string | undefined,
  realGitPathPlaceholder: boolean,
  isDirectory: boolean
): string {
  if (!realGitPathPlaceholder) {
    return EXTERNAL_GIT_METADATA_PLACEHOLDER_PATH;
  }

  if (isDirectory) {
    return buildGitDirectoryPlaceholderPath(archiveRelativePath);
  }

  return normalizeGitMetadataPath(archiveRelativePath) || GIT_DIRECTORY_PLACEHOLDER_FILE;
}

function buildPlainPlaceholderLines(archivePath: string, originalPath: string): string[] {
  return [
    "Export2AI Soft-Delete Placeholder",
    `Archive path: ${archivePath}`,
    `Original repository path: ${originalPath}`,
    "This content was generated by Export2AI. The real local .git metadata was intentionally not exported.",
    "Reason: preserve repository validation compatibility without exporting remotes, refs, branches, local history, hooks, object database, or credentials.",
    "Instruction to AI: treat this file as an artificial placeholder only; do not use it as project code, CI configuration, dependency evidence, credential evidence, or repository truth."
  ];
}

function prefixLines(prefix: string, archivePath: string, originalPath: string): string {
  return `${buildPlainPlaceholderLines(archivePath, originalPath)
    .map(line => `${prefix} ${line}`)
    .join("\n")}\n`;
}

function jsonPlaceholder(archivePath: string, originalPath: string): string {
  return `${JSON.stringify({
    export2aiSoftDeletePlaceholder: true,
    archivePath,
    originalRepositoryPath: originalPath,
    generatedBy: "Export2AI",
    message: "The real local .git metadata was intentionally not exported.",
    notExported: ["remotes", "refs", "branches", "local history", "hooks", "object database", "credentials"],
    instructionToAI: "Artificial placeholder only. Do not use as project code, CI configuration, dependency evidence, credential evidence, or repository truth."
  }, null, 2)}\n`;
}

export function createGitMetadataSoftDeletePlaceholder(
  archiveRelativePath: string,
  originalRelativePath?: string
): string {
  const archivePath = normalizeGitMetadataPath(archiveRelativePath) || archiveRelativePath;
  const originalPath = normalizeGitMetadataPath(originalRelativePath) || archivePath;
  const basename = path.posix.basename(archivePath).toLowerCase();
  const ext = path.posix.extname(archivePath).toLowerCase();

  if (ext === ".json") {
    return jsonPlaceholder(archivePath, originalPath);
  }

  if ([".yml", ".yaml", ".toml", ".ini", ".cfg", ".conf"].includes(ext) ||
      basename === ".gitignore" ||
      basename === ".gitattributes" ||
      basename === ".gitmodules" ||
      basename === ".gitkeep" ||
      basename === ".mailmap" ||
      basename === ".git-blame-ignore-revs" ||
      basename === "codeowners") {
    return prefixLines("#", archivePath, originalPath);
  }

  if ([".xml", ".html", ".htm", ".svg"].includes(ext)) {
    return `<!--\n${buildPlainPlaceholderLines(archivePath, originalPath).join("\n")}\n-->\n`;
  }

  if ([".bat", ".cmd"].includes(ext)) {
    return prefixLines("REM", archivePath, originalPath);
  }

  if ([".ps1", ".psm1", ".psd1", ".sh", ".bash", ".zsh", ".py"].includes(ext)) {
    return prefixLines("#", archivePath, originalPath);
  }

  return `${buildPlainPlaceholderLines(archivePath, originalPath).join("\n")}\n`;
}

export function buildRepositoryControlReadErrorPath(directoryRelativePath: string | undefined): string {
  const normalized = normalizeGitMetadataPath(directoryRelativePath);
  return normalized
    ? `${normalized}/${REPOSITORY_CONTROL_READ_ERROR_FILE}`
    : REPOSITORY_CONTROL_READ_ERROR_FILE;
}

export function createRepositoryControlReadErrorPlaceholder(
  archiveRelativePath: string,
  originalRelativePath: string | undefined,
  reason: string
): string {
  const archivePath = normalizeGitMetadataPath(archiveRelativePath) || archiveRelativePath;
  const originalPath = normalizeGitMetadataPath(originalRelativePath) || archivePath;
  return [
    "Export2AI Repository-Control Read Error",
    `Archive path: ${archivePath}`,
    `Original repository path: ${originalPath}`,
    `Reason: ${reason}`,
    "This repository-control path was expected to be available in the export, but Export2AI could not read it from the local filesystem.",
    "Instruction to AI: treat this as an export/read problem for this path, not as evidence that the repository intentionally lacks this file or directory."
  ].join("\n") + "\n";
}
