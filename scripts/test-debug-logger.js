const assert = require("assert");
const Module = require("module");

let inspected = {};
let fallbackValue = false;
const outputLines = [];
const showCalls = [];

class MockUri {}

const mockVscode = {
  Uri: MockUri,
  workspace: {
    workspaceFolders: [{ uri: { fsPath: "C:\\repo" } }],
    getConfiguration(section, target) {
      assert.strictEqual(section, "export2ai", "debug logger reads Export2AI config section");
      return {
        get(key, defaultValue) {
          assert.strictEqual(key, "debug", "debug logger reads debug setting");
          return fallbackValue ?? defaultValue;
        },
        inspect(key) {
          assert.strictEqual(key, "debug", "debug logger inspects debug setting scopes");
          return inspected;
        }
      };
    }
  }
};

const originalLoad = Module._load;
Module._load = function mockVscodeLoad(request, parent, isMain) {
  if (request === "vscode") {
    return mockVscode;
  }

  return originalLoad.call(this, request, parent, isMain);
};

const logger = require("../out/utils/debugLogger");

function configureDebug(inspectResult, fallback = false) {
  inspected = inspectResult;
  fallbackValue = fallback;
}

(async () => {
  configureDebug({ globalValue: true, workspaceValue: false });
  assert.strictEqual(
    logger.isDebugLoggingEnabled({ fsPath: "C:\\repo" }),
    true,
    "User/global debug true wins even when workspace has false"
  );

  configureDebug({ workspaceValue: true });
  assert.strictEqual(logger.isDebugLoggingEnabled(), true, "workspace debug true enables logging");

  configureDebug({ globalValue: false, workspaceValue: false }, false);
  assert.strictEqual(logger.isDebugLoggingEnabled(), false, "all explicit false values disable logging");

  logger.setDebugOutputChannel({
    appendLine(line) {
      outputLines.push(line);
    },
    show(preserveFocus) {
      showCalls.push(preserveFocus);
    }
  });

  configureDebug({ globalValue: true, workspaceValue: false });
  logger.debugLog("debug: enabled", { show: true, details: { workspace: "C:\\repo" } });

  assert.strictEqual(outputLines.length, 1, "debugLog appends a line when debug is enabled");
  assert(outputLines[0].includes("debug: enabled"), "debugLog writes the marker message");
  assert.strictEqual(showCalls[0], false, "debugLog focuses the Export2AI output channel");

  await new Promise(resolve => setTimeout(resolve, 130));
  assert.strictEqual(showCalls[1], false, "debugLog retries channel focus after Settings timing settles");

  logger.setDebugOutputChannel(undefined);
  Module._load = originalLoad;
  console.log("debug logger tests passed.");
})().catch(error => {
  Module._load = originalLoad;
  console.error("debug logger tests failed:", error);
  process.exit(1);
});
