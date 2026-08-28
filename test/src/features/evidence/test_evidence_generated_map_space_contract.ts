import { renderScaffold, writeFiles } from "@automovie/template";
import { TestValidator } from "@nestia/e2e";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

interface ILintResult {
  output: string;
  status: number;
}

interface IFixtureFailure {
  error: unknown;
}

type EvidenceOwner = "map" | "map-source" | "space" | "space-source";

class GeneratedMapSpaceFixtureCleanupError extends AggregateError {}

const ROOT = path.resolve(__dirname, "../../../..");
const TTSC = path.join(ROOT, "node_modules/ttsc/lib/launcher/ttsc.js");
const FIXTURE_CACHE = path.join(ROOT, "test/node_modules/.cache");
const TTSC_CACHE = path.join(ROOT, "node_modules/.cache/ttsc");
const CLAIM_NAMES = [
  "maps H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work",
  "spaces H2 units answer their principle checklists, cover the layer's obligations, and account for inherited work",
  "mapSources owners each answer exactly one maps design file",
  "mapSources owners answer source-unit principle checklists, realize every maps unit, and cover source obligations",
  "spaceSources owners each answer exactly one spaces design file",
  "spaceSources owners answer source-unit principle checklists, realize every spaces unit, and cover source obligations",
] as const;
const SETTINGS_TARGET = "settings/production.md#production-contract";
const MAP_TARGET = "maps/world.md#site-boundary-and-access";
const SPACE_TARGET = "spaces/building.md#building-inside-site";

const COMMON_PRINCIPLES = [
  "principles/core/common.md#scope-preservation",
  "principles/core/common.md#substantive-completion",
  "principles/core/common.md#machine-default",
  "principles/core/common.md#evidence-content-conformance",
  "principles/core/common.md#declared-basis",
] as const;
const COMMON_OBLIGATIONS = [
  "obligations/core/common.md#purpose-fit",
  "obligations/core/common.md#layer-boundary",
  "obligations/core/common.md#production-language",
  "obligations/core/common.md#proportionate-development",
] as const;
const MAP_PRINCIPLES = [
  "principles/design/maps.md#map-addressable-world-identity",
  "principles/design/maps.md#map-information-structure",
  "principles/design/maps.md#map-coordinate-extent-scale",
  "principles/design/maps.md#map-verification-address",
] as const;
const MAP_OBLIGATIONS = [
  "obligations/design/maps.md#addressable-map-decisions",
  "obligations/design/maps.md#map-world-site-interface",
  "obligations/design/maps.md#map-world-content-relations",
  "obligations/design/maps.md#map-world-temporal-state",
  "obligations/design/maps.md#map-world-scale-partition",
  "obligations/design/maps.md#map-world-source-resolution",
  "obligations/design/maps.md#map-review-set",
] as const;
const SPACE_PRINCIPLES = [
  "principles/design/spaces.md#space-information-structure",
  "principles/design/spaces.md#space-topology",
  "principles/design/spaces.md#space-boundary-authority",
  "principles/design/spaces.md#space-verification-address",
] as const;
const SPACE_OBLIGATIONS = [
  "obligations/design/spaces.md#addressable-spatial-decisions",
  "obligations/design/spaces.md#space-reference-topology",
  "obligations/design/spaces.md#space-envelope-interface",
  "obligations/design/spaces.md#space-access-circulation",
  "obligations/design/spaces.md#space-review-set",
] as const;
const SOURCE_PRINCIPLES = [
  "principles/core/source-units.md#source-scope-preservation",
  "principles/core/source-units.md#source-substantive-completion",
  "principles/core/source-units.md#source-evidence-content-conformance",
] as const;
const INHERITED_PRINCIPLE =
  "principles/core/inherited-units.md#derived-parent-differentiation";
const MAP_UPSTREAM = "upstream/design/maps.md#settings-revision-from-map-work";
const SPACE_UPSTREAM =
  "upstream/design/spaces.md#settings-and-map-revision-from-space-work";
const MAP_SOURCE_UPSTREAM =
  "upstream/design/map-sources.md#design-revision-from-map-source-work";
const SPACE_SOURCE_UPSTREAM =
  "upstream/design/space-sources.md#design-revision-from-space-source-work";
const UPSTREAM_TARGETS = new Set<string>([
  MAP_UPSTREAM,
  SPACE_UPSTREAM,
  MAP_SOURCE_UPSTREAM,
  SPACE_SOURCE_UPSTREAM,
]);
const MAP_SOURCE_OBLIGATIONS = [
  "obligations/design/map-sources.md#map-source-design-ownership",
  "obligations/design/map-sources.md#map-source-deterministic-world",
  "obligations/design/map-sources.md#map-source-preserved-lineage",
  "obligations/design/map-sources.md#map-source-invalid-world",
] as const;
const SPACE_SOURCE_OBLIGATIONS = [
  "obligations/design/space-sources.md#space-source-design-ownership",
  "obligations/design/space-sources.md#space-source-stable-identities",
  "obligations/design/space-sources.md#space-source-invalid-topology",
] as const;

const MAP_TARGETS = [
  ...COMMON_PRINCIPLES,
  INHERITED_PRINCIPLE,
  ...MAP_PRINCIPLES,
  ...COMMON_OBLIGATIONS,
  ...MAP_OBLIGATIONS,
  MAP_UPSTREAM,
  SETTINGS_TARGET,
] as const;
const SPACE_TARGETS = [
  ...COMMON_PRINCIPLES,
  INHERITED_PRINCIPLE,
  ...SPACE_PRINCIPLES,
  ...COMMON_OBLIGATIONS,
  ...SPACE_OBLIGATIONS,
  SPACE_UPSTREAM,
  SETTINGS_TARGET,
  MAP_TARGET,
] as const;
const MAP_SOURCE_TARGETS = [
  ...SOURCE_PRINCIPLES,
  MAP_SOURCE_UPSTREAM,
  ...MAP_SOURCE_OBLIGATIONS,
  "maps/world.md",
  MAP_TARGET,
] as const;
const SPACE_SOURCE_TARGETS = [
  ...SOURCE_PRINCIPLES,
  SPACE_SOURCE_UPSTREAM,
  ...SPACE_SOURCE_OBLIGATIONS,
  "spaces/building.md",
  SPACE_TARGET,
] as const;

const TARGET_REASONS: Readonly<Record<string, string>> = {
  "scope-preservation":
    "The owner keeps the complete boundary, access, topology, or realization assigned to it without hiding a sibling decision.",
  "substantive-completion":
    "The owner contains coordinates, identities, dimensions, failure conditions, and observations as a complete artifact rather than a heading or promise.",
  "machine-default":
    "The owner uses direct project terms, exact identifiers, and measured values instead of formulaic filler or ornamental restatement.",
  "evidence-content-conformance":
    "Every annotation names the concrete boundary, access node, route, source value, or verification result that the host actually contains.",
  "declared-basis":
    "The owner traces its world extent and coordinate convention to settings and leaves only its own map or space decisions local.",
  "purpose-fit":
    "The owner supplies the site interface or building topology needed by this focused library delivery.",
  "layer-boundary":
    "Map owns the site boundary and external road, while space owns the building and circulation inside the adopted boundary.",
  "production-language":
    "The owner uses the declared English working language while preserving exact ids, coordinates, and metre dimensions.",
  "proportionate-development":
    "One focused unit develops the single site interface or building topology at the detail its downstream consumer needs.",
  "map-addressable-world-identity":
    "The world, site boundary, external road, and access node each have stable ids and independently citable coordinates.",
  "map-information-structure":
    "The map unit separates extent, site interface, world state, derivation, and falsifying review conditions.",
  "map-coordinate-extent-scale":
    "The map fixes a right-handed metre frame, a 200 by 200 metre extent, one site polygon, and one access point in that frame.",
  "map-verification-address":
    "The map names a top view, boundary containment check, and route-node query that can falsify its claims.",
  "addressable-map-decisions":
    "The map population gives the focused world's site interface one stable H2 address.",
  "map-world-site-interface":
    "The map owns the site polygon and road-access node and identifies both as the interface consumed by the building space.",
  "map-world-content-relations":
    "The external road terminates at the named access node on the site edge and remains outside the building topology.",
  "map-world-temporal-state":
    "The resolved world records one fixed clear-noon state so no hidden time or weather state alters the interface.",
  "map-world-scale-partition":
    "The focused 200 metre world uses one declared cell and keeps the 40 by 30 metre site boundary within it.",
  "map-world-source-resolution":
    "The world is authored from exact fixture coordinates with no external asset, transform, or unstated conversion loss.",
  "map-review-set":
    "The review set checks the top view, boundary containment, road connection, access-node identity, and fixed world state.",
  "space-information-structure":
    "The space unit separates adopted site facts, envelope, opening, route, dimensions, and falsifying observations.",
  "space-topology":
    "The building, room, opening, and route form one explicit containment and adjacency graph.",
  "space-boundary-authority":
    "The building stays inside the adopted map boundary and consumes its access node without redefining either world feature.",
  "space-verification-address":
    "Plan, section, entry traversal, and clear-dimension checks can each falsify the building unit.",
  "addressable-spatial-decisions":
    "The space population gives the building topology and access route one stable H2 address.",
  "space-reference-topology":
    "The site, building, room, opening, and route keep stable ids and explicit containment and adjacency.",
  "space-envelope-interface":
    "The exterior door is the sole envelope opening at the interior end of the adopted access interface.",
  "space-access-circulation":
    "A continuous 1.2 metre clear route runs from the map access node through the door into the room.",
  "space-review-set":
    "The review set includes plan, section, exterior, interior, and entry traversal observations with explicit failure cases.",
  "source-scope-preservation":
    "The export realizes only its reviewed map or space owner and includes every identity and relation assigned to that source.",
  "source-substantive-completion":
    "The export builds a deterministic world or building record with coordinates, ids, references, and explicit validation bounds.",
  "source-evidence-content-conformance":
    "The export citations name the exact design, deterministic fields, lineage, and refusal behavior implemented by the value.",
  "map-source-design-ownership":
    "The map export serializes the one reviewed site-interface design and invents no building topology.",
  "map-source-deterministic-world":
    "The same literal coordinates always produce the same world extent, boundary polygon, road, access node, and state.",
  "map-source-preserved-lineage":
    "The export preserves authored ids, coordinate basis, source status, and the dependency from road to access node.",
  "map-source-invalid-world":
    "createSiteMap refuses a non-quadrilateral boundary, an out-of-extent point, or a road that does not terminate at the declared access node.",
  "space-source-design-ownership":
    "The space export serializes the one reviewed building design and reads the map-owned access identity instead of replacing it.",
  "space-source-stable-identities":
    "The building, room, door, route, and external access reference remain stable across equal executions.",
  "space-source-invalid-topology":
    "createBuildingSpace refuses the wrong access id, a footprint outside the adopted boundary, and a route below either clear-dimension limit.",
  "settings-revision-from-map-work":
    "The map checked the settings-owned metre frame, extent, access requirement, and clear-noon state; all were sufficient for the resolved boundary and external road.",
  "settings-and-map-revision-from-space-work":
    "The space checked its settings clearance rule and the map-owned site boundary and access node; all supported the footprint, door, and route without repair.",
  "design-revision-from-map-source-work":
    "createSiteMap implemented the reviewed coordinates, identities, extent, state, and invalid-world cases without inventing or repairing a parent decision.",
  "design-revision-from-space-source-work":
    "createBuildingSpace implemented the reviewed footprint, opening, route, access identity, clear dimensions, and invalid-topology cases without repairing a parent.",
};

/** Preserve the primary fixture failure when recursive cleanup fails too. */
const preserveFixtureCleanup = (
  failure: IFixtureFailure | undefined,
  cleanup: () => unknown,
): void => {
  try {
    cleanup();
  } catch (cleanupFailure) {
    if (failure === undefined) throw cleanupFailure;
    throw new GeneratedMapSpaceFixtureCleanupError(
      [failure.error, cleanupFailure],
      "Generated map-space cleanup failed after the test failed.",
    );
  }
};

/** Replace one exact fixture anchor and refuse an absent or duplicate anchor. */
const replaceOnce = (source: string, before: string, after: string): string => {
  const first = source.indexOf(before);
  assert.notEqual(first, -1, `Fixture text did not contain '${before}'.`);
  assert.equal(
    source.indexOf(before, first + before.length),
    -1,
    `Fixture text contained '${before}' more than once.`,
  );
  return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
};

const anchorOf = (target: string): string =>
  target.includes("#") ? target.slice(target.indexOf("#") + 1) : target;

/** Give every focused citation a concrete semantic reason. */
const reasonOf = (owner: EvidenceOwner, target: string): string => {
  if (target === INHERITED_PRINCIPLE)
    return owner === "map"
      ? "The map resolves the settings-owned extent and metre frame into its own boundary, road, access identities, state, and falsifying observations."
      : "The space resolves the adopted map boundary and access identity into its own footprint, opening, containment, route, clear dimensions, and observations.";
  if (target === SETTINGS_TARGET)
    return owner === "map"
      ? "The map adopts the settings-owned library extent, metre frame, and fixed clear-noon review condition."
      : "The space adopts the settings-owned library purpose, metre frame, and required continuous entry route.";
  if (target === MAP_TARGET)
    return owner === "space"
      ? "The building consumes site-access-east from the map-owned east boundary without restating its road or world coordinates."
      : "createSiteMap realizes the reviewed site polygon, external road, and site-access-east interface exactly.";
  if (target === SPACE_TARGET)
    return "createBuildingSpace realizes the reviewed footprint, envelope opening, room, and continuous route from site-access-east.";
  if (target === "maps/world.md")
    return "createSiteMap has exactly one design owner: the complete maps/world.md file.";
  if (target === "spaces/building.md")
    return "createBuildingSpace has exactly one design owner: the complete spaces/building.md file.";
  const reason = TARGET_REASONS[anchorOf(target)];
  assert.ok(reason, `No evidence reason exists for ${target}.`);
  return reason;
};

/** Render one Markdown evidence block with review prose but no guessed digest. */
const markdownEvidence = (
  owner: EvidenceOwner,
  targets: readonly string[],
): string =>
  [
    "<!--",
    ...targets.flatMap((target) => {
      const prefix = UPSTREAM_TARGETS.has(target)
        ? "@evidenceExclude"
        : "@evidence";
      return [
        `${prefix} ${target} ${reasonOf(owner, target)}`,
        `${prefix}Review ${target} Reviewed ${target} against the complete ${owner} owner: ${reasonOf(owner, target)}`,
      ];
    }),
    "-->",
  ].join("\n");

/** Render one TypeScript JSDoc block with the same evidence discipline. */
const sourceEvidence = (
  owner: EvidenceOwner,
  targets: readonly string[],
): string =>
  [
    "/**",
    ...targets.flatMap((target) => {
      const prefix = UPSTREAM_TARGETS.has(target)
        ? "@evidenceExclude"
        : "@evidence";
      return [
        ` * ${prefix} ${target} ${reasonOf(owner, target)}`,
        ` * ${prefix}Review ${target} Reviewed ${target} against the complete ${owner} owner: ${reasonOf(owner, target)}`,
      ];
    }),
    " */",
  ].join("\n");

/** Materialize the one setting and two design owners used by this probe. */
const writeDesign = (root: string): void => {
  const files: Readonly<Record<string, string>> = {
    "docs/settings/production.md": [
      "# Map-space contract settings",
      "",
      "## Production contract {#production-contract}",
      "",
      "This library delivers one deterministic building and its site interface in a right-handed metre frame. The judged world is a 200 by 200 metre clear-noon extent; the building must preserve one continuous 1.2 metre clear route from the external road into its room.",
      "",
    ].join("\n"),
    "docs/maps/world.md": [
      "# Focused world map",
      "",
      "## Site boundary and access {#site-boundary-and-access}",
      "",
      markdownEvidence("map", MAP_TARGETS),
      "",
      "The world uses positive X east, positive Y up, and positive Z north in metres over x=-100..100 and z=-100..100. One resolved cell owns the 40 by 30 metre site polygon with corners (-20,-15), (20,-15), (20,15), and (-20,15). The site, road, and access identities are `site-main`, `road-east`, and `site-access-east`.",
      "",
      "The external road runs from (100,0) to (20,0) in the XZ plane and terminates at `site-access-east` on the site's east edge. The state is fixed to clear noon, all coordinates are authored without an external transform, and the building space consumes the node while map retains the boundary and road.",
      "",
      "Review the top view, assert every boundary point lies in the declared world cell, and query that `road-east` terminates exactly once at `site-access-east`. A shifted boundary, disconnected road, duplicate node, hidden transform, or non-clear-noon state falsifies this unit.",
      "",
    ].join("\n"),
    "docs/spaces/building.md": [
      "# Building space",
      "",
      "## Building inside site {#building-inside-site}",
      "",
      markdownEvidence("space", SPACE_TARGETS),
      "",
      "The 12 by 8 metre building footprint lies inside `site-main`; its east door is the sole envelope opening and has `site-access-east` as its external endpoint. Inside, `room-main` occupies the enclosed footprint and `entry-route` joins the door to the room centre with 1.2 metre clear width and 2.1 metre clear height.",
      "",
      "The space does not redefine the site polygon, external road, or access-node coordinates. Review plan, section, east elevation, interior perspective, and an entry traversal. A footprint outside the adopted boundary, a different access id, a broken containment edge, a blocked route, or a sub-limit clear dimension falsifies this unit.",
      "",
    ].join("\n"),
  };
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, "utf8");
  }
  const contracts = path.join(root, "docs/contracts/index.md");
  fs.writeFileSync(
    contracts,
    [
      "<!--",
      "@evidenceExclude discovery/core/common.md#shared-local-boundary The focused settings, map, space, and source owners were checked for subject-specific rules; their complete site-interface contract is already owned by the selected shared targets, so no independent production rule remains.",
      "-->",
      "",
      "# Focused discovery audit",
      "",
    ].join("\n"),
    "utf8",
  );
};

/** Materialize deterministic map source and its actual space consumer. */
const writeSources = (root: string): void => {
  const mapSource = [
    "interface IMapCandidate {",
    "  boundary: readonly (readonly [number, number])[];",
    "  road: readonly (readonly [number, number])[];",
    "  access: readonly [number, number];",
    "}",
    "",
    "const DEFAULT_MAP: IMapCandidate = {",
    "  boundary: [",
    "    [-20, -15],",
    "    [20, -15],",
    "    [20, 15],",
    "    [-20, 15],",
    "  ],",
    "  road: [",
    "    [100, 0],",
    "    [20, 0],",
    "  ],",
    "  access: [20, 0],",
    "};",
    "",
    sourceEvidence("map-source", MAP_SOURCE_TARGETS),
    "export function createSiteMap(candidate: IMapCandidate = DEFAULT_MAP) {",
    "  if (candidate.boundary.length !== 4)",
    '    throw new Error("site-main boundary must contain exactly four points");',
    "  if (",
    "    [...candidate.boundary, ...candidate.road, candidate.access].some(",
    "      ([x, z]) => x < -100 || x > 100 || z < -100 || z > 100,",
    "    )",
    "  )",
    '    throw new Error("world-main coordinate lies outside its declared extent");',
    "  const terminus = candidate.road[candidate.road.length - 1];",
    "  if (",
    "    terminus === undefined ||",
    "    terminus[0] !== candidate.access[0] ||",
    "    terminus[1] !== candidate.access[1]",
    "  )",
    '    throw new Error("road-east does not terminate at site-access-east");',
    "  return {",
    '    id: "world-main",',
    '    coordinateSystem: "right-handed-x-east-y-up-z-north-metres",',
    "    extent: { minX: -100, maxX: 100, minZ: -100, maxZ: 100 },",
    '    state: "clear-noon",',
    "    site: {",
    '      id: "site-main",',
    "      boundary: candidate.boundary,",
    "      externalAccessNode: {",
    '        id: "site-access-east",',
    "        point: candidate.access,",
    '        roadId: "road-east",',
    "      },",
    "    },",
    "    roads: [",
    "      {",
    '        id: "road-east",',
    "        points: candidate.road,",
    '        terminusNodeId: "site-access-east",',
    "      },",
    "    ] as const,",
    '    source: { kind: "authored", transform: null, conversionLoss: null },',
    "  } as const;",
    "}",
    "",
  ].join("\n");
  const spaceSource = [
    'import { createSiteMap } from "../maps/world";',
    "",
    "type SiteMap = ReturnType<typeof createSiteMap>;",
    "",
    sourceEvidence("space-source", SPACE_SOURCE_TARGETS),
    "export function createBuildingSpace(",
    "  siteMap: SiteMap = createSiteMap(),",
    "  clearWidthMetres = 1.2,",
    "  clearHeightMetres = 2.1,",
    ") {",
    "  const access = siteMap.site.externalAccessNode;",
    '  if (access.id !== "site-access-east")',
    '    throw new Error("building-main requires site-access-east");',
    "  const footprint = { minX: -6, maxX: 6, minZ: -4, maxZ: 4 };",
    "  const insideSite = ([x, z]: readonly [number, number]): boolean => {",
    "    let inside = false;",
    "    for (",
    "      let index = 0, prior = siteMap.site.boundary.length - 1;",
    "      index < siteMap.site.boundary.length;",
    "      prior = index++",
    "    ) {",
    "      const [xi, zi] = siteMap.site.boundary[index]!;",
    "      const [xj, zj] = siteMap.site.boundary[prior]!;",
    "      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi)",
    "        inside = !inside;",
    "    }",
    "    return inside;",
    "  };",
    "  const footprintCorners = [",
    "    [footprint.minX, footprint.minZ],",
    "    [footprint.maxX, footprint.minZ],",
    "    [footprint.maxX, footprint.maxZ],",
    "    [footprint.minX, footprint.maxZ],",
    "  ] as const;",
    "  if (footprintCorners.some((point) => !insideSite(point)))",
    '    throw new Error("building-main footprint lies outside site-main");',
    "  if (clearWidthMetres < 1.2 || clearHeightMetres < 2.1)",
    '    throw new Error("entry-route violates its clear-dimension contract");',
    "  return {",
    '    id: "building-main",',
    "    adoptedSiteBoundary: siteMap.site.boundary,",
    "    footprint,",
    "    externalAccessNodeId: access.id,",
    "    envelopeOpening: {",
    '      id: "door-east",',
    "      externalNodeId: access.id,",
    "      clearWidthMetres,",
    "      clearHeightMetres,",
    "    },",
    '    room: { id: "room-main", parentId: "building-main" },',
    "    route: {",
    '      id: "entry-route",',
    "      from: access.id,",
    '      through: "door-east",',
    '      to: "room-main",',
    "      clearWidthMetres,",
    "      clearHeightMetres,",
    "    },",
    "  } as const;",
    "}",
    "",
  ].join("\n");
  for (const [relative, content] of [
    ["src/maps/world.ts", mapSource],
    ["src/spaces/building.ts", spaceSource],
  ] as const) {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, "utf8");
  }
};

/** Use the rendered lint config while selecting this focused real-graph slice. */
const configureGraph = (root: string): void => {
  const declarationFile = path.join(root, "productionEvidence.mjs");
  let declaration = fs.readFileSync(declarationFile, "utf8");
  for (const [before, after] of [
    ["  kind: null,", '  kind: "library",'],
    ['  settings: "disabled",', '  settings: "review",'],
    ['  maps: "disabled",', '  maps: "review",'],
    ['  spaces: "disabled",', '  spaces: "review",'],
    ['  mapSources: "disabled",', '  mapSources: "review",'],
    ['  spaceSources: "disabled",', '  spaceSources: "review",'],
  ] as const)
    declaration = replaceOnce(declaration, before, after);
  fs.writeFileSync(declarationFile, declaration, "utf8");
  const lintFile = path.join(root, "lint.config.mjs");
  const lintSource = fs.readFileSync(lintFile, "utf8");
  const before =
    "const graph = createAutoMovieEvidenceConfig(productionEvidence);";
  const after = [
    `const names = ${JSON.stringify(CLAIM_NAMES, null, 2)};`,
    "const full = createAutoMovieEvidenceConfig(productionEvidence);",
    "const graph = {",
    "  claims: names.map((name) => {",
    "    const matches = full.claims.filter((claim) => claim.name === name);",
    "    if (matches.length !== 1)",
    '      throw new Error("Expected one current claim named \'" + name + "\'; received " + matches.length + ".");',
    "    return matches[0];",
    "  }),",
    "};",
  ].join("\n");
  const configuredLint = replaceOnce(lintSource, before, after);
  fs.writeFileSync(lintFile, configuredLint, "utf8");
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "esnext",
          module: "esnext",
          moduleResolution: "bundler",
          skipLibCheck: true,
          strict: true,
        },
        include: ["phase.ts", "src/maps/**/*.ts", "src/spaces/**/*.ts"],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
};

/** Build and locate the exact publish-view package facade. */
const buildEvidenceRuntime = (): string => {
  const command =
    process.platform === "win32"
      ? {
          executable: process.env.ComSpec ?? "cmd.exe",
          arguments: [
            "/d",
            "/s",
            "/c",
            "pnpm --filter @automovie/evidence build",
          ],
        }
      : {
          executable: "pnpm",
          arguments: ["--filter", "@automovie/evidence", "build"],
        };
  const result = spawnSync(command.executable, command.arguments, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0 || result.signal !== null)
    throw new Error(
      [
        `Building the generated consumer's @automovie/evidence facade exited ${result.status ?? `by ${result.signal}`}.`,
        result.stdout,
        result.stderr,
      ].join("\n"),
    );
  const destination = path.join(ROOT, "packages/evidence/lib");
  assert.ok(
    fs.existsSync(path.join(destination, "index.js")),
    "The canonical @automovie/evidence build omitted its public facade.",
  );
  assert.ok(
    fs.existsSync(path.join(destination, "index.d.ts")),
    "The canonical @automovie/evidence build omitted its public declarations.",
  );
  return destination;
};

/** Resolve the real factory and contributor without installing the fixture. */
const linkRuntime = (root: string): void => {
  const links = [
    [path.join(ROOT, "node_modules/@ttsc/evidence"), "@ttsc/evidence"],
    [path.join(ROOT, "node_modules/@ttsc/lint"), "@ttsc/lint"],
    [path.join(ROOT, "node_modules/@types/node"), "@types/node"],
    [path.join(ROOT, "node_modules/typescript"), "typescript"],
    [
      path.join(ROOT, "node_modules/typescript-compiler"),
      "typescript-compiler",
    ],
  ] as const;
  for (const [source, relative] of links) {
    const destination = path.join(root, "node_modules", relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.symlinkSync(
      source,
      destination,
      process.platform === "win32" ? "junction" : "dir",
    );
  }
  const evidencePackage = path.join(root, "node_modules/@automovie/evidence");
  fs.mkdirSync(evidencePackage, { recursive: true });
  fs.cpSync(buildEvidenceRuntime(), path.join(evidencePackage, "lib"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(evidencePackage, "package.json"),
    '{"name":"@automovie/evidence","version":"0.0.0","main":"./lib/index.js","types":"./lib/index.d.ts","exports":{".":{"types":"./lib/index.d.ts","default":"./lib/index.js"}}}\n',
    "utf8",
  );
  const template = path.join(root, "node_modules/@automovie/template");
  fs.mkdirSync(template, { recursive: true });
  fs.cpSync(
    path.join(ROOT, "packages/template/docs"),
    path.join(template, "docs"),
    {
      recursive: true,
    },
  );
  assert.ok(
    fs.existsSync(path.join(template, "docs/principles/design/maps.md")),
    "The shared package omitted its map principles.",
  );
  fs.writeFileSync(
    path.join(template, "package.json"),
    '{"name":"@automovie/template","version":"0.0.0","exports":{"./package.json":"./package.json","./docs/*":"./docs/*"}}\n',
    "utf8",
  );
  const resolve = createRequire(
    path.join(ROOT, "packages/evidence/package.json"),
  );
  assert.equal(
    path.basename(resolve.resolve("@ttsc/evidence/package.json")),
    "package.json",
  );
};

/** Run the actual ttsc launcher and preserve all diagnostic channels. */
const lint = (root: string, phase: string): ILintResult => {
  fs.writeFileSync(
    path.join(root, "phase.ts"),
    `export const generatedMapSpacePhase = ${JSON.stringify(phase)};\n`,
    "utf8",
  );
  const result = spawnSync(
    process.execPath,
    [TTSC, "--cache-dir", TTSC_CACHE, "--noEmit", "--project", "tsconfig.json"],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, FORCE_COLOR: "0" },
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  if (result.error !== undefined) throw result.error;
  if (result.signal !== null)
    throw new Error(
      `Generated map-space lint terminated by ${result.signal}.\n${result.stdout}\n${result.stderr}`,
    );
  if (result.status === null)
    throw new Error(
      `Generated map-space lint returned no exit status.\n${result.stdout}\n${result.stderr}`,
    );
  return {
    status: result.status,
    output: `${result.stdout}\n${result.stderr}`
      .replaceAll("\r\n", "\n")
      .replace(/\u001B\[[0-?]*[ -/]*[@-~]/gu, ""),
  };
};

const count = (source: string, pattern: RegExp): number =>
  [...source.matchAll(pattern)].length;

/** Read only fingerprints issued by this run's explicit repair diagnostics. */
const issuedFingerprints = (
  result: ILintResult,
): ReadonlyMap<string, string> => {
  assert.notEqual(result.status, 0, result.output);
  const fingerprints = new Map<string, string>();
  for (const match of result.output.matchAll(
    /Write '@evidence(?:Exclude)?Review ([^\s]+) #([0-9a-f]{7}) /gu,
  )) {
    const [, target, fingerprint] = match;
    assert.ok(target !== undefined && fingerprint !== undefined);
    const prior = fingerprints.get(target);
    assert.ok(
      prior === undefined || prior === fingerprint,
      `Compiler issued two fingerprints for ${target}: ${prior} and ${fingerprint}.`,
    );
    fingerprints.set(target, fingerprint);
  }
  assert.ok(fingerprints.size > 0, result.output);
  assert.equal(
    count(result.output, /Unfingerprinted @evidence(?:Exclude)?Review/gu),
    count(result.output, /Write '@evidence(?:Exclude)?Review /gu),
    result.output,
  );
  return fingerprints;
};

/** Add each compiler-issued digest to every matching authored review. */
const applyFingerprints = (
  root: string,
  fingerprints: ReadonlyMap<string, string>,
): void => {
  let replacements = 0;
  for (const relative of [
    "docs/maps/world.md",
    "docs/spaces/building.md",
    "src/maps/world.ts",
    "src/spaces/building.ts",
  ]) {
    const file = path.join(root, relative);
    const source = fs.readFileSync(file, "utf8");
    const updated = source.replace(
      /@evidence(?:Exclude)?Review ([^\s]+) Reviewed /gu,
      (declaration, target: string) => {
        const fingerprint = fingerprints.get(target);
        assert.ok(
          fingerprint,
          `No compiler-issued fingerprint exists for ${target}.`,
        );
        replacements += 1;
        return declaration.replace(
          `${target} Reviewed `,
          `${target} #${fingerprint} Reviewed `,
        );
      },
    );
    fs.writeFileSync(file, updated, "utf8");
  }
  assert.equal(
    replacements,
    MAP_TARGETS.length +
      SPACE_TARGETS.length +
      MAP_SOURCE_TARGETS.length +
      SPACE_SOURCE_TARGETS.length,
  );
};

/** Remove one citation and its current review without weakening its claim. */
const removeEvidencePair = (source: string, target: string): string => {
  const lines = source.split("\n");
  const kept = lines.filter(
    (line) =>
      !line.startsWith(`@evidence ${target} `) &&
      !line.startsWith(`@evidenceReview ${target} `),
  );
  assert.equal(lines.length - kept.length, 2);
  return kept.join("\n");
};

/**
 * Prove the generated-project map branch and its space consumer through the
 * current public evidence factory and the installed ttsc contributor.
 *
 * Scenarios:
 *
 * 1. A real rendered scaffold exposes map and map-source stages and routes map
 *    ownership separately from spaces in its generated documentation.
 * 2. One reviewed library graph connects `docs/maps` to `src/maps`, connects
 *    `docs/spaces` to `src/spaces`, and accepts only compiler-issued review
 *    fingerprints across the exact six current claim objects.
 * 3. A linked residue inside an active design population fails during the
 *    actual ttsc configuration load instead of disappearing from inventory.
 * 4. Removing the space owner's acknowledgement of the map site interface
 *    produces one isolated graph diagnostic naming that target and claim.
 * 5. Revising the reviewed map design expires the map source's file and H2
 *    reviews plus the consuming space H2 review, proving the downstream edge.
 */
export const test_evidence_generated_map_space_contract = (): void => {
  fs.mkdirSync(FIXTURE_CACHE, { recursive: true });
  const root = fs.mkdtempSync(
    path.join(FIXTURE_CACHE, "automovie-generated-map-space-"),
  );
  const safePrefix = `${path.resolve(FIXTURE_CACHE)}${path.sep}`;
  if (!`${path.resolve(root)}${path.sep}`.startsWith(safePrefix))
    throw new Error(
      `Refusing a generated map-space fixture outside ${FIXTURE_CACHE}.`,
    );

  let fixtureFailure: IFixtureFailure | undefined;
  try {
    const rendered = renderScaffold({ name: "map-space-library" });
    TestValidator.equals(
      "the real scaffold publishes the map route and stage declarations",
      {
        mapStage:
          rendered["productionEvidence.mjs"]?.includes('maps: "disabled"'),
        mapSourceStage: rendered["productionEvidence.mjs"]?.includes(
          'mapSources: "disabled"',
        ),
        completePopulation: rendered["productionEvidence.mjs"]?.includes(
          'populationScope: { mode: "complete-production" }',
        ),
        lintConsumesDeclaration:
          rendered["lint.config.mjs"]?.includes(
            "createAutoMovieEvidenceConfig(productionEvidence)",
          ) &&
          rendered["lint.config.mjs"]?.includes(
            'from "./productionEvidence.mjs"',
          ),
        mapOwnership: rendered["docs/README.md"]?.includes(
          "| maps | broad world organization, site boundary, scale and partition, temporal world state, and external access node |",
        ),
        spaceOwnership: rendered["docs/README.md"]?.includes(
          "| spaces | building exterior/interior, room, zone, enclosure, opening, and circulation topology inside the adopted map/site boundary |",
        ),
      },
      {
        mapStage: true,
        mapSourceStage: true,
        completePopulation: true,
        lintConsumesDeclaration: true,
        mapOwnership: true,
        spaceOwnership: true,
      },
    );
    writeFiles(root, rendered);
    linkRuntime(root);
    writeDesign(root);
    writeSources(root);
    configureGraph(root);

    const unfingerprinted = lint(root, "unfingerprinted");
    const fingerprints = issuedFingerprints(unfingerprinted);
    applyFingerprints(root, fingerprints);
    const paid = lint(root, "reviewed");
    assert.equal(paid.status, 0, paid.output);
    assert.equal(count(paid.output, /\[evidence\/graph\]/gu), 0, paid.output);

    const linkedResidueTarget = path.join(root, "linked-design-residue");
    fs.mkdirSync(linkedResidueTarget);
    fs.writeFileSync(
      path.join(linkedResidueTarget, "hidden.md"),
      "# Hidden linked residue\n",
      "utf8",
    );
    const linkedResidue = path.join(root, "docs", "maps", "linked");
    fs.symlinkSync(
      linkedResidueTarget,
      linkedResidue,
      process.platform === "win32" ? "junction" : "dir",
    );
    const linked = lint(root, "linked-design-residue");
    assert.notEqual(linked.status, 0, linked.output);
    assert.match(
      linked.output,
      /project evidence populations contain only real files and directories inside the project root/u,
    );
    fs.rmSync(linkedResidue);

    const spaceFile = path.join(root, "docs/spaces/building.md");
    const reviewedSpace = fs.readFileSync(spaceFile, "utf8");
    fs.writeFileSync(
      spaceFile,
      removeEvidencePair(reviewedSpace, MAP_TARGET),
      "utf8",
    );
    const disconnected = lint(root, "disconnected-space");
    TestValidator.equals(
      "the map-space foundation edge fails in isolation",
      {
        failed: disconnected.status !== 0,
        graphDiagnostics: count(disconnected.output, /\[evidence\/graph\]/gu),
        target: disconnected.output.includes(MAP_TARGET),
        claim: disconnected.output.includes(CLAIM_NAMES[1]),
      },
      {
        failed: true,
        graphDiagnostics: 1,
        target: true,
        claim: true,
      },
    );
    fs.writeFileSync(spaceFile, reviewedSpace, "utf8");

    const mapFile = path.join(root, "docs/maps/world.md");
    const reviewedMap = fs.readFileSync(mapFile, "utf8");
    fs.writeFileSync(
      mapFile,
      replaceOnce(
        reviewedMap,
        "The external road runs from (100,0) to (20,0) in the XZ plane and terminates at `site-access-east` on the site's east edge.",
        "The external road runs from (100,0) through (60,0) to (20,0) in the XZ plane and terminates at `site-access-east` on the site's east edge.",
      ),
      "utf8",
    );
    const stale = lint(root, "stale-map-design");
    TestValidator.equals(
      "a map revision expires its source and consuming-space reviews",
      {
        failed: stale.status !== 0,
        staleReviews: count(stale.output, /Stale @evidenceReview/gu),
        graphDiagnostics: count(stale.output, /\[evidence\/graph\]/gu),
        fileTarget: stale.output.includes("maps/world.md'"),
        h2Target: stale.output.includes(MAP_TARGET),
        mapSource: /src[\\/]maps[\\/]world\.ts/u.test(stale.output),
      },
      {
        failed: true,
        staleReviews: 4,
        graphDiagnostics: 4,
        fileTarget: true,
        h2Target: true,
        mapSource: true,
      },
    );
  } catch (error) {
    fixtureFailure = { error };
    throw error;
  } finally {
    preserveFixtureCleanup(fixtureFailure, () => {
      if (!`${path.resolve(root)}${path.sep}`.startsWith(safePrefix))
        throw new Error(
          `Refusing to remove a fixture outside ${FIXTURE_CACHE}.`,
        );
      fs.rmSync(root, { force: true, recursive: true });
    });
  }
};
