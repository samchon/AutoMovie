import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

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

const fixtureDocuments = (
  directory: string,
  root = directory,
): Array<Parameters<typeof assertAutoMovieEvidenceReviewReasons>[0][number]> =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) return fixtureDocuments(absolute, root);
      return entry.isFile() && /\.(?:md|ts)$/u.test(entry.name)
        ? [
            {
              path: path.relative(root, absolute).replaceAll("\\", "/"),
              source: fs.readFileSync(absolute, "utf8"),
            },
          ]
        : [];
    });

const testCompletedFilmCorpus = (): void => {
  const fixture = path.resolve(
    import.meta.dirname,
    "../../../test/fixtures/completed-film",
  );
  assert.doesNotThrow(
    () => assertAutoMovieEvidenceReviewReasons(fixtureDocuments(fixture)),
    "the complete historical production must contain zero mechanical restatements and zero same-host review reuse",
  );
};

testRestatementForms();
testHostLocalReuse();
testTargetInterpolationReuse();
testAcceptedBoundaries();
testAssertion();
testCompletedFilmCorpus();
