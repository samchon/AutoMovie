import { builtSpaceObservationStations } from "@automovie/engine";
import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieBuiltOpening,
  IAutoMovieBuiltSpace,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  FACE_ROTATION,
  boxCell,
  originTransform,
} from "../internal/envelopeFixtures";
import { namedFacts, vclose } from "../internal/predicates";

/**
 * Where an interior station stands is settled against the room, not assumed.
 *
 * A room's own extent is the obvious place to lay stations out from, and it is
 * wrong for every room that is not a box: a bounding box has corners in the
 * notch of an L, a centre outside a wedge, and a reading height that leaves a
 * space narrowing upward. Each of those is a camera photographing a wall from
 * the wrong side while its receipt claims a room, which is exactly the failure
 * the derivation exists to make impossible.
 *
 * So the anchor is proved: the box centre when the space contains it, otherwise
 * a point taken from one of the space's own convex cells, and the reading height
 * only when the space still contains the eye there. What cannot be proved is
 * reported unplaced rather than guessed, because a station that vanished would
 * shrink the denominator precisely where the topology is hardest.
 *
 * Scenarios:
 *
 * 1. A space whose cells close no volume keeps its eight stations and places
 *    none, because there is no extent to lay them out in.
 * 2. A shelled space whose bounding-box centre falls outside its own solid
 *    places none either, since a shell carries no cell to take a point from.
 * 3. A space narrowing upward keeps the box centre when the reading height
 *    would leave it, instead of standing the camera in the wall.
 * 4. A two-cell space whose box centre falls in its own notch takes its anchor
 *    from the first cell that closes a volume.
 * 5. A space whose stated volume is a single point places its centre stations,
 *    which look one millimetre outward, and leaves its corner stations unaimed,
 *    because a corner and the centre are the same point there.
 * 6. An opening on a separation carrying no face keeps its threshold station
 *    and reports no place to stand, and so does an opening whose face stands so
 *    far off the room that no step toward the centre reaches inside it.
 * 7. An opening in a space with no extent at all keeps its threshold station
 *    without the opening ever being placed, because there is no anchor to walk
 *    toward.
 */
export const test_architecture_space_station_placement = (): void => {
  TestValidator.equals(
    "a space that closes no volume keeps its stations and places none",
    unplaced(
      builtSpaceObservationStations(
        room(
          {
            id: "hall",
            kind: "room",
            parent: null,
            cells: [
              {
                id: "sky",
                planes: [{ normal: { x: 0, y: 1, z: 0 }, offset: 3 }],
              },
            ],
          },
          [{ id: "gap", kind: "passage", boundary: "located", fill: null }],
          [locatedWall()],
        ),
        "hall",
      ),
    ),
    { count: 9, placed: 0 },
  );

  TestValidator.equals(
    "a shell whose box centre is outside itself places nothing",
    unplaced(builtSpaceObservationStations(room(tetrahedron()), "hall")),
    { count: 8, placed: 0 },
  );

  TestValidator.equals(
    "an anchor is taken from the room rather than from its box",
    namedFacts([
      [
        "a space narrowing upward keeps its box centre",
        () =>
          vclose(
            builtSpaceObservationStations(room(wedge()), "hall")[0]!.pose!
              .position,
            { x: 2, y: 2, z: 1 },
          ),
      ],
      [
        "a space whose box centre is in its own notch uses its first cell",
        () =>
          vclose(
            builtSpaceObservationStations(room(notched()), "hall")[0]!.pose!
              .position,
            { x: 2, y: 1.5, z: 0.5 },
          ),
      ],
    ]),
    {
      "a space narrowing upward keeps its box centre": true,
      "a space whose box centre is in its own notch uses its first cell": true,
    },
  );

  const point = builtSpaceObservationStations(room(pointVolume()), "hall");

  TestValidator.equals(
    "a point-sized volume looks outward from itself and never at itself",
    namedFacts([
      [
        "its centre stations look one millimetre along each axis",
        () =>
          point
            .filter((station) => station.role === "center")
            .every((station) => station.pose !== null) &&
          vclose(point[1]!.pose!.target, { x: 0.001, y: 0, z: 0 }),
      ],
      [
        "and its corner stations have nothing to aim at",
        () =>
          point
            .filter((station) => station.role === "corner")
            .every((station) => station.pose === null),
      ],
    ]),
    {
      "its centre stations look one millimetre along each axis": true,
      "and its corner stations have nothing to aim at": true,
    },
  );

  const faceless = builtSpaceObservationStations(withFacelessOpening(), "hall");

  TestValidator.equals(
    "an unreachable opening keeps its threshold station, unplaced",
    faceless
      .filter((station) => station.role === "threshold")
      .map((station) => [station.id, station.pose]),
    [
      ["threshold-distant-gap", null],
      ["threshold-gap", null],
    ],
  );
};

/** One located separation on the north side of the four-by-six hall. */
const locatedWall = (): IAutoMovieBuiltEnvironment["boundaries"][number] => ({
  id: "located",
  kind: "wall",
  spaces: ["hall"],
  elements: [],
  face: {
    origin: { x: 0, y: 0, z: 6 },
    rotation: FACE_ROTATION.keepZ,
    outline: [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 3 },
      { x: 0, y: 3 },
    ],
    thickness: 0.2,
  },
});

/** How many stations came back and how many of them found a place to stand. */
const unplaced = (
  stations: ReadonlyArray<{ pose: unknown }>,
): { count: number; placed: number } => ({
  count: stations.length,
  placed: stations.filter((station) => station.pose !== null).length,
});

/** One building unit wrapped around one hand-written logical space. */
const room = (
  space: IAutoMovieBuiltSpace,
  openings: IAutoMovieBuiltOpening[] = [],
  boundaries: IAutoMovieBuiltEnvironment["boundaries"] = [],
): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "placement",
  units: "meter",
  buildings: [{ id: "house", element: "house-root", space: space.id }],
  models: [],
  modelReferences: [],
  elements: [
    {
      id: "house-root",
      kind: "building",
      parent: null,
      transform: originTransform(),
      model: null,
      space: space.id,
    },
  ],
  spaces: [space],
  boundaries,
  openings,
  connectors: [],
  surfaces: [],
  walkable: [],
});

/**
 * The tetrahedron on the origin and the three unit axes.
 *
 * Its bounding box is the unit cube, whose centre sums to `1.5` against a
 * closing plane at `1`, so the box centre is outside the solid.
 */
const tetrahedron = (): IAutoMovieBuiltSpace => ({
  id: "hall",
  kind: "room",
  parent: null,
  cells: [],
  shell: {
    vertices: [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: 0, z: 1 },
    ],
    // Every face wound counter-clockwise seen from outside the solid.
    triangles: [0, 2, 1, 0, 3, 2, 0, 1, 3, 1, 2, 3],
  },
});

/**
 * A room whose section narrows upward, cut by the half-space `x <= y`.
 *
 * Its box centre lies exactly on that cut and is inside; the reading height one
 * point six metres up is not, so the anchor stays the centre.
 */
const wedge = (): IAutoMovieBuiltSpace => ({
  id: "hall",
  kind: "room",
  parent: null,
  cells: [
    {
      id: "wedge-cell",
      planes: [
        ...boxCell("box", { x: 0, y: 0, z: 0 }, { x: 4, y: 4, z: 2 }).planes,
        { normal: { x: 1, y: -1, z: 0 }, offset: 0 },
      ],
    },
  ],
});

/**
 * An L whose bounding-box centre falls in its own notch.
 *
 * The long arm runs four metres in x and one in z; the short arm one metre in x
 * and three more in z. The box centre at `(2, ·, 2)` is in neither.
 */
const notched = (): IAutoMovieBuiltSpace => ({
  id: "hall",
  kind: "room",
  parent: null,
  cells: [
    // A half-space five metres under the floor closes no volume and holds no
    // point of the room, so the anchor walk must pass over it to reach the arm.
    { id: "below", planes: [{ normal: { x: 0, y: 1, z: 0 }, offset: -5 }] },
    boxCell("long", { x: 0, y: 0, z: 0 }, { x: 4, y: 3, z: 1 }),
    boxCell("short", { x: 0, y: 0, z: 1 }, { x: 1, y: 3, z: 4 }),
  ],
});

/** A stated volume that is one point, closed by six planes through the origin. */
const pointVolume = (): IAutoMovieBuiltSpace => ({
  id: "hall",
  kind: "room",
  parent: null,
  cells: [boxCell("point", { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })],
});

/**
 * A room whose two openings are each unreachable for a different reason.
 *
 * `gap` is declared on a separation that states no face, so nothing says where
 * its mouth is. `distant-gap` has a face fifty metres east of the room, so its
 * mouth is real and every step of the ladder toward the room's centre is still
 * outside the room.
 */
const withFacelessOpening = (): IAutoMovieBuiltEnvironment =>
  room(
    {
      id: "hall",
      kind: "room",
      parent: null,
      cells: [boxCell("hall-cell", { x: 0, y: 0, z: 0 }, { x: 4, y: 3, z: 6 })],
    },
    [
      { id: "gap", kind: "passage", boundary: "logical", fill: null },
      { id: "distant-gap", kind: "passage", boundary: "distant", fill: null },
    ],
    [
      { id: "logical", kind: "threshold", spaces: ["hall"], elements: [] },
      locatedWall(),
      {
        id: "distant",
        kind: "wall",
        spaces: ["hall"],
        elements: [],
        face: {
          origin: { x: 50, y: 0, z: 0 },
          rotation: FACE_ROTATION.keepZ,
          outline: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 3 },
            { x: 0, y: 3 },
          ],
          thickness: 0.2,
        },
      },
    ],
  );
