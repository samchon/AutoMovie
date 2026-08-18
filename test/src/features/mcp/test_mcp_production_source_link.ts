import { mergeAutoMovieSubjectContributions } from "@automovie/engine";
import {
  AUTOMOVIE_SANDBOX_ENGINE_EXPORTS,
  isProjectSourceSpecifier,
  linkProductionSource,
  resolveProjectSourceSpecifier,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";

const link = (files: Record<string, string>, entry = "src/shots/one.ts") =>
  linkProductionSource({
    entryPath: entry,
    entrySource: files[entry]!,
    read: (relative) => {
      const found = files[relative];
      if (found === undefined)
        throw new Error(`Source "${relative}" does not exist.`);
      return found;
    },
  });

const paths = (result: ReturnType<typeof link>): string[] =>
  result.modules.map((module) => module.path);

/**
 * A shot reaches the subject vocabulary through its own imports.
 *
 * Linking is what lets a shot name a subject instead of rebuilding it, and it
 * is also the widest thing the deterministic sandbox has ever been asked to
 * open. So the rules that make one module safe have to survive being applied to
 * a graph: order has to be a real dependency order, a specifier has to mean one
 * module however it is spelled, and everything the reader refuses for an entry
 * module stays refused for an imported one.
 *
 * Scenarios:
 *
 * 1. Modules come back in dependency order with the entry last, which is what lets
 *    a synchronous registry evaluate each one with its imports present.
 * 2. A module reached twice is linked once, so a diamond does not evaluate its
 *    shared dependency twice or register it twice.
 * 3. A specifier resolves against the module that wrote it, and the extension is
 *    optional, so two spellings of one module are one registry entry.
 * 4. A type-only import creates no dependency, because it is erased before the
 *    sandbox sees it; pulling its module in would link source nothing runs.
 * 5. A cycle is refused and names the path around it, rather than being served a
 *    half-built `exports` the way CommonJS would.
 * 6. A specifier climbing above the project root is refused with its own reason,
 *    so an author is told what they did rather than that a file is missing.
 * 7. An unreadable import is refused and carries the reader's own message, so the
 *    escape and symlink refusals the reader owns are not restated here.
 * 8. What the sandbox publishes is exactly the surface a source module may import;
 *    a name on one side and not the other would be either an unreachable
 *    implementation or an import that fails at execution.
 * 9. The entry's own resolved specifiers are stated on the result, since the
 *    sandbox needs them before any module runs and searching the module list
 *    for an entry that is always there would need a branch nothing can reach.
 */
export const test_mcp_production_source_link = (): void => {
  const chain = link({
    "src/shots/one.ts": [
      'import { defineShot } from "@automovie/engine";',
      'import { chorus } from "../formations/chorus";',
      "export const one = defineShot('one', { build: () => chorus });",
    ].join("\n"),
    "src/formations/chorus.ts": [
      'import { member } from "../units/member";',
      "export const chorus = [member];",
    ].join("\n"),
    "src/units/member.ts": "export const member = 1;",
  });
  TestValidator.equals(
    "modules arrive in dependency order with the entry last",
    paths(chain),
    ["src/units/member.ts", "src/formations/chorus.ts", "src/shots/one.ts"],
  );
  TestValidator.equals(
    "the entry's own specifiers are stated rather than searched for",
    chain.entryImports,
    { "../formations/chorus": "src/formations/chorus.ts" },
  );

  const diamond = link({
    "src/shots/one.ts": [
      'import { left } from "./left";',
      'import { right } from "./right";',
      "export const one = { build: () => [left, right] };",
    ].join("\n"),
    "src/shots/left.ts": [
      'import { shared } from "../units/shared";',
      "export const left = shared;",
    ].join("\n"),
    "src/shots/right.ts": [
      'import { shared } from "../units/shared";',
      "export const right = shared;",
    ].join("\n"),
    "src/units/shared.ts": "export const shared = 1;",
  });
  TestValidator.equals(
    "a module reached twice is linked once",
    paths(diamond),
    [
      "src/units/shared.ts",
      "src/shots/left.ts",
      "src/shots/right.ts",
      "src/shots/one.ts",
    ],
  );

  TestValidator.equals(
    "a specifier means one module however it is spelled",
    namedFacts([
      [
        "sibling",
        () =>
          resolveProjectSourceSpecifier("src/shots/one.ts", "./two") ===
          "src/shots/two.ts",
      ],
      [
        "parent",
        () =>
          resolveProjectSourceSpecifier(
            "src/shots/one.ts",
            "../units/member.ts",
          ) === "src/units/member.ts",
      ],
      [
        "redundant",
        () =>
          resolveProjectSourceSpecifier("src/shots/one.ts", "././two") ===
          "src/shots/two.ts",
      ],
      [
        "escaping",
        () => resolveProjectSourceSpecifier("one.ts", "../outside") === null,
      ],
      [
        "relative",
        () =>
          isProjectSourceSpecifier("./a") &&
          isProjectSourceSpecifier("../a") &&
          isProjectSourceSpecifier("@automovie/engine") === false,
      ],
    ]),
    {
      sibling: true,
      parent: true,
      redundant: true,
      escaping: true,
      relative: true,
    },
  );

  const typeOnly = link({
    "src/shots/one.ts": [
      'import type { Shape } from "../units/shape";',
      'import { type Other } from "../units/other";',
      "export const one = { build: () => 1 };",
    ].join("\n"),
    "src/units/shape.ts": "export interface Shape { a: number }",
    "src/units/other.ts": "export interface Other { b: number }",
  });
  TestValidator.equals(
    "a type-only import creates no runtime dependency",
    paths(typeOnly),
    ["src/shots/one.ts"],
  );

  const cyclic = link({
    "src/shots/one.ts": [
      'import { a } from "../units/a";',
      "export const one = { build: () => a };",
    ].join("\n"),
    "src/units/a.ts": ['import { b } from "./b";', "export const a = b;"].join(
      "\n",
    ),
    "src/units/b.ts": ['import { a } from "./a";', "export const b = a;"].join(
      "\n",
    ),
  });
  TestValidator.equals(
    "a cycle is refused and names the path around it",
    namedFacts([
      ["cyclicFailuresLength", () => cyclic.failures.length === 1],
      [
        "cyclicFailures0",
        () =>
          cyclic.failures.length === 1 &&
          cyclic.failures[0]!.path === "src/units/a.ts",
      ],
      [
        "cyclicFailures02",
        () =>
          cyclic.failures.length === 1 &&
          cyclic.failures[0]!.path === "src/units/a.ts" &&
          cyclic.failures[0]!.reason.includes(
            "src/units/a.ts -> src/units/b.ts -> src/units/a.ts",
          ),
      ],
    ]),
    {
      cyclicFailuresLength: true,
      cyclicFailures0: true,
      cyclicFailures02: true,
    },
  );

  const climbing = link(
    {
      "one.ts": [
        'import { outside } from "../outside";',
        "export const one = { build: () => outside };",
      ].join("\n"),
      "src/units/member.ts": "export const member = 1;",
    },
    "one.ts",
  );
  TestValidator.equals(
    "a specifier above the project root is refused as such",
    namedFacts([
      ["climbingFailuresLength", () => climbing.failures.length === 1],
      [
        "climbingFailures0",
        () =>
          climbing.failures.length === 1 &&
          climbing.failures[0]!.reason.includes(
            "climbs above the project root",
          ),
      ],
    ]),
    { climbingFailuresLength: true, climbingFailures0: true },
  );

  const absent = link({
    "src/shots/one.ts": [
      'import { gone } from "../units/gone";',
      "export const one = { build: () => gone };",
    ].join("\n"),
  });
  TestValidator.equals(
    "an unreadable import carries the reader's own refusal",
    namedFacts([
      ["absentFailuresLength", () => absent.failures.length === 1],
      [
        "absentFailures0",
        () =>
          absent.failures.length === 1 &&
          absent.failures[0]!.reason.includes(
            'Source "src/units/gone.ts" does not exist.',
          ),
      ],
    ]),
    { absentFailuresLength: true, absentFailures0: true },
  );

  // The sandbox reimplements the merge rather than loading it, so the two are
  // two spellings of one contract. A key in one and not the other is a merge
  // that silently carries a field nothing else knows about, which is the
  // divergence a single owner exists to prevent.
  const declared = mergeAutoMovieSubjectContributions([
    {
      models: [],
      set: [],
      spaces: [],
      builtEnvironments: [],
      actors: [],
      clips: [],
      formationMotions: [],
      effectCues: [],
      landmarks: [],
      surfaces: [],
      routes: [],
      effectRecipes: [],
      effectZones: [],
      instanceSets: [],
    },
  ]);
  TestValidator.equals(
    "an all-empty contribution merges to nothing, so no key is invented",
    declared,
    {},
  );

  TestValidator.equals(
    "the importable engine surface is exactly what the sandbox publishes",
    [...AUTOMOVIE_SANDBOX_ENGINE_EXPORTS].sort((left, right) =>
      left < right ? -1 : 1,
    ),
    [
      "AutoMovieSubject",
      "AutoMovieSubjectGroup",
      "assertWorldPlacements",
      "autoMovieAssemblyOpeningReveal",
      "autoMoviePatternInstanceTransforms",
      "autoMoviePatternTextureTransforms",
      "buildAutoMoviePolyhedron",
      "buildAutoMovieWall",
      "builtEnvironmentAdjacentSpaces",
      "builtEnvironmentBuildingOfSpace",
      "builtEnvironmentContainsPoint",
      "builtEnvironmentElementBounds",
      "builtEnvironmentPlacementBounds",
      "builtEnvironmentPlacementOverlap",
      "builtEnvironmentSpaceBoundaries",
      "builtEnvironmentSpaceConnectors",
      "builtEnvironmentSpaceContentBounds",
      "builtEnvironmentSpaceFidelity",
      "builtEnvironmentSpaceNodes",
      "builtEnvironmentSpacePopulations",
      "builtEnvironmentSpaceSurfaces",
      "builtEnvironmentSupportStatus",
      "builtInstanceSetPlacementBounds",
      "defineShot",
      "extrudeAutoMovieProfile",
      "extrudeAutoMovieRegion",
      "generateAutoMovieSurfacePattern",
      "inspectAutoMovieMeshTopology",
      "loftAutoMovieSections",
      "lowerBuiltEnvironment",
      "matchAutoMovieAssemblyJunction",
      "mergeAutoMovieMeshParts",
      "mergeAutoMovieMeshes",
      "mergeAutoMovieSpaces",
      "mergeAutoMovieSubjectContributions",
      "placementChildNode",
      "propAnchorFrame",
      "resolveAutoMovieMaterialAssembly",
      "revolveAutoMovieProfile",
      "sweepAutoMovieProfile",
      "tessellateSurface",
      "transformAutoMovieMesh",
      "triangulateAutoMovieRegion",
      "validateAutoMovieMaterialAssembly",
      "validateAutoMovieMaterialSubstance",
      "worldAlongRoute",
      "worldBlock",
      "worldGrid",
      "worldRamp",
      "worldScatter",
      "worldSurfaceHeight",
      "worldTerrain",
    ],
  );
};
