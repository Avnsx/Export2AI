const fs = require("fs");
const path = require("path");

const outMain = path.join(__dirname, "..", "out", "extension.js");

if (!fs.existsSync(outMain)) {
  console.error(
    "Export2AI build output missing (out/extension.js).\nRun: npm run compile"
  );
  process.exit(1);
}
