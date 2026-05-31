const assert = require("assert");
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

console.log("extension settings navigation tests passed.");
