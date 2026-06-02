const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");

class CancellationError extends Error {}

const readDirectoryFailures = new Set();
const readFileFailures = new Set();
const symlinkLikePaths = new Set();

function keyFor(fsPath) {
  return path.resolve(fsPath).toLowerCase();
}

class Uri {
  constructor(fsPath) {
    this.fsPath = path.resolve(fsPath);
    this.scheme = "file";
    this.authority = "";
    this.path = `/${this.fsPath.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1:")}`;
  }

  toString() {
    return `file://${this.path}`;
  }

  static file(fsPath) {
    return new Uri(fsPath);
  }

  static joinPath(base, ...segments) {
    return new Uri(path.join(base.fsPath, ...segments));
  }
}

const vscodeMock = {
  CancellationError,
  Uri,
  FileType: {
    File: 1,
    Directory: 2,
    SymbolicLink: 64
  },
  workspace: {
    getConfiguration() {
      return {
        get(_key, fallback) {
          return fallback;
        },
        inspect() {
          return {};
        }
      };
    },
    fs: {
      async readDirectory(uri) {
        if (readDirectoryFailures.has(keyFor(uri.fsPath))) {
          throw new Error(`simulated readDirectory failure for ${uri.fsPath}`);
        }
        const entries = await fs.promises.readdir(uri.fsPath, { withFileTypes: true });
        return entries.map(entry => {
          const childPath = path.join(uri.fsPath, entry.name);
          const baseType = entry.isDirectory() ? vscodeMock.FileType.Directory : vscodeMock.FileType.File;
          const fileType = symlinkLikePaths.has(keyFor(childPath))
            ? baseType | vscodeMock.FileType.SymbolicLink
            : baseType;
          return [entry.name, fileType];
        });
      },
      async stat(uri) {
        const stat = await fs.promises.stat(uri.fsPath);
        return {
          type: stat.isDirectory() ? vscodeMock.FileType.Directory : vscodeMock.FileType.File,
          size: stat.size
        };
      },
      async readFile(uri) {
        if (readFileFailures.has(keyFor(uri.fsPath))) {
          throw new Error(`simulated readFile failure for ${uri.fsPath}`);
        }
        return fs.promises.readFile(uri.fsPath);
      }
    }
  }
};

const originalLoad = Module._load;
const originalConsoleError = console.error;
const capturedErrors = [];
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "vscode") {
    return vscodeMock;
  }
  return originalLoad.call(this, request, parent, isMain);
};
console.error = (...args) => {
  capturedErrors.push(args.map(String).join(" "));
};

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function byPath(files) {
  return new Map(files.map(file => [file.path.replace(/\\/g, "/"), file.content]));
}

function assertNoPathPrefix(paths, prefix, message) {
  assert(!paths.some(key => key === prefix || key.startsWith(`${prefix}/`)), message);
}

function assertIncludedPaths(map, paths, message) {
  const missing = paths.filter(relativePath => !map.has(relativePath));
  assert.strictEqual(missing.length, 0, `${message}: missing ${missing.join(", ")}`);
}

function assertExcludedPaths(map, paths, message) {
  const present = paths.filter(relativePath => map.has(relativePath));
  assert.strictEqual(present.length, 0, `${message}: unexpectedly included ${present.join(", ")}`);
}

function createIgnoreInstance(additionalPatterns = []) {
  const { IgnoreUtils } = require("../out/utils/ignoreUtils");
  const { DEFAULT_EXCLUDE_PATTERNS } = require("../out/config");
  const ig = IgnoreUtils.createIgnoreInstance(
    [...DEFAULT_EXCLUDE_PATTERNS, ...additionalPatterns],
    true,
    true
  );
  ig.add([
    "ignored-by-gitignore.txt",
    "AGENTS.md",
    "README.md",
    "pyproject.toml",
    "docs/",
    "tests/",
    "tools/"
  ]);
  return ig;
}

async function collect(rootUri, sourceUri, options = {}) {
  const { FileProcessor } = require("../out/utils/fileProcessor");
  const { additionalExcludePatterns = [], ...collectOptions } = options;
  return FileProcessor.collectFiles(sourceUri, sourceUri, rootUri, createIgnoreInstance(additionalExcludePatterns), {
    maxFileSize: 1024 * 1024,
    compressCode: false,
    removeComments: false,
    softDeleteGitMetadata: true,
    softDeleteGitMetadataRealGitPathPlaceholder: false,
    isExcludedByResourcePath: () => false,
    zipOutputPath: path.join(rootUri.fsPath, "export.zip"),
    fileConcurrency: 2,
    ...collectOptions
  });
}

(async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "export2ai-soft-delete-"));
  const workspaceUri = Uri.file(tempRoot);

  try {
    writeFile(path.join(tempRoot, "src", "index.ts"), "export const ok = true;\n");
    writeFile(path.join(tempRoot, "src", "tokenEstimate.ts"), "export const tokenEstimate = 1;\n");
    writeFile(path.join(tempRoot, "src", "utils", "tokenCounter.ts"), "export const tokenCounter = 1;\n");
    writeFile(path.join(tempRoot, "src", "TokenCounter.ts"), "export const TokenCounter = 1;\n");
    writeFile(path.join(tempRoot, "src", "credentialParser.ts"), "export const credentialParser = true;\n");
    writeFile(path.join(tempRoot, "src", "secretsScanner.ts"), "export const secretsScanner = true;\n");
    writeFile(path.join(tempRoot, "src", "private-key-helper.ts"), "export const privateKeyHelper = true;\n");
    writeFile(path.join(tempRoot, "src", "rsaKeyParser.ts"), "export const rsaKeyParser = true;\n");
    writeFile(path.join(tempRoot, "src", "nested", "credentialTools.ts"), "export const nestedCredentialTools = true;\n");
    writeFile(path.join(tempRoot, "src", "nested", "TokenCounter.ts"), "export const nestedTokenCounter = true;\n");
    writeFile(path.join(tempRoot, "src", "private.pem"), "PRIVATE KEY\n");
    writeFile(path.join(tempRoot, "src", "link-to-outside.ts"), "SHOULD_NOT_EXPORT_SYMLINK_TARGET\n");
    symlinkLikePaths.add(keyFor(path.join(tempRoot, "src", "link-to-outside.ts")));
    writeFile(path.join(tempRoot, "AGENTS.md"), "agent rules\n");
    writeFile(path.join(tempRoot, "README.md"), "# Project\n");
    writeFile(path.join(tempRoot, "pyproject.toml"), "[project]\nname = \"demo\"\n");
    writeFile(path.join(tempRoot, "docs", "guide.md"), "documentation\n");
    writeFile(path.join(tempRoot, "tests", "test_app.py"), "def test_ok():\n    assert True\n");
    writeFile(path.join(tempRoot, "tests", "test_token_flow.py"), "def test_token_flow():\n    assert True\n");
    writeFile(path.join(tempRoot, "tests", "fixture.key"), "PRIVATE KEY\n");
    writeFile(path.join(tempRoot, "tools", "export_clean_archive.py"), "print('tool')\n");
    writeFile(path.join(tempRoot, "tools", "generate_signing_key.py"), "print('generate test key')\n");
    writeFile(path.join(tempRoot, "_EXPORT2AI_GIT_METADATA_PLACEHOLDER.txt"), "real project file with legacy marker name\n");
    writeFile(path.join(tempRoot, ".env"), "SHOULD_NOT_EXPORT=true\n");
    writeFile(path.join(tempRoot, ".env.local"), "SHOULD_NOT_EXPORT=true\n");
    writeFile(path.join(tempRoot, ".envrc"), "export SHOULD_NOT_EXPORT=true\n");
    writeFile(path.join(tempRoot, ".npmrc"), "//registry.npmjs.org/:_authToken=SHOULD_NOT_EXPORT\n");
    writeFile(path.join(tempRoot, ".yarnrc.yml"), "npmAuthToken: SHOULD_NOT_EXPORT\n");
    writeFile(path.join(tempRoot, ".pnpmrc"), "token=SHOULD_NOT_EXPORT\n");
    writeFile(path.join(tempRoot, ".pypirc"), "password = SHOULD_NOT_EXPORT\n");
    writeFile(path.join(tempRoot, ".netrc"), "machine example.invalid password SHOULD_NOT_EXPORT\n");
    writeFile(path.join(tempRoot, ".dockercfg"), "{\"auths\":{\"example.invalid\":\"SHOULD_NOT_EXPORT\"}}\n");
    writeFile(path.join(tempRoot, ".docker", "config.json"), "{\"auths\":{\"example.invalid\":\"SHOULD_NOT_EXPORT\"}}\n");
    writeFile(path.join(tempRoot, "_netrc"), "machine example.invalid password SHOULD_NOT_EXPORT\n");
    writeFile(path.join(tempRoot, "id_rsa"), "ssh private key\n");
    writeFile(path.join(tempRoot, "id_ed25519"), "ssh private key\n");
    writeFile(path.join(tempRoot, "private.pem"), "PRIVATE KEY\n");
    writeFile(path.join(tempRoot, "signing.key"), "PRIVATE KEY\n");
    writeFile(path.join(tempRoot, "certificate.p12"), "certificate\n");
    writeFile(path.join(tempRoot, "certificate.pfx"), "certificate\n");
    writeFile(path.join(tempRoot, "token-dump.json"), "{\"token\":true}\n");
    writeFile(path.join(tempRoot, "out.json"), "{\"token\":true}\n");
    writeFile(path.join(tempRoot, ".gitignore"), "node_modules\n.env\nignored-by-gitignore.txt\n");
    writeFile(path.join(tempRoot, ".gitattributes"), "*.ts text eol=lf\n");
    writeFile(path.join(tempRoot, ".github", "workflows", "ci.yml"), "name: real ci\nsecrets: ${{ secrets.PAT }}\n");
    writeFile(path.join(tempRoot, ".github", "workflows", "publish-policy.yml"), "name: publish policy\n");
    writeFile(path.join(tempRoot, ".github", "workflows", "token-rotation.yml"), "name: token rotation\non: workflow_dispatch\n");
    writeFile(path.join(tempRoot, ".github", "workflows", "unreadable.yml"), "name: unreadable\n");
    writeFile(path.join(tempRoot, ".github", "dependabot.yml"), "version: 2\nupdates: []\n");
    writeFile(path.join(tempRoot, ".github", "settings.json"), JSON.stringify({ labels: true }));
    writeFile(path.join(tempRoot, ".github", "CODEOWNERS"), "@real/team\n");
    writeFile(path.join(tempRoot, ".github", "inaccessible", "hidden.yml"), "name: hidden\n");
    writeFile(path.join(tempRoot, ".git", "HEAD"), "ref: refs/heads/main\n");
    writeFile(path.join(tempRoot, ".git", "config"), "[remote \"origin\"]\nurl = https://token@example.invalid/repo.git\n");
    writeFile(path.join(tempRoot, ".git", "index"), "index bytes\n");
    writeFile(path.join(tempRoot, ".git", "hooks", "pre-commit"), "echo hook\n");
    writeFile(path.join(tempRoot, ".git", "refs", "heads", "main"), "abc123\n");
    writeFile(path.join(tempRoot, ".git", "objects", "aa", "bbbb"), "real object\n");
    writeFile(path.join(tempRoot, "libs", "submodule", ".git"), "gitdir: ../../.git/modules/submodule\n");
    writeFile(path.join(tempRoot, "ignored-by-gitignore.txt"), "ignored\n");
    writeFile(path.join(tempRoot, "__pycache__", "module.pyc"), "cache\n");
    writeFile(path.join(tempRoot, ".pytest_cache", "CACHEDIR.TAG"), "cache\n");
    writeFile(path.join(tempRoot, ".cache", "tool", "state.json"), "{}\n");
    writeFile(path.join(tempRoot, ".tmp", "scratch.txt"), "tmp\n");
    writeFile(path.join(tempRoot, "site", "index.html"), "<html></html>\n");
    writeFile(path.join(tempRoot, "out-report.json"), "{\"leak\":true}\n");
    writeFile(path.join(tempRoot, "docs", "private-key-notes.md"), "private key text\n");
    writeFile(path.join(tempRoot, "docs", "secret-signing-key.pem"), "PRIVATE KEY\n");
    writeFile(path.join(tempRoot, "tests", "fixture-token.txt"), "token\n");
    writeFile(path.join(tempRoot, "tools", "id_ed25519"), "ssh key\n");
    writeFile(path.join(tempRoot, ".github", "workflows", "signing-key.yml"), "name: should not export\n");
    writeFile(path.join(tempRoot, ".github", "credentials.asc"), "credential\n");
    writeFile(path.join(tempRoot, ".github", "credentials.yml"), "credential: should-not-export\n");
    readFileFailures.add(keyFor(path.join(tempRoot, ".github", "workflows", "unreadable.yml")));
    readDirectoryFailures.add(keyFor(path.join(tempRoot, ".github", "inaccessible")));

    const files = await collect(workspaceUri, workspaceUri);
    const map = byPath(files);

    assert(map.has("src/index.ts"), "normal source file is included");
    assert.strictEqual(map.get("src/index.ts"), "export const ok = true;\n", "normal source content is unchanged");
    assertIncludedPaths(
      map,
      [
        "src/tokenEstimate.ts",
        "src/utils/tokenCounter.ts",
        "src/TokenCounter.ts",
        "src/credentialParser.ts",
        "src/secretsScanner.ts",
        "src/private-key-helper.ts",
        "src/rsaKeyParser.ts",
        "src/nested/credentialTools.ts",
        "src/nested/TokenCounter.ts"
      ],
      "safe TypeScript source files with sensitive-looking path segments must stay included"
    );
    const { isProtectedCredentialPath } = require("../out/utils/gitMetadataSoftDelete");
    assert.strictEqual(
      isProtectedCredentialPath("src\\utils\\tokenCounter.ts"),
      false,
      "Windows-style separators still preserve source-extension keyword exemptions"
    );
    for (const protectedCredentialPath of [
      ".envrc",
      ".npmrc",
      ".yarnrc.yml",
      ".pnpmrc",
      ".pypirc",
      ".netrc",
      ".dockercfg",
      ".docker/config.json",
      "_netrc"
    ]) {
      assert.strictEqual(isProtectedCredentialPath(protectedCredentialPath), true, `${protectedCredentialPath} is classified as local auth material`);
    }
    assert(!map.has(".env"), "non-Git dot files remain hard-excluded");
    assertExcludedPaths(
      map,
      [
        ".env",
        ".env.local",
        ".envrc",
        ".npmrc",
        ".yarnrc.yml",
        ".pnpmrc",
        ".pypirc",
        ".netrc",
        ".dockercfg",
        ".docker/config.json",
        "_netrc",
        "id_rsa",
        "id_ed25519",
        "private.pem",
        "signing.key",
        "certificate.p12",
        "certificate.pfx",
        "src/private.pem",
        "tests/fixture.key",
        "token-dump.json",
        "out.json",
        "out-report.json"
      ],
      "hard-sensitive credential/key/export files must remain excluded"
    );
    assert(!map.has("src/link-to-outside.ts"), "symbolic-link entries are skipped instead of being archived");
    assert(![...map.values()].some(content => content.includes("SHOULD_NOT_EXPORT_SYMLINK_TARGET")), "symbolic-link target content is not exported");
    assert(![...map.values()].some(content => content.includes("SHOULD_NOT_EXPORT")), "local auth file contents are not exported");
    assert(!map.has("ignored-by-gitignore.txt"), ".gitignore rules still exclude non-metadata files");
    assert(!map.has("__pycache__/module.pyc"), "__pycache__ remains hard-excluded");
    assert(!map.has(".pytest_cache/CACHEDIR.TAG"), ".pytest_cache remains hard-excluded");
    assert(!map.has(".cache/tool/state.json"), ".cache remains hard-excluded");
    assert(!map.has(".tmp/scratch.txt"), ".tmp remains hard-excluded");
    assert(!map.has("site/index.html"), "site output remains hard-excluded");
    assert(!map.has("out-report.json"), "out*.json remains hard-excluded");
    assert(!map.has(".env.local"), ".env.* remains hard-excluded");

    const customPatternExcluded = byPath(await collect(workspaceUri, workspaceUri, {
      additionalExcludePatterns: ["**/*token*"]
    }));
    assert(!customPatternExcluded.has("src/tokenEstimate.ts"), "explicit custom excludePatterns still exclude safe source files");
    assert(!customPatternExcluded.has("src/utils/tokenCounter.ts"), "explicit custom excludePatterns apply to nested source files");
    assert(customPatternExcluded.has("src/credentialParser.ts"), "custom token exclude does not affect unrelated safe source files");

    assert(map.has("AGENTS.md"), "AGENTS.md is preserved even when ignored");
    assert(map.get("AGENTS.md").includes("agent rules"), "AGENTS.md real contents are exported");
    assert(map.has("README.md"), "README.md is preserved even when ignored");
    assert(map.has("pyproject.toml"), "pyproject.toml is preserved even when ignored");
    assert(map.has("docs/guide.md"), "docs/ is preserved even when ignored");
    assert(map.has("tests/test_app.py"), "tests/ is preserved even when ignored");
    assert(map.has("tests/test_token_flow.py"), "test source files with token-related names remain available for validation");
    assert(map.has("tools/export_clean_archive.py"), "tools/ is preserved even when ignored");
    assert(map.has("tools/generate_signing_key.py"), "source tools with key-related names remain available for validation");

    assert(!map.has("docs/private-key-notes.md"), "private*key paths are excluded even inside restored docs");
    assert(!map.has("docs/secret-signing-key.pem"), "secret/signing key files are excluded even inside restored docs");
    assert(!map.has("tests/fixture-token.txt"), "token paths are excluded even inside restored tests");
    assert(!map.has("tools/id_ed25519"), "ssh key names are excluded even inside restored tools");
    assert(!map.has(".github/credentials.asc"), "credential archive files are excluded even inside restored .github");
    assert(!map.has(".github/credentials.yml"), "credential config outside workflows is excluded even inside restored .github");

    assert(map.has(".gitignore"), ".gitignore is preserved");
    assert(map.get(".gitignore").includes("node_modules"), ".gitignore original contents are exported");
    assert(!map.get(".gitignore").includes("Export2AI Soft-Delete Placeholder"), ".gitignore is not replaced with a placeholder");

    assert(map.has(".gitattributes"), ".gitattributes is preserved");
    assert(map.get(".gitattributes").includes("*.ts text eol=lf"), ".gitattributes original contents are exported");
    assert(map.has(".github/workflows/ci.yml"), ".github workflow path is preserved");
    assert(map.get(".github/workflows/ci.yml").includes("name: real ci"), ".github workflow contents are exported");
    assert(map.get(".github/workflows/ci.yml").includes("secrets.PAT"), "workflow secret references remain available for CI debugging");
    assert(map.has(".github/workflows/publish-policy.yml"), ".github publish policy workflow path is preserved");
    assert(map.get(".github/workflows/publish-policy.yml").includes("publish policy"), "publish policy workflow contents are exported");
    assert(map.has(".github/workflows/token-rotation.yml"), "workflow files with token-related names remain available for CI debugging");
    assert(map.has(".github/workflows/signing-key.yml"), "workflow files with key-related names remain available for CI debugging");
    assert(map.has(".github/dependabot.yml"), "Dependabot config path is preserved");
    assert(map.get(".github/dependabot.yml").includes("version: 2"), "Dependabot config contents are exported");
    assert(map.has(".github/CODEOWNERS"), "CODEOWNERS path is preserved");
    assert(map.get(".github/CODEOWNERS").includes("@real/team"), "CODEOWNERS content is exported");
    assert(map.has(".github/workflows/unreadable.yml"), "unreadable workflow path is still surfaced");
    assert(
      map.get(".github/workflows/unreadable.yml").includes("Export2AI Repository-Control Read Error"),
      "unreadable workflow gets an explicit read-error placeholder"
    );
    assert(
      map.get(".github/workflows/unreadable.yml").includes("Original repository path: .github/workflows/unreadable.yml"),
      "unreadable workflow read-error placeholder keeps workspace-relative path"
    );
    assert(
      map.has(".github/inaccessible/EXPORT2AI_READ_ERROR.txt"),
      "unreadable repository-control directory gets an explicit read-error marker"
    );

    assert(map.has(".github/settings.json"), "JSON GitHub metadata path is preserved");
    assert.deepStrictEqual(JSON.parse(map.get(".github/settings.json")), { labels: true }, "JSON GitHub metadata content is exported");

    const defaultMarkerPath = "_EXPORT2AI_PLACEHOLDERS/git/EXPORT2AI_SOFT_DELETE_PLACEHOLDER.txt";
    assert.strictEqual(
      map.get("_EXPORT2AI_GIT_METADATA_PLACEHOLDER.txt"),
      "real project file with legacy marker name\n",
      "real project file using the legacy root marker name is preserved"
    );
    assert(map.has(defaultMarkerPath), ".git metadata gets one external marker by default");
    assert(map.get(defaultMarkerPath).includes("The real local .git metadata was intentionally not exported."), "marker states .git metadata was omitted");
    assert(map.get(defaultMarkerPath).includes("remotes, refs, branches, local history, hooks, object database, or credentials"), "marker names omitted Git internals");
    assert(map.get(defaultMarkerPath).includes("do not use it as project code, CI configuration, dependency evidence, credential evidence, or repository truth"), "marker instructs AI not to treat it as repo truth");
    assertNoPathPrefix([...map.keys()], ".git", ".git directory is absent by default");
    assert(!map.has(".git/HEAD"), ".git HEAD is not exported");
    assert(!map.has(".git/config"), ".git config is not exported");
    assert(!map.has(".git/index"), ".git index is not exported");
    assert(![...map.keys()].some(key => key.startsWith(".git/refs/")), ".git refs are not traversed");
    assert(![...map.keys()].some(key => key.startsWith(".git/hooks/")), ".git hooks are not traversed");
    assert(![...map.keys()].some(key => key.startsWith(".git/objects/")), ".git objects are not traversed");
    assert(![...map.values()].some(content => content.includes("token@example.invalid")), ".git remote URL is not exported");
    assert(!map.has("libs/submodule/.git"), "submodule .git file path is absent by default");
    assert(![...map.keys()].some(key => key.endsWith("/.git") || key.includes("/.git/")), "nested .git paths are absent by default");
    assert(![...map.values()].some(content => content.includes("gitdir:")), "submodule gitdir target is not exported");

    const extractedDir = path.join(tempRoot, ".extracted-simulation");
    for (const [relativePath, content] of map) {
      const targetPath = path.join(extractedDir, ...relativePath.split("/"));
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, content);
    }
    assert(!fs.existsSync(path.join(extractedDir, ".git")), "Path('.git').exists() stays false after extraction");

    const hardDeleted = byPath(await collect(workspaceUri, workspaceUri, { softDeleteGitMetadata: false }));
    assert(!hardDeleted.has(".gitignore"), "soft-delete can be disabled");
    assert(!hardDeleted.has(".github/workflows/ci.yml"), ".github remains excluded when disabled");
    assert(!hardDeleted.has("_EXPORT2AI_PLACEHOLDERS/git/EXPORT2AI_SOFT_DELETE_PLACEHOLDER.txt"), ".git marker is absent when disabled");

    const excludeGithub = byPath(await collect(workspaceUri, workspaceUri, {
      isExcludedByResourcePath: (uri) => uri.fsPath.includes(`${path.sep}.github`)
    }));
    assert(!excludeGithub.has(".github/workflows/ci.yml"), "explicit excludePaths-style predicate wins over soft-delete");
    assert(excludeGithub.has(".gitignore"), "other Git metadata placeholders remain included");
    const excludeGitignore = byPath(await collect(workspaceUri, workspaceUri, {
      isExcludedByResourcePath: (uri) => uri.fsPath.endsWith(`${path.sep}.gitignore`)
    }));
    assert(!excludeGitignore.has(".gitignore"), "explicit excludePaths-style predicate wins for restored .gitignore");
    const excludeGit = byPath(await collect(workspaceUri, Uri.file(path.join(tempRoot, ".git")), {
      isExcludedByResourcePath: (uri) => uri.fsPath.includes(`${path.sep}.git`)
    }));
    assert.strictEqual(excludeGit.size, 0, "explicit excludePaths-style predicate wins for selected .git");

    const githubOnly = byPath(await collect(workspaceUri, Uri.file(path.join(tempRoot, ".github"))));
    assert(githubOnly.has("workflows/ci.yml"), "selected .github folder keeps archive-relative paths");
    assert(githubOnly.get("workflows/ci.yml").includes("name: real ci"), "selected .github folder exports real workflow content");

    const gitOnly = byPath(await collect(workspaceUri, Uri.file(path.join(tempRoot, ".git"))));
    assert.deepStrictEqual([...gitOnly.keys()], ["_EXPORT2AI_PLACEHOLDERS/git/EXPORT2AI_SOFT_DELETE_PLACEHOLDER.txt"], "selected .git folder gets one external marker by default");

    const advancedGitPlaceholder = byPath(await collect(workspaceUri, workspaceUri, {
      softDeleteGitMetadataRealGitPathPlaceholder: true
    }));
    assert(advancedGitPlaceholder.has(".git/EXPORT2AI_SOFT_DELETE_PLACEHOLDER.txt"), "advanced mode can write marker inside .git");
    assert(!advancedGitPlaceholder.has(".git/config"), "advanced mode still does not export .git config");

    let collectionSummary;
    const filesWithSummary = await collect(workspaceUri, workspaceUri, {
      onSummary: (summary) => {
        collectionSummary = summary;
      }
    });
    const { buildExportManifest } = require("../out/zipService");
    const manifest = buildExportManifest(
      path.basename(tempRoot),
      {
        ignoreGitIgnore: true,
        ignoreDotFiles: true,
        ignoreDollarFiles: true,
        softDeleteGitMetadata: true,
        softDeleteGitMetadataRealGitPathPlaceholder: false,
        excludePatterns: ["node_modules", ".git"],
        excludePaths: [],
        compressCode: false,
        removeComments: false,
        enableTokenCounting: true,
        showExplorerTokenBadges: false,
        llmModel: "gpt-5.5",
        compressionLevel: 9,
        includeManifest: true,
        copyPathAfterCreate: true,
        maxFileSize: 1024 * 1024,
        maxDepth: 5,
        fileConcurrency: 2,
        outputFormat: "plaintext",
        debug: false
      },
      filesWithSummary,
      1234,
      567,
      collectionSummary,
      new Date("2026-06-01T00:00:00.000Z")
    );
    assert(manifest.includes(`Source folder: ${path.basename(tempRoot)}`), "manifest records source folder name");
    assert(manifest.includes("Source path redacted: true"), "manifest records source path redaction");
    assert(manifest.includes(".git was intentionally omitted."), "manifest states .git was intentionally omitted");
    assert(manifest.includes("Credentials and private key material are intentionally omitted."), "manifest states credentials/key material are omitted");
    assert(manifest.includes("This archive is for code-context analysis, not for publishing."), "manifest states archive purpose");
    assert(!manifest.includes(tempRoot), "manifest does not leak absolute source path");
    assert(!manifest.includes("Source: "), "manifest does not include legacy absolute Source line");
    assert(manifest.includes("Created: 2026-06-01T00:00:00.000Z"), "manifest records created timestamp");
    assert(manifest.includes("Included files:"), "manifest records included file count");
    assert(manifest.includes("Excluded entries:"), "manifest records excluded entry count");
    assert(manifest.includes("Soft-delete Git/GitHub metadata: true"), "manifest records soft-delete setting");
    assert(manifest.includes("Real .git path placeholder: false"), "manifest records .git placeholder mode");

    const { ProjectTreeGenerator } = require("../out/utils/projectTree");
    const { IgnoreUtils } = require("../out/utils/ignoreUtils");
    const emptyExclude = IgnoreUtils.createResourcePathExclusionFn(workspaceUri, ["", "   "]);
    assert.strictEqual(emptyExclude(workspaceUri), false, "empty excludePaths entries do not exclude the workspace root");
    const relativeCaseExclude = IgnoreUtils.createResourcePathExclusionFn(workspaceUri, ["SRC"]);
    assert.strictEqual(
      relativeCaseExclude(Uri.file(path.join(tempRoot, "src", "index.ts"))),
      process.platform === "win32",
      "relative excludePaths are case-insensitive on Windows only"
    );
    const absoluteCaseExclude = IgnoreUtils.createResourcePathExclusionFn(workspaceUri, [path.join(tempRoot, "SRC")]);
    assert.strictEqual(
      absoluteCaseExclude(Uri.file(path.join(tempRoot, "src", "index.ts"))),
      process.platform === "win32",
      "absolute excludePaths are case-insensitive on Windows only"
    );
    const tree = await ProjectTreeGenerator.generateProjectTree(
      workspaceUri,
      createIgnoreInstance(),
      5,
      0,
      "",
      () => false,
      { isCancellationRequested: false },
      workspaceUri,
      true,
      false,
      workspaceUri
    );
    assert(tree.includes(".github"), "copy structure keeps .github");
    assert(tree.includes("ci.yml"), "copy structure keeps .github descendants");
    assert(tree.includes(".gitignore"), "copy structure keeps .gitignore");
    assert(tree.includes("_EXPORT2AI_PLACEHOLDERS/git/EXPORT2AI_SOFT_DELETE_PLACEHOLDER.txt"), "copy structure shows external .git marker by default");
    assert(!tree.includes(".git\n"), "copy structure does not list a .git directory by default");
    assert(tree.includes("EXPORT2AI_READ_ERROR.txt"), "copy structure surfaces repository-control read errors");
    assert(!tree.includes("HEAD"), "copy structure does not traverse .git");
    assert(!tree.includes("link-to-outside.ts"), "copy structure skips symbolic links");

    const gitTree = await ProjectTreeGenerator.generateProjectTree(
      Uri.file(path.join(tempRoot, ".git")),
      createIgnoreInstance(),
      5,
      0,
      "",
      () => false,
      { isCancellationRequested: false },
      Uri.file(path.join(tempRoot, ".git")),
      true,
      false,
      workspaceUri
    );
    assert(gitTree.includes("_EXPORT2AI_PLACEHOLDERS/git/EXPORT2AI_SOFT_DELETE_PLACEHOLDER.txt"), "selected .git structure shows external marker by default");
    assert(!gitTree.includes("config"), "selected .git structure does not expose config");
    const excludedGitTree = await ProjectTreeGenerator.generateProjectTree(
      Uri.file(path.join(tempRoot, ".git")),
      createIgnoreInstance(),
      5,
      0,
      "",
      (uri) => uri.fsPath.includes(`${path.sep}.git`),
      { isCancellationRequested: false },
      Uri.file(path.join(tempRoot, ".git")),
      true,
      false,
      workspaceUri
    );
    assert.strictEqual(excludedGitTree, "", "explicit excludePaths-style predicate wins for selected .git structure");
    assert(
      capturedErrors.some(message => message.includes("simulated readDirectory failure")),
      "repository-control directory read failure is logged"
    );
    assert(
      capturedErrors.some(message => message.includes("simulated readFile failure")),
      "repository-control file read failure is logged"
    );

    console.log("Soft-delete Git/GitHub metadata tests passed.");
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    Module._load = originalLoad;
    console.error = originalConsoleError;
  }
})().catch((error) => {
  Module._load = originalLoad;
  console.error = originalConsoleError;
  console.error("Soft-delete Git/GitHub metadata tests failed:", error);
  process.exit(1);
});
