const assert = require("assert");
const Module = require("module");
const path = require("path");

const root = path.join(__dirname, "..");
const workspaceRoot = path.join(root, "tmp", "badge-runtime-workspace");
const secondaryWorkspaceRoot = path.join(root, "tmp", "badge-runtime-secondary");

const settings = {
  ignoreGitIgnore: true,
  ignoreDotFiles: true,
  ignoreDollarFiles: true,
  excludePatterns: ["node_modules", "build", "out", ".git"],
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
  fileConcurrency: 4,
  outputFormat: "plaintext",
  debug: false
};

class Disposable {
  constructor(callback = () => {}) {
    this.callback = callback;
  }

  dispose() {
    this.callback();
  }
}

class Uri {
  constructor(fsPath) {
    this.fsPath = path.resolve(fsPath);
  }

  toString() {
    return `file:///${this.fsPath.replace(/\\/g, "/")}`;
  }

  static file(fsPath) {
    return new Uri(fsPath);
  }

  static joinPath(base, ...segments) {
    return new Uri(path.join(base.fsPath, ...segments));
  }
}

class EventEmitter {
  constructor() {
    this.listeners = new Set();
    this.event = (listener) => {
      this.listeners.add(listener);
      return new Disposable(() => this.listeners.delete(listener));
    };
  }

  fire(value) {
    for (const listener of this.listeners) {
      listener(value);
    }
  }

  dispose() {
    this.listeners.clear();
  }
}

const workspaceUri = Uri.file(workspaceRoot);
const srcUri = Uri.joinPath(workspaceUri, "src");
const secondaryWorkspaceUri = Uri.file(secondaryWorkspaceRoot);
const secondarySrcUri = Uri.joinPath(secondaryWorkspaceUri, "src");
const workspaceFolder = {
  uri: workspaceUri,
  name: "badge-runtime-workspace",
  index: 0
};
const secondarySettings = {
  ...settings,
  llmModel: "claude-sonnet-4-6"
};
const secondaryWorkspaceFolder = {
  uri: secondaryWorkspaceUri,
  name: "badge-runtime-secondary",
  index: 1
};

let capturedProvider;
let statusBarItem;
const decorationEvents = [];
const executedCommands = [];
let statCalls = 0;
let collectCalls = 0;

function normalizeKey(fsPath) {
  return path.resolve(fsPath).toLowerCase();
}

function isUnderRoot(uri, rootPath) {
  const target = normalizeKey(uri.fsPath);
  const workspace = normalizeKey(rootPath);
  return target === workspace || target.startsWith(`${workspace}${path.sep}`);
}

function getWorkspaceFolder(uri) {
  if (isUnderRoot(uri, workspaceRoot)) {
    return workspaceFolder;
  }
  if (isUnderRoot(uri, secondaryWorkspaceRoot)) {
    return secondaryWorkspaceFolder;
  }
  return undefined;
}

function settingsForResource(resource) {
  return resource && isUnderRoot(resource, secondaryWorkspaceRoot) ? secondarySettings : settings;
}

const vscodeMock = {
  Disposable,
  EventEmitter,
  Uri,
  FileType: {
    File: 1,
    Directory: 2
  },
  StatusBarAlignment: {
    Right: 2
  },
  workspace: {
    workspaceFolders: [workspaceFolder, secondaryWorkspaceFolder],
    getWorkspaceFolder(uri) {
      return getWorkspaceFolder(uri);
    },
    getConfiguration(section, resource) {
      assert.strictEqual(section, "export2ai", "TokenEstimateManager only reads export2ai config");
      const scopedSettings = settingsForResource(resource);
      return {
        get(key, fallback) {
          return Object.prototype.hasOwnProperty.call(scopedSettings, key) ? scopedSettings[key] : fallback;
        },
        inspect(key) {
          return {
            globalValue: scopedSettings[key],
            workspaceValue: undefined,
            globalLanguageValue: undefined,
            workspaceLanguageValue: undefined
          };
        }
      };
    },
    onDidChangeConfiguration() {
      return new Disposable();
    },
    onDidSaveTextDocument() {
      return new Disposable();
    },
    onDidCreateFiles() {
      return new Disposable();
    },
    onDidDeleteFiles() {
      return new Disposable();
    },
    onDidRenameFiles() {
      return new Disposable();
    },
    fs: {
      async stat() {
        statCalls += 1;
        return { type: vscodeMock.FileType.Directory, size: 0 };
      }
    }
  },
  window: {
    createStatusBarItem() {
      statusBarItem = {
        text: "",
        tooltip: "",
        command: undefined,
        visible: false,
        show() {
          this.visible = true;
        },
        hide() {
          this.visible = false;
        },
        dispose() {}
      };
      return statusBarItem;
    },
    createOutputChannel() {
      return {
        appendLine() {},
        show() {},
        dispose() {}
      };
    },
    registerFileDecorationProvider(provider) {
      capturedProvider = provider;
      const subscription = provider.onDidChangeFileDecorations((uri) => {
        decorationEvents.push(uri);
      });
      return new Disposable(() => subscription.dispose());
    }
  },
  commands: {
    async executeCommand(command, ...args) {
      executedCommands.push({ command, args });
    }
  }
};

const projectServiceStub = {
  async prepareIgnoreContext() {
    return {
      ig: {},
      isExcludedByResourcePath: () => false
    };
  }
};

const fileProcessorStub = {
  FileProcessor: {
    async collectFiles() {
      collectCalls += 1;
      return [
        { path: "src/index.ts", content: "export const value = 1;\n".repeat(120) },
        { path: "src/utils/format.ts", content: "export function format(input) { return String(input); }\n".repeat(120) },
        { path: "README.md", content: "# Badge Runtime Smoke\n".repeat(80) }
      ];
    }
  }
};

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "vscode") {
    return vscodeMock;
  }

  if (request === "./projectService" && parent?.filename.endsWith(`${path.sep}out${path.sep}tokenEstimate.js`)) {
    return projectServiceStub;
  }

  if (request === "./utils/fileProcessor" && parent?.filename.endsWith(`${path.sep}out${path.sep}tokenEstimate.js`)) {
    return fileProcessorStub;
  }

  return originalLoad.call(this, request, parent, isMain);
};

function nextTurn() {
  return new Promise((resolve) => setImmediate(resolve));
}

function badgeFor(uri) {
  return capturedProvider.provideFileDecoration(uri);
}

(async () => {
  try {
    const { TokenEstimateManager } = require("../out/tokenEstimate");
    const manager = new TokenEstimateManager({
      subscriptions: [],
      extension: {
        id: "avnsx.export2ai",
        packageJSON: { publisher: "avnsx", name: "export2ai", version: "1.2.7" }
      },
      extensionPath: root
    });

    assert(capturedProvider, "file decoration provider was registered");
    await nextTurn();

    assert.strictEqual(settings.showExplorerTokenBadges, false, "badge setting starts disabled");
    assert.strictEqual(badgeFor(workspaceUri), undefined, "workspace root has no badge by default");
    assert.strictEqual(badgeFor(srcUri), undefined, "child folder has no badge by default");
    assert.strictEqual(statCalls, 0, "disabled badges do not start fallback folder stats");

    const disabledEventStart = decorationEvents.length;
    await manager.updateContextForUri(workspaceUri);
    await nextTurn();
    assert(collectCalls > 0, "runtime estimate path collected files");
    assert(statusBarItem.tooltip.includes("Counted: workspace badge-runtime-workspace"), "root estimate tooltip names workspace scope");
    assert.strictEqual(badgeFor(workspaceUri), undefined, "manual estimate still has no badge while disabled");
    assert.strictEqual(badgeFor(srcUri), undefined, "manual estimate does not create child badges while disabled");
    assert(
      decorationEvents.slice(disabledEventStart).some((event) => event === undefined),
      "manual estimate emits a full decoration clear while badges are disabled"
    );

    settings.showExplorerTokenBadges = true;
    await manager.refreshWorkspaceEstimates();
    const rootDecoration = badgeFor(workspaceUri);
    const childDecoration = badgeFor(srcUri);
    assert(rootDecoration && typeof rootDecoration.badge === "string", "opt-in root badge is produced");
    assert(childDecoration && typeof childDecoration.badge === "string", "opt-in child badge is produced");
    assert(childDecoration.badge.length <= 2, "Explorer badge stays within VS Code's two-character limit");

    await manager.updateContextForUri(srcUri);
    assert(statusBarItem.tooltip.includes("Counted: folder src"), "selected folder estimate tooltip names folder scope");

    secondarySettings.showExplorerTokenBadges = true;
    await manager.updateContextForUri(secondarySrcUri);
    assert(statusBarItem.tooltip.includes("Counted: folder src"), "multi-root selected folder tooltip names folder scope");
    assert(statusBarItem.tooltip.includes("Model: claude-sonnet-4-6"), "multi-root selected folder tooltip uses that workspace model");
    assert(statusBarItem.text.includes("claude-sonnet-4-6"), "multi-root selected folder status bar uses that workspace model");

    const enabledCollectCalls = collectCalls;
    assert.strictEqual(badgeFor(Uri.joinPath(workspaceUri, "empty-folder")), undefined, "uncached folder has no badge after full aggregation");
    assert.strictEqual(collectCalls, enabledCollectCalls, "provider remains synchronous after full aggregation");

    const reDisableEventStart = decorationEvents.length;
    settings.showExplorerTokenBadges = false;
    secondarySettings.showExplorerTokenBadges = false;
    await manager.refreshWorkspaceEstimates();
    assert.strictEqual(badgeFor(workspaceUri), undefined, "root badge clears after disabling setting");
    assert.strictEqual(badgeFor(srcUri), undefined, "child badge clears after disabling setting");
    assert(
      decorationEvents.slice(reDisableEventStart).some((event) => event === undefined),
      "disabling badges emits a full decoration clear"
    );

    const outsideEventStart = decorationEvents.length;
    await manager.updateContextForUri(Uri.file(path.join(root, "tmp", "outside-workspace")));
    assert.strictEqual(statusBarItem.visible, false, "status bar hides when the counted URI is outside every workspace");
    assert(
      decorationEvents.slice(outsideEventStart).some((event) => event === undefined),
      "outside-workspace update emits a full decoration clear"
    );

    settings.enableTokenCounting = false;
    await manager.updateContextForUri(workspaceUri);
    assert.strictEqual(statusBarItem.visible, false, "status bar hides when token counting is disabled");
    assert.strictEqual(badgeFor(workspaceUri), undefined, "token counting disabled cannot produce badges");

    assert(
      executedCommands.some((entry) => entry.command === "setContext" && entry.args[0] === "export2ai.enableTokenCounting"),
      "token counting context is still updated"
    );

    manager.dispose();
    console.log("Explorer badge runtime smoke test passed.");
    console.log(`collect calls: ${collectCalls}; stat fallback calls while disabled: ${statCalls}`);
  } finally {
    Module._load = originalLoad;
  }
})().catch((error) => {
  Module._load = originalLoad;
  console.error("Explorer badge runtime smoke test failed:", error);
  process.exit(1);
});
