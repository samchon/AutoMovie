import type {
  IAutoMovieCompiledFormation,
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

/** One compiled unit reaching a stated distance from the origin. */
const unit = (
  reach: number,
): Pick<IAutoMovieCompiledFormation, "id" | "bounds"> => ({
  id: "army",
  bounds: {
    min: { x: -reach, y: 0, z: -reach },
    max: { x: reach, y: 0, z: reach },
  },
});

const codes = (
  space: IAutoMovieSpace | null,
  formations: ReadonlyArray<Pick<IAutoMovieCompiledFormation, "id" | "bounds">>,
): string[] =>
  validateAutoMovieFormationGround(
    { id: "opening" },
    {
      scene: { space },
      formations,
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
};
