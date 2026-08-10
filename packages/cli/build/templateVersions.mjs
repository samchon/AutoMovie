// Resolve the scaffold's dependency versions from the monorepo's real package
// manifests and pnpm catalogs. Extracted from sync-versions.mjs so the
// repository-local experimental sandbox generator (internals/experimental.mjs)
// resolves the same versions the published scaffold bakes in, instead of
// parsing the generated src/templateVersions.ts back out or drifting its own
// copy of the catalog rules.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");

const packageVersion = (relative) =>
  `^${JSON.parse(readFileSync(resolve(ROOT, relative, "package.json"), "utf8")).version}`;

const workspaceYaml = () =>
  readFileSync(resolve(ROOT, "pnpm-workspace.yaml"), "utf8");

/** Map every YAML anchor (`&name ^1.2.3`) to its version, for alias resolution. */
const anchorMap = () => {
  const map = {};
  for (const line of workspaceYaml().split(/\r?\n/)) {
    const match = line.match(/&(\w+)\s+"?([~^]?[\w.-]+)"?/);
    if (match) map[match[1]] = match[2];
  }
  return map;
};

const catalogVersion = (catalog, dep) => {
  const workspace = workspaceYaml();
  const anchors = anchorMap();
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

/**
 * Freeze one catalog range to the exact version used by a shipped runtime
 * graph.
 */
const exactCatalogVersion = (catalog, dep) =>
  catalogVersion(catalog, dep).replace(/^[~^]/, "");

/**
 * The scaffold's `{{version:*}}` values. `WORKSPACE_TEMPLATE_VERSION_KEYS`
 * names the subset a workspace-local consumer overrides with `workspace:^`.
 */
export const resolveTemplateVersions = () => ({
  archetypes: packageVersion("packages/archetypes"),
  cli: packageVersion("packages/cli"),
  engine: packageVersion("packages/engine"),
  interface: packageVersion("packages/interface"),
  mcp: packageVersion("packages/mcp"),
  render: packageVersion("packages/render"),
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
  mcpSdk: catalogVersion("modelcontextprotocol", "@modelcontextprotocol/sdk"),
  threeVrm: catalogVersion("three", "@pixiv/three-vrm"),
  playwright: catalogVersion("media", "playwright"),
  pngjs: catalogVersion("media", "pngjs"),
  pngjsTypes: catalogVersion("media", "@types/pngjs"),
  three: catalogVersion("three", "three"),
  threeTypes: catalogVersion("three", "@types/three"),
  vite: catalogVersion("vite", "vite"),
  nodeTypes: catalogVersion("utils", "@types/node"),
  ttsc: catalogVersion("typescript", "ttsc"),
  ttscEvidence: catalogVersion("typescript", "@ttsc/evidence"),
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
  "interface",
  "mcp",
  "render",
  "viewer",
]);
