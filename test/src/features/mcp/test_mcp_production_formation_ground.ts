import type {
  IAutoMovieCompiledFormation,
  IAutoMovieFormationMotion,
  IAutoMovieSpace,
} from "@automovie/interface";
import { validateAutoMovieFormationGround } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";

/** One square floor centred on the origin, walkable everywhere. */
const field = (half: number): IAutoMovieSpace => ({
  id: "field",
  surfaces: [
    {
      id: "ground",
      kind: "floor",
      polygon: [
        { x: -half, y: 0, z: -half },
        { x: half, y: 0, z: -half },
        { x: half, y: 0, z: half },
        { x: -half, y: 0, z: half },
      ],
      anchor: { x: 0, y: 0, z: 0 },
      rampTo: null,
    },
  ],
  walkable: ["ground"],
});

type IUnit = Pick<
  IAutoMovieCompiledFormation,
  "id" | "bounds" | "anchor" | "facingDeg"
>;

/** One compiled unit reaching a stated distance from the origin. */
const unit = (reach: number, id = "army"): IUnit => ({
  id,
  bounds: {
    min: { x: -reach, y: 0, z: -reach },
    max: { x: reach, y: 0, z: reach },
  },
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
});

/** One cue carrying a unit a stated distance along +z between two times. */
const march = (
  metres: number,
  formation = "army",
): IAutoMovieFormationMotion => ({
  id: `${formation}-advance`,
  formation,
  action: "advance",
  start: 1,
  end: 3,
  from: {
    translation: { x: 0, y: 0, z: 0 },
    facingOffsetDeg: 0,
    spacingScale: { lateral: 1, depth: 1 },
  },
  to: {
    translation: { x: 0, y: 0, z: metres },
    facingOffsetDeg: 0,
    spacingScale: { lateral: 1, depth: 1 },
  },
  easing: "easeInOut",
});

/**
 * One cue that turns a unit through a stated angle and moves it nowhere.
 *
 * A long thin unit sweeps a circle of its own half-length, so a box that fits a
 * floor lengthwise leaves it while turning and fits again once square to it.
 */
const turn = (
  degrees: number,
  formation = "army",
): IAutoMovieFormationMotion => ({
  ...march(0, formation),
  to: {
    translation: { x: 0, y: 0, z: 0 },
    facingOffsetDeg: degrees,
    spacingScale: { lateral: 1, depth: 1 },
  },
});

/** One compiled unit far longer than it is wide, so a turn sweeps. */
const lance = (halfLength: number, halfWidth: number): IUnit => ({
  id: "army",
  bounds: {
    min: { x: -halfWidth, y: 0, z: -halfLength },
    max: { x: halfWidth, y: 0, z: halfLength },
  },
  anchor: { x: 0, y: 0, z: 0 },
  facingDeg: 0,
});

/**
 * Two crossed walkable arms: a corridor along `z` and one along `x`.
 *
 * A long unit lies in one arm, ends the turn lying in the other, and fits in
 * neither on the way. That is the shape a gate reading only the ends cannot
 * see, and it is why the interior of a turn is sampled at all.
 */
const crossroads = (arm: number, halfWidth: number): IAutoMovieSpace => ({
  id: "crossroads",
  surfaces: [
    {
      id: "north-road",
      kind: "floor",
      polygon: [
        { x: -halfWidth, y: 0, z: -arm },
        { x: halfWidth, y: 0, z: -arm },
        { x: halfWidth, y: 0, z: arm },
        { x: -halfWidth, y: 0, z: arm },
      ],
      anchor: { x: 0, y: 0, z: 0 },
      rampTo: null,
    },
    {
      id: "east-road",
      kind: "floor",
      polygon: [
        { x: -arm, y: 0, z: -halfWidth },
        { x: arm, y: 0, z: -halfWidth },
        { x: arm, y: 0, z: halfWidth },
        { x: -arm, y: 0, z: halfWidth },
      ],
      anchor: { x: 0, y: 0, z: 0 },
      rampTo: null,
    },
  ],
  walkable: ["north-road", "east-road"],
});

/** A square floor turned on its point, so `|x| + |z|` bounds it. */
const diamond = (reach: number): IAutoMovieSpace => ({
  id: "diamond",
  surfaces: [
    {
      id: "ground",
      kind: "floor",
      polygon: [
        { x: -reach, y: 0, z: 0 },
        { x: 0, y: 0, z: -reach },
        { x: reach, y: 0, z: 0 },
        { x: 0, y: 0, z: reach },
      ],
      anchor: { x: 0, y: 0, z: 0 },
      rampTo: null,
    },
  ],
  walkable: ["ground"],
});

const codes = (
  space: IAutoMovieSpace | null,
  formations: readonly IUnit[],
  formationMotions?: readonly IAutoMovieFormationMotion[],
): string[] =>
  validateAutoMovieFormationGround(
    { id: "opening" },
    {
      scene: { space },
      formations,
      formationMotions,
    },
  ).map((diagnostic) => diagnostic.code);

/**
 * A shot may not stage a unit on ground it did not stage under it.
 *
 * The space a shot stages is what the scene keeps and what the viewer turns
 * into real meshes, so a unit reaching past it stands over a void. The world
 * design does not answer this: authored terrain and a staged space are separate
 * records, which is how a field corrected in one went on drawing a floor a
 * third the size of its own unit in the other.
 *
 * Both numbers already exist. The bounds are the compiler's, the containment
 * question is the engine's, and this gate only compares them; deriving a third
 * answer here is the shape of the defect it exists to catch.
 *
 * Scenarios:
 *
 * 1. A unit inside the staged floor is accepted, so the gate does not refuse the
 *    ordinary case it is meant to leave alone.
 * 2. A unit reaching past the floor is refused once, naming the shot, the unit and
 *    the corner the ground does not carry, all read from the one answer rather
 *    than from the same question asked twice.
 * 3. A unit exactly on the boundary is accepted, because the edge of a floor is
 *    still floor and a strict reading would refuse a field sized to its unit.
 * 4. A shot with no staged space is not measured at all, because the engine then
 *    falls back to the scalar ground plane and there is no extent to leave.
 * 5. Every staged unit answers for itself: one contained beside one escaping
 *    reports exactly one refusal and names which unit left, so a passing
 *    sibling cannot hide a failing one and the gate cannot report either.
 * 6. A unit that fits where it stands and marches off the floor is refused at the
 *    time its cue took it out, because a unit walking over a void is the defect
 *    this gate exists for and not a different one.
 * 7. A unit whose cue keeps it on the floor is accepted, and a cue belonging to
 *    another unit does not move this one.
 * 8. A unit whose cue starts at zero is never at its design bounds, so those are
 *    not measured: every sampled time is a position the unit really holds, and
 *    a gate that refused one it never held would be worse than none.
 * 9. A unit that lies along one arm of a crossroads and ends a quarter turn along
 *    the other leaves the ground in between, which reading only the ends cannot
 *    see; a turn that never leaves is still accepted.
 * 10. A unit is judged by its own four corners rather than the box around them,
 *     which a diamond floor separates: turned, the box reaches past ground
 *     every corner of the unit is still standing on.
 * 11. A cue turning far enough to reach the sample cap still ends and still
 *     answers. It says nothing about the sampling under the cap, because the
 *     unit it uses is already off its ground where it stands.
 */
export const test_mcp_production_formation_ground = (): void => {
  TestValidator.equals(
    "a unit inside the staged floor is accepted",
    codes(field(10), [unit(4)]),
    [],
  );

  const escaped = validateAutoMovieFormationGround(
    { id: "opening" },
    { scene: { space: field(4) }, formations: [unit(10)] },
  );
  TestValidator.equals(
    "a unit reaching past the staged floor is refused, and the refusal says which and where",
    namedFacts([
      ["code", () => escaped[0]?.code === "engine-validation-failed"],
      ["one", () => escaped.length === 1],
      ["target", () => escaped[0]!.target === "shot:opening"],
      ["category", () => escaped[0]!.category === "error"],
      [
        "formation",
        () => escaped[0]!.message.startsWith("formation:army.bounds "),
      ],
      ["corner", () => escaped[0]!.message.includes("(-10, -10)")],
    ]),
    {
      code: true,
      one: true,
      target: true,
      category: true,
      formation: true,
      corner: true,
    },
  );

  TestValidator.equals(
    "a unit standing exactly on the edge is still standing on floor",
    codes(field(6), [unit(6)]),
    [],
  );

  TestValidator.equals(
    "a shot that staged no space is not measured",
    namedFacts([
      ["nullSpace", () => codes(null, [unit(1000)]).length === 0],
      [
        "absentSpace",
        () =>
          validateAutoMovieFormationGround(
            { id: "opening" },
            {
              scene: {},
              formations: [unit(1000)],
            },
          ).length === 0,
      ],
    ]),
    { nullSpace: true, absentSpace: true },
  );

  const sibling = validateAutoMovieFormationGround(
    { id: "opening" },
    { scene: { space: field(5) }, formations: [unit(2), unit(9, "cavalry")] },
  );
  TestValidator.equals(
    "one contained unit does not answer for an escaping one",
    namedFacts([
      ["one", () => sibling.length === 1],
      // Distinct ids, so the refusal has to name which unit left. Two units
      // called the same thing would let the gate report either and pass.
      [
        "names",
        () => sibling[0]!.message.startsWith("formation:cavalry.bounds "),
      ],
    ]),
    { one: true, names: true },
  );

  const marched = validateAutoMovieFormationGround(
    { id: "opening" },
    {
      scene: { space: field(10) },
      formations: [unit(4)],
      formationMotions: [march(20)],
    },
  );
  TestValidator.equals(
    "a unit that fits at rest and marches off the floor is refused, at the time its cue took it",
    namedFacts([
      ["code", () => marched[0]?.code === "engine-validation-failed"],
      [
        "time",
        () => marched[0]!.message.includes("at 3s its cue takes the unit to"),
      ],
      ["corner", () => marched[0]!.message.includes("(-4, 16)")],
    ]),
    { code: true, time: true, corner: true },
  );

  TestValidator.equals(
    "a unit that marches and stays on the floor is accepted",
    codes(field(20), [unit(4)], [march(10)]),
    [],
  );

  TestValidator.equals(
    "a cue belonging to another unit does not move this one",
    codes(field(10), [unit(4)], [march(20, "cavalry")]),
    [],
  );

  // A cue starting at zero means the unit is never at its design bounds, so
  // measuring them would refuse a shot for a position it never holds. Here the
  // unit begins carried 40 m onto a floor that reaches 60, and only its design
  // box, sitting at the origin, would be off a floor that starts at 30.
  const carried: IAutoMovieFormationMotion = {
    ...march(0),
    start: 0,
    end: 2,
    from: {
      translation: { x: 0, y: 0, z: 40 },
      facingOffsetDeg: 0,
      spacingScale: { lateral: 1, depth: 1 },
    },
    to: {
      translation: { x: 0, y: 0, z: 45 },
      facingOffsetDeg: 0,
      spacingScale: { lateral: 1, depth: 1 },
    },
  };
  const offsetFloor: IAutoMovieSpace = {
    id: "far-field",
    surfaces: [
      {
        id: "ground",
        kind: "floor",
        polygon: [
          { x: -10, y: 0, z: 30 },
          { x: 10, y: 0, z: 30 },
          { x: 10, y: 0, z: 60 },
          { x: -10, y: 0, z: 60 },
        ],
        anchor: { x: 0, y: 0, z: 30 },
        rampTo: null,
      },
    ],
    walkable: ["ground"],
  };
  TestValidator.equals(
    "a unit whose cue starts at zero is not judged where it never stands",
    codes(offsetFloor, [unit(4)], [carried]),
    [],
  );

  // A nine-by-one unit lies along one arm of a crossroads, ends a quarter turn
  // lying along the other, and is diagonal to both in between. Reading only the
  // ends says it never left the road.
  TestValidator.equals(
    "a unit that leaves the ground mid-turn is refused",
    codes(crossroads(10, 1.5), [lance(9, 1)], [turn(90)]),
    ["engine-validation-failed"],
  );

  const turnedOff = Number(
    /at ([0-9.]+)s/u.exec(
      validateAutoMovieFormationGround(
        { id: "opening" },
        {
          scene: { space: crossroads(10, 1.5) },
          formations: [lance(9, 1)],
          formationMotions: [turn(90)],
        },
      )[0]!.message,
    )![1],
  );
  TestValidator.equals(
    "the mid-turn refusal names a time between the cue's own ends",
    namedFacts([
      ["afterStart", () => turnedOff > 1],
      ["beforeEnd", () => turnedOff < 3],
    ]),
    { afterStart: true, beforeEnd: true },
  );

  TestValidator.equals(
    "a unit that turns without leaving its ground is accepted",
    codes(field(10), [lance(9, 1)], [turn(90)]),
    [],
  );

  // The box around a turned unit is bigger than the unit, and on a square floor
  // the two agree: the box's half-extents are exactly the unit's widest corners
  // in each axis. A diamond separates them. Turned a quarter of a right angle,
  // this unit's four corners all sit at |x| + |z| = 12.73 while its box corners
  // sit at 14.14, so a floor reaching 13.5 carries the unit and not its box.
  TestValidator.equals(
    "a unit is judged by its own corners, not the box around them",
    codes(diamond(13.5), [lance(9, 1)], [turn(45)]),
    [],
  );

  // A cue may legally turn through 360,000 degrees, which without a cap would
  // be a hundred thousand measurements for one unit. What this pins is that the
  // walk still ends and still answers; this unit is already off its ground
  // where it stands, so the refusal it reports is not evidence about the
  // sampling under the cap, and nothing here claims it is.
  TestValidator.equals(
    "a cue turning far enough to reach the sample cap still answers",
    codes(field(4), [lance(9, 1)], [turn(360_000)]),
    ["engine-validation-failed"],
  );
};
