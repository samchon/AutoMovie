import * as AutoMovieEngine from "@automovie/engine";

/**
 * The package a deterministic source module names to reach the engine surface.
 *
 * Spelled once, because the import gate, the sandbox's module table, and the
 * refusal an author reads all have to mean the same package, and a second
 * spelling is how one of them ends up meaning a package that does not exist.
 */
export const AUTOMOVIE_SANDBOX_ENGINE_SPECIFIER = "@automovie/engine";

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
  | "assertWorldPlacements"
  | "autoMovieAssemblyOpeningReveal"
  | "autoMoviePatternInstanceTransforms"
  | "autoMoviePatternTextureTransforms"
  | "buildAutoMoviePolyhedron"
  | "buildAutoMovieRegionFace"
  | "buildAutoMovieWall"
  | "builtEnvironmentAdjacentSpaces"
  | "builtEnvironmentBuildingOfSpace"
  | "builtEnvironmentContainsPoint"
  | "builtEnvironmentElementBounds"
  | "builtEnvironmentElementPartBounds"
  | "builtEnvironmentPlacementBounds"
  | "builtEnvironmentPlacementOverlap"
  | "builtEnvironmentSupportStatus"
  | "builtEnvironmentSpaceBoundaries"
  | "builtEnvironmentSpaceConnectors"
  | "builtEnvironmentSpaceContentBounds"
  | "builtEnvironmentSpaceFidelity"
  | "builtEnvironmentSpaceNodes"
  | "builtEnvironmentSpacePopulations"
  | "builtEnvironmentSpaceSurfaces"
  | "builtInstanceSetPlacementBounds"
  | "defineShot"
  | "extrudeAutoMovieProfile"
  | "extrudeAutoMovieRegion"
  | "generateAutoMovieSurfacePattern"
  | "inspectAutoMovieMeshTopology"
  | "loftAutoMovieSections"
  | "lowerBuiltEnvironment"
  | "matchAutoMovieAssemblyJunction"
  | "mergeAutoMovieMeshParts"
  | "mergeAutoMovieMeshes"
  | "mergeAutoMovieSpaces"
  | "mergeAutoMovieSubjectContributions"
  | "placementChildNode"
  | "propAnchorFrame"
  | "resolveAutoMovieMaterialAssembly"
  | "revolveAutoMovieProfile"
  | "sweepAutoMovieProfile"
  | "tessellateSurface"
  | "transformAutoMovieMesh"
  | "triangulateAutoMovieRegion"
  | "validateAutoMovieMaterialAssembly"
  | "validateAutoMovieMaterialSubstance"
  | "worldAlongRoute"
  | "worldBlock"
  | "worldGrid"
  | "worldRamp"
  | "worldScatter"
  | "worldSurfaceHeight"
  | "worldTerrain";

/**
 * The engine surface a deterministic source module may import at runtime.
 *
 * The sandbox publishes most of these by carrying a runtime value through a
 * JSON boundary and the rest with a stand-in of its own, so this list is the
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
 *
 * Reach is granted per name rather than withheld per name, and that direction
 * was measured rather than assumed. Runtime exports include callbacks, typed
 * arrays, class instances, mutable inputs, and values that JSON silently turns
 * into `{}` or `null`; neither reflection nor a signature classifier can prove
 * that an arbitrary export is deterministic, side-effect free, and round-trip
 * safe. A default-open surface would therefore exchange an explicit refusal
 * for a plausible wrong answer. The list that is worth publishing beside this
 * one is
 * {@link AUTOMOVIE_SANDBOX_WITHHELD_ENGINE_EXPORTS}, which is derived rather
 * than remembered, and {@link autoMovieSandboxEngineImportRefusal}, which tells
 * a blocked author which of the two situations they are in.
 */
export const AUTOMOVIE_SANDBOX_ENGINE_SURFACE: readonly AutoMovieSandboxEngineExport[] =
  [
    "AutoMovieSubject",
    "AutoMovieSubjectGroup",
    "assertWorldPlacements",
    "autoMovieAssemblyOpeningReveal",
    "autoMoviePatternInstanceTransforms",
    "autoMoviePatternTextureTransforms",
    "buildAutoMoviePolyhedron",
    "buildAutoMovieRegionFace",
    "buildAutoMovieWall",
    "builtEnvironmentAdjacentSpaces",
    "builtEnvironmentBuildingOfSpace",
    "builtEnvironmentContainsPoint",
    "builtEnvironmentElementBounds",
    "builtEnvironmentElementPartBounds",
    "builtEnvironmentPlacementBounds",
    "builtEnvironmentPlacementOverlap",
    "builtEnvironmentSupportStatus",
    "builtEnvironmentSpaceBoundaries",
    "builtEnvironmentSpaceConnectors",
    "builtEnvironmentSpaceContentBounds",
    "builtEnvironmentSpaceFidelity",
    "builtEnvironmentSpaceNodes",
    "builtEnvironmentSpacePopulations",
    "builtEnvironmentSpaceSurfaces",
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
  ];

/**
 * The surface as a membership test.
 *
 * A set rather than a scan of the array, because every question asked of the
 * surface is "is this arbitrary spelling on it" and `Array.includes` would need
 * the caller to assert that an unknown string is already a member — the one
 * claim the caller is asking about.
 */
const REACHABLE: ReadonlySet<string> = new Set(
  AUTOMOVIE_SANDBOX_ENGINE_SURFACE,
);

/**
 * Every name `@automovie/engine` actually publishes at run time.
 *
 * Read from the package namespace rather than restated, so it cannot go stale
 * and cannot be wrong: a name the engine adds is here on the next import, and a
 * name it removes leaves. That is what separates "this capability does not
 * exist" from "this capability exists and the sandbox withholds it", a
 * distinction the import gate could not make while it knew only its own
 * allowlist and refused every other spelling identically.
 *
 * Types are absent by construction. `IAutoMovieSurfacePattern` is erased before
 * this object exists, so nothing here can be read as a claim that a type is a
 * runtime capability.
 */
export const AUTOMOVIE_ENGINE_RUNTIME_EXPORTS: ReadonlySet<string> = new Set(
  Object.keys(AutoMovieEngine),
);

/**
 * Every engine name that exists and that deterministic shot source may not have.
 *
 * The withheld set is the one the repository owes a reason for, and deriving it
 * is what makes the reason true of every member at once: it is
 * {@link AUTOMOVIE_ENGINE_RUNTIME_EXPORTS} minus
 * {@link AUTOMOVIE_SANDBOX_ENGINE_SURFACE}, so nobody maintains it and nobody
 * can forget an entry. A hand-written table of several hundred reasons would be
 * a second list of the kind whose omissions this one exists to make visible.
 *
 * The reason every member carries is one reason, and it is the accurate one:
 * the name has no reviewed JSON-safe bridge or deterministic stand-in. Absence
 * from the surface is therefore an explicit unverified boundary, not a claim
 * that the engine lacks the capability. {@link autoMovieSandboxEngineImportRefusal}
 * states that to an author in the words of the import they wrote, together with
 * the route that still works — a project script, which runs in ordinary Node
 * against the whole engine.
 *
 * Sorted by code unit, so the order is a published fact rather than whatever
 * order the engine's own module graph happened to evaluate in.
 */
export const AUTOMOVIE_SANDBOX_WITHHELD_ENGINE_EXPORTS: readonly string[] = [
  ...AUTOMOVIE_ENGINE_RUNTIME_EXPORTS,
]
  .filter((name) => REACHABLE.has(name) === false)
  .sort(AutoMovieEngine.compareCodeUnits);

/**
 * Why one engine name a source module imported is refused, or `null` if it is not.
 *
 * A refusal that says only "runtime import" leaves an author unable to tell a
 * decided exclusion from an oversight, and unable to tell either from a typo.
 * This answers all three from facts rather than from memory: the surface says
 * what is reachable, the engine's own namespace says what exists, and the
 * difference between them is what the author is told.
 *
 * `null` for a reachable name, so a mixed import naming one reachable and one
 * withheld capability reports the withheld one only.
 */
export const autoMovieSandboxEngineImportRefusal = (props: {
  name: string;
  sourcePath: string;
}): string | null => {
  if (REACHABLE.has(props.name)) return null;
  const reachable = REACHABLE.size;
  if (AUTOMOVIE_ENGINE_RUNTIME_EXPORTS.has(props.name))
    return `Source module "${props.sourcePath}" imports "${props.name}" from "${AUTOMOVIE_SANDBOX_ENGINE_SPECIFIER}", which the engine publishes as a runtime value and the deterministic sandbox withholds because it has no reviewed JSON-safe bridge or deterministic stand-in. Use or import it from a project script under "scripts/", which runs in ordinary Node against the whole engine, or report the gap so the name joins the ${reachable} on AUTOMOVIE_SANDBOX_ENGINE_SURFACE with that boundary proved.`;
  return `Source module "${props.sourcePath}" imports "${props.name}" from "${AUTOMOVIE_SANDBOX_ENGINE_SPECIFIER}", which publishes no such name at run time, so no sandbox and no project script could supply it. Check the spelling against the ${reachable} names on AUTOMOVIE_SANDBOX_ENGINE_SURFACE, and import a type with "import type", which is erased before execution and needs no runtime name.`;
};

/**
 * One question an author asks, answered by a family of reachable engine names.
 *
 * The question is the key rather than a label beside one, because a topic label
 * is what produced the failure this index exists for: `builtEnvironmentSpaceNodes`
 * was on the surface, documented, and read, and still went uncalled at the
 * moment it was needed. A sorted inventory of identifiers is addressed by a name
 * the author already knows; a question is addressed by the thing they do not.
 */
export type AutoMovieSandboxCapabilityQuestion =
  | "How do I write a subject and a shot at all?"
  | "How do I turn a profile or a region into geometry?"
  | "How do I assemble the parts I built into one thing?"
  | "Is the mesh I built well formed?"
  | "How do I cover a surface with an element instead of a repeating texture?"
  | "What is this built out of, and does that build-up hold?"
  | "What does the building I declared actually contain?"
  | "Does this building placement rest, float, sink, or overlap?"
  | "How do I turn a declared building into the geometry a frame shows?"
  | "How do I name a part of something I placed?"
  | "How do I derive a placed object's world frame from its relation?"
  | "How do I build the site the building stands on?"
  | "How high is the ground under this point?";

/**
 * Where each question stands in the order an author meets them.
 *
 * A `Record` over the closed question union rather than a list of the same
 * strings, so a question added to the union without a place in the order is a
 * compile error. A second list would have published a question the index never
 * grouped, which is the same defect as a capability the surface never named,
 * one layer up.
 *
 * Reading order, not alphabetical: a source module is written before it has a
 * shape to build, a shape before an assembly, and a building is queried before
 * it is lowered.
 */
const QUESTION_ORDER: Readonly<
  Record<AutoMovieSandboxCapabilityQuestion, number>
> = {
  "How do I write a subject and a shot at all?": 0,
  "How do I turn a profile or a region into geometry?": 1,
  "How do I assemble the parts I built into one thing?": 2,
  "Is the mesh I built well formed?": 3,
  "How do I cover a surface with an element instead of a repeating texture?": 4,
  "What is this built out of, and does that build-up hold?": 5,
  "What does the building I declared actually contain?": 6,
  "Does this building placement rest, float, sink, or overlap?": 7,
  "How do I turn a declared building into the geometry a frame shows?": 8,
  "How do I name a part of something I placed?": 9,
  "How do I derive a placed object's world frame from its relation?": 10,
  "How do I build the site the building stands on?": 11,
  "How high is the ground under this point?": 12,
};

/**
 * The questions in the order an author meets them.
 *
 * Derived from {@link QUESTION_ORDER}, whose keys are exactly the union, so this
 * is complete by construction and a guide that walks it walks the whole surface.
 */
export const AUTOMOVIE_SANDBOX_CAPABILITY_QUESTIONS: readonly AutoMovieSandboxCapabilityQuestion[] =
  (Object.keys(QUESTION_ORDER) as readonly AutoMovieSandboxCapabilityQuestion[])
    .slice()
    .sort((left, right) => QUESTION_ORDER[left] - QUESTION_ORDER[right]);

/**
 * The question each reachable name answers.
 *
 * A `Record` over the closed surface union, so a name added to the surface
 * without a question is a compile error rather than a capability that is
 * published and unfindable — the same construction that keeps the bridge table
 * complete, applied to the half of reach that a name alone never bought.
 */
const QUESTION_OF_EXPORT: Readonly<
  Record<AutoMovieSandboxEngineExport, AutoMovieSandboxCapabilityQuestion>
> = {
  AutoMovieSubject: "How do I write a subject and a shot at all?",
  AutoMovieSubjectGroup: "How do I write a subject and a shot at all?",
  defineShot: "How do I write a subject and a shot at all?",
  mergeAutoMovieSubjectContributions:
    "How do I write a subject and a shot at all?",
  buildAutoMoviePolyhedron:
    "How do I turn a profile or a region into geometry?",
  buildAutoMovieRegionFace:
    "How do I turn a profile or a region into geometry?",
  buildAutoMovieWall: "How do I turn a profile or a region into geometry?",
  extrudeAutoMovieProfile: "How do I turn a profile or a region into geometry?",
  extrudeAutoMovieRegion: "How do I turn a profile or a region into geometry?",
  loftAutoMovieSections: "How do I turn a profile or a region into geometry?",
  revolveAutoMovieProfile: "How do I turn a profile or a region into geometry?",
  sweepAutoMovieProfile: "How do I turn a profile or a region into geometry?",
  tessellateSurface: "How do I turn a profile or a region into geometry?",
  triangulateAutoMovieRegion:
    "How do I turn a profile or a region into geometry?",
  autoMovieAssemblyOpeningReveal:
    "How do I assemble the parts I built into one thing?",
  matchAutoMovieAssemblyJunction:
    "How do I assemble the parts I built into one thing?",
  mergeAutoMovieMeshParts:
    "How do I assemble the parts I built into one thing?",
  mergeAutoMovieMeshes: "How do I assemble the parts I built into one thing?",
  transformAutoMovieMesh: "How do I assemble the parts I built into one thing?",
  inspectAutoMovieMeshTopology: "Is the mesh I built well formed?",
  autoMoviePatternInstanceTransforms:
    "How do I cover a surface with an element instead of a repeating texture?",
  autoMoviePatternTextureTransforms:
    "How do I cover a surface with an element instead of a repeating texture?",
  generateAutoMovieSurfacePattern:
    "How do I cover a surface with an element instead of a repeating texture?",
  resolveAutoMovieMaterialAssembly:
    "What is this built out of, and does that build-up hold?",
  validateAutoMovieMaterialAssembly:
    "What is this built out of, and does that build-up hold?",
  validateAutoMovieMaterialSubstance:
    "What is this built out of, and does that build-up hold?",
  builtEnvironmentAdjacentSpaces:
    "What does the building I declared actually contain?",
  builtEnvironmentBuildingOfSpace:
    "What does the building I declared actually contain?",
  builtEnvironmentContainsPoint:
    "What does the building I declared actually contain?",
  builtEnvironmentPlacementBounds:
    "Does this building placement rest, float, sink, or overlap?",
  builtEnvironmentPlacementOverlap:
    "Does this building placement rest, float, sink, or overlap?",
  builtEnvironmentSupportStatus:
    "Does this building placement rest, float, sink, or overlap?",
  builtEnvironmentSpaceBoundaries:
    "What does the building I declared actually contain?",
  builtEnvironmentSpaceConnectors:
    "What does the building I declared actually contain?",
  builtEnvironmentSpaceContentBounds:
    "What does the building I declared actually contain?",
  builtEnvironmentSpaceFidelity:
    "What does the building I declared actually contain?",
  builtEnvironmentSpaceNodes:
    "What does the building I declared actually contain?",
  builtEnvironmentSpacePopulations:
    "What does the building I declared actually contain?",
  builtEnvironmentElementBounds:
    "Does this building placement rest, float, sink, or overlap?",
  builtEnvironmentElementPartBounds:
    "Does this building placement rest, float, sink, or overlap?",
  builtInstanceSetPlacementBounds:
    "Does this building placement rest, float, sink, or overlap?",
  builtEnvironmentSpaceSurfaces:
    "What does the building I declared actually contain?",
  lowerBuiltEnvironment:
    "How do I turn a declared building into the geometry a frame shows?",
  mergeAutoMovieSpaces:
    "How do I turn a declared building into the geometry a frame shows?",
  placementChildNode: "How do I name a part of something I placed?",
  propAnchorFrame:
    "How do I derive a placed object's world frame from its relation?",
  assertWorldPlacements: "How do I build the site the building stands on?",
  worldAlongRoute: "How do I build the site the building stands on?",
  worldBlock: "How do I build the site the building stands on?",
  worldGrid: "How do I build the site the building stands on?",
  worldRamp: "How do I build the site the building stands on?",
  worldScatter: "How do I build the site the building stands on?",
  worldTerrain: "How do I build the site the building stands on?",
  worldSurfaceHeight: "How high is the ground under this point?",
};

/**
 * The reachable surface, grouped by the question each family answers.
 *
 * Derived from the per-name record rather than written out, so a family cannot
 * be described with the wrong count. `BUILT_ENVIRONMENT` called the built-environment
 * queries "the six `builtEnvironment*` queries" while eight were reachable and
 * only seven were named anywhere, and an author reading that sentence had no way
 * to learn that `builtEnvironmentSpaceFidelity` existed. A count nobody types
 * cannot drift from the surface it counts.
 * @evidence requirements/agent-authoring/partial-work.md#agent-partial-work-gap-distinction Lets an author ask whether a capability is reachable at all, so an unauthored fact and a capability AutoMovie cannot express stay distinguishable without an external substitute.
 */
export const AUTOMOVIE_SANDBOX_CAPABILITY_INDEX: readonly {
  readonly question: AutoMovieSandboxCapabilityQuestion;
  readonly names: readonly AutoMovieSandboxEngineExport[];
}[] = AUTOMOVIE_SANDBOX_CAPABILITY_QUESTIONS.map((question) => ({
  question,
  names: AUTOMOVIE_SANDBOX_ENGINE_SURFACE.filter(
    (name) => QUESTION_OF_EXPORT[name] === question,
  ),
}));
