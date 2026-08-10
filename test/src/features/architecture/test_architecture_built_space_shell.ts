import {
  builtEnvironmentContainsPoint,
  builtEnvironmentSpaceFidelity,
  builtSpaceContainsPoint,
  builtSpaceIsConvex,
  builtSpaceShellVolume,
  builtSpaceStatesVolume,
  deriveAutoMovieDrawing,
  measureAutoMovieQuantities,
  validateBuiltEnvironment,
} from "@automovie/engine";
import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieBuiltSpace,
  IAutoMovieSpaceShell,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { drawingView } from "../internal/drawingFixtures";
import { createModel } from "../internal/fixtures";
import { hasViolation, namedFacts, nclose } from "../internal/predicates";

/** The eight corners and twelve outward facets of an axis-aligned box. */
const boxShell = (
  min: IAutoMovieVector3,
  max: IAutoMovieVector3,
  outward = true,
): IAutoMovieSpaceShell => {
  const vertices: IAutoMovieVector3[] = [
    { x: min.x, y: min.y, z: min.z },
    { x: max.x, y: min.y, z: min.z },
    { x: max.x, y: min.y, z: max.z },
    { x: min.x, y: min.y, z: max.z },
    { x: min.x, y: max.y, z: min.z },
    { x: max.x, y: max.y, z: min.z },
    { x: max.x, y: max.y, z: max.z },
    { x: min.x, y: max.y, z: max.z },
  ];
  const triangles = [
    0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 3, 2, 6, 3, 6, 7, 0, 5, 1, 0, 4, 5, 0,
    3, 7, 0, 7, 4, 1, 5, 6, 1, 6, 2,
  ];
  if (outward) return { vertices, triangles };
  const flipped: number[] = [];
  for (let face = 0; face < triangles.length; face += 3)
    flipped.push(triangles[face]!, triangles[face + 2]!, triangles[face + 1]!);
  return { vertices, triangles: flipped };
};

/** One shell holding two, the inner one wound inward so it reads as a void. */
const merge = (
  outer: IAutoMovieSpaceShell,
  inner: IAutoMovieSpaceShell,
): IAutoMovieSpaceShell => ({
  vertices: [...outer.vertices, ...inner.vertices],
  triangles: [
    ...outer.triangles,
    ...inner.triangles.map((index) => index + outer.vertices.length),
  ],
});

/** A 10x4x10 hall with a 4x4x4 atrium void standing in the middle of it. */
const HALL = merge(
  boxShell({ x: 0, y: 0, z: 0 }, { x: 10, y: 4, z: 10 }),
  boxShell({ x: 3, y: 0, z: 3 }, { x: 7, y: 4, z: 7 }, false),
);

const work = (
  space: Partial<IAutoMovieBuiltSpace>,
): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "gallery",
  units: "meter",
  buildings: [{ id: "block", element: "root", space: "whole" }],
  models: [{ ...createModel(null), id: "stone" }],
  modelReferences: [],
  elements: [
    {
      id: "root",
      kind: "building",
      parent: null,
      transform: {
        translation: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 },
      },
      model: "stone",
      space: "whole",
    },
  ],
  spaces: [
    { id: "whole", kind: "building", parent: null, cells: [] },
    {
      id: "hall",
      kind: "room",
      parent: "whole",
      cells: [],
      shell: HALL,
      ...space,
    },
  ],
  boundaries: [],
  openings: [],
  connectors: [],
  surfaces: [],
  walkable: [],
});

const spaceOf = (
  environment: IAutoMovieBuiltEnvironment,
  id: string,
): IAutoMovieBuiltSpace =>
  environment.spaces.find((candidate) => candidate.id === id)!;

/**
 * A logical volume may be its own closed boundary, and that boundary may have a
 * void through it.
 *
 * Half-space cells state every polyhedral region exactly, but a region pierced
 * by an atrium is a chore to decompose and a curved region cannot be stated at
 * all — the exact gap #1868 names, and the one IFC keeps a `Brep` fallback and
 * an `IfcFacetedBrepWithVoids` open for. This case pins that the escape hatch
 * is exact where it claims to be and refuses everything a query could not read,
 * and that what it still cannot do is reported rather than smoothed over.
 *
 * Scenarios:
 *
 * 1. A shelled hall with an atrium void: a point in the room is inside, a point in
 *    the void is **outside**, a point beyond the hall is outside, and a point
 *    on the hall's own face, edge and corner is inside — the corner case being
 *    the one a bare solid-angle test gets wrong.
 * 2. The enclosed volume is the outer box less the void, exactly.
 * 3. A space states its volume once: carrying cells beside a shell is refused.
 * 4. A shell is held to what makes its inside a fact — too few vertices, too few
 *    triangles, a ragged index count, an index naming no vertex, a degenerate
 *    facet, an unmatched directed edge, a doubled facet, and a shell wound
 *    inside out are each refused.
 * 5. `fidelity` is a closed word, may not be declared by a space that states no
 *    volume, and folds over descendants: a faceted hall makes its own building
 *    faceted, a volume-less subtree is `unstated`.
 * 6. The quantity take-off measures a shell exactly, and reports a faceted space
 *    as its own `unsupported` gap rather than quoting facets as a curve.
 * 7. The drafter cannot section a shell and says so: a cut sheet of the shelled
 *    hall draws no region for it and carries an `unsupported` gap naming the
 *    subject, while the same sheet of a celled hall draws the region and raises
 *    no such gap.
 * 8. Either spelling answers one set of questions: `builtSpaceStatesVolume` and
 *    `builtSpaceIsConvex` read a shell, one cell, several cells and nothing at
 *    all without any caller counting cells for itself.
 * 9. A shell nobody validated is read as the arithmetic says rather than thrown
 *    over: an index naming no vertex contributes no facet to the volume or the
 *    winding, and a facet with no area is skipped rather than summed as a `NaN`
 *    that would poison every later answer.
 */
export const test_architecture_built_space_shell = (): void => {
  const shelled = work({});
  TestValidator.equals(
    "a shelled hall holds its room and not its atrium",
    namedFacts([
      [
        "valid",
        () => validateBuiltEnvironment({ environment: shelled }).success,
      ],
      [
        "inTheRoom",
        () =>
          builtEnvironmentContainsPoint(shelled, "hall", { x: 1, y: 2, z: 1 }),
      ],
      [
        "inTheAtrium",
        () =>
          builtEnvironmentContainsPoint(shelled, "hall", {
            x: 5,
            y: 2,
            z: 5,
          }) === false,
      ],
      [
        "beyondTheHall",
        () =>
          builtEnvironmentContainsPoint(shelled, "hall", {
            x: 12,
            y: 2,
            z: 5,
          }) === false,
      ],
      [
        "onAFace",
        () =>
          builtEnvironmentContainsPoint(shelled, "hall", { x: 0, y: 2, z: 5 }),
      ],
      [
        "onAnEdge",
        () =>
          builtEnvironmentContainsPoint(shelled, "hall", { x: 0, y: 0, z: 5 }),
      ],
      [
        "inACorner",
        () =>
          builtEnvironmentContainsPoint(shelled, "hall", { x: 0, y: 0, z: 0 }),
      ],
      [
        "onTheAtriumWall",
        () =>
          builtEnvironmentContainsPoint(shelled, "hall", { x: 3, y: 2, z: 5 }),
      ],
      [
        "throughTheParent",
        () =>
          builtEnvironmentContainsPoint(shelled, "whole", { x: 1, y: 2, z: 1 }),
      ],
    ]),
    {
      valid: true,
      inTheRoom: true,
      inTheAtrium: true,
      beyondTheHall: true,
      onAFace: true,
      onAnEdge: true,
      inACorner: true,
      onTheAtriumWall: true,
      throughTheParent: true,
    },
  );

  TestValidator.predicate(
    "the shell encloses the hall less its atrium, exactly",
    nclose(builtSpaceShellVolume(HALL), 10 * 4 * 10 - 4 * 4 * 4, 1e-9),
  );

  const cube = boxShell({ x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 2 });
  const refuse = (shell: IAutoMovieSpaceShell): boolean =>
    hasViolation(
      validateBuiltEnvironment({ environment: work({ shell }) }),
      "range",
      ".shell",
    ) ||
    hasViolation(
      validateBuiltEnvironment({ environment: work({ shell }) }),
      "type",
      ".shell",
    );

  TestValidator.equals(
    "a shell is held to what makes its inside a fact",
    namedFacts([
      ["aWholeCubePasses", () => refuse(cube) === false],
      [
        "bothSpellingsAtOnce",
        () =>
          hasViolation(
            validateBuiltEnvironment({
              environment: work({
                cells: [
                  {
                    id: "box",
                    planes: [
                      { normal: { x: 1, y: 0, z: 0 }, offset: 1 },
                      { normal: { x: -1, y: 0, z: 0 }, offset: 0 },
                      { normal: { x: 0, y: 1, z: 0 }, offset: 1 },
                      { normal: { x: 0, y: -1, z: 0 }, offset: 0 },
                    ],
                  },
                ],
              }),
            }),
            "type",
            ".shell",
          ),
      ],
      [
        "tooFewVertices",
        () =>
          refuse({
            vertices: cube.vertices.slice(0, 3),
            triangles: [0, 1, 2, 0, 2, 1, 1, 2, 0, 2, 1, 0],
          }),
      ],
      [
        "tooFewTriangles",
        () => refuse({ ...cube, triangles: cube.triangles.slice(0, 9) }),
      ],
      [
        "aRaggedIndexCount",
        () => refuse({ ...cube, triangles: [...cube.triangles, 0] }),
      ],
      [
        "anIndexNamingNoVertex",
        () =>
          refuse({
            ...cube,
            triangles: cube.triangles.map((index, at) =>
              at === 0 ? 99 : index,
            ),
          }),
      ],
      [
        "aFractionalIndex",
        () =>
          refuse({
            ...cube,
            triangles: cube.triangles.map((index, at) =>
              at === 0 ? 0.5 : index,
            ),
          }),
      ],
      [
        "aDegenerateFacet",
        () =>
          refuse({
            ...cube,
            triangles: cube.triangles.map((index, at) =>
              at === 1 ? 0 : index,
            ),
          }),
      ],
      [
        "anUnmatchedEdge",
        () => refuse({ ...cube, triangles: cube.triangles.slice(0, 33) }),
      ],
      [
        "aDoubledFacet",
        () =>
          refuse({
            ...cube,
            triangles: [...cube.triangles, ...cube.triangles.slice(0, 3)],
          }),
      ],
      [
        "aShellWoundInsideOut",
        () =>
          refuse(boxShell({ x: 0, y: 0, z: 0 }, { x: 2, y: 2, z: 2 }, false)),
      ],
      [
        "aNonFiniteVertex",
        () =>
          refuse({
            ...cube,
            vertices: cube.vertices.map((vertex, at) =>
              at === 0 ? { ...vertex, y: Number.NaN } : vertex,
            ),
          }),
      ],
    ]),
    {
      aWholeCubePasses: true,
      bothSpellingsAtOnce: true,
      tooFewVertices: true,
      tooFewTriangles: true,
      aRaggedIndexCount: true,
      anIndexNamingNoVertex: true,
      aFractionalIndex: true,
      aDegenerateFacet: true,
      anUnmatchedEdge: true,
      aDoubledFacet: true,
      aShellWoundInsideOut: true,
      aNonFiniteVertex: true,
    },
  );

  const faceted = work({ fidelity: "faceted" });
  TestValidator.equals(
    "a faceted volume says so, and says it for everything above it",
    namedFacts([
      [
        "facetedValidates",
        () => validateBuiltEnvironment({ environment: faceted }).success,
      ],
      [
        "exactValidates",
        () =>
          validateBuiltEnvironment({ environment: work({ fidelity: "exact" }) })
            .success,
      ],
      [
        "junkWordRefused",
        () =>
          hasViolation(
            validateBuiltEnvironment({
              environment: work({
                fidelity: "approximate" as IAutoMovieBuiltSpace["fidelity"],
              }),
            }),
            "type",
            ".fidelity",
          ),
      ],
      [
        "nothingToApproximate",
        () => {
          const environment = work({});
          spaceOf(environment, "whole").fidelity = "faceted";
          return hasViolation(
            validateBuiltEnvironment({ environment }),
            "type",
            ".fidelity",
          );
        },
      ],
      [
        "theHallIsExactByDefault",
        () => builtEnvironmentSpaceFidelity(shelled, "hall") === "exact",
      ],
      [
        "theFacetedHallIsFaceted",
        () => builtEnvironmentSpaceFidelity(faceted, "hall") === "faceted",
      ],
      [
        "andSoIsTheBuildingOverIt",
        () => builtEnvironmentSpaceFidelity(faceted, "whole") === "faceted",
      ],
      [
        "aVolumelessSubtreeIsUnstated",
        () => {
          const environment = work({});
          delete spaceOf(environment, "hall").shell;
          return (
            builtEnvironmentSpaceFidelity(environment, "whole") === "unstated"
          );
        },
      ],
    ]),
    {
      facetedValidates: true,
      exactValidates: true,
      junkWordRefused: true,
      nothingToApproximate: true,
      theHallIsExactByDefault: true,
      theFacetedHallIsFaceted: true,
      andSoIsTheBuildingOverIt: true,
      aVolumelessSubtreeIsUnstated: true,
    },
  );

  TestValidator.equals(
    "the take-off measures the shell and owns up to the facets",
    namedFacts([
      [
        "shellVolumeIsMeasured",
        () => {
          const finding = measureAutoMovieQuantities({
            environment: shelled,
          }).findings.find((entry) => entry.subject === "space-volume")!;
          return (
            finding.contributors.some(
              (contributor) =>
                contributor.owner === "hall" &&
                nclose(contributor.value, 336, 1e-6),
            ) && nclose(finding.total, 336, 1e-6)
          );
        },
      ],
      [
        "anExactSpaceRaisesNoCurvatureGap",
        () =>
          measureAutoMovieQuantities({ environment: shelled }).gaps.some(
            (gap) => gap.subject === "curved-space-boundary",
          ) === false,
      ],
      [
        "aFacetedSpaceRaisesOne",
        () =>
          measureAutoMovieQuantities({ environment: faceted }).gaps.some(
            (gap) =>
              gap.subject === "curved-space-boundary" &&
              gap.status === "unsupported" &&
              gap.reason.includes("hall"),
          ),
      ],
    ]),
    {
      shellVolumeIsMeasured: true,
      anExactSpaceRaisesNoCurvatureGap: true,
      aFacetedSpaceRaisesOne: true,
    },
  );

  const celled = work({
    shell: undefined,
    cells: [
      {
        id: "box",
        planes: [
          { normal: { x: 1, y: 0, z: 0 }, offset: 10 },
          { normal: { x: -1, y: 0, z: 0 }, offset: 0 },
          { normal: { x: 0, y: 1, z: 0 }, offset: 4 },
          { normal: { x: 0, y: -1, z: 0 }, offset: 0 },
          { normal: { x: 0, y: 0, z: 1 }, offset: 10 },
          { normal: { x: 0, y: 0, z: -1 }, offset: 0 },
        ],
      },
    ],
  });
  const plan = drawingView({ origin: { x: 0, y: 2, z: 0 } });
  TestValidator.equals(
    "a shell is a section the drafter cannot cut, and it says which",
    namedFacts([
      [
        "theShelledHallDrawsNoRegion",
        () =>
          deriveAutoMovieDrawing({ environment: shelled, view: plan }).regions
            .length === 0,
      ],
      [
        "andTheSheetNamesTheSubject",
        () =>
          deriveAutoMovieDrawing({
            environment: shelled,
            view: plan,
          }).gaps.some(
            (gap) =>
              gap.subject === "shelled-space-section" &&
              gap.status === "unsupported",
          ),
      ],
      [
        "aCelledHallDrawsItsRegion",
        () =>
          deriveAutoMovieDrawing({ environment: celled, view: plan }).regions
            .length === 1,
      ],
      [
        "andRaisesNoSuchGap",
        () =>
          deriveAutoMovieDrawing({ environment: celled, view: plan }).gaps.some(
            (gap) => gap.subject === "shelled-space-section",
          ) === false,
      ],
    ]),
    {
      theShelledHallDrawsNoRegion: true,
      andTheSheetNamesTheSubject: true,
      aCelledHallDrawsItsRegion: true,
      andRaisesNoSuchGap: true,
    },
  );

  const twoCells = work({
    shell: undefined,
    cells: [
      ...spaceOf(celled, "hall").cells,
      { ...spaceOf(celled, "hall").cells[0]!, id: "second" },
    ],
  });
  TestValidator.equals(
    "one set of questions, whichever spelling answered them",
    namedFacts([
      [
        "aShellIsAVolume",
        () => builtSpaceStatesVolume(spaceOf(shelled, "hall")),
      ],
      ["aCellIsAVolume", () => builtSpaceStatesVolume(spaceOf(celled, "hall"))],
      [
        "aNameIsNot",
        () => builtSpaceStatesVolume(spaceOf(shelled, "whole")) === false,
      ],
      ["oneCellIsConvex", () => builtSpaceIsConvex(spaceOf(celled, "hall"))],
      [
        "twoCellsAreNot",
        () => builtSpaceIsConvex(spaceOf(twoCells, "hall")) === false,
      ],
      [
        "aShellIsNot",
        () => builtSpaceIsConvex(spaceOf(shelled, "hall")) === false,
      ],
      [
        "andNeitherIsANameWithNoCells",
        () => builtSpaceIsConvex(spaceOf(shelled, "whole")) === false,
      ],
    ]),
    {
      aShellIsAVolume: true,
      aCellIsAVolume: true,
      aNameIsNot: true,
      oneCellIsConvex: true,
      twoCellsAreNot: true,
      aShellIsNot: true,
      andNeitherIsANameWithNoCells: true,
    },
  );

  const dangling: IAutoMovieSpaceShell = {
    vertices: [],
    triangles: cube.triangles,
  };
  const flat: IAutoMovieSpaceShell = {
    vertices: cube.vertices,
    triangles: cube.triangles.map((index, at) => (at === 1 ? 0 : index)),
  };
  TestValidator.equals(
    "an unvalidated shell is read as the arithmetic says",
    namedFacts([
      ["danglingEnclosesNothing", () => builtSpaceShellVolume(dangling) === 0],
      [
        "danglingHoldsNothing",
        () =>
          builtSpaceContainsPoint(
            { id: "x", kind: "room", parent: null, cells: [], shell: dangling },
            { x: 1, y: 1, z: 1 },
          ) === false,
      ],
      [
        "aFlatFacetIsSkippedRatherThanSummed",
        () =>
          builtSpaceContainsPoint(
            { id: "x", kind: "room", parent: null, cells: [], shell: flat },
            { x: 1, y: 1, z: 1 },
          ),
      ],
      [
        "andWhatItLeavesOpenStaysOutside",
        () =>
          builtSpaceContainsPoint(
            { id: "x", kind: "room", parent: null, cells: [], shell: flat },
            { x: 9, y: 9, z: 9 },
          ) === false,
      ],
    ]),
    {
      danglingEnclosesNothing: true,
      danglingHoldsNothing: true,
      aFlatFacetIsSkippedRatherThanSummed: true,
      andWhatItLeavesOpenStaysOutside: true,
    },
  );
};
