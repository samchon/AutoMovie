import {
  builtSpaceContainsPoint,
  builtSpaceObservationStations,
} from "@automovie/engine";
import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieVector3,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  lFootprintBuilding,
  rectangularBuilding,
} from "../internal/envelopeFixtures";
import { namedFacts, throwsError, vclose } from "../internal/predicates";

/**
 * A room owes nine views from inside itself, and the caller picks none of them.
 *
 * The survey guidance draws a room as one doorway view, four inward views from
 * distinct corners, and four outward views from the centre. That population is
 * derived here from the room's own stated volume and the openings on its own
 * boundaries, so a reviewer cannot cover a space with a few flattering angles
 * and read complete, and a room with more doors owes more views rather than the
 * same nine.
 *
 * The camera has to be inside. A turntable circling a room's bounding box
 * photographs the outside of its walls, which is why every station's point is
 * proved against the space's own volume before it is handed back, and why a
 * point that cannot be placed leaves its station present and unplaced instead
 * of quietly leaving the denominator.
 *
 * Scenarios:
 *
 * 1. The rectangular hall owes exactly nine stations, in one deterministic
 *    order: four from its centre, four from its corners, one at its door.
 * 2. Every one of those positions equals the metres typed by hand from the
 *    room's own extent, and each is inside the room's own stated volume.
 * 3. The centre stations look along the four horizontal axes and the corner and
 *    threshold stations look back at the centre.
 * 4. A second opening on the same room adds a tenth station, so the population
 *    follows the topology rather than a fixed count. An uncut opening is placed
 *    from its host face, since a passage with no void still has an arrival.
 * 5. The L-shaped wing owes eight stations and no threshold, and the corner of
 *    its bounding box that falls in the notch is present with no pose, because
 *    no point on the ladder toward the centre is inside the room.
 * 6. A space that states no volume is a name rather than a room and owes
 *    nothing.
 * 7. A space the record does not hold is refused by name.
 */
export const test_architecture_space_stations = (): void => {
  const record = rectangularBuilding();
  const hall = record.spaces[0]!;
  const stations = builtSpaceObservationStations(record, "hall");

  TestValidator.equals(
    "the hall owes its nine interior stations in a fixed order",
    stations.map((station) => [station.id, station.role, station.opening]),
    [
      ["center-x-minus", "center", null],
      ["center-x-plus", "center", null],
      ["center-z-minus", "center", null],
      ["center-z-plus", "center", null],
      ["corner-x-minus-z-minus", "corner", null],
      ["corner-x-minus-z-plus", "corner", null],
      ["corner-x-plus-z-minus", "corner", null],
      ["corner-x-plus-z-plus", "corner", null],
      ["threshold-door-main", "threshold", "door-main"],
    ],
  );

  TestValidator.equals(
    "every station stands at the metre it was derived to stand at",
    placedAt(stations, [
      { x: 2, y: 1.5, z: 3 },
      { x: 2, y: 1.5, z: 3 },
      { x: 2, y: 1.5, z: 3 },
      { x: 2, y: 1.5, z: 3 },
      { x: 0.1, y: 1.5, z: 0.15 },
      { x: 0.1, y: 1.5, z: 5.85 },
      { x: 3.9, y: 1.5, z: 0.15 },
      { x: 3.9, y: 1.5, z: 5.85 },
      { x: 2, y: 1.5, z: 0.15 },
    ]),
    {
      "center-x-minus": true,
      "center-x-plus": true,
      "center-z-minus": true,
      "center-z-plus": true,
      "corner-x-minus-z-minus": true,
      "corner-x-minus-z-plus": true,
      "corner-x-plus-z-minus": true,
      "corner-x-plus-z-plus": true,
      "threshold-door-main": true,
    },
  );

  TestValidator.equals(
    "and every one of them stands inside the hall itself",
    stations.every(
      (station) =>
        station.pose !== null &&
        builtSpaceContainsPoint(hall, station.pose.position),
    ),
    true,
  );

  TestValidator.equals(
    "the centre looks out along the axes and everything else looks back at it",
    namedFacts([
      [
        "the centre station aimed at decreasing x reaches past the west wall",
        () =>
          vclose(stations[0]!.pose!.direction, { x: -1, y: 0, z: 0 }) &&
          vclose(stations[0]!.pose!.target, { x: -4, y: 1.5, z: 3 }),
      ],
      [
        "the centre station aimed at increasing z reaches past the north wall",
        () =>
          vclose(stations[3]!.pose!.direction, { x: 0, y: 0, z: 1 }) &&
          vclose(stations[3]!.pose!.target, { x: 2, y: 1.5, z: 9 }),
      ],
      [
        "the south-west corner looks diagonally across the room",
        () =>
          vclose(stations[4]!.pose!.direction, {
            x: 0.5547001962252291,
            y: 0,
            z: 0.8320502943378437,
          }) && vclose(stations[4]!.pose!.target, { x: 2, y: 1.5, z: 3 }),
      ],
      [
        "and the doorway looks straight into it",
        () => vclose(stations[8]!.pose!.direction, { x: 0, y: 0, z: 1 }),
      ],
    ]),
    {
      "the centre station aimed at decreasing x reaches past the west wall": true,
      "the centre station aimed at increasing z reaches past the north wall": true,
      "the south-west corner looks diagonally across the room": true,
      "and the doorway looks straight into it": true,
    },
  );

  TestValidator.equals(
    "a second opening adds its own threshold, placed from its host face",
    placedAt(
      builtSpaceObservationStations(withSideHatch(), "hall").filter(
        (station) => station.role === "threshold",
      ),
      [
        { x: 2, y: 1.5, z: 0.15 },
        { x: 3.9, y: 1.5, z: 3 },
      ],
    ),
    {
      "threshold-door-main": true,
      "threshold-hatch-east": true,
    },
  );

  const wing = lFootprintBuilding();

  TestValidator.equals(
    "the notch corner keeps its identity and reports no place to stand",
    placedAt(builtSpaceObservationStations(wing, "hall"), [
      { x: 2, y: 1.5, z: 2 },
      { x: 2, y: 1.5, z: 2 },
      { x: 2, y: 1.5, z: 2 },
      { x: 2, y: 1.5, z: 2 },
      { x: 0.1, y: 1.5, z: 0.1 },
      { x: 0.1, y: 1.5, z: 3.9 },
      { x: 3.9, y: 1.5, z: 0.1 },
      null,
    ]),
    {
      "center-x-minus": true,
      "center-x-plus": true,
      "center-z-minus": true,
      "center-z-plus": true,
      "corner-x-minus-z-minus": true,
      "corner-x-minus-z-plus": true,
      "corner-x-plus-z-minus": true,
      "corner-x-plus-z-plus": true,
    },
  );

  TestValidator.equals(
    "a space that bounds nothing owes nothing, and an absent one is refused",
    namedFacts([
      [
        "a purely semantic container has no interior population",
        () =>
          builtSpaceObservationStations(withNamedWing(), "west-wing").length ===
          0,
      ],
      [
        "and a space the record does not hold is named in the refusal",
        () =>
          throwsError(
            () => builtSpaceObservationStations(record, "cellar"),
            ["hall-house", "cellar"],
          ),
      ],
    ]),
    {
      "a purely semantic container has no interior population": true,
      "and a space the record does not hold is named in the refusal": true,
    },
  );
};

/**
 * Whether each station in order stands at its expected metre, by station id.
 *
 * Positions are metres of building, so they are compared within a tolerance
 * rather than by deep equality; the ladder's fifth of a twentieth lands on
 * `0.15000000000000002` and a room is not wrong by two attometres. `null`
 * expects a station present with no pose.
 */
const placedAt = (
  stations: ReadonlyArray<{
    id: string;
    pose: { position: IAutoMovieVector3 } | null;
  }>,
  expected: ReadonlyArray<IAutoMovieVector3 | null>,
): Record<string, boolean> =>
  namedFacts(
    stations.map(
      (station, index) =>
        [
          station.id,
          () => {
            const want = expected[index] ?? null;
            return want === null
              ? station.pose === null
              : station.pose !== null && vclose(station.pose.position, want);
          },
        ] as const,
    ),
  );

/** The hall with one uncut passage added through its east wall. */
const withSideHatch = (): IAutoMovieBuiltEnvironment => {
  const record = rectangularBuilding();
  return {
    ...record,
    openings: [
      ...record.openings,
      {
        id: "hatch-east",
        kind: "passage",
        boundary: "wall-east",
        fill: null,
      },
    ],
  };
};

/** The hall with one child space that carries a name and no volume. */
const withNamedWing = (): IAutoMovieBuiltEnvironment => {
  const record = rectangularBuilding();
  return {
    ...record,
    spaces: [
      ...record.spaces,
      { id: "west-wing", kind: "zone", parent: "hall", cells: [] },
    ],
  };
};
