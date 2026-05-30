const fs = require("fs");
const path = require("path");
const os = require("os");
const { finished } = require("stream/promises");
const { ZipArchive } = require("archiver");
const ignore = require("ignore");
const { isBinaryFile } = require("isbinaryfile");
const { TokenCounter } = require("../out/utils/tokenCounter");
const { DEFAULT_LLM_MODEL } = require("../out/utils/modelRegistry");
const { buildZipArchiveFileName } = require("../out/utils/modelFormat");

function createIgnoreInstance(patterns, ignoreDotFiles, ignoreDollarFiles = true) {
  const ig = ignore().add(patterns);
  if (ignoreDotFiles) {
    ig.add(".*");
  }
  if (ignoreDollarFiles) {
    ig.add(["$*", "**/$*"]);
  }
  return ig;
}

function isIgnored(ig, relativePath, isDirectory) {
  if (!relativePath) return false;
  const posix = relativePath.split(path.sep).join("/");
  return ig.ignores(isDirectory ? `${posix}/` : posix);
}

const { stripCommentsForFile } = require("../out/utils/commentStripper");

function compressCodeContent(content) {
  return content.split("\n").map(l => l.trim()).filter(Boolean).join("\n");
}

function processContent(content, relativePath, removeComments, compressCode) {
  let out = content;
  if (removeComments) out = stripCommentsForFile(out, relativePath);
  if (compressCode) out = compressCodeContent(out);
  return out;
}

async function readGitignore(root) {
  try {
    return fs.readFileSync(path.join(root, ".gitignore"), "utf8");
  } catch {
    return "";
  }
}

async function collectFiles(sourcePath, workspaceRoot, config, zipOutputPath) {
  const ig = createIgnoreInstance(config.excludePatterns, config.ignoreDotFiles, config.ignoreDollarFiles);
  if (config.ignoreGitIgnore) {
    ig.add(await readGitignore(workspaceRoot));
  }

  const files = [];

  async function walk(current) {
    const relativeDir = path.relative(sourcePath, current).replace(/\\/g, "/");
    if (relativeDir && isIgnored(ig, relativeDir, true)) return;

    for (const entry of await fs.promises.readdir(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      const relative = path.relative(sourcePath, absolute).replace(/\\/g, "/");

      if (isIgnored(ig, relative, entry.isDirectory())) continue;
      if (path.resolve(absolute).toLowerCase() === path.resolve(zipOutputPath).toLowerCase()) continue;

      if (entry.isDirectory()) {
        await walk(absolute);
      } else if (entry.isFile()) {
        const stat = await fs.promises.stat(absolute);
        if (stat.size > config.maxFileSize) {
          files.push({ path: relative, content: `[File too large: ${stat.size} bytes]` });
          continue;
        }

        const buffer = await fs.promises.readFile(absolute);
        if (await isBinaryFile(buffer, stat.size)) {
          files.push({ path: relative, content: "[Binary file content not included]" });
          continue;
        }

        let content = buffer.toString("utf8");
        content = processContent(content, relative, config.removeComments, config.compressCode);
        files.push({ path: relative, content });
      }
    }
  }

  await walk(sourcePath);
  return files;
}

async function createZip(sourcePath, workspaceRoot, config) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseName = path.basename(sourcePath);
  const zipPath = path.join(
    workspaceRoot,
    buildZipArchiveFileName(baseName, config.llmModel, timestamp)
  );
  const files = await collectFiles(sourcePath, workspaceRoot, config, zipPath);
  const combined = files.map(f => f.content).join("\n");
  const tokenInfo = TokenCounter.countTokens(combined, config.llmModel);
  const tokenCount = tokenInfo.inputTokens;

  const output = fs.createWriteStream(zipPath);
  const archive = new ZipArchive({ zlib: { level: config.compressionLevel } });
  archive.pipe(output);

  for (const file of files) {
    archive.append(file.content, { name: file.path });
  }

  archive.append([
    "Export2AI Manifest",
    `Target model: ${config.llmModel}`,
    `Files: ${files.length}`,
    `Estimated tokens: ${tokenCount}`
  ].join("\n"), { name: "_EXPORT2AI_MANIFEST.txt" });

  await archive.finalize();
  await finished(output);

  const stat = fs.statSync(zipPath);
  return { zipPath, files, tokenCount, tokenApproximate: tokenInfo.approximate, size: stat.size };
}

(async () => {
  const workspaceRoot = process.cwd();
  const config = {
    ignoreGitIgnore: true,
    ignoreDotFiles: true,
    ignoreDollarFiles: true,
    excludePatterns: ["node_modules", "*.log", "*.tmp", "dist", "build", "out", "*-chatgpt-context-*.zip", "*-*-context-*.zip"],
    excludePaths: [],
    compressCode: true,
    removeComments: true,
    maxFileSize: 1024 * 1024,
    compressionLevel: 9,
    llmModel: DEFAULT_LLM_MODEL
  };

  console.log("Live test: creating zip from src/ ...");
  const dollarTestPath = path.join(workspaceRoot, "src", "$temp-live-test.txt");
  fs.writeFileSync(dollarTestPath, "should not appear in zip");

  const result = await createZip(path.join(workspaceRoot, "src"), workspaceRoot, config);
  console.log("zip path:", result.zipPath);
  console.log("zip size:", result.size, "bytes");
  console.log("files:", result.files.length);
  console.log("tokens:", result.tokenCount);
  console.log("sample paths:", result.files.slice(0, 5).map(f => f.path));

  const hasNodeModules = result.files.some(f => f.path.includes("node_modules"));
  const hasDotFile = result.files.some(f => path.basename(f.path).startsWith("."));
  const hasDollarFile = result.files.some(f => path.basename(f.path).startsWith("$"));
  const hasTmp = result.files.some(f => f.path.endsWith(".tmp"));
  const srcFile = result.files.find(f => f.path.replace(/\\/g, "/") === "extension.ts");

  const processorFile = result.files.find(f => f.path.replace(/\\/g, "/") === "utils/fileProcessor.ts");

  console.assert(result.size > 0, "zip should not be empty");
  console.assert(!hasNodeModules, "node_modules should be excluded");
  console.assert(!hasDotFile, "dot files should be excluded when ignoreDotFiles=true");
  console.assert(!hasDollarFile, "dollar files should be excluded when ignoreDollarFiles=true");
  console.assert(!hasTmp, "tmp files should be excluded");
  console.assert(srcFile, "extension.ts should be included");
  console.assert(processorFile && !processorFile.content.includes("// Fall through"), "comments should be removed");
  console.assert(result.tokenCount > 0, "token count should be positive");
  console.assert(!result.tokenApproximate, "default tokenizer should be exact (gpt-5.5 o200k)");

  fs.unlinkSync(result.zipPath);
  fs.unlinkSync(dollarTestPath);
  console.log("Live test passed.");
})().catch(err => {
  console.error("Live test failed:", err);
  process.exit(1);
});
