const assert = require("assert");
const Module = require("module");
const path = require("path");
const {
  buildExtensionSettingsQuery,
  resolveExtensionId
} = require("../out/utils/extensionId");
const {
  applyExtensionMetadataSettings,
  formatExtensionVersionLabel,
  formatLastUpdatedLabel,
  formatExtensionInfoLabel,
  isValidIsoDate,
  listChangelogReleases,
  findChangelogReleaseDate,
  resolveLastUpdatedIsoDate,
  EXTENSION_INFO_SETTING,
  EXTENSION_VERSION_SETTING,
  EXTENSION_LAST_UPDATED_SETTING
} = require("./extension-metadata");
const { getConfigurationProperty } = require("./configuration-utils");

function mockContext(overrides = {}) {
  return {
    extension: {
      id: overrides.id,
      packageJSON: {
        publisher: overrides.publisher ?? "avnsx",
        name: overrides.name ?? "export2ai"
      }
    }
  };
}

function mockManifest(version) {
  return {
    version,
    contributes: {
      configuration: [
        {
          title: "Export2AI",
          properties: {
            [EXTENSION_INFO_SETTING]: { type: "string", readOnly: true, order: 0 },
            [EXTENSION_VERSION_SETTING]: { type: "string", order: -100 },
            [EXTENSION_LAST_UPDATED_SETTING]: { type: "string", order: -99 }
          }
        },
        {
          title: "Comments",
          id: "comments",
          properties: {
            "export2ai.removeComments": { type: "boolean", default: false },
            "export2ai.commentStripLanguages": { type: "string", readOnly: true, order: 1 }
          }
        }
      ]
    }
  };
}

const SAMPLE_CHANGELOG = `# Changelog

## [1.2.2] - 2026-05-30

### Fixed
- Example fix

## [1.2.1] - 2026-05-29

- Earlier release
`;

assert.strictEqual(
  buildExtensionSettingsQuery("avnsx.export2ai"),
  "@ext:avnsx.export2ai",
  "settings query"
);

assert.strictEqual(
  resolveExtensionId(mockContext({ id: "avnsx.export2ai" })),
  "avnsx.export2ai",
  "prefer runtime id"
);

assert.strictEqual(
  resolveExtensionId(mockContext({ id: undefined, publisher: "Acme", name: "my-ext" })),
  "Acme.my-ext",
  "fallback publisher.name"
);

assert.strictEqual(
  formatExtensionVersionLabel("1.2.2"),
  "Extension version v.1.2.2",
  "version label format"
);
assert.strictEqual(
  formatExtensionInfoLabel("1.2.2", "2026-05-30"),
  "Extension version v.1.2.2 · Last updated May 30, 2026",
  "combined info label"
);
assert.strictEqual(
  formatExtensionInfoLabel("", undefined),
  "Extension version v.unknown · Last updated: Unknown",
  "combined info with missing data"
);

assert.strictEqual(isValidIsoDate("2026-05-30"), true, "valid iso date");
assert.strictEqual(isValidIsoDate("2026-13-01"), false, "invalid month");

assert.strictEqual(
  resolveLastUpdatedIsoDate(SAMPLE_CHANGELOG, "9.9.9"),
  "2026-05-30",
  "fallback to newest changelog date when version missing"
);

const manifest = mockManifest("9.8.7");
applyExtensionMetadataSettings(manifest, SAMPLE_CHANGELOG);
const info = getConfigurationProperty(manifest, EXTENSION_INFO_SETTING);
assert.strictEqual(
  info.default,
  "Extension version v.9.8.7 · Last updated May 30, 2026",
  "combined setting default synced"
);
assert.strictEqual(info.order, -100, "info setting stays first");
assert.strictEqual(info.description, undefined, "no duplicate description line");
assert.strictEqual(info.markdownDescription, undefined, "no duplicate markdown line");
assert.strictEqual(
  getConfigurationProperty(manifest, EXTENSION_VERSION_SETTING),
  undefined,
  "legacy version setting removed on merge"
);
assert.strictEqual(
  getConfigurationProperty(manifest, EXTENSION_LAST_UPDATED_SETTING),
  undefined,
  "legacy last-updated setting removed on merge"
);

const matchedManifest = mockManifest("1.2.1");
applyExtensionMetadataSettings(matchedManifest, SAMPLE_CHANGELOG);
assert.strictEqual(
  getConfigurationProperty(matchedManifest, EXTENSION_INFO_SETTING).default,
  "Extension version v.1.2.1 · Last updated May 29, 2026",
  "combined label uses exact version date when present"
);

const packageManifest = require("../package.json");
assert.strictEqual(
  packageManifest.icon,
  "icons/icon-1254x1254.png",
  "manifest exposes packaged marketplace icon"
);
assert(
  packageManifest.scripts.package.includes("scripts/package-vsix.js"),
  "package script uses dedicated VSIX build wrapper"
);
const outputFormatSetting = getConfigurationProperty(packageManifest, "export2ai.outputFormat");
assert.strictEqual(outputFormatSetting.default, "plaintext", "copy structure output defaults to plaintext");
const debugSetting = getConfigurationProperty(packageManifest, "export2ai.debug");
assert.strictEqual(debugSetting.default, false, "debug logging defaults off");
assert(
  debugSetting.description.includes("full Export2AI diagnostics"),
  "debug setting describes full-extension diagnostics"
);

const partialManifest = {
  version: "1.2.2",
  contributes: {
    configuration: [
      {
        title: "Export2AI",
        properties: {}
      }
    ]
  }
};
assert.doesNotThrow(
  () => applyExtensionMetadataSettings(partialManifest, SAMPLE_CHANGELOG),
  "missing info property does not throw"
);

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
    this.fsPath = fsPath;
  }

  toString() {
    return `file:///${this.fsPath.replace(/\\/g, "/")}`;
  }

  static file(fsPath) {
    return new Uri(fsPath);
  }
}

function clearExtensionModuleCache() {
  for (const relative of [
    "../out/extension",
    "../out/config",
    "../out/utils/debugLogger"
  ]) {
    delete require.cache[require.resolve(relative)];
  }
}

async function runBuiltInExcludeCommandScenario({
  settings,
  workspaceFolders,
  quickPick,
  update
}) {
  const originalLoad = Module._load;
  const registeredCommands = new Map();
  const quickPickCalls = [];
  const updateCalls = [];
  const infoMessages = [];
  const errorMessages = [];

  const config = {
    get(key, fallback) {
      return Object.prototype.hasOwnProperty.call(settings, key) ? settings[key] : fallback;
    },
    async update(key, value, target) {
      updateCalls.push({ key, value, target });
      if (update) {
        await update(key, value, target);
      }
      settings[key] = value;
    },
    inspect(key) {
      return { workspaceValue: settings[key], globalValue: undefined };
    }
  };

  const vscodeMock = {
    Disposable,
    Uri,
    ConfigurationTarget: {
      Global: 1,
      Workspace: 2
    },
    CancellationError: class CancellationError extends Error {},
    ProgressLocation: {
      Notification: 15
    },
    workspace: {
      workspaceFolders,
      getConfiguration(section) {
        assert.strictEqual(section, "export2ai", "built-in excludes command reads export2ai config");
        return config;
      },
      getWorkspaceFolder() {
        return workspaceFolders[0];
      },
      asRelativePath(uri) {
        return uri.fsPath;
      },
      onDidChangeConfiguration() {
        return new Disposable();
      },
      fs: {
        async stat() {
          return { type: 1, size: 0 };
        }
      }
    },
    window: {
      async showQuickPick(items, options) {
        quickPickCalls.push({ items, options });
        return quickPick(items, options);
      },
      async showInformationMessage(message) {
        infoMessages.push(message);
        return undefined;
      },
      async showErrorMessage(message) {
        errorMessages.push(message);
        return undefined;
      },
      async showWarningMessage() {
        return undefined;
      },
      createOutputChannel() {
        return { appendLine() {}, show() {}, dispose() {} };
      },
      withProgress() {
        throw new Error("withProgress should not be reached by built-in exclude tests");
      }
    },
    commands: {
      registerCommand(command, handler) {
        registeredCommands.set(command, handler);
        return new Disposable(() => registeredCommands.delete(command));
      }
    },
    env: {
      clipboard: {
        async writeText() {}
      }
    }
  };

  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === "vscode") {
      return vscodeMock;
    }
    if (request === "./utils/debugLogger") {
      return {
        debugError() {},
        debugLog() {},
        disposeDebugOutputChannel() {},
        isDebugLoggingEnabled() {
          return false;
        }
      };
    }
    if (parent?.filename.endsWith(`${path.sep}out${path.sep}extension.js`)) {
      if (request === "./projectService") {
        return { copyFileContentToClipboard() {}, copyProjectStructure() {} };
      }
      if (request === "./tokenEstimate") {
        return { TokenEstimateManager: class TokenEstimateManager { dispose() {} } };
      }
      if (request === "./utils/extensionSettings") {
        return { openOwnExtensionSettings: async () => {} };
      }
      if (request === "./utils/menuTargetModels") {
        return { MENU_TARGET_MODELS: [] };
      }
      if (request === "./utils/modelFormat") {
        return { formatModelCommandSlug: value => value };
      }
      if (request === "./utils/tokenCounter") {
        return { TokenCounter: { formatTokenLabel: () => "(est. 0 tokens)" } };
      }
      if (request === "./utils/systemExplorer") {
        return { revealInSystemExplorer: async () => {} };
      }
      if (request === "./zipService") {
        return { createZipArchive: async () => { throw new Error("zip should not run"); } };
      }
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    clearExtensionModuleCache();
    const { activate, deactivate } = require("../out/extension");
    const subscriptions = [];
    activate({
      subscriptions,
      extension: {
        id: "avnsx.export2ai",
        packageJSON: { publisher: "avnsx", name: "export2ai", version: "1.2.8" }
      }
    });

    const handler = registeredCommands.get("export2ai.showBuiltInExcludePatterns");
    assert(handler, "built-in excludes command is registered");
    await handler();
    deactivate();
  } finally {
    Module._load = originalLoad;
    clearExtensionModuleCache();
  }

  return { quickPickCalls, updateCalls, infoMessages, errorMessages };
}

async function testBuiltInExcludeCommand() {
  const workspaceFolder = { uri: Uri.file("C:\\repo"), name: "repo", index: 0 };
  const success = await runBuiltInExcludeCommandScenario({
    settings: {
      useBuiltInExcludePatterns: true,
      disabledBuiltInExcludePatterns: [" node_modules ", "**/*.pem", "**/*.pem", "not-a-built-in", 42]
    },
    workspaceFolders: [workspaceFolder],
    quickPick(items, options) {
      assert.strictEqual(items.length, 30, "checklist exposes every built-in pattern");
      assert.strictEqual(options.canPickMany, true, "checklist allows multi-pick");
      assert.strictEqual(items.find(item => item.label === "node_modules").picked, false, "trimmed disabled built-in is pre-unchecked");
      assert.strictEqual(items.find(item => item.label === "**/*.pem").picked, false, "disabled credential pattern is pre-unchecked");
      const enabled = new Set(items.map(item => item.label));
      enabled.delete(".git");
      enabled.delete("**/*.pem");
      return items.filter(item => enabled.has(item.label));
    }
  });
  assert.deepStrictEqual(
    success.updateCalls[0],
    {
      key: "disabledBuiltInExcludePatterns",
      value: [".git", "**/*.pem"],
      target: 2
    },
    "command writes unchecked built-ins to workspace settings"
  );
  assert(success.infoMessages[0].includes("2 built-in exclude pattern"), "successful update reports disabled count");

  const cancel = await runBuiltInExcludeCommandScenario({
    settings: { useBuiltInExcludePatterns: true, disabledBuiltInExcludePatterns: [] },
    workspaceFolders: [workspaceFolder],
    quickPick() {
      return undefined;
    }
  });
  assert.strictEqual(cancel.updateCalls.length, 0, "cancelled checklist does not write settings");
  assert.strictEqual(cancel.infoMessages.length, 0, "cancelled checklist stays quiet");

  const quickPickFailure = await runBuiltInExcludeCommandScenario({
    settings: { useBuiltInExcludePatterns: true, disabledBuiltInExcludePatterns: [] },
    workspaceFolders: [workspaceFolder],
    quickPick() {
      throw new Error("simulated quick-pick failure");
    }
  });
  assert.strictEqual(quickPickFailure.updateCalls.length, 0, "quick-pick failure does not write settings");
  assert(
    quickPickFailure.errorMessages[0].includes("Failed to show built-in exclude patterns"),
    "quick-pick failure is surfaced to the user"
  );

  const updateFailure = await runBuiltInExcludeCommandScenario({
    settings: { useBuiltInExcludePatterns: true, disabledBuiltInExcludePatterns: [] },
    workspaceFolders: [workspaceFolder],
    quickPick(items) {
      return items.slice(0, 1);
    },
    update() {
      throw new Error("simulated update failure");
    }
  });
  assert.strictEqual(updateFailure.infoMessages.length, 0, "failed update does not claim success");
  assert(
    updateFailure.errorMessages[0].includes("Failed to update built-in exclude patterns"),
    "update failure is surfaced to the user"
  );

  const builtInsOff = await runBuiltInExcludeCommandScenario({
    settings: { useBuiltInExcludePatterns: false, disabledBuiltInExcludePatterns: [] },
    workspaceFolders: [],
    quickPick(items, options) {
      assert(options.title.includes("currently off"), "title flags globally disabled built-ins");
      return items.filter(item => item.label !== "node_modules");
    }
  });
  assert.strictEqual(builtInsOff.updateCalls[0].target, 1, "no-workspace update uses global target");
  assert.deepStrictEqual(builtInsOff.updateCalls[0].value, ["node_modules"], "unchecked item is saved while built-ins are off");
  assert(
    builtInsOff.infoMessages[0].includes("Re-enable export2ai.useBuiltInExcludePatterns"),
    "success message explains saved list is inactive while built-ins are off"
  );
}

testBuiltInExcludeCommand()
  .then(() => {
    console.log("extension settings navigation tests passed.");
  })
  .catch((error) => {
    console.error("extension settings navigation tests failed:", error);
    process.exit(1);
  });
