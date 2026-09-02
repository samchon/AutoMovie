// Resolve the scaffold's dependency versions from the monorepo's real package
// manifests and pnpm catalogs. Extracted from syncVersions.ts so the
// repository-local experimental sandbox generator (build/experimental.ts)
// resolves the same versions the published scaffold bakes in, instead of
// parsing the generated src/templateVersions.ts back out or drifting its own
// copy of the catalog rules.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const NEWLINE = String.fromCharCode(10);

const HERE = __dirname;
const ROOT = resolve(HERE, "../../..");

const packageVersion = (relative: string): string => {
  const manifest = JSON.parse(
    readFileSync(resolve(ROOT, relative, "package.json"), "utf8"),
  ) as { version: string };
  return `^${manifest.version}`;
};

const workspaceYaml = (): string =>
  readFileSync(resolve(ROOT, "pnpm-workspace.yaml"), "utf8");

/** Map every YAML anchor (`&name ^1.2.3`) to its version, for alias resolution. */
const anchorMap = (workspace: string): Record<string, string> => {
  const map: Record<string, string> = {};
  for (const line of workspace.split(/\r?\n/)) {
    const match = line.match(/&(\w+)\s+"?([~^]?[\w.-]+)"?/);
    if (match) map[match[1]] = match[2];
  }
  return map;
};

/**
 * Resolve one catalog entry out of a workspace manifest given as text.
 *
 * Split from the read so the rule this repository owns -- indentation scoping,
 * anchor stripping, alias resolution, and the three refusals -- can be driven
 * over a manifest written for the case, rather than only over the one manifest
 * this repository happens to hold today. Asserting against that manifest would
 * pin its current versions and say nothing about the parser: bumping a
 * dependency would break the test, and breaking the parser would not.
 */
export const readCatalogVersion = (props: {
  catalog: string;
  dep: string;
  workspace: string;
}): string => {
  const { catalog, dep, workspace } = props;
  const anchors = anchorMap(workspace);
  const lines = workspace.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${catalog}:`);
  if (start === -1) throw new Error(`catalog "${catalog}" not found`);
  const baseIndent = lines[start].length - lines[start].trimStart().length;
  for (let i = start + 1; i < lines.length; ++i) {
    const line = lines[i];
    if (line.trim().length === 0) continue;
    const indent = line.length - line.trimStart().length;
    if (indent <= baseIndent) break;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().replace(/^"|"$/g, "");
    if (key !== dep) continue;
    // The value may be `^22.19.17`, an anchored `&name ^13.0.2`, an alias
    // `*name`, or a quoted form; strip a leading anchor token, resolve an
    // alias against the anchor map, and drop surrounding quotes.
    const raw = line
      .slice(colon + 1)
      .trim()
      .replace(/^&\S+\s*/, "")
      .replace(/^"|"$/g, "");
    const alias = raw.match(/^\*(\w+)$/);
    if (alias) {
      const resolved = anchors[alias[1]];
      if (resolved === undefined)
        throw new Error(`unresolved YAML alias: ${raw}`);
      return resolved;
    }
    return raw;
  }
  throw new Error(`dependency "${dep}" not found in catalog "${catalog}"`);
};

const catalogVersion = (catalog: string, dep: string): string =>
  readCatalogVersion({ catalog, dep, workspace: workspaceYaml() });

/**
 * Freeze one catalog range to the exact version used by a shipped runtime
 * graph.
 */
const exactCatalogVersion = (catalog: string, dep: string): string =>
  catalogVersion(catalog, dep).replace(/^[~^]/, "");

/**
 * The scaffold's `{{version:*}}` values. `WORKSPACE_TEMPLATE_VERSION_KEYS`
 * names the subset a workspace-local consumer overrides with `workspace:^`.
 */
export const resolveTemplateVersions = (): Record<string, string> => ({
  archetypes: packageVersion("packages/archetypes"),
  cli: packageVersion("packages/cli"),
  engine: packageVersion("packages/engine"),
  evidence: packageVersion("packages/evidence"),
  interface: packageVersion("packages/interface"),
  production: packageVersion("packages/production"),
  render: packageVersion("packages/render"),
  template: packageVersion("packages/template"),
  viewer: packageVersion("packages/viewer"),
  huggingFaceTransformers: exactCatalogVersion(
    "media",
    "@huggingface/transformers",
  ),
  h264Mp4Encoder: catalogVersion("media", "h264-mp4-encoder"),
  kokoroJs: exactCatalogVersion("media", "kokoro-js"),
  libopusWasm: catalogVersion("media", "libopus-wasm"),
  mp4box: catalogVersion("media", "mp4box"),
  onnxruntimeNode: exactCatalogVersion("media", "onnxruntime-node"),
  playwright: catalogVersion("media", "playwright"),
  pngjs: catalogVersion("media", "pngjs"),
  pngjsTypes: catalogVersion("media", "@types/pngjs"),
  three: catalogVersion("three", "three"),
  threeTypes: catalogVersion("three", "@types/three"),
  vite: catalogVersion("vite", "vite"),
  nodeTypes: catalogVersion("utils", "@types/node"),
  ttsc: catalogVersion("typescript", "ttsc"),
  ttscLint: catalogVersion("typescript", "@ttsc/lint"),
  typescript: catalogVersion("typescript", "typescript"),
});

/**
 * The `{{version:*}}` keys that name a package published from this monorepo. A
 * workspace-linked project replaces these with `workspace:^` so it consumes the
 * working tree instead of npm.
 */
export const WORKSPACE_TEMPLATE_VERSION_KEYS = Object.freeze([
  "archetypes",
  "cli",
  "engine",
  "evidence",
  "interface",
  "production",
  "render",
  "template",
  "viewer",
]);

/**
 * The generated module body, from the versions this repository resolved.
 *
 * Unquoted identifier keys and double-quoted values, so the file it writes is
 * already prettier-canonical: `JSON.stringify` quotes its keys and the
 * repository's own `format:check` would flag the result of every sync.
 */
export const renderAutoMovieTemplateVersionsModule = (
  versions: Readonly<Record<string, string>>,
): string =>
  [
    "// GENERATED by build/resolveTemplateVersions.ts from the workspace. Do not edit by hand.",
    "// Bump the package versions / catalog and re-run `pnpm run build:versions`.",
    "",
    "/**",
    " * Dependency versions baked into the scaffold, kept in sync with this repo.",
    " *",
    " * @evidence requirements/agent-authoring/project-ownership.md#agent-portable-authoring Pins the documented toolchain inputs a generated project needs in a new checkout.",
    " * @evidence specifications/authoring-and-authority/source-authority-and-derivation.md#spec-authoring-source-input Emits explicit dependency versions instead of reading undeclared host state.",
    " */",
    "export const AUTOMOVIE_TEMPLATE_VERSIONS: Record<string, string> = {",
    ...Object.entries(versions).map(
      ([key, value]) => `  ${key}: ${JSON.stringify(value)},`,
    ),
    "};",
    "",
  ].join(NEWLINE);

/**
 * Write that module, when this file is the process entry.
 *
 * Guarded so importing it -- which is how its rules are read -- does not write
 * a file. The emit and the resolution live together because a path require of
 * a module that imports a sibling answers with the sibling here (#2224), so a
 * two-file arrangement leaves the importing half unreadable, and the rules in
 * it unread.
 */
if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(__filename)
) {
  const target = resolve(__dirname, "../src/templateVersions.ts");
  writeFileSync(
    target,
    renderAutoMovieTemplateVersionsModule(resolveTemplateVersions()),
    "utf8",
  );
  process.stdout.write(`synced template versions -> ${target}` + NEWLINE);
}
