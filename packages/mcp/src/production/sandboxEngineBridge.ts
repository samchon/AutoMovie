import {
  autoMovieAssemblyOpeningReveal,
  autoMoviePatternInstanceTransforms,
  autoMoviePatternTextureTransforms,
  buildAutoMoviePolyhedron,
  buildAutoMovieWall,
  builtEnvironmentAdjacentSpaces,
  builtEnvironmentBuildingOfSpace,
  builtEnvironmentContainsPoint,
  builtEnvironmentElementBounds,
  builtEnvironmentPlacementBounds,
  builtEnvironmentPlacementOverlap,
  builtEnvironmentSpaceConnectors,
  builtEnvironmentSpaceContentBounds,
  builtEnvironmentSpaceFidelity,
  builtEnvironmentSpaceNodes,
  builtEnvironmentSpacePopulations,
  builtEnvironmentSpaceSurfaces,
  builtEnvironmentSupportStatus,
  builtInstanceSetPlacementBounds,
  extrudeAutoMovieProfile,
  extrudeAutoMovieRegion,
  generateAutoMovieSurfacePattern,
  inspectAutoMovieMeshTopology,
  loftAutoMovieSections,
  lowerBuiltEnvironment,
  matchAutoMovieAssemblyJunction,
  mergeAutoMovieMeshParts,
  mergeAutoMovieMeshes,
  mergeAutoMovieSpaces,
  mergeAutoMovieSubjectContributions,
  placementChildNode,
  propAnchorFrame,
  resolveAutoMovieMaterialAssembly,
  revolveAutoMovieProfile,
  sweepAutoMovieProfile,
  tessellateSurface,
  transformAutoMovieMesh,
  triangulateAutoMovieRegion,
  validateAutoMovieMaterialAssembly,
  validateAutoMovieMaterialSubstance,
} from "@automovie/engine";

import { AutoMovieSandboxEngineExport } from "./sandboxEngineSurface";

/**
 * What one bridged engine call produced, or why it produced nothing.
 */
export type IAutoMovieSandboxEngineAnswer =
  | { ok: true; value: unknown }
  | { ok: false; message: string };

/**
 * The engine names the deterministic sandbox answers by calling the engine.
 *
 * These take plain data and return plain data, so one JSON round trip carries a
 * call across the sandbox boundary without either side handing the other an
 * object it could reach a realm through. That is what lets the sandbox stop
 * owning a second copy of this arithmetic: a copy is a chance to disagree, and
 * these functions disagreed four times in one cycle — a reciprocal multiply
 * rewritten as two divisions, an angle conversion folded into one constant —
 * each a rounding difference the byte-parity gate reported hours later and an
 * author would have seen as a frame that moved.
 *
 * A name absent here is answered by a stand-in the sandbox defines itself.
 * `defineShot` and the subject classes are one reason: they carry a closure or
 * a prototype, and neither survives a JSON round trip. `worldSurfaceHeight` is
 * the other: the sandbox asks it once per placed slot, so bridging it would
 * serialise a whole terrain record per crowd member, and the copy stays inside
 * the sandbox where the byte-parity gate reads it.
 */
export const AUTOMOVIE_SANDBOX_BRIDGED_ENGINE_EXPORTS: readonly AutoMovieSandboxEngineExport[] =
  [
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
    "builtEnvironmentSupportStatus",
    "builtEnvironmentSpaceConnectors",
    "builtEnvironmentSpaceContentBounds",
    "builtEnvironmentSpaceFidelity",
    "builtEnvironmentSpaceNodes",
    "builtEnvironmentSpacePopulations",
    "builtEnvironmentSpaceSurfaces",
    "builtInstanceSetPlacementBounds",
    "extrudeAutoMovieProfile",
    "extrudeAutoMovieRegion",
    "generateAutoMovieSurfacePattern",
    "inspectAutoMovieMeshTopology",
    "loftAutoMovieSections",
    "lowerBuiltEnvironment",
    "matchAutoMovieAssemblyJunction",
    "mergeAutoMovieMeshes",
    "mergeAutoMovieMeshParts",
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
  ];

/**
 * Adapt one kernel to the boundary's shape without restating its signature.
 *
 * The parameter list comes from the function itself, so a kernel that gains an
 * argument or changes a shape does not leave a hand-written adapter behind
 * describing what it used to take.
 */
const bridged =
  <A extends readonly unknown[], R>(kernel: (...args: A) => R) =>
  (args: readonly unknown[]): unknown =>
    kernel(...(args as unknown as A));

const BRIDGE: Readonly<Record<string, (args: readonly unknown[]) => unknown>> =
  {
    autoMovieAssemblyOpeningReveal: bridged(autoMovieAssemblyOpeningReveal),
    autoMoviePatternInstanceTransforms: bridged(
      autoMoviePatternInstanceTransforms,
    ),
    autoMoviePatternTextureTransforms: bridged(
      autoMoviePatternTextureTransforms,
    ),
    buildAutoMoviePolyhedron: bridged(buildAutoMoviePolyhedron),
    buildAutoMovieWall: bridged(buildAutoMovieWall),
    builtEnvironmentAdjacentSpaces: bridged(builtEnvironmentAdjacentSpaces),
    builtEnvironmentBuildingOfSpace: bridged(builtEnvironmentBuildingOfSpace),
    builtEnvironmentContainsPoint: bridged(builtEnvironmentContainsPoint),
    builtEnvironmentElementBounds: bridged(builtEnvironmentElementBounds),
    builtEnvironmentPlacementBounds: bridged(builtEnvironmentPlacementBounds),
    builtEnvironmentPlacementOverlap: bridged(builtEnvironmentPlacementOverlap),
    builtEnvironmentSupportStatus: bridged(builtEnvironmentSupportStatus),
    builtEnvironmentSpaceConnectors: bridged(builtEnvironmentSpaceConnectors),
    builtEnvironmentSpaceContentBounds: bridged(
      builtEnvironmentSpaceContentBounds,
    ),
    builtEnvironmentSpaceFidelity: bridged(builtEnvironmentSpaceFidelity),
    builtEnvironmentSpaceNodes: bridged(builtEnvironmentSpaceNodes),
    builtEnvironmentSpacePopulations: bridged(builtEnvironmentSpacePopulations),
    builtEnvironmentSpaceSurfaces: bridged(builtEnvironmentSpaceSurfaces),
    builtInstanceSetPlacementBounds: bridged(builtInstanceSetPlacementBounds),
    extrudeAutoMovieProfile: bridged(extrudeAutoMovieProfile),
    extrudeAutoMovieRegion: bridged(extrudeAutoMovieRegion),
    generateAutoMovieSurfacePattern: bridged(generateAutoMovieSurfacePattern),
    inspectAutoMovieMeshTopology: bridged(inspectAutoMovieMeshTopology),
    loftAutoMovieSections: bridged(loftAutoMovieSections),
    lowerBuiltEnvironment: bridged(lowerBuiltEnvironment),
    matchAutoMovieAssemblyJunction: bridged(matchAutoMovieAssemblyJunction),
    mergeAutoMovieMeshes: bridged(mergeAutoMovieMeshes),
    mergeAutoMovieMeshParts: bridged(mergeAutoMovieMeshParts),
    mergeAutoMovieSpaces: bridged(mergeAutoMovieSpaces),
    mergeAutoMovieSubjectContributions: bridged(
      mergeAutoMovieSubjectContributions,
    ),
    placementChildNode: bridged(placementChildNode),
    propAnchorFrame: bridged(propAnchorFrame),
    resolveAutoMovieMaterialAssembly: bridged(resolveAutoMovieMaterialAssembly),
    revolveAutoMovieProfile: bridged(revolveAutoMovieProfile),
    sweepAutoMovieProfile: bridged(sweepAutoMovieProfile),
    tessellateSurface: bridged(tessellateSurface),
    transformAutoMovieMesh: bridged(transformAutoMovieMesh),
    triangulateAutoMovieRegion: bridged(triangulateAutoMovieRegion),
    validateAutoMovieMaterialAssembly: bridged(
      validateAutoMovieMaterialAssembly,
    ),
    validateAutoMovieMaterialSubstance: bridged(
      validateAutoMovieMaterialSubstance,
    ),
  };

/**
 * Refuse a number a deterministic artifact could not carry anyway.
 *
 * `JSON.stringify` writes `NaN` and both infinities as `null`, so a result
 * carrying one would cross the boundary as a hole rather than as a number, and
 * the author would read a missing value instead of the arithmetic that produced
 * it.
 */
const finiteOnly = (key: string, value: unknown): unknown => {
  if (typeof value === "number" && Number.isFinite(value) === false)
    throw new Error(
      `An engine call answered with ${String(value)} at "${key}", which a deterministic artifact cannot carry.`,
    );
  return value;
};

/**
 * Answer one engine call the deterministic sandbox forwarded.
 *
 * Strings cross the boundary in both directions: the sandbox serialises its
 * arguments, this reads them into host values, and the result goes back as
 * text. Nothing structured is shared, so neither realm can reach the other's
 * prototypes through an argument, and the sandbox never holds a host function
 * it could pull a `Function` constructor off.
 *
 * A refusal the engine raises is carried as a message rather than as an error
 * object, for the same reason: an `Error` from this realm handed to sandbox
 * code is a live reference to this realm.
 */
export const callAutoMovieSandboxEngine = (
  name: string,
  argsJson: string,
): string => {
  try {
    const kernel = BRIDGE[name];
    if (kernel === undefined)
      throw new Error(
        `The deterministic sandbox forwarded "${name}", which is not a bridged engine call.`,
      );
    return JSON.stringify(
      { ok: true, value: kernel(JSON.parse(argsJson) as unknown[]) },
      finiteOnly,
    );
  } catch (error) {
    return JSON.stringify({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
