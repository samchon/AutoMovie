import { AutoMovieHumanoidBone } from "@automovie/interface";
import { buildModel } from "@automovie/viewer";
import { TestValidator } from "@nestia/e2e";

import { createModel, primitivePart } from "../internal/fixtures";
import { throwsError } from "../internal/predicates";

/**
 * A rigid part whose `attachedBone` the skeleton does not carry throws instead
 * of silently parenting to the model root (#1106): the fallback rendered a
 * hand-held prop frozen at the origin while everything else looked right: the
 * silent-skip class #1051 removed from the viewer, and the same defect class
 * the skin path already throws on.
 *
 * Scenarios:
 *
 * 1. `attachedBone: "rightHand"` on a skeleton without that bone throws naming the
 *    part and the bone.
 * 2. Negative twin: the same part attached to an existing bone rides that bone
 *    (parented under it, not the group).
 * 3. `attachedBone: null` still parents the part to the model group.
 */
export const test_viewer_build_model_attached_bone = (): void => {
  const sword = (attachedBone: AutoMovieHumanoidBone | null) => ({
    ...primitivePart("sword", {
      type: "box" as const,
      width: 0.05,
      height: 0.7,
      depth: 0.05,
    }),
    attachedBone,
  });

  // 1. unknown attachedBone throws with the part and bone named
  TestValidator.predicate(
    "an unknown attachedBone throws",
    throwsError(
      () =>
        buildModel({
          ...createModel(),
          parts: [sword("rightHand")],
        }),
      ['part "sword"', 'missing bone "rightHand"'],
    ),
  );

  // 2. negative twin: a known attachedBone rides that bone
  const model = createModel();
  const knownBone = model.skeleton!.bones[0]!.bone;
  const built = buildModel({ ...model, parts: [sword(knownBone)] });
  const bone = built.bones.get(knownBone)!;
  TestValidator.equals(
    "a known attachedBone parents the part under that bone",
    bone.children.some((child) => child.name === "sword"),
    true,
  );

  // 3. a null attachedBone still parents to the model group
  const loose = buildModel({ ...createModel(), parts: [sword(null)] });
  TestValidator.equals(
    "an unattached part parents to the model group",
    loose.object.children.some((child) => child.name === "sword"),
    true,
  );
};
