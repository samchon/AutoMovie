import {
  builtConnectorGeometry,
  builtConnectorSectionAt,
  lowerBuiltEnvironment,
  validateBuiltEnvironment,
} from "@automovie/engine";
import type {
  IAutoMovieBuiltEnvironment,
  IAutoMovieConvexSpaceCell,
  IAutoMovieQuaternion,
  IAutoMovieTransform,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { createModel } from "../internal/fixtures";
import { nclose, qclose, qunit, vclose } from "../internal/predicates";

const NO_ROTATION: IAutoMovieQuaternion = { x: 0, y: 0, z: 0, w: 1 };

const yaw = (radians: number): IAutoMovieQuaternion => ({
  x: 0,
  y: Math.sin(radians / 2),
  z: 0,
  w: Math.cos(radians / 2),
});

const place = (x = 0, y = 0, z = 0): IAutoMovieTransform => ({
  translation: { x, y, z },
  rotation: NO_ROTATION,
  scale: { x: 1, y: 1, z: 1 },
});

const box = (
  id: string,
  min: { x: number; y: number; z: number },
  max: { x: number; y: number; z: number },
): IAutoMovieConvexSpaceCell => ({
  id,
  planes: [
    { normal: { x: 1, y: 0, z: 0 }, offset: max.x },
    { normal: { x: -1, y: 0, z: 0 }, offset: -min.x },
    { normal: { x: 0, y: 1, z: 0 }, offset: max.y },
    { normal: { x: 0, y: -1, z: 0 }, offset: -min.y },
    { normal: { x: 0, y: 0, z: 1 }, offset: max.z },
    { normal: { x: 0, y: 0, z: -1 }, offset: -min.z },
  ],
});

/** The stations of a quarter-turn helix, four treads to a 3 m climb. */
const HELIX_TURNS = 4;
const HELIX_RADIUS = 1.5;
const HELIX_RISE = 0.75;

/**
 * Four spaces joined by every connector family this stage must express.
 *
 * The spiral stair is the case the old position-only route could not state at
 * all: its stations sit on a helix whose facing turns a quarter each tread, and
 * without a per-station quaternion two treads a quarter turn apart are the same
 * record. The corridor states a varying section instead of a scalar, the ramp
 * states a slope its own route must agree with, and the escalator is its own
 * traversal family rather than a mislabelled stair.
 */
const levels = (): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "levels",
  units: "meter",
  buildings: [{ id: "unit", element: "root", space: "whole" }],
  models: [{ ...createModel(null), id: "tread" }],
  modelReferences: [],
  elements: [
    {
      id: "root",
      kind: "building",
      parent: null,
      transform: place(),
      model: null,
      space: "whole",
    },
    {
      id: "stair-flight",
      kind: "stair-flight",
      parent: "root",
      transform: place(0, 0, 0),
      model: "tread",
      space: "lower",
    },
  ],
  spaces: [
    { id: "whole", kind: "building", parent: null, cells: [] },
    {
      id: "lower",
      kind: "hall",
      parent: "whole",
      cells: [box("lower-cell", { x: -8, y: 0, z: -8 }, { x: 8, y: 3, z: 8 })],
    },
    {
      id: "upper",
      kind: "gallery",
      parent: "whole",
      cells: [box("upper-cell", { x: -8, y: 3, z: -8 }, { x: 8, y: 6, z: 8 })],
    },
    {
      id: "wing",
      kind: "wing",
      parent: "whole",
      cells: [box("wing-cell", { x: 8, y: 0, z: -8 }, { x: 24, y: 3, z: 8 })],
    },
  ],
  boundaries: [],
  openings: [],
  connectors: [
    {
      // A helix: the centre route barely moves in plan, so only the facing
      // tells one tread from the next.
      id: "spiral",
      kind: "stair",
      from: "lower",
      to: "upper",
      bidirectional: true,
      route: Array.from({ length: HELIX_TURNS + 1 }, (_, index) => ({
        x: HELIX_RADIUS * Math.cos((index * Math.PI) / 2),
        y: index * HELIX_RISE,
        z: HELIX_RADIUS * Math.sin((index * Math.PI) / 2),
      })),
      orientations: Array.from({ length: HELIX_TURNS + 1 }, (_, index) =>
        yaw((index * Math.PI) / 2),
      ),
      width: 1.2,
      clearHeight: 2.1,
      elements: ["stair-flight"],
    },
    {
      // A corridor that narrows in the middle and widens again.
      id: "corridor",
      kind: "passage",
      from: "lower",
      to: "wing",
      bidirectional: true,
      route: [
        { x: 0, y: 0, z: 0 },
        { x: 8, y: 0, z: 0 },
        { x: 16, y: 0, z: 0 },
      ],
      sections: [
        { at: 0, width: 3, clearHeight: 2.6 },
        { at: 0.5, width: 1.5, clearHeight: 2.2 },
        { at: 1, width: 3, clearHeight: 2.6 },
      ],
      elements: [],
    },
    {
      id: "ramp",
      kind: "ramp",
      from: "lower",
      to: "upper",
      bidirectional: true,
      route: [
        { x: 4, y: 0, z: 4 },
        { x: 4, y: 3, z: 7 },
      ],
      width: 1.8,
      clearHeight: 2.4,
      slope: Math.PI / 4,
      elements: [],
    },
    {
      id: "flight",
      kind: "stair",
      from: "lower",
      to: "upper",
      bidirectional: true,
      route: [
        { x: -4, y: 0, z: 0 },
        { x: -4, y: 3, z: 4 },
      ],
      width: 1.4,
      clearHeight: 2.2,
      steps: { count: 20, rise: 0.15, run: 0.2 },
      elements: [],
    },
    {
      id: "escalator",
      kind: "escalator",
      from: "lower",
      to: "upper",
      bidirectional: false,
      route: [
        { x: 6, y: 0, z: -6 },
        { x: 6, y: 3, z: -1.5 },
      ],
      width: 1,
      clearHeight: 2.3,
      elements: [],
    },
    {
      id: "travelator",
      kind: "moving-walk",
      from: "lower",
      to: "wing",
      bidirectional: false,
      route: [
        { x: 0, y: 0, z: 6 },
        { x: 12, y: 0, z: 6 },
      ],
      width: 1.2,
      clearHeight: 2.5,
      elements: [],
    },
  ],
  surfaces: [],
  walkable: [],
});

/** The violation paths one mutation of the level graph produces. */
const refusalPaths = (
  mutate: (value: IAutoMovieBuiltEnvironment) => void,
): string[] => {
  const value = levels();
  mutate(value);
  const validation = validateBuiltEnvironment({ environment: value });
  return validation.success === true
    ? []
    : validation.violations.map((violation) => violation.path);
};

/**
 * A connector is a measurable shape, not a labelled edge between two rooms.
 * This pins that a spiral stair is expressible at all, that a varying section
 * is read where the route actually is, that a stated slope and a stated step
 * must agree with the route they are declared on, and that the constant and the
 * varying spelling of a section are mutually exclusive rather than merged.
 * Whether a person can climb any of it is deliberately never asked.
 *
 * Scenarios:
 *
 * 1. A graph holding a spiral stair, a varying-section corridor, a ramp, a
 *    straight flight, an escalator, and a moving walk validates as a whole.
 * 2. A spiral stair's treads are told apart by facing alone: consecutive stations
 *    sit a quarter turn apart while their plan positions repeat every fourth
 *    station, and every facing survives as a unit quaternion.
 * 3. Route metrics come out as hand arithmetic: a 4 m plan run climbing 3 m is 5 m
 *    long at `atan2(3, 4)`, and the station parameters are arc-length fractions
 *    rather than index fractions.
 * 4. A constant section answers the same pair everywhere; a varying one
 *    interpolates between its stations and reproduces each station exactly.
 * 5. A connector with no orientation answers `null` facings rather than inventing
 *    a heading from the route.
 * 6. Every query refuses an unknown connector, an out-of-range parameter, a route
 *    with nothing to measure, and a connector with no section at all.
 * 7. Twenty-three malformed connectors are each refused at their own path,
 *    including both spellings at once and neither spelling.
 * 8. The pre-geometry scalar record lowers exactly as before.
 */
export const test_architecture_built_connector = (): void => {
  const source = levels();
  TestValidator.equals(
    "a graph of six connector families validates",
    validateBuiltEnvironment({ environment: source }).success,
    true,
  );

  const spiral = builtConnectorGeometry(source, "spiral");
  TestValidator.predicate(
    "a spiral stair's treads are told apart by facing alone",
    (() => {
      const first = spiral.stations[0]!;
      const quarter = spiral.stations[1]!;
      const full = spiral.stations[4]!;
      return (
        // The plan position repeats after four quarter turns, so position alone
        // cannot distinguish the bottom tread from the top one.
        nclose(first.position.x, full.position.x) &&
        nclose(first.position.z, full.position.z) &&
        nclose(full.position.y, HELIX_TURNS * HELIX_RISE) &&
        // The facing does distinguish them, and it is a real quaternion.
        spiral.stations.every((station) => qunit(station.rotation!)) &&
        spiral.stations
          .slice(1)
          .every(
            (station, index) =>
              !qclose(station.rotation!, spiral.stations[index]!.rotation!),
          ) &&
        qclose(first.rotation!, NO_ROTATION) &&
        qclose(quarter.rotation!, yaw(Math.PI / 2)) &&
        // A whole turn comes back to where it started, one storey higher.
        qclose(full.rotation!, first.rotation!)
      );
    })(),
  );

  const flight = builtConnectorGeometry(source, "flight");
  TestValidator.predicate(
    "route metrics are the route's own arithmetic",
    nclose(flight.rise, 3) &&
      nclose(flight.run, 4) &&
      nclose(flight.length, 5) &&
      nclose(flight.slope, Math.atan2(3, 4)) &&
      nclose(flight.stations[0]!.at, 0) &&
      nclose(flight.stations[1]!.at, 1),
  );
  TestValidator.predicate(
    "station parameters are arc length, not index",
    (() => {
      const corridor = builtConnectorGeometry(source, "corridor");
      return (
        nclose(corridor.stations[1]!.at, 0.5) &&
        nclose(corridor.length, 16) &&
        nclose(corridor.rise, 0) &&
        nclose(corridor.slope, 0)
      );
    })(),
  );
  TestValidator.equals(
    "a connector that declared no facing answers with none",
    builtConnectorGeometry(source, "corridor").stations.map(
      (station) => station.rotation,
    ),
    [null, null, null],
  );
  TestValidator.predicate(
    "the helix route is a real helix rather than a stack of points",
    vclose(spiral.stations[1]!.position, {
      x: HELIX_RADIUS * Math.cos(Math.PI / 2),
      y: HELIX_RISE,
      z: HELIX_RADIUS,
    }),
  );

  TestValidator.predicate(
    "a constant section answers the same pair everywhere",
    (() => {
      const start = builtConnectorSectionAt(source, "flight", 0);
      const middle = builtConnectorSectionAt(source, "flight", 0.5);
      const end = builtConnectorSectionAt(source, "flight", 1);
      return (
        nclose(start.width, 1.4) &&
        nclose(middle.width, 1.4) &&
        nclose(end.width, 1.4) &&
        nclose(middle.clearHeight, 2.2)
      );
    })(),
  );
  TestValidator.predicate(
    "a varying section interpolates between its own stations",
    (() => {
      const start = builtConnectorSectionAt(source, "corridor", 0);
      const quarter = builtConnectorSectionAt(source, "corridor", 0.25);
      const waist = builtConnectorSectionAt(source, "corridor", 0.5);
      const end = builtConnectorSectionAt(source, "corridor", 1);
      return (
        nclose(start.width, 3) &&
        nclose(quarter.width, 2.25) &&
        nclose(quarter.clearHeight, 2.4) &&
        nclose(waist.width, 1.5) &&
        nclose(end.width, 3) &&
        nclose(end.clearHeight, 2.6)
      );
    })(),
  );

  TestValidator.error("an unknown connector refuses geometry", () =>
    builtConnectorGeometry(source, "missing"),
  );
  TestValidator.error("an unknown connector refuses a section", () =>
    builtConnectorSectionAt(source, "missing", 0),
  );
  TestValidator.error("a parameter outside the route is refused", () =>
    builtConnectorSectionAt(source, "flight", 1.5),
  );
  TestValidator.error("a non-finite parameter is refused", () =>
    builtConnectorSectionAt(source, "flight", Number.NaN),
  );
  TestValidator.error("an empty route has nothing to measure", () => {
    const value = levels();
    value.connectors[0]!.route = [];
    builtConnectorGeometry(value, "spiral");
  });
  TestValidator.error("a route that never moves has nothing to measure", () => {
    const value = levels();
    value.connectors[0]!.route = [
      { x: 1, y: 1, z: 1 },
      { x: 1, y: 1, z: 1 },
    ];
    builtConnectorGeometry(value, "spiral");
  });
  TestValidator.error("a connector with no section at all is refused", () => {
    const value = levels();
    delete value.connectors[3]!.width;
    delete value.connectors[3]!.clearHeight;
    builtConnectorSectionAt(value, "flight", 0);
  });

  const malformed: Array<
    readonly [string, (value: IAutoMovieBuiltEnvironment) => void, string]
  > = [
    [
      "both section spellings at once",
      (value) =>
        (value.connectors[3]!.sections = [
          { at: 0, width: 1, clearHeight: 2 },
          { at: 1, width: 1, clearHeight: 2 },
        ]),
      "$input.connectors[3].sections",
    ],
    [
      "neither section spelling",
      (value) => {
        delete value.connectors[3]!.width;
        delete value.connectors[3]!.clearHeight;
      },
      "$input.connectors[3].width",
    ],
    [
      "a constant width with no clear height",
      (value) => delete value.connectors[3]!.clearHeight,
      "$input.connectors[3].clearHeight",
    ],
    [
      "a constant clear height with no width",
      (value) => delete value.connectors[3]!.width,
      "$input.connectors[3].width",
    ],
    [
      "a one-station varying section",
      (value) =>
        (value.connectors[1]!.sections = [{ at: 0, width: 1, clearHeight: 2 }]),
      "$input.connectors[1].sections",
    ],
    [
      "a varying section that does not begin at 0",
      (value) => (value.connectors[1]!.sections![0]!.at = 0.1),
      "$input.connectors[1].sections[0].at",
    ],
    [
      "a varying section that does not end at 1",
      (value) => (value.connectors[1]!.sections![2]!.at = 0.9),
      "$input.connectors[1].sections[2].at",
    ],
    [
      "a varying section that does not advance",
      (value) => (value.connectors[1]!.sections![1]!.at = 0),
      "$input.connectors[1].sections[1].at",
    ],
    [
      "a non-finite section station",
      (value) => (value.connectors[1]!.sections![1]!.at = Number.NaN),
      "$input.connectors[1].sections[1].at",
    ],
    [
      "a zero section width",
      (value) => (value.connectors[1]!.sections![1]!.width = 0),
      "$input.connectors[1].sections[1].width",
    ],
    [
      "a zero section clear height",
      (value) => (value.connectors[1]!.sections![1]!.clearHeight = 0),
      "$input.connectors[1].sections[1].clearHeight",
    ],
    [
      "one facing too few",
      (value) => value.connectors[0]!.orientations!.pop(),
      "$input.connectors[0].orientations",
    ],
    [
      "a facing that is not a unit quaternion",
      (value) =>
        (value.connectors[0]!.orientations![2] = {
          x: 0,
          y: 0,
          z: 0,
          w: 0.5,
        }),
      "$input.connectors[0].orientations[2]",
    ],
    [
      "a repeated route station",
      (value) =>
        (value.connectors[3]!.route[1] = { ...value.connectors[3]!.route[0]! }),
      "$input.connectors[3].route[1]",
    ],
    [
      "a slope outside the quarter turn",
      (value) => (value.connectors[2]!.slope = 2),
      "$input.connectors[2].slope",
    ],
    [
      "a non-finite slope",
      (value) => (value.connectors[2]!.slope = Number.NaN),
      "$input.connectors[2].slope",
    ],
    [
      "a slope the route contradicts",
      (value) => (value.connectors[2]!.slope = Math.PI / 6),
      "$input.connectors[2].slope",
    ],
    [
      "a fractional step count",
      (value) => (value.connectors[3]!.steps!.count = 15.5),
      "$input.connectors[3].steps.count",
    ],
    [
      "no steps at all",
      (value) => (value.connectors[3]!.steps!.count = 0),
      "$input.connectors[3].steps.count",
    ],
    [
      "a zero step rise",
      (value) => (value.connectors[3]!.steps!.rise = 0),
      "$input.connectors[3].steps.rise",
    ],
    [
      "a zero step going",
      (value) => (value.connectors[3]!.steps!.run = 0),
      "$input.connectors[3].steps.run",
    ],
    [
      "steps that do not climb their own route",
      (value) => (value.connectors[3]!.steps!.rise = 0.25),
      "$input.connectors[3].steps.rise",
    ],
    [
      "steps that do not run their own route",
      (value) => (value.connectors[3]!.steps!.run = 0.35),
      "$input.connectors[3].steps.run",
    ],
  ];
  malformed.forEach(([name, mutate, path]) =>
    TestValidator.equals(
      `${name} is refused at ${path}`,
      refusalPaths(mutate).includes(path),
      true,
    ),
  );
  TestValidator.equals(
    "the untouched level graph produces no violation path at all",
    refusalPaths(() => {}),
    [],
  );

  TestValidator.equals(
    "the scalar-section record lowers to the same staged set as before",
    lowerBuiltEnvironment(source).set?.map((piece) => piece.node),
    ["levels/stair-flight"],
  );
};
