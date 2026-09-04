import assert from "node:assert";

import { assertAutoMovieEvidenceReviewReasons } from "../src/auditAutoMovieEvidenceReviewReasons";

const document = (source: string, path = "docs/models/example.md") => ({
  path,
  source,
});

const rejectionMessage = (
  documents: Parameters<typeof assertAutoMovieEvidenceReviewReasons>[0],
): string => {
  try {
    assertAutoMovieEvidenceReviewReasons(documents);
  } catch (error) {
    assert(error instanceof Error);
    return error.message;
  }
  assert.fail("Expected mechanically invalid review reasons to be refused.");
};

const testRestatementForms = (): void => {
  const message = rejectionMessage([
    document(`
# Example

## Form {#form}

<!--
@evidence principles/core/common.md#scope-preservation The unit owns its promised silhouette.
@evidenceReview principles/core/common.md#scope-preservation #abc123 The unit owns its promised silhouette!
@evidenceExclude settings/limits.md#speed This population has no moving owner.
@evidenceExcludeReview settings/limits.md#speed #def456 Compared settings/limits.md#speed with the complete population. Verified relationship: This population has no moving owner.
@evidence principles/design/models.md#spatial-convention The origin is at ground centre.
@evidenceReview principles/design/models.md#spatial-convention #789abc Inspection found that the origin is at ground centre.
-->
`),
  ]);
  assert.match(
    message,
    /docs\/models\/example\.md:8 \[evidence-review-restatement\] principles\/core\/common\.md#scope-preservation \(docs\/models\/example\.md#form\)/u,
  );
  assert.match(
    message,
    /docs\/models\/example\.md:10 \[evidence-review-restatement\] settings\/limits\.md#speed \(docs\/models\/example\.md#form\)/u,
  );
  assert.match(
    message,
    /docs\/models\/example\.md:12 \[evidence-review-restatement\] principles\/design\/models\.md#spatial-convention \(docs\/models\/example\.md#form\)/u,
  );
};

const testHostLocalReuse = (): void => {
  const message = rejectionMessage([
    document(`
# Example

## First {#first}

<!--
@evidence principles/design/models.md#representation-contract The proxy has a fixed silhouette.
@evidenceReview principles/design/models.md#representation-contract #abc123 Read principles/design/models.md#representation-contract and the host; the weakest face split remains observable at the left profile.
@evidence principles/design/models.md#reviewable-structure The proxy exposes its face split.
@evidenceReview principles/design/models.md#reviewable-structure #def456 Read principles/design/models.md#reviewable-structure and the host; the weakest face split remains observable at the left profile.
-->

## Second {#second}

<!--
@evidence principles/design/models.md#spatial-convention The origin is at ground centre.
@evidenceReview principles/design/models.md#spatial-convention #789abc Read principles/design/models.md#spatial-convention and the host; the weakest face split remains observable at the left profile.
-->
`),
  ]);
  assert.match(
    message,
    /\[evidence-review-reused\] principles\/design\/models\.md#reviewable-structure \(docs\/models\/example\.md#first\)/u,
  );
  assert.doesNotMatch(message, /docs\/models\/example\.md#second/u);
};

const testTargetInterpolationReuse = (): void => {
  const message = rejectionMessage([
    document(
      `/**
 * @evidence principles/core/source-units.md#scope-preservation Builds the declared joint.
 * @evidenceReview principles/core/source-units.md#scope-preservation #abc123 Checked principles/core/source-units.md#scope-preservation against the export and found the named joint.
 * @evidence principles/core/source-units.md#substantive-completion Constructs the joint.
 * @evidenceReview principles/core/source-units.md#substantive-completion #def456 Checked principles/core/source-units.md#substantive-completion against the export and found the named joint.
 */
export const joint = true;
`,
      "src/models/joint.ts",
    ),
  ]);
  assert.match(message, /\[evidence-review-reused\]/u);
  assert.match(message, /src\/models\/joint\.ts::docblock@1/u);
};

const testAcceptedBoundaries = (): void => {
  assert.doesNotThrow(() =>
    assertAutoMovieEvidenceReviewReasons([
      document(`
\`\`\`
@evidence principles/core/common.md#scope-preservation Example acknowledgement.
@evidenceReview principles/core/common.md#scope-preservation #abc123 Example acknowledgement.
\`\`\`

# Example

## First without an explicit anchor

<!--
@evidence principles/core/common.md#scope-preservation The unit owns its silhouette.

@evidenceReview principles/core/common.md#scope-preservation #abc123 The unit owns its silhouette.
@evidence principles/design/models.md#reviewable-structure The unit names the left profile.
@evidenceReview principles/design/models.md#reviewable-structure #def456 The review found the left profile is weakest because its face split narrows to one pixel.
@evidenceExclude settings/limits.md#speed No moving subject exists.
@evidenceReview settings/limits.md#speed #789abc The mismatched review kind is not the paired exclusion review.
-->
`),
    ]),
  );
  assert.doesNotThrow(() =>
    assertAutoMovieEvidenceReviewReasons([
      document(
        "<!-- @evidenceReview contracts/local.md#rule malformed -->",
        "docs/models/malformed.md",
      ),
    ]),
  );
};

const testAssertion = (): void => {
  assert.doesNotThrow(() => assertAutoMovieEvidenceReviewReasons([]));
  assert.throws(
    () =>
      assertAutoMovieEvidenceReviewReasons([
        document(`
<!--
@evidence principles/core/common.md#scope-preservation The unit owns its scope.
@evidenceReview principles/core/common.md#scope-preservation #abc123 The unit owns its scope.
-->
`),
      ]),
    /mechanically invalid copies:[\s\S]*docs\/models\/example\.md:4[\s\S]*evidence-review-restatement/u,
  );
};

/**
 * Two hosts answering one target with one sentence, and the three boundaries
 * that are not that.
 */
const testCrossHostSharedReason = (): void => {
  const shared = "The unit fixes the ground origin and the raised endpoint.";
  const host = (title: string, anchor: string, tag: string) => `
# Film

## ${title} {#${anchor}}

<!--
${tag}
-->
`;
  const message = rejectionMessage([
    document(
      host(
        "One",
        "one",
        `@evidence principles/core/common.md#scope-preservation ${shared}`,
      ),
      "docs/models/a.md",
    ),
    document(
      host(
        "Two",
        "two",
        `@evidence principles/core/common.md#scope-preservation ${shared}`,
      ),
      "docs/models/b.md",
    ),
  ]);
  assert.match(
    message,
    /docs\/models\/b\.md:7 \[evidence-reason-shared\] principles\/core\/common\.md#scope-preservation \(docs\/models\/b\.md#two\)/u,
  );
  assert.match(message, /word for word the one docs\/models\/a\.md:7 gives/u);

  // A different target, which is the sibling defect and carries its own code.
  assert.doesNotThrow(() =>
    assertAutoMovieEvidenceReviewReasons([
      document(
        host(
          "One",
          "one",
          `@evidence principles/core/common.md#scope-preservation ${shared}`,
        ),
        "docs/models/c.md",
      ),
      document(
        host(
          "Two",
          "two",
          `@evidence principles/core/defaults.md#purposeful-enumeration ${shared}`,
        ),
        "docs/models/d.md",
      ),
    ]),
  );

  // Refusing a target and answering it are different claims that may honestly
  // read alike, so the exclusion flag is part of the identity.
  assert.doesNotThrow(() =>
    assertAutoMovieEvidenceReviewReasons([
      document(
        host(
          "One",
          "one",
          `@evidence principles/core/common.md#scope-preservation ${shared}`,
        ),
        "docs/models/e.md",
      ),
      document(
        host(
          "Two",
          "two",
          `@evidenceExclude principles/core/common.md#scope-preservation ${shared}`,
        ),
        "docs/models/f.md",
      ),
    ]),
  );

  // And one word apart, which passes. Stating the limit rather than hiding it:
  // the exchange test is a reviewer's duty and this is only its cheapest
  // mechanical floor.
  assert.doesNotThrow(() =>
    assertAutoMovieEvidenceReviewReasons([
      document(
        host(
          "One",
          "one",
          `@evidence principles/core/common.md#scope-preservation ${shared}`,
        ),
        "docs/models/g.md",
      ),
      document(
        host(
          "Two",
          "two",
          "@evidence principles/core/common.md#scope-preservation The unit fixes the ground origin and the lowered endpoint.",
        ),
        "docs/models/h.md",
      ),
    ]),
  );
};

/** Native carrier syntax does not hide or manufacture shared reasons. */
const testNativeCarrierBoundaries = (): void => {
  const tag =
    "@evidence principles/core/common.md#scope-preservation The unit owns its silhouette.";
  const message = rejectionMessage([
    document(
      ["````text", "~~~", "```", "````", `<!-- ${tag} -->`].join("\n"),
      "docs/models/a.md",
    ),
    document(`<!-- ${tag} -->`, "docs/models/b.md"),
  ]);
  assert.match(message, /evidence-reason-shared/u);

  assert.doesNotThrow(() =>
    assertAutoMovieEvidenceReviewReasons([
      document(`export const sample = \`${tag}\`;`, "src/models/a.ts"),
      document(`export const sample = \`${tag}\`;`, "src/models/b.ts"),
    ]),
  );
};

testRestatementForms();
testHostLocalReuse();
testTargetInterpolationReuse();
testAcceptedBoundaries();
testAssertion();
testCrossHostSharedReason();
testNativeCarrierBoundaries();
