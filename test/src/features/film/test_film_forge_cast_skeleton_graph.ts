import { forgeCast } from "@automovie/engine";
import { AutoMovieHumanoidBone, IAutoMovieBone } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { forgeEntry, makeScriptWrite } from "../internal/filmFixtures";
import { IDENTITY_TRANSFORM } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

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
 * Pins the skeleton-graph gates: a rig must be one connected tree — unique bone
 * names, resolvable parents, exactly one root, and every bone reachable from
 * it. The detached-cycle case is the reason reachability exists at all: it
 * satisfies every local check and is still unposable.
 *
 * Scenarios:
 *
 * 1. A skeleton declaring `hips` twice, `spine` parented to the undeclared `neck`,
 *    and two roots (`hips`, `chest`) → `type` violations on the duplicate bone,
 *    the unresolvable parent, and the root count (and reachability is skipped —
 *    meaningless without a single root).
 * 2. A single-rooted skeleton (`hips` → `spine`) plus a two-bone cycle (`leftHand`
 *    ⇄ `leftLowerArm`) floating off the tree → every local check passes, but
 *    both cycle bones raise unreachable violations.
 * 3. A single-rooted skeleton declaring `spine` twice under `hips` → only the
 *    duplicate field is reported through model validation. The reachability
 *    walk still terminates (the visited guard absorbs the doubled child edge
 *    instead of re-queueing forever), with no spurious unreachable findings.
 */
export const test_film_forge_cast_skeleton_graph = (): void => {
  const broken = forgeCast(makeScriptWrite(), {
    type: "write",
    entries: [
      forgeEntry("knightB", {
        skeleton: {
          id: "skeleton-broken",
          bones: [
            b("hips", null),
            b("hips", null),
            b("spine", "neck"),
            b("chest", null),
          ],
        },
      }),
    ],
  });
  TestValidator.equals("broken fails", broken.success, false);
  if (broken.success === false) {
    TestValidator.predicate(
      "duplicate bone rejected",
      hasViolation(broken, "type", ".skeleton.bones[1].bone"),
    );
    TestValidator.predicate(
      "unresolvable parent rejected",
      hasViolation(broken, "type", ".skeleton.bones[2].parent"),
    );
    TestValidator.predicate(
      "root count rejected",
      broken.violations.some(
        (v) =>
          v.path.endsWith(".skeleton.bones") &&
          String(v.expected).includes("exactly one root"),
      ),
    );
  }

  const cyclic = forgeCast(makeScriptWrite(), {
    type: "write",
    entries: [
      forgeEntry("knightB", {
        skeleton: {
          id: "skeleton-cycle",
          bones: [
            b("hips", null),
            b("spine", "hips"),
            b("leftHand", "leftLowerArm"),
            b("leftLowerArm", "leftHand"),
          ],
        },
      }),
    ],
  });
  TestValidator.equals("cycle fails", cyclic.success, false);
  TestValidator.predicate(
    "both detached-cycle bones unreachable",
    cyclic.success === false &&
      hasViolation(cyclic, "type", ".skeleton.bones[2]") &&
      hasViolation(cyclic, "type", ".skeleton.bones[3]"),
  );

  const doubled = forgeCast(makeScriptWrite(), {
    type: "write",
    entries: [
      forgeEntry("knightB", {
        skeleton: {
          id: "skeleton-doubled",
          bones: [b("hips", null), b("spine", "hips"), b("spine", "hips")],
        },
      }),
    ],
  });
  TestValidator.equals("doubled fails", doubled.success, false);
  TestValidator.predicate(
    "only the duplicate field is reported (walk terminates, nothing unreachable)",
    doubled.success === false &&
      hasViolation(doubled, "type", ".skeleton.bones[2].bone") &&
      doubled.violations.every((v) =>
        v.path.endsWith(".skeleton.bones[2].bone"),
      ),
  );
};
