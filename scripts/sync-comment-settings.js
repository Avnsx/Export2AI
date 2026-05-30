const fs = require("fs");
const path = require("path");
const { applyCommentStripSettings } = require("./extension-metadata");

const root = path.join(__dirname, "..");
const slimPath = path.join(root, "package.slim.json");
const compiledPath = path.join(root, "out", "utils", "commentProfiles.js");

function syncCommentSettings() {
  if (!fs.existsSync(slimPath)) {
    throw new Error("package.slim.json is missing.");
  }
  if (!fs.existsSync(compiledPath)) {
    console.warn("sync-comment-settings: compile first (out/utils/commentProfiles.js missing).");
    return;
  }

  const commentStripModule = require(compiledPath);
  const slim = JSON.parse(fs.readFileSync(slimPath, "utf8"));
  applyCommentStripSettings(slim, commentStripModule);
  fs.writeFileSync(slimPath, `${JSON.stringify(slim, null, 2)}\n`);
  console.log("Synced comment-strip settings into package.slim.json.");
}

if (require.main === module) {
  syncCommentSettings();
}

module.exports = { syncCommentSettings };
