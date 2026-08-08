import { validateModel } from "@automovie/engine";
import { AutoMovieHumanoidBone, IAutoMovieBone } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { IDENTITY_TRANSFORM, createModel } from "../internal/fixtures";
import { hasViolation, namedFacts } from "../internal/predicates";

const b = (
  bone: AutoMovieHumanoidBone,
  parent: AutoMovieHumanoidBone | null,
): IAutoMovieBone => ({
  bone,
  parent,
  rest: IDENTITY_TRANSFORM,
  constraint: null,
});

/**
 * A model skeleton must be a connected tree: every parent resolves, exactly one
 * root exists, and every bone is reachable from that root.
 *
 * Scenarios:
 *
 * 1. `spine` names missing parent `neck` -> a type violation on its parent.
 * 2. `hips` and `spine` are both roots -> a type violation on the bone list.
 * 3. A single-rooted skeleton plus a detached two-bone cycle -> both detached
 *    cycle bones are unreachable.
 */
export const test_validation_model_skeleton_graph = (): void => {
  const base = createModel();

  const missingParent = validateModel({
    model: {
      ...base,
      skeleton: {
        ...base.skeleton!,
        bones: [b("hips", null), b("spine", "neck")],
      },
    },
  });
  TestValidator.equals("missing parent fails", missingParent.success, false);
  TestValidator.predicate(
    "missing parent violation",
    hasViolation(missingParent, "type", "$input.skeleton.bones[1].parent"),
  );

  const twoRoots = validateModel({
    model: {
      ...base,
      skeleton: {
        ...base.skeleton!,
        bones: [b("hips", null), b("spine", null)],
      },
    },
  });
  TestValidator.equals("two roots fail", twoRoots.success, false);
  TestValidator.equals(
    "root count violation",
    namedFacts([
      ["refused", () => twoRoots.success === false],
      [
        "violated",
        () =>
          twoRoots.success === false &&
          twoRoots.violations.some(
            (v) =>
              v.path.endsWith("$input.skeleton.bones") &&
              String(v.expected).includes("exactly one root"),
          ),
      ],
    ]),
    { refused: true, violated: true },
  );

  const detachedCycle = validateModel({
    model: {
      ...base,
      skeleton: {
        ...base.skeleton!,
        bones: [
          b("hips", null),
          b("spine", "hips"),
          b("leftHand", "leftLowerArm"),
          b("leftLowerArm", "leftHand"),
        ],
      },
    },
  });
  TestValidator.equals("detached cycle fails", detachedCycle.success, false);
  TestValidator.equals(
    "detached cycle bones unreachable",
    namedFacts([
      ["detachedCycleSuccess", () => detachedCycle.success === false],
      [
        "hasViolationDetachedCycleType",
        () =>
          detachedCycle.success === false &&
          hasViolation(detachedCycle, "type", "$input.skeleton.bones[2]"),
      ],
      [
        "hasViolationDetachedCycleType2",
        () =>
          detachedCycle.success === false &&
          hasViolation(detachedCycle, "type", "$input.skeleton.bones[3]"),
      ],
    ]),
    {
      detachedCycleSuccess: true,
      hasViolationDetachedCycleType: true,
      hasViolationDetachedCycleType2: true,
    },
  );
};
