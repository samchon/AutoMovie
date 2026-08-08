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
 * 2. A unit reaching past the floor is refused, naming the formation and the
 *    corner the ground does not carry.
 * 3. A unit exactly on the boundary is accepted, because the edge of a floor is
 *    still floor and a strict reading would refuse a field sized to its unit.
 * 4. A shot with no staged space is not measured at all, because the engine then
 *    falls back to the scalar ground plane and there is no extent to leave.
 * 5. Every staged unit answers for itself: one contained and one escaping report
 *    exactly one refusal, so a passing sibling cannot hide a failing one.
 * 6. A unit that fits where it stands and marches off the floor is refused, naming
 *    the time its cue took it out, because a unit walking over a void is the
 *    defect this gate exists for and not a different one.
 * 7. A unit whose cue keeps it on the floor is accepted, and a cue belonging to
 *    another unit does not move this one.
 * 8. A unit whose cue starts at zero is never at its design bounds, so those are
 *    not measured: every sampled time is a position the unit really holds, and
 *    a gate that refused one it never held would be worse than none.
 */
export const test_mcp_production_formation_ground = (): void => {
  TestValidator.equals(
    "a unit inside the staged floor is accepted",
    codes(field(10), [unit(4)]),
    [],
  );

  TestValidator.equals(
    "a unit reaching past the staged floor is refused",
    codes(field(4), [unit(10)]),
    ["engine-validation-failed"],
  );

  const escaped = validateAutoMovieFormationGround(
    { id: "opening" },
    { scene: { space: field(4) }, formations: [unit(10)] },
  )[0]!;
  TestValidator.equals(
    "the refusal names the shot, the unit, and the corner the ground cannot carry",
    namedFacts([
      ["target", () => escaped.target === "shot:opening"],
      ["category", () => escaped.category === "error"],
      ["formation", () => escaped.message.startsWith("formation:army.bounds ")],
      ["corner", () => escaped.message.includes("(-10, -10)")],
    ]),
    { target: true, category: true, formation: true, corner: true },
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

  TestValidator.equals(
    "one contained unit does not answer for an escaping one",
    codes(field(5), [unit(2), unit(9)]),
    ["engine-validation-failed"],
  );

  TestValidator.equals(
    "a unit that fits at rest and marches off the floor is refused",
    codes(field(10), [unit(4)], [march(20)]),
    ["engine-validation-failed"],
  );

  TestValidator.equals(
    "the refusal names the time its cue took the unit out",
    validateAutoMovieFormationGround(
      { id: "opening" },
      {
        scene: { space: field(10) },
        formations: [unit(4)],
        formationMotions: [march(20)],
      },
    )[0]!.message.includes("at 3s its cue takes the unit to"),
    true,
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
};
