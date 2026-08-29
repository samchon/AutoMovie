import {
  builtEnvironmentEnvelopeCorners,
  validateBuiltEnvironment,
} from "@automovie/engine";
import type {
  IAutoMovieBuiltBoundary,
  IAutoMovieBuiltEnvironment,
  IAutoMovieQuaternion,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  FACE_ROTATION,
  boxCell,
  lFootprintBuilding,
  originTransform,
  rectangularBuilding,
} from "../internal/envelopeFixtures";
import { namedFacts, vclose } from "../internal/predicates";

/**
 * A corner is where an elevation hides itself, so it is derived, not declared.
 *
 * The survey guidance draws a rectangle as four perpendicular facade views plus
 * four corner obliques, and an irregular footprint as those plus one more view
 * at every re-entrant face. That second half is the part a facade-by-facade
 * sweep loses: the two elevations meeting in a notch each photograph away from
 * the notch, so nothing in a per-facade population ever looks into it.
 *
 * The two kinds are told apart at the meeting point itself. Walking from the
 * corner toward one facade's own body, an exterior corner leaves that body
 * behind the other facade's outward plane and a re-entrant corner leaves it in
 * front. Nothing here reads a label, a winding order, or a footprint the record
 * does not carry.
 *
 * Scenarios:
 *
 * 1. The rectangle produces exactly its four corners, all exterior, and its two
 *    opposite wall pairs produce none, because parallel facades never meet.
 * 2. One corner's meeting point and outward bisector equal the metres typed by
 *    hand from the fixture's own frames.
 * 3. The L-shaped wing is a legal building whose six facades produce six
 *    corners: five exterior and exactly one re-entrant, standing in the notch.
 * 4. Facades that are neither parallel nor adjacent produce nothing, because the
 *    gap between them exceeds the thicker of the two separations.
 * 5. Two facades of different building units produce nothing even when they
 *    share a point.
 * 6. A facade whose own centroid is the meeting point produces nothing, because
 *    there is no direction from the corner into its body to read.
 * 7. A meeting whose second body sits exactly on the first's outward plane
 *    produces nothing, because it turns neither way.
 */
export const test_architecture_envelope_corners = (): void => {
  const rectangle = builtEnvironmentEnvelopeCorners(rectangularBuilding());

  TestValidator.equals(
    "the rectangle owes one corner per pair of meeting walls",
    rectangle.map((corner) => [corner.id, corner.kind, corner.building]),
    [
      ["wall-east+wall-north", "exterior", "house"],
      ["wall-east+wall-south", "exterior", "house"],
      ["wall-north+wall-west", "exterior", "house"],
      ["wall-south+wall-west", "exterior", "house"],
    ],
  );

  TestValidator.equals(
    "the north-east corner stands where its two walls meet",
    namedFacts([
      [
        "the meeting point is the middle of the shared vertical edge",
        () => vclose(rectangle[0]!.position, { x: 4, y: 1.5, z: 6 }),
      ],
      [
        "and the bisector points off the envelope",
        () =>
          vclose(rectangle[0]!.normal, {
            x: 0.7071067811865476,
            y: 0,
            z: 0.7071067811865476,
          }),
      ],
      [
        "naming both walls in code-unit order",
        () =>
          rectangle[0]!.facades[0] === "wall-east" &&
          rectangle[0]!.facades[1] === "wall-north",
      ],
    ]),
    {
      "the meeting point is the middle of the shared vertical edge": true,
      "and the bisector points off the envelope": true,
      "naming both walls in code-unit order": true,
    },
  );

  const wing = lFootprintBuilding();

  TestValidator.equals(
    "the L-shaped wing is a legal building",
    validateBuiltEnvironment({ environment: wing }).success,
    true,
  );

  const notched = builtEnvironmentEnvelopeCorners(wing);

  TestValidator.equals(
    "its notch is the one corner an observer walks into",
    notched.map((corner) => [corner.id, corner.kind]),
    [
      ["wall-0+wall-1", "exterior"],
      ["wall-0+wall-5", "exterior"],
      ["wall-1+wall-2", "exterior"],
      ["wall-2+wall-3", "reentrant"],
      ["wall-3+wall-4", "exterior"],
      ["wall-4+wall-5", "exterior"],
    ],
  );

  TestValidator.equals(
    "the re-entrant corner stands at the inside angle of the footprint",
    vclose(notched.find((corner) => corner.kind === "reentrant")!.position, {
      x: 2,
      y: 1.5,
      z: 2,
    }),
    true,
  );

  TestValidator.equals(
    "a meeting that is not one building's own corner produces nothing",
    namedFacts([
      [
        "two units touching at a point share no corner",
        () => builtEnvironmentEnvelopeCorners(differentUnits()).length === 0,
      ],
      [
        "a facade standing on its own meeting point contributes none",
        () => builtEnvironmentEnvelopeCorners(pointlessFacade()).length === 0,
      ],
      [
        "and a meeting that turns neither way contributes none",
        () => builtEnvironmentEnvelopeCorners(flatTurn()).length === 0,
      ],
    ]),
    {
      "two units touching at a point share no corner": true,
      "a facade standing on its own meeting point contributes none": true,
      "and a meeting that turns neither way contributes none": true,
    },
  );
};

/** One enclosing separation with a hand-written face frame. */
const facade = (props: {
  id: string;
  space: string;
  origin: { x: number; y: number; z: number };
  rotation: IAutoMovieQuaternion;
  outline: Array<{ x: number; y: number }>;
}): IAutoMovieBuiltBoundary => ({
  id: props.id,
  kind: "wall",
  spaces: [props.space],
  elements: [],
  face: {
    origin: props.origin,
    rotation: props.rotation,
    outline: props.outline,
    thickness: 0.2,
  },
});

/** The rectangle outline every small fixture below reuses. */
const panel = (
  width: number,
  height: number,
): Array<{ x: number; y: number }> => [
  { x: 0, y: 0 },
  { x: width, y: 0 },
  { x: width, y: height },
  { x: 0, y: height },
];

/** One record shell holding hand-written spaces and boundaries. */
const shell = (props: {
  id: string;
  units: Array<{ id: string; space: string }>;
  spaces: IAutoMovieBuiltEnvironment["spaces"];
  boundaries: IAutoMovieBuiltBoundary[];
}): IAutoMovieBuiltEnvironment => ({
  version: 1,
  id: props.id,
  units: "meter",
  buildings: props.units.map((unit) => ({
    id: unit.id,
    element: `${unit.id}-root`,
    space: unit.space,
  })),
  models: [],
  modelReferences: [],
  elements: props.units.map((unit) => ({
    id: `${unit.id}-root`,
    kind: "building",
    parent: null,
    transform: originTransform(),
    model: null,
    space: unit.space,
  })),
  spaces: props.spaces,
  boundaries: props.boundaries,
  openings: [],
  connectors: [],
  surfaces: [],
  walkable: [],
});

/**
 * Two building units whose facades meet at the world origin.
 *
 * A corner belongs to one envelope, so two works standing against each other
 * share a seam rather than a corner, and neither owes the other's observation.
 */
const differentUnits = (): IAutoMovieBuiltEnvironment =>
  shell({
    id: "neighbours",
    units: [
      { id: "a", space: "a-hall" },
      { id: "b", space: "b-hall" },
    ],
    spaces: [
      {
        id: "a-hall",
        kind: "room",
        parent: null,
        cells: [boxCell("a-cell", { x: 0, y: 0, z: 0 }, { x: 4, y: 3, z: 6 })],
      },
      {
        id: "b-hall",
        kind: "room",
        parent: null,
        cells: [
          boxCell("b-cell", { x: -4, y: 0, z: -6 }, { x: 0, y: 3, z: 0 }),
        ],
      },
    ],
    boundaries: [
      facade({
        id: "north-a",
        space: "a-hall",
        origin: { x: 4, y: 0, z: 0 },
        rotation: FACE_ROTATION.halfTurnY,
        outline: panel(4, 3),
      }),
      facade({
        id: "west-b",
        space: "b-hall",
        origin: { x: 0, y: 0, z: 0 },
        rotation: FACE_ROTATION.quarterY,
        outline: panel(6, 3),
      }),
    ],
  });

/**
 * One arealess separation sharing a point with a real one.
 *
 * Its own centroid is the meeting point, so nothing states which way its body
 * lies and the meeting cannot be classified either way.
 */
const pointlessFacade = (): IAutoMovieBuiltEnvironment =>
  shell({
    id: "pointless",
    units: [{ id: "a", space: "a-hall" }],
    spaces: [
      {
        id: "a-hall",
        kind: "room",
        parent: null,
        cells: [boxCell("a-cell", { x: 0, y: 0, z: 0 }, { x: 4, y: 3, z: 6 })],
      },
    ],
    boundaries: [
      facade({
        id: "flat-x",
        space: "a-hall",
        origin: { x: 0, y: 0, z: 0 },
        rotation: FACE_ROTATION.quarterMinusY,
        outline: panel(6, 3),
      }),
      facade({
        id: "pointless",
        space: "a-hall",
        origin: { x: 0, y: 0, z: 0 },
        rotation: FACE_ROTATION.halfTurnY,
        outline: [
          { x: 0, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 0 },
        ],
      }),
    ],
  });

/**
 * Two separations meeting with the second's body on the first's outward plane.
 *
 * The triangular face's centroid sits directly below the shared point, so the
 * direction from the corner into it is perpendicular to the other facade's
 * normal and the meeting turns neither out of nor into the envelope.
 */
const flatTurn = (): IAutoMovieBuiltEnvironment =>
  shell({
    id: "flat",
    units: [{ id: "a", space: "a-hall" }],
    spaces: [
      {
        id: "a-hall",
        kind: "room",
        parent: null,
        cells: [boxCell("a-cell", { x: 0, y: 0, z: 0 }, { x: 4, y: 3, z: 6 })],
      },
    ],
    boundaries: [
      facade({
        id: "flat-x",
        space: "a-hall",
        origin: { x: 0, y: 0, z: 0 },
        rotation: FACE_ROTATION.quarterMinusY,
        outline: panel(6, 3),
      }),
      facade({
        id: "tri-z",
        space: "a-hall",
        origin: { x: 1, y: 0, z: 0 },
        rotation: FACE_ROTATION.halfTurnY,
        outline: [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
          { x: 1, y: 3 },
        ],
      }),
    ],
  });
