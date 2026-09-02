// Resolve the scaffold's dependency versions from the monorepo's real package
// manifests and pnpm catalogs. Extracted from syncVersions.ts so the
// repository-local experimental sandbox generator (build/experimental.ts)
// resolves the same versions the published scaffold bakes in, instead of
// parsing the generated src/templateVersions.ts back out or drifting its own
// copy of the catalog rules.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { readCatalogVersion } from "./catalogVersion";

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
