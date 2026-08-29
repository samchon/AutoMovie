import {
  builtEnvironmentEnvelopeFaces,
  validateBuiltEnvironment,
} from "@automovie/engine";
import type { IAutoMovieBuiltEnvironment } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  FACE_ROTATION,
  boxCell,
  originTransform,
  rectangularBuilding,
} from "../internal/envelopeFixtures";
import { namedFacts, vclose } from "../internal/predicates";

/**
 * The exposed envelope is what encloses one space, read from its own geometry.
 *
 * A review of a building is counted over its facades, its corners and its roof,
 * and none of those is a field anybody authors. What the record does carry is
 * which regions a separation stands between, so the separation that encloses
 * exactly one space is the one with nothing behind it, and that is the whole
 * definition of exposed. The direction it faces and whether it reads in
 * elevation or from above follow from the same face frame.
 *
 * Two things here are deliberately not taken on trust. A face states its own
 * outward `+Z`, and a frame written the other way round would aim every derived
 * camera into the wall it was meant to photograph, so the outward direction is
 * settled by asking the space which side it is on rather than by reading the
 * winding. And the facade/roof split comes from the normal rather than from the
 * boundary's `kind`, because `kind` is an open label a production chooses and
 * two records naming the same slope differently must still owe the same views.
 *
 * Scenarios:
 *
 * 1. The rectangular hall is a legal building, so the rule is read off a record
 *    the engine accepts.
 * 2. Its six enclosing separations come back in boundary-id order, each with the
 *    building and space that own it.
 * 3. Four wall faces read as `facade`, the ceiling slab as `roof`, and the
 *    ground slab as `underside`, from their normals alone.
 * 4. The east wall's world outline, centroid and outward normal equal the metres
 *    typed by hand from the fixture's own frame.
 * 5. A separation between two spaces, a separation carrying no face, and a
 *    separation citing a space the record does not hold are all absent, because
 *    none of the three is an exposed face of anything.
 * 6. A face whose authored `+Z` points into its own space is reported pointing
 *    out of it.
 * 7. A face whose outline encloses no area still reports a centroid, taken from
 *    the mean of its own points.
 */
export const test_architecture_envelope_faces = (): void => {
  const record = rectangularBuilding();

  TestValidator.equals(
    "the rectangular hall is a legal building",
    validateBuiltEnvironment({ environment: record }).success,
    true,
  );

  const faces = builtEnvironmentEnvelopeFaces(record);

  TestValidator.equals(
    "every enclosing separation is an exposed face, in boundary order",
    faces.map((face) => [
      face.boundary,
      face.aspect,
      face.building,
      face.space,
    ]),
    [
      ["floor-slab", "underside", "house", "hall"],
      ["roof-top", "roof", "house", "hall"],
      ["wall-east", "facade", "house", "hall"],
      ["wall-north", "facade", "house", "hall"],
      ["wall-south", "facade", "house", "hall"],
      ["wall-west", "facade", "house", "hall"],
    ],
  );

  const east = faces.find((face) => face.boundary === "wall-east");

  TestValidator.equals(
    "the east wall is placed and turned exactly as its frame says",
    namedFacts([
      [
        "its outline runs from the north-east corner to the south-east one",
        () =>
          east !== undefined &&
          east.vertices.length === 4 &&
          vclose(east.vertices[0]!, { x: 4, y: 0, z: 6 }) &&
          vclose(east.vertices[1]!, { x: 4, y: 0, z: 0 }) &&
          vclose(east.vertices[2]!, { x: 4, y: 3, z: 0 }) &&
          vclose(east.vertices[3]!, { x: 4, y: 3, z: 6 }),
      ],
      [
        "its centroid is the middle of that rectangle",
        () =>
          east !== undefined && vclose(east.centroid, { x: 4, y: 1.5, z: 3 }),
      ],
      [
        "and it faces away from the hall",
        () => east !== undefined && vclose(east.normal, { x: 1, y: 0, z: 0 }),
      ],
      [
        "carrying its own kind and thickness",
        () =>
          east !== undefined && east.kind === "wall" && east.thickness === 0.2,
      ],
    ]),
    {
      "its outline runs from the north-east corner to the south-east one": true,
      "its centroid is the middle of that rectangle": true,
      "and it faces away from the hall": true,
      "carrying its own kind and thickness": true,
    },
  );

  TestValidator.equals(
    "the roof faces up and the floor faces down",
    namedFacts([
      [
        "the ceiling slab's normal is world up",
        () =>
          vclose(faces.find((face) => face.boundary === "roof-top")!.normal, {
            x: 0,
            y: 1,
            z: 0,
          }),
      ],
      [
        "the ground slab's normal is world down",
        () =>
          vclose(faces.find((face) => face.boundary === "floor-slab")!.normal, {
            x: 0,
            y: -1,
            z: 0,
          }),
      ],
    ]),
    {
      "the ceiling slab's normal is world up": true,
      "the ground slab's normal is world down": true,
    },
  );

  const odd = builtEnvironmentEnvelopeFaces(oddBoundaries());

  TestValidator.equals(
    "only the two exposed separations of the odd record are faces",
    odd.map((face) => face.boundary),
    ["degenerate", "flipped"],
  );

  TestValidator.equals(
    "an inward frame is reported outward, and a flat outline still has a centre",
    namedFacts([
      [
        "the inward-wound face points out of the hall",
        () =>
          vclose(odd.find((face) => face.boundary === "flipped")!.normal, {
            x: 0,
            y: 0,
            z: 1,
          }),
      ],
      [
        "the arealess face reports the mean of its own points",
        () =>
          vclose(odd.find((face) => face.boundary === "degenerate")!.centroid, {
            x: 1,
            y: 0,
            z: 6,
          }),
      ],
    ]),
    {
      "the inward-wound face points out of the hall": true,
      "the arealess face reports the mean of its own points": true,
    },
  );
};

/**
 * One deliberately malformed record holding every separation that is not a face.
 *
 * It cites a space the record does not hold, so `validateBuiltEnvironment`
 * refuses it and no scenario above asks it to pass. What it is here for is the
 * three ways a separation fails to be exposed and the two ways an exposed one is
 * awkward, all in one read.
 */
const oddBoundaries = (): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "odd",
  units: "meter",
  buildings: [{ id: "house", element: "house-root", space: "hall" }],
  models: [],
  modelReferences: [],
  elements: [
    {
      id: "house-root",
      kind: "building",
      parent: null,
      transform: originTransform(),
      model: null,
      space: "hall",
    },
  ],
  spaces: [
    {
      id: "hall",
      kind: "room",
      parent: null,
      cells: [boxCell("hall-cell", { x: 0, y: 0, z: 0 }, { x: 4, y: 3, z: 6 })],
    },
    {
      id: "annex",
      kind: "room",
      parent: "hall",
      cells: [
        boxCell("annex-cell", { x: 4, y: 0, z: 0 }, { x: 6, y: 3, z: 6 }),
      ],
    },
  ],
  boundaries: [
    {
      id: "partition",
      kind: "wall",
      spaces: ["hall", "annex"],
      elements: [],
      face: {
        origin: { x: 4, y: 0, z: 6 },
        rotation: FACE_ROTATION.quarterY,
        outline: [
          { x: 0, y: 0 },
          { x: 6, y: 0 },
          { x: 6, y: 3 },
          { x: 0, y: 3 },
        ],
        thickness: 0.2,
      },
    },
    {
      id: "logical",
      kind: "threshold",
      spaces: ["hall"],
      elements: [],
    },
    {
      id: "orphan",
      kind: "wall",
      spaces: ["ghost"],
      elements: [],
      face: {
        origin: { x: 0, y: 0, z: 0 },
        rotation: FACE_ROTATION.keepZ,
        outline: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
        ],
        thickness: 0.2,
      },
    },
    {
      id: "flipped",
      kind: "wall",
      spaces: ["hall"],
      elements: [],
      face: {
        origin: { x: 4, y: 0, z: 6 },
        rotation: FACE_ROTATION.halfTurnY,
        outline: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 4, y: 3 },
          { x: 0, y: 3 },
        ],
        thickness: 0.2,
      },
    },
    {
      id: "degenerate",
      kind: "wall",
      spaces: ["hall"],
      elements: [],
      face: {
        origin: { x: 0, y: 0, z: 6 },
        rotation: FACE_ROTATION.keepZ,
        outline: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 2, y: 0 },
        ],
        thickness: 0.2,
      },
    },
  ],
  openings: [],
  connectors: [],
  surfaces: [],
  walkable: [],
});
