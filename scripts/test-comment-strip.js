const assert = require("assert");
const {
  stripCommentsForFile,
  stripCStyleComments
} = require("../out/utils/commentStripper");
const {
  resolveCommentProfile,
  isCommentStrippingSupported
} = require("../out/utils/commentProfiles");

function eq(actual, expected, label) {
  assert.strictEqual(actual, expected, label ?? "assertion failed");
}

function includes(actual, needle, label) {
  assert.ok(actual.includes(needle), `${label ?? "assertion failed"}: missing "${needle}" in:\n${actual}`);
}

function excludes(actual, needle, label) {
  assert.ok(!actual.includes(needle), `${label ?? "assertion failed"}: should not include "${needle}" in:\n${actual}`);
}

// C-family: preserve strings
{
  const input = 'const u = "http://x.com"; // tail\n/* block */ const a = 1;';
  const out = stripCommentsForFile(input, "src/app.ts");
  includes(out, "http://x.com", "URL in string");
  excludes(out, "// tail", "line comment");
  excludes(out, "block", "block comment");
  includes(out, "const a = 1", "code kept");
}

// C-family via deprecated helper
{
  const out = stripCStyleComments("x /* y */ z // end");
  eq(out.trim(), "x  z");
}

// Python: hash comments, preserve shebang
{
  const input = "#!/usr/bin/env python3\nx = 1  # inline\n# full line\ny = 2";
  const out = stripCommentsForFile(input, "main.py");
  includes(out, "#!/usr/bin/env python3", "shebang");
  includes(out, "x = 1", "code line");
  includes(out, "y = 2", "code line 2");
  excludes(out, "full line", "full line comment");
}

// SQL: -- line comments
{
  const input = "SELECT 1 -- comment\nFROM t /* block */ WHERE id = 1";
  const out = stripCommentsForFile(input, "query.sql");
  includes(out, "SELECT 1", "select");
  excludes(out, "comment", "sql line comment");
  excludes(out, "block", "sql block");
}

// HTML
{
  const input = "<div><!-- hidden --><p>ok</p></div>";
  const out = stripCommentsForFile(input, "page.html");
  eq(out, "<div><p>ok</p></div>");
}

// Lua block
{
  const input = "local x = 1 -- line\n--[[ block\nmore ]] end";
  const out = stripCommentsForFile(input, "mod.lua");
  includes(out, "local x = 1", "lua code");
  excludes(out, "block", "lua block");
  excludes(out, "line", "lua line comment");
}

// PowerShell
{
  const input = "$x = 1 # line\n<# block\n#> $y = 2";
  const out = stripCommentsForFile(input, "run.ps1");
  includes(out, "$x = 1", "ps code");
  includes(out, "$y = 2", "ps code 2");
  excludes(out, "line", "ps line");
  excludes(out, "block", "ps block");
}

// Batch REM / ::
{
  const input = "@echo off\r\nREM comment\r\necho ok\r\n:: also\r\n";
  const out = stripCommentsForFile(input, "run.bat");
  includes(out, "echo ok", "batch echo");
  excludes(out, "comment", "batch rem");
  excludes(out, "also", "batch ::");
}

// MATLAB .m heuristic
{
  const matlab = "function y = f(x)\n% doc\ny = x;\nend";
  const objc = "#import <Foundation/Foundation.h>\n// objc comment\n@implementation Foo\n@end";
  const matOut = stripCommentsForFile(matlab, "f.m");
  const objOut = stripCommentsForFile(objc, "Foo.m");
  excludes(matOut, "doc", "matlab percent");
  excludes(objOut, "objc comment", "objc line");
  includes(objOut, "#import", "objc import kept");
}

// Unknown extension unchanged
{
  const input = "// not stripped\n# also\n";
  eq(stripCommentsForFile(input, "notes.txt"), input);
}

// JSON not supported
{
  const input = '{ "a": 1 /* not json */ }';
  eq(stripCommentsForFile(input, "data.json"), input);
}

// Profile resolution smoke
{
  assert.ok(resolveCommentProfile("a.ts"));
  assert.ok(resolveCommentProfile("Dockerfile"));
  assert.ok(isCommentStrippingSupported("main.go"));
  assert.ok(!isCommentStrippingSupported("readme.md"));
}

console.log("test-comment-strip: all assertions passed.");
