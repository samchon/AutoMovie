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
  | "buildAutoMovieWall"
  | "builtEnvironmentAdjacentSpaces"
  | "builtEnvironmentBuildingOfSpace"
  | "builtEnvironmentContainsPoint"
  | "builtEnvironmentSpaceConnectors"
  | "builtEnvironmentSpaceNodes"
  | "builtEnvironmentSpaceSurfaces"
  | "defineShot"
  | "extrudeAutoMovieProfile"
  | "lowerBuiltEnvironment"
  | "mergeAutoMovieMeshes"
  | "mergeAutoMovieSpaces"
  | "mergeAutoMovieSubjectContributions"
  | "revolveAutoMovieProfile"
  | "sweepAutoMovieProfile"
  | "worldSurfaceHeight";

/**
 * The engine surface a deterministic source module may import at runtime.
 *
 * The sandbox reimplements each of these rather than loading the package, so
 * this list is the contract between the two, and it is the only place either
 * side reads it from. The import gate derives what a source may name, and the
 * sandbox derives which stand-ins it publishes, which is what keeps the two
 * from disagreeing.
 *
 * Two independent lists is exactly how the surface broke before: a stand-in
 * existed for five procedural kernel names that the import gate never listed,
 * so no source could reach them, and the parity gate reported a failure for a
 * comparison it had never actually run. Neither half can drift from the other
 * now: a listed name with no stand-in and a stand-in the list omits both make
 * the sandbox refuse to start, with a message naming the missing half.
 *
 * Sorted, because the order is a published fact the guide and the refusal
 * message read back to an author.
 */
export const AUTOMOVIE_SANDBOX_ENGINE_SURFACE: readonly AutoMovieSandboxEngineExport[] =
  [
    "AutoMovieSubject",
    "AutoMovieSubjectGroup",
    "buildAutoMovieWall",
    "builtEnvironmentAdjacentSpaces",
    "builtEnvironmentBuildingOfSpace",
    "builtEnvironmentContainsPoint",
    "builtEnvironmentSpaceConnectors",
    "builtEnvironmentSpaceNodes",
    "builtEnvironmentSpaceSurfaces",
    "defineShot",
    "extrudeAutoMovieProfile",
    "lowerBuiltEnvironment",
    "mergeAutoMovieMeshes",
    "mergeAutoMovieSpaces",
    "mergeAutoMovieSubjectContributions",
    "revolveAutoMovieProfile",
    "sweepAutoMovieProfile",
    "worldSurfaceHeight",
  ];
