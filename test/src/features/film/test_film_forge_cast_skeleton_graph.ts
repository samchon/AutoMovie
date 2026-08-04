import { forgeCast } from "@automovie/engine";
import { AutoMovieHumanoidBone, IAutoMovieBone } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { forgeEntry, makeScriptWrite } from "../internal/filmFixtures";
import { IDENTITY_TRANSFORM } from "../internal/fixtures";
import { hasViolation } from "../internal/predicates";

/**
 * Evaluate named facts in order and stop at the first false one, so a failed
 * comparison names the fact instead of collapsing into one boolean. Stopping
 * keeps the short-circuit semantics the original conjunction had, which some
 * facts depend on to guard the ones after them.
 */
const namedFacts = (
  entries: ReadonlyArray<readonly [string, () => boolean]>,
): Record<string, boolean> => {
  const output: Record<string, boolean> = {};
  for (const [name, evaluate] of entries) {
    output[name] = evaluate();
    if (output[name] === false) break;
  }
  return output;
};

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
 * Pins the skeleton-graph gates: a rig must be one connected tree (unique bone
 * names, resolvable parents, exactly one root, and every bone reachable from
 * it). The detached-cycle case is the reason reachability exists at all: it
 * satisfies every local check and is still unposable.
 *
 * Scenarios:
 *
 * 1. A skeleton declaring `hips` twice, `spine` parented to the undeclared `neck`,
 *    and two roots (`hips`, `chest`) → `type` violations on the duplicate bone,
 *    the unresolvable parent, and the root count (and reachability is skipped:
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
  TestValidator.equals(
    "both detached-cycle bones unreachable",
    namedFacts([
      ["cyclicSuccess", () => cyclic.success === false],
      [
        "hasViolationCyclic",
        () => hasViolation(cyclic, "type", ".skeleton.bones[2]"),
      ],
      [
        "hasViolationCyclic2",
        () => hasViolation(cyclic, "type", ".skeleton.bones[3]"),
      ],
    ]),
    {
      cyclicSuccess: true,
      hasViolationCyclic: true,
      hasViolationCyclic2: true,
    },
  );

  const doubled = forgeCast(makeScriptWrite(), {
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
  TestValidator.equals(
    "only the duplicate field is reported (walk terminates, nothing unreachable)",
    namedFacts([
      ["doubledSuccess", () => doubled.success === false],
      [
        "hasViolationDoubled",
        () => hasViolation(doubled, "type", ".skeleton.bones[2].bone"),
      ],
      [
        "doubledViolations",
        () =>
          doubled.violations.every((v) =>
            v.path.endsWith(".skeleton.bones[2].bone"),
          ),
      ],
    ]),
    {
      doubledSuccess: true,
      hasViolationDoubled: true,
      doubledViolations: true,
    },
  );
};
