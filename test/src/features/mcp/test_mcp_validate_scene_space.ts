import { IAutoMovieScene, IAutoMovieSpace } from "@automovie/interface";
import { AutoMovieApplication } from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { IDENTITY_TRANSFORM } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

const app = new AutoMovieApplication();

const SPACE: IAutoMovieSpace = {
  id: "space-1",
  surfaces: [
    {
      id: "floor",
      kind: "floor",
      polygon: [
        { x: -2, y: 0, z: -2 },
        { x: 2, y: 0, z: -2 },
        { x: 2, y: 0, z: 2 },
        { x: -2, y: 0, z: 2 },
      ],
      anchor: { x: 0, y: 0, z: 0 },
      rampTo: null,
    },
  ],
  walkable: ["floor"],
};

const sceneWith = (space: unknown): IAutoMovieScene =>
  ({
    id: "scene-1",
    name: null,
    nodes: [
      {
        id: "node-a",
        model: "model-a",
        transform: IDENTITY_TRANSFORM,
        motion: null,
        pose: null,
      },
    ],
    cameras: [],
    lights: [],
    space,
  }) as IAutoMovieScene;

const validate = (space: unknown) =>
  app.validateScene({
    scene: sceneWith(space),
    models: [{ id: "model-a", skeleton: null }],
  }).validation;

/**
 * A committed scene's `space` is validated too (#1173). `stage` gates the space
 * it composes, but `commitScene` accepts a caller-authored scene, and a
 * malformed space there would sit in the project until a ground query
 * dereferenced it. The scene validator therefore runs the same shape floor and
 * the same engine `validateSpace` the staging path does: one rule, one
 * meaning, whichever door the space came through.
 *
 * A space surface deliberately needs NO entry in the models registry: it is the
 * ground's meaning, drawn from its own footprint, so the node model-resolution
 * gate must not reach it.
 *
 * Scenarios:
 *
 * 1. A scene whose only geometry beyond the one node is a walkable floor validates
 *    clean against a registry holding just that node's model: the surface
 *    demands no model of its own.
 * 2. A scene with no space at all, and one with an explicit `null`, both stay
 *    clean: the pre-space scalar plane is untouched by this check.
 * 3. A structurally broken space (a non-array `surfaces`) is reported at
 *    `$input.scene.space.surfaces` and stops there: the same payload's dangling
 *    walkable id draws NO engine violation, proving the engine validator was
 *    never handed a shape it would dereference into a throw.
 * 4. A shape-valid but semantically broken space (concave footprint, walkable id
 *    resolving to nothing) is reported by the engine validator under
 *    `$input.scene.space.*`.
 */
export const test_mcp_validate_scene_space = (): void => {
  TestValidator.equals("a walkable floor needs no model", validate(SPACE), {
    success: true,
  });
  TestValidator.equals("an omitted space is clean", validate(undefined), {
    success: true,
  });
  TestValidator.equals("a null space is clean", validate(null), {
    success: true,
  });

  // `surfaces` is not an array: the engine validator would iterate it into a
  // throw. It also carries a walkable id resolving to nothing, so the ABSENCE
  // of that engine violation is what proves the shape gate short-circuited.
  const brokenShape = validate({
    id: "space-1",
    surfaces: 5,
    walkable: ["ghost"],
  });
  TestValidator.predicate(
    "a broken space shape is reported and never reaches the engine validator",
    hasViolation(brokenShape, "type", "$input.scene.space.surfaces") &&
      !hasViolation(brokenShape, "type", "$input.scene.space.walkable[0]"),
  );

  const brokenMeaning = validate({
    id: "space-1",
    surfaces: [
      {
        id: "floor",
        kind: "floor",
        // (0, 0) sits strictly inside the hull of the other three.
        polygon: [
          { x: -2, y: 0, z: -2 },
          { x: 2, y: 0, z: -2 },
          { x: 0, y: 0, z: 2 },
          { x: 0, y: 0, z: 0 },
        ],
        anchor: { x: 0, y: 0, z: 0 },
        rampTo: null,
      },
    ],
    walkable: ["balcony"],
  });
  TestValidator.predicate(
    "the engine's surface rules report under the scene's space path",
    hasViolation(
      brokenMeaning,
      "type",
      "$input.scene.space.surfaces[0].polygon",
    ) && hasViolation(brokenMeaning, "type", "$input.scene.space.walkable[0]"),
  );
};
