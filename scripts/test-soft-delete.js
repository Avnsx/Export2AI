const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");

class CancellationError extends Error {}

const readDirectoryFailures = new Set();
const readFileFailures = new Set();

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
    Directory: 2
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
        return entries.map(entry => [
          entry.name,
          entry.isDirectory() ? vscodeMock.FileType.Directory : vscodeMock.FileType.File
        ]);
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

function createIgnoreInstance() {
  const { IgnoreUtils } = require("../out/utils/ignoreUtils");
  const ig = IgnoreUtils.createIgnoreInstance(
    ["node_modules", "*.log", "dist", "build", "out", ".git", "__pycache__", ".pytest_cache", ".cache", ".tmp"],
    true,
    true
  );
  ig.add("ignored-by-gitignore.txt");
  return ig;
}

async function collect(rootUri, sourceUri, options = {}) {
  const { FileProcessor } = require("../out/utils/fileProcessor");
  return FileProcessor.collectFiles(sourceUri, sourceUri, rootUri, createIgnoreInstance(), {
    maxFileSize: 1024 * 1024,
    compressCode: false,
    removeComments: false,
    softDeleteGitMetadata: true,
    softDeleteGitMetadataRealGitPathPlaceholder: false,
    isExcludedByResourcePath: () => false,
    zipOutputPath: path.join(rootUri.fsPath, "export.zip"),
    fileConcurrency: 2,
    ...options
  });
}

(async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "export2ai-soft-delete-"));
  const workspaceUri = Uri.file(tempRoot);

  try {
    writeFile(path.join(tempRoot, "src", "index.ts"), "export const ok = true;\n");
    writeFile(path.join(tempRoot, ".env"), "SHOULD_NOT_EXPORT=true\n");
    writeFile(path.join(tempRoot, ".gitignore"), "node_modules\n.env\nignored-by-gitignore.txt\n");
    writeFile(path.join(tempRoot, ".gitattributes"), "*.ts text eol=lf\n");
    writeFile(path.join(tempRoot, ".github", "workflows", "ci.yml"), "name: real ci\nsecrets: ${{ secrets.PAT }}\n");
    writeFile(path.join(tempRoot, ".github", "workflows", "publish-policy.yml"), "name: publish policy\n");
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
    readFileFailures.add(keyFor(path.join(tempRoot, ".github", "workflows", "unreadable.yml")));
    readDirectoryFailures.add(keyFor(path.join(tempRoot, ".github", "inaccessible")));

    const files = await collect(workspaceUri, workspaceUri);
    const map = byPath(files);

    assert(map.has("src/index.ts"), "normal source file is included");
    assert.strictEqual(map.get("src/index.ts"), "export const ok = true;\n", "normal source content is unchanged");
    assert(!map.has(".env"), "non-Git dot files remain hard-excluded");
    assert(!map.has("ignored-by-gitignore.txt"), ".gitignore rules still exclude non-metadata files");
    assert(!map.has("__pycache__/module.pyc"), "__pycache__ remains hard-excluded");
    assert(!map.has(".pytest_cache/CACHEDIR.TAG"), ".pytest_cache remains hard-excluded");
    assert(!map.has(".cache/tool/state.json"), ".cache remains hard-excluded");
    assert(!map.has(".tmp/scratch.txt"), ".tmp remains hard-excluded");

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

    assert(map.has("_EXPORT2AI_GIT_METADATA_PLACEHOLDER.txt"), ".git metadata gets one external marker by default");
    assert(map.get("_EXPORT2AI_GIT_METADATA_PLACEHOLDER.txt").includes("The real local .git metadata was intentionally not exported."), "marker states .git metadata was omitted");
    assert(map.get("_EXPORT2AI_GIT_METADATA_PLACEHOLDER.txt").includes("remotes, refs, branches, local history, hooks, object database, or credentials"), "marker names omitted Git internals");
    assert(map.get("_EXPORT2AI_GIT_METADATA_PLACEHOLDER.txt").includes("do not use it as project code, CI configuration, dependency evidence, credential evidence, or repository truth"), "marker instructs AI not to treat it as repo truth");
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
    assert(!hardDeleted.has("_EXPORT2AI_GIT_METADATA_PLACEHOLDER.txt"), ".git marker is absent when disabled");

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
    assert.deepStrictEqual([...gitOnly.keys()], ["_EXPORT2AI_GIT_METADATA_PLACEHOLDER.txt"], "selected .git folder gets one external marker by default");

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
    assert(!manifest.includes(tempRoot), "manifest does not leak absolute source path");
    assert(!manifest.includes("Source: "), "manifest does not include legacy absolute Source line");
    assert(manifest.includes("Created: 2026-06-01T00:00:00.000Z"), "manifest records created timestamp");
    assert(manifest.includes("Included files:"), "manifest records included file count");
    assert(manifest.includes("Excluded entries:"), "manifest records excluded entry count");
    assert(manifest.includes("Soft-delete Git/GitHub metadata: true"), "manifest records soft-delete setting");
    assert(manifest.includes("Real .git path placeholder: false"), "manifest records .git placeholder mode");

    const { ProjectTreeGenerator } = require("../out/utils/projectTree");
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
    assert(tree.includes("_EXPORT2AI_GIT_METADATA_PLACEHOLDER.txt"), "copy structure shows external .git marker by default");
    assert(!tree.includes("EXPORT2AI_SOFT_DELETE_PLACEHOLDER.txt"), "copy structure does not create .git marker path by default");
    assert(tree.includes("EXPORT2AI_READ_ERROR.txt"), "copy structure surfaces repository-control read errors");
    assert(!tree.includes("HEAD"), "copy structure does not traverse .git");

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
    assert(gitTree.includes("_EXPORT2AI_GIT_METADATA_PLACEHOLDER.txt"), "selected .git structure shows external marker by default");
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
