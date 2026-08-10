import { designLineageImpact } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import { brokenLineage, renovationLineage } from "../internal/lineageFixtures";
import { throwsError } from "../internal/predicates";

/**
 * Pin that one changed identity invalidates exactly the outputs derived from
 * it, and nothing else.
 *
 * "Everything is stale" is always a correct answer and always a useless one, so
 * the claim this test defends is the complement: the artifacts left standing
 * are named beside the ones that fell, and both lists are read off the authored
 * derivation edges by hand.
 *
 * Moving one door opening therefore reaches the wall mesh it is cut into, the
 * finish pieces cut to that wall, the door leaf hosted in it, the schedule line
 * counting those pieces, and the render that drew them. It does not reach the
 * opposite wall, that wall's finishes, its render, the phase render, or either
 * of the two alternative comparison renders.
 *
 * Scenarios:
 *
 * 1. One opening change invalidates the wall mesh, the finish cut, the door mesh,
 *    the quantity, and the render, and leaves the six unrelated artifacts
 *    untouched.
 * 2. The same question asked twice about the same identity deduplicates rather
 *    than doubling the answer.
 * 3. Changing an imported asset's bytes invalidates the outputs that cite it even
 *    though no line of the design moved.
 * 4. A derived artifact named as changed invalidates itself and its dependents.
 * 5. Two unrelated changes union their impact rather than one shadowing the other.
 * 6. Changing nothing invalidates nothing and leaves every artifact accounted for,
 *    which is the boundary that proves the partition is total.
 * 7. An identity no graph declared is refused rather than traced as empty, and an
 *    incoherent lineage is refused before any impact is computed.
 */
export const test_architecture_design_lineage_change_impact = (): void => {
  const lineage = renovationLineage();

  TestValidator.equals(
    "one opening change invalidates its wall, cut, door, quantity, and render",
    designLineageImpact(lineage, ["opening-door"]),
    {
      changed: ["opening-door"],
      invalidated: [
        "cut-floor-oak",
        "mesh-door-leaf",
        "mesh-wall-north",
        "quantity-finishes",
        "render-lobby",
      ],
      unaffected: [
        "cut-floor-west",
        "mesh-wall-west",
        "render-cool",
        "render-strip-phase",
        "render-warm",
        "render-west",
      ],
    },
  );

  TestValidator.equals(
    "asking twice about one identity deduplicates instead of doubling",
    designLineageImpact(lineage, ["opening-door", "opening-door"]),
    designLineageImpact(lineage, ["opening-door"]),
  );

  TestValidator.equals(
    "changing an imported asset's bytes invalidates the outputs citing it",
    designLineageImpact(lineage, ["oak-texture"]),
    {
      changed: ["oak-texture"],
      invalidated: ["cut-floor-oak", "quantity-finishes", "render-lobby"],
      unaffected: [
        "cut-floor-west",
        "mesh-door-leaf",
        "mesh-wall-north",
        "mesh-wall-west",
        "render-cool",
        "render-strip-phase",
        "render-warm",
        "render-west",
      ],
    },
  );

  TestValidator.equals(
    "a derived artifact named as changed invalidates itself and its dependents",
    designLineageImpact(lineage, ["mesh-wall-north"]),
    {
      changed: ["mesh-wall-north"],
      invalidated: [
        "cut-floor-oak",
        "mesh-wall-north",
        "quantity-finishes",
        "render-lobby",
      ],
      unaffected: [
        "cut-floor-west",
        "mesh-door-leaf",
        "mesh-wall-west",
        "render-cool",
        "render-strip-phase",
        "render-warm",
        "render-west",
      ],
    },
  );

  TestValidator.equals(
    "two unrelated changes union their impact",
    designLineageImpact(lineage, ["opening-door", "wall-west"]),
    {
      changed: ["opening-door", "wall-west"],
      invalidated: [
        "cut-floor-oak",
        "cut-floor-west",
        "mesh-door-leaf",
        "mesh-wall-north",
        "mesh-wall-west",
        "quantity-finishes",
        "render-lobby",
        "render-west",
      ],
      unaffected: ["render-cool", "render-strip-phase", "render-warm"],
    },
  );

  TestValidator.equals(
    "changing nothing invalidates nothing and accounts for every artifact",
    designLineageImpact(lineage, []),
    {
      changed: [],
      invalidated: [],
      unaffected: [
        "cut-floor-oak",
        "cut-floor-west",
        "mesh-door-leaf",
        "mesh-wall-north",
        "mesh-wall-west",
        "quantity-finishes",
        "render-cool",
        "render-lobby",
        "render-strip-phase",
        "render-warm",
        "render-west",
      ],
    },
  );

  TestValidator.predicate(
    "an identity no graph declared is refused rather than traced as empty",
    throwsError(
      () => designLineageImpact(lineage, ["wall-east"]),
      'has no identity "wall-east" to trace',
    ),
  );
  TestValidator.predicate(
    "an incoherent lineage is refused before any impact is computed",
    throwsError(
      () =>
        designLineageImpact(
          brokenLineage((draft) => {
            draft.head = "r9";
          }),
          ["opening-door"],
        ),
      'head revision "r9" does not resolve',
    ),
  );
};
