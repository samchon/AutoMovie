import { stageScene } from "@automovie/engine";
import { IAutoMovieStageSetPiece } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { makeScriptWrite, makeStagingWrite } from "../internal/filmFixtures";
import { hasViolation, namedFacts } from "../internal/predicates";

type SetPlacement = IAutoMovieStageSetPiece;

const stageSet = (set: SetPlacement[]) =>
  stageScene(makeScriptWrite(), makeStagingWrite({ set }));

/**
 * A set piece carries an optional uniform-or-per-axis `scale` (#1173), lowered
 * onto the staged node's transform. This is what lets ONE forged primitive
 * furnish a whole set (the wall, the step, and the table top are the same unit
 * box at three sizes) where the pinned `{1, 1, 1}` forced a separately forged
 * model per size.
 *
 * Scenarios:
 *
 * 1. An omitted `scale` keeps the model's authored size (identity); a bare number
 *    scales all three axes; a vector scales each axis on its own: one `slab`
 *    model staged three ways in one round.
 * 2. The gate refuses a zero axis (the piece would draw nothing), a negative axis
 *    (mirrored winding reads inside out in the normal/outline passes), and a
 *    non-finite one, each at its own `$input.set[i].scale`.
 * 3. The negative twin: a very small but positive uniform scale is accepted, so
 *    the gate rejects zero rather than "small".
 */
export const test_film_stage_scene_set_scale = (): void => {
  const staged = stageSet([
    { node: "plain", model: "slab", position: { x: 0, y: 0, z: 0 } },
    {
      node: "crate",
      model: "slab",
      position: { x: 1, y: 0, z: 0 },
      scale: 2.5,
    },
    {
      node: "wall",
      model: "slab",
      position: { x: 2, y: 0, z: 0 },
      scale: { x: 12, y: 1.8, z: 0.24 },
    },
  ]);
  TestValidator.equals(
    "staging with scaled set succeeds",
    staged.success,
    true,
  );
  if (staged.success !== true) return;

  const scaleOf = (id: string) =>
    staged.scene.nodes.find((node) => node.id === id)!.transform.scale;
  TestValidator.equals("an omitted scale is identity", scaleOf("plain"), {
    x: 1,
    y: 1,
    z: 1,
  });
  TestValidator.equals("a number scales every axis", scaleOf("crate"), {
    x: 2.5,
    y: 2.5,
    z: 2.5,
  });
  TestValidator.equals("a vector scales per axis", scaleOf("wall"), {
    x: 12,
    y: 1.8,
    z: 0.24,
  });

  // 2. the gate, all in one refused round.
  const refused = stageSet([
    { node: "flat", model: "slab", position: { x: 0, y: 0, z: 0 }, scale: 0 },
    {
      node: "mirror",
      model: "slab",
      position: { x: 1, y: 0, z: 0 },
      scale: { x: 1, y: -1, z: 1 },
    },
    {
      node: "nan",
      model: "slab",
      position: { x: 2, y: 0, z: 0 },
      scale: Number.NaN,
    },
    {
      node: "endless",
      model: "slab",
      position: { x: 3, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: Number.POSITIVE_INFINITY },
    },
  ]);
  TestValidator.equals(
    "zero, negative, and non-finite scales are each refused at their path",
    namedFacts([
      ["refusedSuccess", () => refused.success === false],
      [
        "hasViolationRefusedRange",
        () =>
          refused.success === false &&
          hasViolation(refused, "range", "$input.set[0].scale"),
      ],
      [
        "hasViolationRefusedRange2",
        () =>
          refused.success === false &&
          hasViolation(refused, "range", "$input.set[1].scale"),
      ],
      [
        "hasViolationRefusedRange3",
        () =>
          refused.success === false &&
          hasViolation(refused, "range", "$input.set[2].scale"),
      ],
      [
        "hasViolationRefusedRange4",
        () =>
          refused.success === false &&
          hasViolation(refused, "range", "$input.set[3].scale"),
      ],
    ]),
    {
      refusedSuccess: true,
      hasViolationRefusedRange: true,
      hasViolationRefusedRange2: true,
      hasViolationRefusedRange3: true,
      hasViolationRefusedRange4: true,
    },
  );

  // 3. the negative twin: positive-but-tiny is a size, not a collapse.
  const tiny = stageSet([
    {
      node: "pebble",
      model: "slab",
      position: { x: 0, y: 0, z: 0 },
      scale: 1e-6,
    },
  ]);
  TestValidator.equals("a tiny positive scale is accepted", tiny.success, true);
};
