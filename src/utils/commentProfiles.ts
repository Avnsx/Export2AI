/**
 * Comment syntax profiles keyed by file extension.
 * Source of truth for language-aware comment stripping in zips.
 */

export interface BlockCommentRule {
  open: string;
  close: string;
  /** When true, nested open tokens increase depth (Rust, OCaml, Haskell, PowerShell). */
  nested?: boolean;
}

export interface CommentProfile {
  id: string;
  /** Short label for settings UI */
  label: string;
  linePrefixes: readonly string[];
  blockRules: readonly BlockCommentRule[];
  /** Keep #! interpreter line on line 1 (shell, Python, etc.) */
  preserveShebang?: boolean;
}

/** Extensions mapped to profile id (lowercase, without dot). */
export const EXTENSION_TO_PROFILE: Readonly<Record<string, string>> = {
  c: "c-family",
  cc: "c-family",
  cpp: "c-family",
  cxx: "c-family",
  h: "c-family",
  hpp: "c-family",
  hh: "c-family",
  hxx: "c-family",
  ino: "c-family",
  java: "c-family",
  kt: "c-family",
  kts: "c-family",
  scala: "c-family",
  sc: "c-family",
  groovy: "c-family",
  gradle: "c-family",
  cs: "c-family",
  go: "c-family",
  rs: "c-family",
  swift: "c-family",
  dart: "c-family",
  zig: "c-family",
  js: "c-family",
  jsx: "c-family",
  mjs: "c-family",
  cjs: "c-family",
  ts: "c-family",
  tsx: "c-family",
  vue: "c-family",
  svelte: "c-family",
  glsl: "c-family",
  hlsl: "c-family",
  cu: "c-family",
  cuda: "c-family",
  mm: "c-family",
  m: "c-family",
  jsonc: "c-family",
  json5: "c-family",
  qml: "c-family",
  php: "php",
  phtml: "php",
  php3: "php",
  php4: "php",
  php5: "php",
  phps: "php",
  py: "hash",
  pyw: "hash",
  pyi: "hash",
  pyx: "hash",
  sh: "hash",
  bash: "hash",
  zsh: "hash",
  fish: "hash",
  rb: "hash",
  rake: "hash",
  gemspec: "hash",
  pl: "hash",
  pm: "hash",
  r: "hash",
  yaml: "hash",
  yml: "hash",
  toml: "hash",
  tf: "hash",
  tfvars: "hash",
  hcl: "hash",
  ex: "hash",
  exs: "hash",
  jl: "hash",
  cr: "hash",
  nim: "hash",
  coffee: "hash",
  awk: "hash",
  sed: "hash",
  graphql: "hash",
  gql: "hash",
  dockerfile: "hash",
  containerfile: "hash",
  makefile: "hash",
  mk: "hash",
  cmake: "hash",
  v: "hash",
  sv: "hash",
  svh: "hash",
  prql: "hash",
  snakemake: "hash",
  smk: "hash",
  rkt: "hash",
  racket: "hash",
  clj: "hash",
  cljs: "hash",
  cljc: "hash",
  edn: "hash",
  el: "hash",
  lsp: "hash",
  pro: "hash",
  prolog: "hash",
  conf: "hash",
  cfg: "hash",
  ini: "hash",
  properties: "hash",
  env: "hash",
  gitignore: "hash",
  gitattributes: "hash",
  gitmodules: "hash",
  editorconfig: "hash",
  nix: "hash",
  asm: "semicolon",
  s: "semicolon",
  il: "semicolon",
  sql: "sql",
  mysql: "sql",
  pgsql: "sql",
  psql: "sql",
  plsql: "sql",
  ddl: "sql",
  dml: "sql",
  eql: "sql",
  cql: "sql",
  html: "html",
  htm: "html",
  xhtml: "html",
  xml: "html",
  xsd: "html",
  xsl: "html",
  xslt: "html",
  svg: "html",
  xaml: "html",
  csproj: "html",
  vbproj: "html",
  fsproj: "html",
  props: "html",
  targets: "html",
  wxs: "html",
  wxl: "html",
  ftl: "html",
  vm: "html",
  css: "css",
  scss: "css",
  sass: "css",
  less: "css",
  styl: "css",
  lua: "lua",
  hs: "haskell",
  lhs: "haskell",
  ml: "ocaml",
  mli: "ocaml",
  mll: "ocaml",
  mly: "ocaml",
  fun: "ocaml",
  sig: "ocaml",
  fs: "ocaml",
  fsx: "ocaml",
  fsxi: "ocaml",
  vb: "vb",
  vbs: "vb",
  bas: "vb",
  mat: "matlab",
  octave: "matlab",
  erl: "erlang",
  hrl: "erlang",
  ps1: "powershell",
  psm1: "powershell",
  psd1: "powershell",
  bat: "batch",
  cmd: "batch",
  lisp: "lisp",
  scm: "lisp",
  ss: "lisp",
  vim: "vim",
  tex: "latex",
  latex: "latex",
  sty: "latex",
  cls: "latex",
  bib: "latex",
  bbl: "latex"
};

export const COMMENT_PROFILES: Readonly<Record<string, CommentProfile>> = {
  "c-family": {
    id: "c-family",
    label: "C, C++, C#, Java, JavaScript, TypeScript, Go, Rust, Swift, Kotlin, …",
    linePrefixes: ["//"],
    blockRules: [{ open: "/*", close: "*/" }],
    preserveShebang: false
  },
  php: {
    id: "php",
    label: "PHP",
    linePrefixes: ["//", "#"],
    blockRules: [{ open: "/*", close: "*/" }],
    preserveShebang: false
  },
  hash: {
    id: "hash",
    label: "Python, Ruby, Shell, Perl, YAML, TOML, Terraform, Dockerfile, …",
    linePrefixes: ["#"],
    blockRules: [],
    preserveShebang: true
  },
  semicolon: {
    id: "semicolon",
    label: "Assembly (GAS/NASM-style)",
    linePrefixes: [";"],
    blockRules: [],
    preserveShebang: false
  },
  sql: {
    id: "sql",
    label: "SQL, MySQL, PostgreSQL, PL/SQL",
    linePrefixes: ["--"],
    blockRules: [{ open: "/*", close: "*/" }],
    preserveShebang: false
  },
  html: {
    id: "html",
    label: "HTML, XML, SVG, XAML, MSBuild project files",
    linePrefixes: [],
    blockRules: [{ open: "<!--", close: "-->" }],
    preserveShebang: false
  },
  css: {
    id: "css",
    label: "CSS, SCSS, Sass, Less",
    linePrefixes: [],
    blockRules: [{ open: "/*", close: "*/" }],
    preserveShebang: false
  },
  lua: {
    id: "lua",
    label: "Lua",
    linePrefixes: ["--"],
    blockRules: [{ open: "--[[", close: "]]" }],
    preserveShebang: false
  },
  haskell: {
    id: "haskell",
    label: "Haskell",
    linePrefixes: ["--"],
    blockRules: [{ open: "{-", close: "-}", nested: true }],
    preserveShebang: false
  },
  ocaml: {
    id: "ocaml",
    label: "OCaml, F#, Standard ML",
    linePrefixes: [],
    blockRules: [{ open: "(*", close: "*)", nested: true }],
    preserveShebang: false
  },
  vb: {
    id: "vb",
    label: "Visual Basic, VBScript",
    linePrefixes: ["'"],
    blockRules: [],
    preserveShebang: false
  },
  matlab: {
    id: "matlab",
    label: "MATLAB, Octave",
    linePrefixes: ["%"],
    blockRules: [{ open: "%{", close: "}%" }],
    preserveShebang: false
  },
  erlang: {
    id: "erlang",
    label: "Erlang",
    linePrefixes: ["%"],
    blockRules: [],
    preserveShebang: false
  },
  powershell: {
    id: "powershell",
    label: "PowerShell",
    linePrefixes: ["#"],
    blockRules: [{ open: "<#", close: "#>", nested: true }],
    preserveShebang: false
  },
  batch: {
    id: "batch",
    label: "Windows Batch (.bat, .cmd)",
    linePrefixes: [],
    blockRules: [],
    preserveShebang: false
  },
  lisp: {
    id: "lisp",
    label: "Lisp, Scheme, Racket",
    linePrefixes: [";"],
    blockRules: [],
    preserveShebang: false
  },
  vim: {
    id: "vim",
    label: "Vim script",
    linePrefixes: ['"'],
    blockRules: [],
    preserveShebang: false
  },
  latex: {
    id: "latex",
    label: "LaTeX, TeX, BibTeX",
    linePrefixes: ["%"],
    blockRules: [],
    preserveShebang: false
  }
};

/** Human-readable groups for extension settings (stable order). */
export const COMMENT_STRIP_SETTINGS_GROUPS: readonly {
  profileId: string;
  syntax: string;
  languages: string;
}[] = [
  { profileId: "c-family", syntax: "`//` · `/* */`", languages: COMMENT_PROFILES["c-family"].label },
  { profileId: "php", syntax: "`//` · `#` · `/* */`", languages: COMMENT_PROFILES.php.label },
  { profileId: "hash", syntax: "`#`", languages: COMMENT_PROFILES.hash.label },
  { profileId: "semicolon", syntax: "`;`", languages: COMMENT_PROFILES.semicolon.label },
  { profileId: "sql", syntax: "`--` · `/* */`", languages: COMMENT_PROFILES.sql.label },
  { profileId: "html", syntax: "`<!-- -->`", languages: COMMENT_PROFILES.html.label },
  { profileId: "css", syntax: "`/* */`", languages: COMMENT_PROFILES.css.label },
  { profileId: "lua", syntax: "`--` · `--[[ ]]`", languages: COMMENT_PROFILES.lua.label },
  { profileId: "haskell", syntax: "`--` · `{- -}`", languages: COMMENT_PROFILES.haskell.label },
  { profileId: "ocaml", syntax: "`(* *)`", languages: COMMENT_PROFILES.ocaml.label },
  { profileId: "vb", syntax: "`'`", languages: COMMENT_PROFILES.vb.label },
  { profileId: "matlab", syntax: "`%` · `%{ %}`", languages: COMMENT_PROFILES.matlab.label },
  { profileId: "erlang", syntax: "`%`", languages: COMMENT_PROFILES.erlang.label },
  { profileId: "powershell", syntax: "`#` · `<# #>`", languages: COMMENT_PROFILES.powershell.label },
  { profileId: "batch", syntax: "`REM` · `::` (line start)", languages: COMMENT_PROFILES.batch.label },
  { profileId: "lisp", syntax: "`;`", languages: COMMENT_PROFILES.lisp.label },
  { profileId: "vim", syntax: "`\"`", languages: COMMENT_PROFILES.vim.label },
  { profileId: "latex", syntax: "`%`", languages: COMMENT_PROFILES.latex.label }
];

function extensionsForProfile(profileId: string): string[] {
  return Object.entries(EXTENSION_TO_PROFILE)
    .filter(([, id]) => id === profileId)
    .map(([ext]) => ext)
    .sort((a, b) => a.localeCompare(b));
}

function formatExtensionSample(profileId: string, max = 10): string {
  const exts = extensionsForProfile(profileId);
  if (exts.length === 0) {
    return "—";
  }
  const shown = exts.slice(0, max).map((ext) => `\`.${ext}\``);
  const rest = exts.length - max;
  return rest > 0 ? `${shown.join(", ")}, +${rest} more` : shown.join(", ");
}

export function buildCommentStripSettingsMarkdown(): string {
  const totalExts = Object.keys(EXTENSION_TO_PROFILE).length;
  return [
    "When enabled, Export2AI removes comments **per file extension** before adding source files to the zip.",
    "",
    "The stripper is **string-aware**: line comments, block comments, and nested blocks are handled per syntax family. String literals, template literals, and shebang lines are preserved where possible.",
    "",
    `**${COMMENT_STRIP_SETTINGS_GROUPS.length} syntax families** cover **${totalExts} extensions** (plus special names like \`Dockerfile\` and \`Makefile\`).`,
    "",
    "Plain text, `.json`, `.md`, and unknown extensions are **not** modified.",
    "",
    "See **Comment Strip Languages** below for the full per-family extension map."
  ].join("\n");
}

export function buildCommentStripLanguagesMarkdown(): string {
  const totalExts = Object.keys(EXTENSION_TO_PROFILE).length;
  const lines = [
    "Read-only reference synced at build time from `commentProfiles.ts`. Export2AI picks a syntax family from the file extension (or special filename) and applies the matching comment rules when **Remove Comments** is on.",
    "",
    `**${COMMENT_STRIP_SETTINGS_GROUPS.length} syntax families · ${totalExts} mapped extensions**`,
    "",
    "| Comment syntax | Languages | Example extensions |",
    "|----------------|-----------|---------------------|"
  ];
  for (const group of COMMENT_STRIP_SETTINGS_GROUPS) {
    const count = extensionsForProfile(group.profileId).length;
    const langs = `${group.languages} (${count})`;
    lines.push(`| ${group.syntax} | ${langs} | ${formatExtensionSample(group.profileId)} |`);
  }
  lines.push(
    "",
    "**Also recognized (no dot extension):** `Dockerfile`, `Makefile`, `CMakeLists.txt`, `.env*`.",
    "",
    "**Never stripped:** `.json`, `.md`, plain text, binary files, and extensions not listed above.",
    "",
    "**Limitations:** nested strings, regex literals, and some edge-case encodings may still lose inner text; JSON-with-comments (`.jsonc`) uses the C-family profile."
  );
  return lines.join("\n");
}

export function buildCommentStripSettingsSummary(): string {
  const totalExts = Object.keys(EXTENSION_TO_PROFILE).length;
  return `${COMMENT_STRIP_SETTINGS_GROUPS.length} syntax families · ${totalExts} file extensions (see description below for full map)`;
}

export function getExtensionKey(relativePath: string): string | undefined {
  const base = relativePath.split(/[/\\]/).pop() ?? relativePath;
  const lower = base.toLowerCase();

  if (lower === "dockerfile" || lower.startsWith("dockerfile.")) {
    return "dockerfile";
  }
  if (lower === "makefile" || lower.startsWith("makefile.")) {
    return "makefile";
  }
  if (lower === "cmakelists.txt") {
    return "cmake";
  }
  if (lower.startsWith(".env")) {
    return "env";
  }

  const dot = lower.lastIndexOf(".");
  if (dot <= 0) {
    return undefined;
  }
  return lower.slice(dot + 1);
}

export function resolveCommentProfile(relativePath: string): CommentProfile | undefined {
  const ext = getExtensionKey(relativePath);
  if (!ext) {
    return undefined;
  }
  const profileId = EXTENSION_TO_PROFILE[ext];
  if (!profileId) {
    return undefined;
  }
  return COMMENT_PROFILES[profileId];
}

export function isCommentStrippingSupported(relativePath: string): boolean {
  return resolveCommentProfile(relativePath) !== undefined;
}
