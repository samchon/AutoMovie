import {
  builtConnectorCarriagePlacements,
  builtConnectorGeometry,
  builtEnvironmentAdjacentSpaces,
  builtEnvironmentSpaceConnectors,
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
import {
  namedFacts,
  nclose,
  qclose,
  throwsError,
  vclose,
} from "../internal/predicates";

const NO_ROTATION: IAutoMovieQuaternion = { x: 0, y: 0, z: 0, w: 1 };

const alphabetical = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

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

/** Where the car's own element rests, and how far each stop is above it. */
const CAR_REST = 0.5;
const STOREY = 3;

/**
 * A three-level work whose runs move: a lift, an escalator, and a one-way
 * chute, beside a stair that does not move at all.
 *
 * The lift is the case a two-ended relation could not state. It stops at a
 * floor neither of its ends names, its car stands somewhere different at each
 * stop, and its counterweight travels the other way and stands at no floor at
 * all. Writing that as three connectors would give one shaft three identities;
 * writing the car's position per state would give one car three placements. The
 * escalator is the powered run the `escalator` kind was named for, and it
 * carries the drive a stair has no use for. The chute is one-way, so the order
 * of its own stops is what decides where it can take somebody.
 */
const runs = (): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: "runs",
  units: "meter",
  buildings: [{ id: "unit", element: "root", space: "whole" }],
  models: [{ ...createModel(null), id: "box" }],
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
      id: "shaft",
      kind: "lift-shaft",
      parent: "root",
      transform: place(),
      model: "box",
      space: null,
    },
    {
      // The car rests at the lowest stop; every state is a travel from here.
      id: "car",
      kind: "lift-car",
      parent: "shaft",
      transform: place(0, CAR_REST, 0),
      model: "box",
      space: null,
    },
    {
      // Counterweights hang at the far end of the same rope, so this one is
      // high when the car is low and serves no floor in any state.
      id: "counterweight",
      kind: "counterweight",
      parent: "shaft",
      transform: place(1.2, CAR_REST + 2 * STOREY, 0),
      model: "box",
      space: null,
    },
    {
      id: "band",
      kind: "escalator-band",
      parent: "root",
      transform: place(6, 0, -6),
      model: "box",
      space: null,
    },
    {
      id: "gate-drum",
      kind: "revolving-door",
      parent: "root",
      transform: place(2, 0, 2),
      model: "box",
      space: "lobby",
    },
    {
      // A wing that turns about the drum's own axis: the same travel record a
      // sliding car uses, on its other arm.
      id: "gate-wing",
      kind: "revolving-door-wing",
      parent: "gate-drum",
      transform: place(),
      model: "box",
      space: "lobby",
    },
  ],
  spaces: [
    { id: "whole", kind: "building", parent: null, cells: [] },
    {
      id: "level-0",
      kind: "storey",
      parent: "whole",
      cells: [
        box("level-0-cell", { x: -8, y: 0, z: -8 }, { x: 8, y: 3, z: 8 }),
      ],
    },
    {
      id: "level-1",
      kind: "storey",
      parent: "whole",
      cells: [
        box("level-1-cell", { x: -8, y: 3, z: -8 }, { x: 8, y: 6, z: 8 }),
      ],
    },
    {
      id: "level-2",
      kind: "storey",
      parent: "whole",
      cells: [
        box("level-2-cell", { x: -8, y: 6, z: -8 }, { x: 8, y: 9, z: 8 }),
      ],
    },
    {
      id: "lobby",
      kind: "room",
      parent: "level-0",
      cells: [box("lobby-cell", { x: 0, y: 0, z: 0 }, { x: 4, y: 3, z: 4 })],
    },
    // A plant deck nobody bounded: it is a place the escalator stops at, and
    // deliberately not a volume anything can be found inside.
    { id: "plant", kind: "plant", parent: "whole", cells: [] },
  ],
  boundaries: [],
  openings: [],
  connectors: [
    {
      id: "lift",
      kind: "lift",
      from: "level-0",
      to: "level-2",
      bidirectional: true,
      route: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 2 * STOREY, z: 0 },
      ],
      landings: [{ space: "level-1", at: 0.5 }],
      width: 1.6,
      clearHeight: 2.4,
      // Naming the shaft is enough: the car and the counterweight hang below
      // it, so the run owns them without listing every part twice.
      elements: ["shaft"],
      operation: {
        carriages: [
          {
            id: "car",
            element: "car",
            motion: {
              kind: "prismatic",
              axis: { x: 0, y: 1, z: 0 },
              min: 0,
              max: 2 * STOREY,
            },
          },
          {
            id: "counterweight",
            element: "counterweight",
            motion: {
              kind: "prismatic",
              axis: { x: 0, y: 1, z: 0 },
              min: -2 * STOREY,
              max: 0,
            },
          },
        ],
        states: [
          {
            id: "at-level-0",
            drive: "still",
            carriages: [
              { carriage: "car", value: 0, serves: "level-0" },
              { carriage: "counterweight", value: 0, serves: null },
            ],
          },
          {
            id: "at-level-1",
            drive: "still",
            carriages: [
              { carriage: "car", value: STOREY, serves: "level-1" },
              { carriage: "counterweight", value: -STOREY, serves: null },
            ],
          },
          {
            id: "at-level-2",
            drive: "still",
            carriages: [
              { carriage: "car", value: 2 * STOREY, serves: "level-2" },
              { carriage: "counterweight", value: -2 * STOREY, serves: null },
            ],
          },
          {
            // Between floors, so the car serves nothing while it is driven.
            id: "ascending",
            drive: "forward",
            carriages: [
              { carriage: "car", value: STOREY / 2, serves: null },
              { carriage: "counterweight", value: -STOREY / 2, serves: null },
            ],
          },
          {
            // The twin of the refusal below: a run that goes both ways may be
            // driven backwards, and only a one-way run may not.
            id: "descending",
            drive: "reverse",
            carriages: [
              { carriage: "car", value: (3 * STOREY) / 2, serves: null },
              {
                carriage: "counterweight",
                value: (-3 * STOREY) / 2,
                serves: null,
              },
            ],
          },
        ],
        state: "at-level-0",
      },
    },
    {
      id: "escalator",
      kind: "escalator",
      from: "level-0",
      to: "level-1",
      bidirectional: false,
      route: [
        { x: 6, y: 0, z: -6 },
        { x: 6, y: STOREY, z: -1.5 },
      ],
      landings: [{ space: "plant", at: 0.5 }],
      width: 1,
      clearHeight: 2.3,
      elements: ["band"],
      operation: {
        carriages: [
          {
            id: "steps",
            element: "band",
            motion: {
              kind: "prismatic",
              axis: { x: 0, y: STOREY, z: 4.5 },
              min: 0,
              max: 1,
            },
          },
        ],
        states: [
          {
            id: "stopped",
            drive: "still",
            carriages: [{ carriage: "steps", value: 0, serves: null }],
          },
          {
            // The plant deck bounds no volume, so the stop is a fact about the
            // run rather than a claim the geometry has to settle.
            id: "running",
            drive: "forward",
            carriages: [{ carriage: "steps", value: 0.4, serves: "plant" }],
          },
        ],
        state: "stopped",
      },
    },
    {
      // A one-way descent: its stops are ordered, so where it can take somebody
      // depends on where they board it.
      id: "chute",
      kind: "other",
      from: "level-2",
      to: "level-0",
      bidirectional: false,
      route: [
        { x: -6, y: 2 * STOREY, z: 0 },
        { x: -6, y: 4, z: 0 },
        { x: -6, y: 0, z: 0 },
      ],
      landings: [{ space: "level-1", at: 0.5 }],
      width: 1,
      clearHeight: 1,
      elements: [],
    },
    {
      // A revolving door: the run turns rather than travels, on the same one
      // degree of freedom a car slides on.
      id: "gate",
      kind: "passage",
      from: "level-0",
      to: "lobby",
      bidirectional: true,
      route: [
        { x: 2, y: 0, z: -1 },
        { x: 2, y: 0, z: 2 },
      ],
      width: 1.2,
      clearHeight: 2.1,
      elements: ["gate-drum"],
      operation: {
        carriages: [
          {
            id: "wing",
            element: "gate-wing",
            motion: {
              kind: "revolute",
              axis: { x: 0, y: 1, z: 0 },
              pivot: { x: 0, y: 0, z: 0 },
              min: 0,
              max: Math.PI,
            },
          },
        ],
        states: [
          {
            id: "shut",
            drive: "still",
            carriages: [{ carriage: "wing", value: 0, serves: "lobby" }],
          },
          {
            id: "half-turned",
            drive: "forward",
            carriages: [{ carriage: "wing", value: Math.PI / 3, serves: null }],
          },
        ],
        state: "shut",
      },
    },
    {
      // The static twin: a stair is the whole of itself at all times.
      id: "stair",
      kind: "stair",
      from: "level-0",
      to: "level-1",
      bidirectional: true,
      route: [
        { x: -4, y: 0, z: 0 },
        { x: -4, y: STOREY, z: 4 },
      ],
      width: 1.4,
      clearHeight: 2.2,
      elements: [],
    },
  ],
  surfaces: [],
  walkable: [],
});

/** The violation paths one mutation of the moving work produces. */
const refusalPaths = (
  mutate: (value: IAutoMovieBuiltEnvironment) => void,
): string[] => {
  const value = runs();
  mutate(value);
  const validation = validateBuiltEnvironment({ environment: value });
  return validation.success === true
    ? []
    : validation.violations.map((violation) => violation.path);
};

/** The world Y of one carriage of the lift, at one named state. */
const carAt = (
  environment: IAutoMovieBuiltEnvironment,
  carriage: string,
  state?: string,
): number =>
  builtConnectorCarriagePlacements(environment, "lift", state).find(
    (placement) => placement.carriage === carriage,
  )!.position.y;

/**
 * A run that moves is a run with named states, and the states have to be true.
 *
 * A lift that stops at four floors is one shaft, so this pins that the floors
 * between its ends stay in the graph rather than in its geometry alone: an
 * adjacency query answers with them, a one-way run only reaches the stops ahead
 * of it, and a landing is placed on the route by arc length. It also pins that
 * a stop is a claim the engine settles — the car has to actually stand in the
 * space its state says it serves, while a counterweight that serves nothing is
 * held to nothing. Whether anyone could board any of it is never asked.
 *
 * Scenarios:
 *
 * 1. A work holding a lift with a car, a counterweight and a mid landing, a
 *    powered escalator, a one-way chute, a revolving gate, and a static stair
 *    validates whole.
 * 2. A landing is placed on the run's own route by arc length, on both an even
 *    two-point route and an uneven three-point one; a run with no landing
 *    answers with none.
 * 3. Carriage placement answers where each car stands at the record's own state
 *    and at any other named one, and hands back the space that state serves —
 *    `null` for the counterweight, which stands at no floor in any state. A
 *    revolving gate's wing turns on the same record without travelling at all.
 * 4. Lowering stages the car at the current state: standing the record at the top
 *    floor moves the staged node, and stripping the operation puts it back at
 *    its rest pose, so a static connector lowers as it always did.
 * 5. Adjacency reaches every stop of a two-way run and only the stops ahead of a
 *    one-way one, and the connector query answers for a landing that is neither
 *    endpoint.
 * 6. A run that declares no operation has no carriage to place, and every query
 *    refuses an unknown connector, an unknown state, and a carriage whose
 *    element is gone.
 * 7. A state that names no value for a carriage leaves it at rest and serving
 *    nothing, and a current state that does not resolve serves nothing either.
 * 8. Thirty-one malformed runs are each refused at their own path, including a car
 *    that does not stand in the floor it claims, a reverse drive on a one-way
 *    run — which the two-way lift's own reverse state is the twin of — an
 *    element two members try to drive at once, and a state the scene could not
 *    stage even though the record's current one can.
 */
export const test_architecture_built_connector_operation = (): void => {
  const source = runs();
  TestValidator.equals(
    "a work of three moving runs and one static one validates",
    validateBuiltEnvironment({ environment: source }).success,
    true,
  );

  const lift = builtConnectorGeometry(source, "lift");
  TestValidator.equals(
    "a landing sits on the run's own route by arc length",
    namedFacts([
      ["count", () => lift.landings.length === 1],
      ["space", () => lift.landings[0]!.space === "level-1"],
      ["at", () => nclose(lift.landings[0]!.at, 0.5)],
      [
        "position",
        () => vclose(lift.landings[0]!.position, { x: 0, y: STOREY, z: 0 }),
      ],
    ]),
    { count: true, space: true, at: true, position: true },
  );
  TestValidator.predicate(
    "an uneven route places its landing by length, not by station index",
    (() => {
      const chute = builtConnectorGeometry(source, "chute");
      // Segments of 2 m and 4 m: half the length falls a quarter of the way
      // along the second one, which an index-based reading would miss by a
      // metre.
      return (
        chute.landings.length === 1 &&
        vclose(chute.landings[0]!.position, { x: -6, y: STOREY, z: 0 })
      );
    })(),
  );
  TestValidator.equals(
    "a run with no landing answers with none",
    builtConnectorGeometry(source, "stair").landings,
    [],
  );
  TestValidator.predicate(
    "a landing on a route that stalls is placed at the stall rather than by a division by zero",
    (() => {
      const value = runs();
      value.connectors[0]!.route = [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 2 * STOREY, z: 0 },
      ];
      value.connectors[0]!.landings![0]!.at = 0;
      const stalled = builtConnectorGeometry(value, "lift");
      return vclose(stalled.landings[0]!.position, { x: 0, y: 0, z: 0 });
    })(),
  );

  TestValidator.equals(
    "each car stands where its own state puts it",
    namedFacts([
      ["carRest", () => nclose(carAt(source, "car"), CAR_REST)],
      [
        "carLevel1",
        () => nclose(carAt(source, "car", "at-level-1"), CAR_REST + STOREY),
      ],
      [
        "carLevel2",
        () => nclose(carAt(source, "car", "at-level-2"), CAR_REST + 2 * STOREY),
      ],
      [
        "counterweightRest",
        () => nclose(carAt(source, "counterweight"), CAR_REST + 2 * STOREY),
      ],
      [
        "counterweightLevel2",
        () => nclose(carAt(source, "counterweight", "at-level-2"), CAR_REST),
      ],
    ]),
    {
      carRest: true,
      carLevel1: true,
      carLevel2: true,
      counterweightRest: true,
      counterweightLevel2: true,
    },
  );
  TestValidator.equals(
    "the state hands back the floor it serves, and nothing for what serves none",
    builtConnectorCarriagePlacements(source, "lift", "at-level-1").map(
      (placement) => [placement.carriage, placement.node, placement.serves],
    ),
    [
      ["car", "runs/car", "level-1"],
      ["counterweight", "runs/counterweight", null],
    ],
  );

  TestValidator.predicate(
    "lowering stages the car at the state the record stands in",
    (() => {
      const node = (environment: IAutoMovieBuiltEnvironment): number =>
        lowerBuiltEnvironment(environment).set!.find(
          (piece) => piece.node === "runs/car",
        )!.position.y;
      const raised = runs();
      raised.connectors[0]!.operation!.state = "at-level-2";
      const stripped = runs();
      stripped.connectors[0]!.operation!.state = "at-level-2";
      delete stripped.connectors[0]!.operation;
      return (
        nclose(node(source), CAR_REST) &&
        nclose(node(raised), CAR_REST + 2 * STOREY) &&
        // A run that states no operation lowers from its rest pose alone, which
        // is exactly what it did before any of this existed.
        nclose(node(stripped), CAR_REST)
      );
    })(),
  );

  TestValidator.predicate(
    "a carriage may turn as well as slide, which is what a revolving gate is",
    (() => {
      const shut = builtConnectorCarriagePlacements(source, "gate")[0]!;
      const turned = builtConnectorCarriagePlacements(
        source,
        "gate",
        "half-turned",
      )[0]!;
      return (
        shut.serves === "lobby" &&
        turned.serves === null &&
        // The wing pivots about its own origin, so it turns without travelling
        // — which is exactly why a placement has to answer with a rotation and
        // not only a position.
        vclose(shut.position, turned.position) &&
        qclose(shut.rotation, NO_ROTATION) &&
        qclose(turned.rotation, yaw(Math.PI / 3))
      );
    })(),
  );

  TestValidator.equals(
    "a two-way run reaches every stop it declares",
    // The lift reaches the floor between its ends, and the one-way escalator
    // reaches the plant deck ahead of it.
    builtEnvironmentAdjacentSpaces(source, "level-0").sort(alphabetical),
    ["level-1", "level-2", "lobby", "plant"],
  );
  TestValidator.equals(
    "a landing reaches the stops on both sides of a two-way run",
    builtEnvironmentAdjacentSpaces(source, "level-1").sort(alphabetical),
    ["level-0", "level-2"],
  );
  TestValidator.equals(
    "a one-way run reaches only the stops ahead of it",
    builtEnvironmentAdjacentSpaces(source, "level-2").sort(alphabetical),
    ["level-0", "level-1"],
  );
  TestValidator.equals(
    "a landing on a one-way run reaches forward and never back",
    builtEnvironmentAdjacentSpaces(source, "plant"),
    ["level-1"],
  );
  TestValidator.equals(
    "a space no run touches is adjacent to nothing",
    builtEnvironmentAdjacentSpaces(source, "whole"),
    [],
  );
  TestValidator.equals(
    "a landing is a place the run lands on, so the connector query answers with it",
    builtEnvironmentSpaceConnectors(source, "level-1").map(
      (connector) => connector.id,
    ),
    ["lift", "escalator", "chute", "stair"],
  );

  TestValidator.equals(
    "a run that never moves has no carriage to place",
    builtConnectorCarriagePlacements(source, "stair"),
    [],
  );
  TestValidator.predicate(
    "an unknown connector has no carriage",
    throwsError(() => builtConnectorCarriagePlacements(source, "missing")),
  );
  TestValidator.predicate(
    "an unknown operating state is refused",
    throwsError(() =>
      builtConnectorCarriagePlacements(source, "lift", "at-level-9"),
    ),
  );
  TestValidator.predicate(
    "a carriage whose element is gone is refused",
    throwsError(() => {
      const value = runs();
      value.elements = value.elements.filter((element) => element.id !== "car");
      builtConnectorCarriagePlacements(value, "lift");
    }),
  );
  TestValidator.predicate(
    "a state that names no value leaves its carriage at rest and serving nothing",
    (() => {
      const value = runs();
      value.connectors[0]!.operation!.states[0]!.carriages = [
        { carriage: "counterweight", value: 0, serves: null },
      ];
      const placements = builtConnectorCarriagePlacements(value, "lift");
      const car = placements.find((entry) => entry.carriage === "car")!;
      return nclose(car.position.y, CAR_REST) && car.serves === null;
    })(),
  );
  TestValidator.predicate(
    "a current state that does not resolve leaves every carriage at rest",
    (() => {
      const value = runs();
      value.connectors[0]!.operation!.state = "at-level-9";
      const placements = builtConnectorCarriagePlacements(value, "lift");
      return (
        placements.every((entry) => entry.serves === null) &&
        nclose(placements[0]!.position.y, CAR_REST)
      );
    })(),
  );

  const malformed: Array<
    readonly [string, (value: IAutoMovieBuiltEnvironment) => void, string]
  > = [
    [
      "a landing space that does not resolve",
      (value) => (value.connectors[0]!.landings![0]!.space = "missing"),
      "$input.connectors[0].landings[0].space",
    ],
    [
      "a landing that restates an endpoint",
      (value) => (value.connectors[0]!.landings![0]!.space = "level-2"),
      "$input.connectors[0].landings[0].space",
    ],
    [
      "a landing stated twice",
      (value) =>
        value.connectors[0]!.landings!.push({ space: "level-1", at: 0.75 }),
      "$input.connectors[0].landings[1].space",
    ],
    [
      "a landing at the run's own start",
      (value) => (value.connectors[0]!.landings![0]!.at = 0),
      "$input.connectors[0].landings[0].at",
    ],
    [
      "a landing at the run's own end",
      (value) => (value.connectors[0]!.landings![0]!.at = 1),
      "$input.connectors[0].landings[0].at",
    ],
    [
      "a non-finite landing station",
      (value) => (value.connectors[0]!.landings![0]!.at = Number.NaN),
      "$input.connectors[0].landings[0].at",
    ],
    [
      "landings that do not advance along the route",
      (value) => {
        value.connectors[0]!.landings!.push({ space: "plant", at: 0.25 });
      },
      "$input.connectors[0].landings[1].at",
    ],
    [
      "an operation with no carriage",
      (value) => (value.connectors[0]!.operation!.carriages = []),
      "$input.connectors[0].operation.carriages",
    ],
    [
      "an operation on a run built from nothing",
      (value) => (value.connectors[0]!.elements = []),
      "$input.connectors[0].elements",
    ],
    [
      "a carriage element that does not resolve",
      (value) =>
        (value.connectors[0]!.operation!.carriages[0]!.element = "missing"),
      "$input.connectors[0].operation.carriages[0].element",
    ],
    [
      "a carriage element outside the run it belongs to",
      (value) =>
        (value.connectors[0]!.operation!.carriages[0]!.element = "band"),
      "$input.connectors[0].operation.carriages[0].element",
    ],
    [
      "two carriages driving one element",
      (value) =>
        (value.connectors[0]!.operation!.carriages[1]!.element = "car"),
      "$input.connectors[0].operation.carriages[1].element",
    ],
    [
      "a duplicate carriage id",
      (value) => (value.connectors[0]!.operation!.carriages[1]!.id = "car"),
      "$input.connectors[0].operation.carriages[1].id",
    ],
    [
      "an empty carriage id",
      (value) => (value.connectors[0]!.operation!.carriages[0]!.id = " "),
      "$input.connectors[0].operation.carriages[0].id",
    ],
    [
      "a carriage travel axis of zero length",
      (value) =>
        (value.connectors[0]!.operation!.carriages[0]!.motion.axis = {
          x: 0,
          y: 0,
          z: 0,
        }),
      "$input.connectors[0].operation.carriages[0].motion.axis",
    ],
    [
      "a carriage travel that does not start at rest",
      (value) => (value.connectors[0]!.operation!.carriages[0]!.motion.min = 1),
      "$input.connectors[0].operation.carriages[0].motion.min",
    ],
    [
      "a carriage with no travel at all",
      (value) => (value.connectors[0]!.operation!.carriages[0]!.motion.max = 0),
      "$input.connectors[0].operation.carriages[0].motion.max",
    ],
    [
      "an operation with no named state",
      (value) => (value.connectors[0]!.operation!.states = []),
      "$input.connectors[0].operation.states",
    ],
    [
      "a duplicate state id",
      (value) => (value.connectors[0]!.operation!.states[1]!.id = "at-level-0"),
      "$input.connectors[0].operation.states[1].id",
    ],
    [
      "a state driving an unknown carriage",
      (value) =>
        (value.connectors[0]!.operation!.states[0]!.carriages[0]!.carriage =
          "ghost"),
      "$input.connectors[0].operation.states[0].carriages[0].carriage",
    ],
    [
      "a state driving one carriage twice",
      (value) =>
        (value.connectors[0]!.operation!.states[0]!.carriages[1]!.carriage =
          "car"),
      "$input.connectors[0].operation.states[0].carriages[1].carriage",
    ],
    [
      "a state that gives a carriage no value",
      (value) =>
        value.connectors[0]!.operation!.states[0]!.carriages.splice(1, 1),
      "$input.connectors[0].operation.states[0].carriages",
    ],
    [
      "a state driving a carriage past its own travel",
      (value) =>
        (value.connectors[0]!.operation!.states[0]!.carriages[0]!.value = 99),
      "$input.connectors[0].operation.states[0].carriages[0].value",
    ],
    [
      "a state driving a carriage to nowhere",
      (value) =>
        (value.connectors[0]!.operation!.states[0]!.carriages[0]!.value =
          Number.NaN),
      "$input.connectors[0].operation.states[0].carriages[0].value",
    ],
    [
      "an unknown drive",
      (value) =>
        (value.connectors[0]!.operation!.states[0]!.drive = "idle" as "still"),
      "$input.connectors[0].operation.states[0].drive",
    ],
    [
      "a reverse drive on a one-way run",
      (value) => (value.connectors[1]!.operation!.states[1]!.drive = "reverse"),
      "$input.connectors[1].operation.states[1].drive",
    ],
    [
      "a current state that does not resolve",
      (value) => (value.connectors[0]!.operation!.state = "parked"),
      "$input.connectors[0].operation.state",
    ],
    [
      "a stop the run does not make",
      (value) =>
        (value.connectors[0]!.operation!.states[0]!.carriages[0]!.serves =
          "whole"),
      "$input.connectors[0].operation.states[0].carriages[0].serves",
    ],
    [
      "a car that does not stand in the floor it claims",
      (value) =>
        (value.connectors[0]!.operation!.states[0]!.carriages[0]!.serves =
          "level-2"),
      "$input.connectors[0].operation.states[0].carriages[0].serves",
    ],
    [
      // At rest the wing is a clean scaled frame; half a turn later the same
      // hierarchy carries shear no staged node could hold, and a state that
      // cannot be staged is a state the viewer could never reproduce.
      "a state the scene could not stage even though the current one can",
      (value) =>
        (value.elements.find(
          (element) => element.id === "gate-drum",
        )!.transform.scale = { x: 2, y: 1, z: 1 }),
      "$input.connectors[3].operation.states[1]",
    ],
    [
      "an element a door leaf and a lift car both try to drive",
      (value) => {
        value.boundaries.push({
          id: "wall",
          kind: "wall",
          spaces: ["level-0", "level-1"],
          elements: ["shaft"],
        });
        value.openings.push({
          id: "hatch",
          kind: "door",
          boundary: "wall",
          fill: "car",
          operation: {
            panels: [
              {
                id: "leaf",
                element: "car",
                width: 1,
                height: 2,
                motion: {
                  kind: "revolute",
                  axis: { x: 0, y: 1, z: 0 },
                  pivot: { x: 0, y: 0, z: 0 },
                  min: 0,
                  max: Math.PI / 2,
                },
              },
            ],
            states: [{ id: "shut", panels: [{ panel: "leaf", value: 0 }] }],
            state: "shut",
            hardware: [],
          },
        });
      },
      "$input.connectors[0].operation.carriages[0].element",
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
    "the untouched moving work produces no violation path at all",
    refusalPaths(() => {}),
    [],
  );
};
