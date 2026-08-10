/**
 * One engine name a deterministic source module may import at runtime.
 *
 * A union rather than a bare `string`, so a name is spelled once and every
 * table keyed by the surface is complete by construction: a member added here
 * turns an incomplete table into a compile error instead of a silent hole that
 * only the ten-minute byte-parity gate would notice.
 */
export type AutoMovieSandboxEngineExport =
  | "AutoMovieSubject"
  | "AutoMovieSubjectGroup"
  | "autoMovieAssemblyOpeningReveal"
  | "buildAutoMoviePolyhedron"
  | "buildAutoMovieWall"
  | "builtEnvironmentAdjacentSpaces"
  | "builtEnvironmentBuildingOfSpace"
  | "builtEnvironmentContainsPoint"
  | "builtEnvironmentSpaceConnectors"
  | "builtEnvironmentSpaceFidelity"
  | "builtEnvironmentSpaceNodes"
  | "builtEnvironmentSpaceSurfaces"
  | "defineShot"
  | "extrudeAutoMovieProfile"
  | "extrudeAutoMovieRegion"
  | "inspectAutoMovieMeshTopology"
  | "loftAutoMovieSections"
  | "lowerBuiltEnvironment"
  | "matchAutoMovieAssemblyJunction"
  | "mergeAutoMovieMeshParts"
  | "mergeAutoMovieMeshes"
  | "mergeAutoMovieSpaces"
  | "mergeAutoMovieSubjectContributions"
  | "resolveAutoMovieMaterialAssembly"
  | "revolveAutoMovieProfile"
  | "sweepAutoMovieProfile"
  | "tessellateSurface"
  | "transformAutoMovieMesh"
  | "triangulateAutoMovieRegion"
  | "validateAutoMovieMaterialAssembly"
  | "validateAutoMovieMaterialSubstance"
  | "worldSurfaceHeight";

/**
 * The engine surface a deterministic source module may import at runtime.
 *
 * The sandbox answers most of these by calling the engine across a JSON
 * boundary and the rest with a stand-in of its own, so this list is the
 * contract between the two halves, and it is the only place either side reads
 * it from. The import gate derives what a source may name, and the sandbox
 * derives what it publishes, which is what keeps the two from disagreeing.
 *
 * Two independent lists is exactly how the surface broke before: a stand-in
 * existed for five procedural kernel names that the import gate never listed,
 * so no source could reach them, and the parity gate reported a failure for a
 * comparison it had never actually run. Neither half can drift from the other
 * now: a listed name the sandbox neither bridges nor stands in for, and an
 * implementation the list omits, both make the sandbox refuse to start with a
 * message naming the missing half.
 *
 * Sorted, because the order is a published fact the guide and the refusal
 * message read back to an author.
 */
export const AUTOMOVIE_SANDBOX_ENGINE_SURFACE: readonly AutoMovieSandboxEngineExport[] =
  [
    "AutoMovieSubject",
    "AutoMovieSubjectGroup",
    "autoMovieAssemblyOpeningReveal",
    "buildAutoMoviePolyhedron",
    "buildAutoMovieWall",
    "builtEnvironmentAdjacentSpaces",
    "builtEnvironmentBuildingOfSpace",
    "builtEnvironmentContainsPoint",
    "builtEnvironmentSpaceConnectors",
    "builtEnvironmentSpaceFidelity",
    "builtEnvironmentSpaceNodes",
    "builtEnvironmentSpaceSurfaces",
    "defineShot",
    "extrudeAutoMovieProfile",
    "extrudeAutoMovieRegion",
    "inspectAutoMovieMeshTopology",
    "loftAutoMovieSections",
    "lowerBuiltEnvironment",
    "matchAutoMovieAssemblyJunction",
    "mergeAutoMovieMeshParts",
    "mergeAutoMovieMeshes",
    "mergeAutoMovieSpaces",
    "mergeAutoMovieSubjectContributions",
    "resolveAutoMovieMaterialAssembly",
    "revolveAutoMovieProfile",
    "sweepAutoMovieProfile",
    "tessellateSurface",
    "transformAutoMovieMesh",
    "triangulateAutoMovieRegion",
    "validateAutoMovieMaterialAssembly",
    "validateAutoMovieMaterialSubstance",
    "worldSurfaceHeight",
  ];
