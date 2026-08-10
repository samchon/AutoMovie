import {
  autoMovieRenderDigest,
  designLineageDigest,
  designLineageViewDigest,
} from "@automovie/engine";
import type { IAutoMovieDesignLineage } from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import {
  brokenLineage,
  emptyLineage,
  lineageDigest,
  renovationLineage,
} from "../internal/lineageFixtures";
import { throwsError } from "../internal/predicates";

/**
 * Pin the content digest and the deterministic replay handle a derived artifact
 * is supposed to cite.
 *
 * A digest that moves when an authored array is reshuffled cannot certify
 * anything, and a digest that fails to move when an imported texture's bytes
 * change certifies a lie. Both properties are asserted here, and the
 * canonicalization itself is checked against a serialization this test writes
 * out by hand rather than against whatever the implementation currently emits.
 *
 * Field separation is length-prefixed on purpose. A record joined by a bare
 * delimiter lets authored text forge a field boundary, so two different designs
 * can be made to digest identically; the collision case below is exactly that
 * attempt, and it has to fail.
 *
 * Scenarios:
 *
 * 1. The minimal lineage digests to the SHA-256 of a canonical string written out
 *    here field by field, so a change in canonicalization is caught rather than
 *    absorbed.
 * 2. The same lineage digests identically twice, and reshuffling every authored
 *    array leaves the digest unchanged.
 * 3. Editing one authored value moves the digest.
 * 4. A view digest replays: the same alternative at the same phase twice is one
 *    value, and the minimal lineage's view digest is likewise hand-derived.
 * 5. Two alternatives of one revision digest differently, and the base design
 *    differs from both.
 * 6. The same alternative at two phases digests differently.
 * 7. An imported texture's bytes move the view digest although not one line of the
 *    design moved. Replacing the file and requoting it in the outputs that read
 *    it is a single edit, because a record that moved only one of the two is
 *    refused as stale before it can be digested at all.
 * 8. Two designs that a bare-delimiter serialization would collide digest
 *    differently.
 * 9. An unknown alternative or phase is refused rather than digested.
 */
export const test_architecture_design_lineage_digest = (): void => {
  const bare = emptyLineage();
  const bareDigest = lineageDigest("0f");
  TestValidator.equals(
    "the minimal lineage digests its hand-written canonical serialization",
    designLineageDigest(bare),
    autoMovieRenderDigest(
      [
        "7:lineage|4:bare|1:1|2:r1",
        `8:revision|2:r1|0:|${bareDigest.length}:${bareDigest}`,
      ].join("\n"),
    ),
  );
  TestValidator.equals(
    "the minimal lineage's base view digests its hand-written serialization",
    designLineageViewDigest(bare, { variant: null, phase: null }),
    autoMovieRenderDigest(
      `4:view|4:bare|2:r1|${bareDigest.length}:${bareDigest}|0:|0:`,
    ),
  );

  const lineage = renovationLineage();
  TestValidator.equals(
    "the same authored lineage digests to the same value twice",
    designLineageDigest(lineage),
    designLineageDigest(renovationLineage()),
  );

  const shuffled = brokenLineage((draft) => {
    draft.subjects.reverse();
    draft.revisions.reverse();
    draft.phases.reverse();
    draft.lifecycles.reverse();
    draft.variants.reverse();
    draft.decisions.reverse();
    draft.derived.reverse();
    for (const variant of draft.variants) variant.changes.reverse();
    for (const phase of draft.phases) phase.requires.reverse();
    for (const artifact of draft.derived) artifact.inputs.reverse();
  });
  TestValidator.equals(
    "reshuffling every authored array leaves the digest unchanged",
    designLineageDigest(shuffled),
    designLineageDigest(lineage),
  );
  TestValidator.predicate(
    "editing one authored value moves the digest",
    designLineageDigest(
      brokenLineage((draft) => {
        draft.variants[0]!.changes[0]!.value = "oak-plain-sawn";
      }),
    ) !== designLineageDigest(lineage),
  );

  const warm = designLineageViewDigest(lineage, {
    variant: "warm-oak",
    phase: "finishes",
  });
  TestValidator.equals(
    "replaying one alternative at one phase yields the same view digest",
    designLineageViewDigest(renovationLineage(), {
      variant: "warm-oak",
      phase: "finishes",
    }),
    warm,
  );
  const cool = designLineageViewDigest(lineage, {
    variant: "cool-stone",
    phase: "finishes",
  });
  const base = designLineageViewDigest(lineage, {
    variant: null,
    phase: "finishes",
  });
  TestValidator.equals(
    "the two alternatives and the base design are three distinct views",
    new Set([warm, cool, base]).size,
    3,
  );
  TestValidator.predicate(
    "the same alternative at an earlier phase is a different view",
    designLineageViewDigest(lineage, {
      variant: "warm-oak",
      phase: "structure",
    }) !== warm,
  );

  TestValidator.predicate(
    "an imported texture's bytes move the view although the design did not",
    designLineageViewDigest(
      brokenLineage((draft) => {
        // Replacing the file and rebaking what read it is one edit, not two:
        // the outputs that quoted the old bytes are stale until they quote the
        // new ones, so a record that moved only the subject is refused.
        const replaced = lineageDigest("5d");
        draft.subjects.find((subject) => subject.id === "oak-texture")!.digest =
          replaced;
        for (const artifact of draft.derived)
          for (const citation of artifact.assets)
            if (citation.subject === "oak-texture") citation.digest = replaced;
      }),
      { variant: "warm-oak", phase: "finishes" },
    ) !== warm,
  );

  // A serialization that joined fields with a bare delimiter would read these
  // two designs as the same bytes: `ab` + `c` against `a` + `bc`.
  const collidable = (
    subject: string,
    aspect: string,
  ): IAutoMovieDesignLineage => ({
    version: 1,
    id: "collide",
    head: "r1",
    subjects: [{ id: subject, graph: "element", digest: null }],
    revisions: [{ id: "r1", parent: null, digest: lineageDigest("0f") }],
    phases: [],
    lifecycles: [{ subject, introducedIn: null, removedIn: null }],
    variants: [
      {
        id: "v1",
        label: "one",
        base: "r1",
        changes: [
          {
            id: "c1",
            subject,
            aspect,
            value: "v",
            rationale: "collision probe",
          },
        ],
      },
    ],
    decisions: [],
    derived: [],
  });
  TestValidator.predicate(
    "authored text cannot forge a field boundary in the digest",
    designLineageViewDigest(collidable("ab", "c"), {
      variant: "v1",
      phase: null,
    }) !==
      designLineageViewDigest(collidable("a", "bc"), {
        variant: "v1",
        phase: null,
      }),
  );

  TestValidator.predicate(
    "an unknown alternative is refused rather than digested",
    throwsError(
      () =>
        designLineageViewDigest(lineage, { variant: "brutalist", phase: null }),
      'has no design variant "brutalist"',
    ),
  );
  TestValidator.predicate(
    "an unknown phase is refused rather than digested",
    throwsError(
      () =>
        designLineageViewDigest(lineage, {
          variant: "warm-oak",
          phase: "topping-out",
        }),
      'has no construction phase "topping-out"',
    ),
  );
};
