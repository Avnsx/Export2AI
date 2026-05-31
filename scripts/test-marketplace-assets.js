const assert = require("assert");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = path.join(__dirname, "..");
const EXPECTED_PUBLISHER = "avnsx";
const EXPECTED_NAME = "export2ai";
const EXPECTED_ICON = "icons/icon-1254x1254.png";
const EXPECTED_ICON_PATH_IN_VSIX = `extension/${EXPECTED_ICON}`;
const EXPECTED_ICON_SIZE = 1254;
const EXPECTED_ICON_ENTRIES = [
  "extension/icons/gh_banner.png",
  EXPECTED_ICON_PATH_IN_VSIX
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function readPngDimensions(buffer) {
  assert.strictEqual(buffer.slice(0, 8).toString("hex"), "89504e470d0a1a0a", "valid PNG signature");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

function readZipEntries(zipPath) {
  const buffer = fs.readFileSync(zipPath);
  const minEnd = Math.max(0, buffer.length - 0xffff - 22);
  let endOffset = -1;

  for (let offset = buffer.length - 22; offset >= minEnd; offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }

  assert(endOffset >= 0, "VSIX contains ZIP end-of-central-directory record");

  const entryCount = buffer.readUInt16LE(endOffset + 10);
  let cursor = buffer.readUInt32LE(endOffset + 16);
  const entries = new Map();

  for (let index = 0; index < entryCount; index++) {
    assert.strictEqual(buffer.readUInt32LE(cursor), 0x02014b50, "valid central-directory header");
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength);

    entries.set(name, {
      method,
      compressedSize,
      uncompressedSize,
      localOffset
    });

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return {
    entries,
    extract(name) {
      const entry = entries.get(name);
      assert(entry, `VSIX contains ${name}`);
      const offset = entry.localOffset;
      assert.strictEqual(buffer.readUInt32LE(offset), 0x04034b50, "valid local-file header");
      const nameLength = buffer.readUInt16LE(offset + 26);
      const extraLength = buffer.readUInt16LE(offset + 28);
      const dataStart = offset + 30 + nameLength + extraLength;
      const compressed = buffer.slice(dataStart, dataStart + entry.compressedSize);

      if (entry.method === 0) {
        return compressed;
      }
      if (entry.method === 8) {
        const inflated = zlib.inflateRawSync(compressed);
        assert.strictEqual(inflated.length, entry.uncompressedSize, `${name} uncompressed size`);
        return inflated;
      }

      throw new Error(`Unsupported ZIP compression method ${entry.method} for ${name}`);
    }
  };
}

const slimManifest = readJson("package.slim.json");
const packageManifest = readJson("package.json");

assert.strictEqual(slimManifest.publisher, EXPECTED_PUBLISHER, "slim manifest publisher");
assert.strictEqual(slimManifest.name, EXPECTED_NAME, "slim manifest name");
assert.strictEqual(packageManifest.publisher, EXPECTED_PUBLISHER, "generated manifest publisher");
assert.strictEqual(packageManifest.name, EXPECTED_NAME, "generated manifest name");
assert.strictEqual(slimManifest.icon, EXPECTED_ICON, "slim manifest uses highest-resolution marketplace icon");
assert.strictEqual(packageManifest.icon, EXPECTED_ICON, "generated manifest uses highest-resolution marketplace icon");

const iconBuffer = fs.readFileSync(path.join(root, EXPECTED_ICON));
const iconDimensions = readPngDimensions(iconBuffer);
assert.deepStrictEqual(
  iconDimensions,
  { width: EXPECTED_ICON_SIZE, height: EXPECTED_ICON_SIZE },
  "marketplace icon is 1254x1254 PNG"
);

const vsixPath = path.join(root, "build", `export2ai-${packageManifest.version}.vsix`);
assert(fs.existsSync(vsixPath), `VSIX exists at ${path.relative(root, vsixPath)}`);

const vsix = readZipEntries(vsixPath);
assert(
  ![...vsix.entries.keys()].some(name => /^extension\/\.env(?:$|\.)/.test(name)),
  "VSIX must not package local env or publishing credential files"
);
assert(vsix.entries.has("extension/package.json"), "VSIX contains extension/package.json");
assert(vsix.entries.has("extension.vsixmanifest"), "VSIX contains extension.vsixmanifest");
assert(vsix.entries.has(EXPECTED_ICON_PATH_IN_VSIX), `VSIX contains ${EXPECTED_ICON_PATH_IN_VSIX}`);
assert.deepStrictEqual(
  [...vsix.entries.keys()].filter(name => name.startsWith("extension/icons/")).sort(),
  EXPECTED_ICON_ENTRIES,
  "VSIX packages only the supported icon asset and README banner"
);

const packagedManifest = JSON.parse(vsix.extract("extension/package.json").toString("utf8"));
assert.strictEqual(packagedManifest.publisher, EXPECTED_PUBLISHER, "packaged manifest publisher");
assert.strictEqual(packagedManifest.name, EXPECTED_NAME, "packaged manifest name");
assert.strictEqual(packagedManifest.icon, EXPECTED_ICON, "packaged manifest icon path matches source");

const packagedVsixManifest = vsix.extract("extension.vsixmanifest").toString("utf8");
assert(
  packagedVsixManifest.includes(`Id="${EXPECTED_NAME}"`),
  "VSIX metadata extension id/name matches package name"
);
assert(
  packagedVsixManifest.includes(`Publisher="${EXPECTED_PUBLISHER}"`),
  "VSIX metadata publisher matches package publisher"
);
assert(
  packagedVsixManifest.includes(`<Icon>${EXPECTED_ICON_PATH_IN_VSIX}</Icon>`),
  "VSIX metadata icon path matches packaged icon"
);
assert(
  packagedVsixManifest.includes(`Type="Microsoft.VisualStudio.Services.Icons.Default" Path="${EXPECTED_ICON_PATH_IN_VSIX}"`),
  "VSIX default icon asset points at packaged icon"
);

const packagedIconDimensions = readPngDimensions(vsix.extract(EXPECTED_ICON_PATH_IN_VSIX));
assert.deepStrictEqual(
  packagedIconDimensions,
  { width: EXPECTED_ICON_SIZE, height: EXPECTED_ICON_SIZE },
  "packaged marketplace icon remains 1254x1254 PNG"
);

console.log("marketplace asset tests passed.");
