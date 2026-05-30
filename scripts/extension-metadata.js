const fs = require("fs");
const path = require("path");
const { findConfigurationSetting } = require("./configuration-utils");

/** Single compact read-only row at the top of Export2AI settings. */
const EXTENSION_INFO_SETTING = "export2ai.extensionInfo";

/** @deprecated Replaced by EXTENSION_INFO_SETTING */
const EXTENSION_VERSION_SETTING = "export2ai.extensionVersion";
/** @deprecated Replaced by EXTENSION_INFO_SETTING */
const EXTENSION_LAST_UPDATED_SETTING = "export2ai.extensionLastUpdated";

const CHANGELOG_HEADING = /^##\s*\[([^\]]+)\]\s*-\s*(\d{4}-\d{2}-\d{2})\s*$/gm;

function formatExtensionVersionLabel(version) {
  const trimmed = String(version ?? "").trim();
  return trimmed ? `Extension version v.${trimmed}` : "Extension version v.unknown";
}

function isValidIsoDate(isoDate) {
  if (typeof isoDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return false;
  }
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    !Number.isNaN(date.getTime())
    && date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
  );
}

function formatLastUpdatedLabel(isoDate) {
  if (!isValidIsoDate(isoDate)) {
    return "Last updated: Unknown";
  }
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const formatted = date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  });
  return `Last updated ${formatted}`;
}

function formatExtensionInfoLabel(version, lastUpdatedIso) {
  return `${formatExtensionVersionLabel(version)} · ${formatLastUpdatedLabel(lastUpdatedIso)}`;
}

function listChangelogReleases(changelogText) {
  if (typeof changelogText !== "string" || !changelogText.trim()) {
    return [];
  }

  const releases = [];
  let match;
  CHANGELOG_HEADING.lastIndex = 0;
  while ((match = CHANGELOG_HEADING.exec(changelogText)) !== null) {
    const releaseVersion = match[1].trim();
    const date = match[2].trim();
    if (releaseVersion && isValidIsoDate(date)) {
      releases.push({ version: releaseVersion, date });
    }
  }
  return releases;
}

function findChangelogReleaseDate(changelogText, version) {
  const normalizedVersion = String(version ?? "").trim();
  if (!normalizedVersion) {
    return undefined;
  }
  return listChangelogReleases(changelogText).find((entry) => entry.version === normalizedVersion)?.date;
}

function resolveLastUpdatedIsoDate(changelogText, version) {
  const versionMatch = findChangelogReleaseDate(changelogText, version);
  if (versionMatch) {
    return versionMatch;
  }

  const releases = listChangelogReleases(changelogText);
  if (releases.length === 0) {
    return undefined;
  }

  return releases[0].date;
}

function applyReadOnlyMetadataSetting(properties, settingKey, label, order) {
  const setting = properties?.[settingKey];
  if (!setting || typeof label !== "string" || !label.trim()) {
    return;
  }
  setting.default = label;
  delete setting.description;
  delete setting.markdownDescription;
  if (typeof order === "number") {
    setting.order = order;
  }
}

function applyCommentStripSettings(manifest, commentStripModule) {
  if (!commentStripModule) {
    return;
  }

  const {
    buildCommentStripSettingsMarkdown,
    buildCommentStripLanguagesMarkdown,
    buildCommentStripSettingsSummary
  } = commentStripModule;

  const removeComments = findConfigurationSetting(manifest, "export2ai.removeComments");
  if (removeComments && typeof buildCommentStripSettingsMarkdown === "function") {
    removeComments.setting.markdownDescription = buildCommentStripSettingsMarkdown();
    removeComments.setting.description =
      "Remove comments from source files in the zip (per extension; see Comment Strip Languages).";
  }

  const languagesRef = findConfigurationSetting(manifest, "export2ai.commentStripLanguages");
  if (languagesRef) {
    applyReadOnlyMetadataSetting(
      languagesRef.properties,
      "export2ai.commentStripLanguages",
      typeof buildCommentStripSettingsSummary === "function"
        ? buildCommentStripSettingsSummary()
        : undefined,
      1
    );
    if (typeof buildCommentStripLanguagesMarkdown === "function") {
      languagesRef.setting.markdownDescription = buildCommentStripLanguagesMarkdown();
    }
    languagesRef.setting.description =
      "Supported comment syntax families and mapped file extensions (read-only; synced from build).";
  }
}

function applyExtensionMetadataSettings(manifest, changelogText, commentStripModule) {
  const infoEntry = findConfigurationSetting(manifest, EXTENSION_INFO_SETTING);
  if (!infoEntry) {
    return;
  }

  const lastUpdatedIso = resolveLastUpdatedIsoDate(changelogText, manifest.version);
  const infoLabel = formatExtensionInfoLabel(manifest.version, lastUpdatedIso);
  applyReadOnlyMetadataSetting(infoEntry.properties, EXTENSION_INFO_SETTING, infoLabel, -100);

  delete infoEntry.properties[EXTENSION_VERSION_SETTING];
  delete infoEntry.properties[EXTENSION_LAST_UPDATED_SETTING];

  applyCommentStripSettings(manifest, commentStripModule);
}

/** @deprecated Use applyExtensionMetadataSettings */
function applyExtensionVersionSetting(manifest, changelogText = "") {
  applyExtensionMetadataSettings(manifest, changelogText);
}

function readChangelogText(changelogPath) {
  try {
    return fs.readFileSync(changelogPath, "utf8");
  } catch {
    return "";
  }
}

function defaultChangelogPath(rootDir = path.join(__dirname, "..")) {
  return path.join(rootDir, "CHANGELOG.md");
}

module.exports = {
  EXTENSION_INFO_SETTING,
  EXTENSION_VERSION_SETTING,
  EXTENSION_LAST_UPDATED_SETTING,
  formatExtensionVersionLabel,
  formatLastUpdatedLabel,
  formatExtensionInfoLabel,
  isValidIsoDate,
  listChangelogReleases,
  findChangelogReleaseDate,
  resolveLastUpdatedIsoDate,
  applyReadOnlyMetadataSetting,
  applyExtensionMetadataSettings,
  applyCommentStripSettings,
  applyExtensionVersionSetting,
  readChangelogText,
  defaultChangelogPath
};
