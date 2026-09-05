import assert from "node:assert/strict";

import { verifyAutoMovieEvidenceMetadataRewrite } from "../src/verifyAutoMovieEvidenceMetadataRewrite";

const source = (fingerprint: string, reason = "Exact observation.") =>
  [
    "# Contract",
    "",
    "<!-- ordinary author note -->",
    "",
    "## Rule {#rule}",
    "",
    "<!--",
    "@evidence contracts/shared.md#item Exact acknowledgement.",
    `@evidenceReview contracts/shared.md#item ${fingerprint} ${reason}`,
    "-->",
    "",
    "Authored body.",
  ].join("\n");

/**
 * Metadata rewrite verification protects every byte outside its exact slot.
 *
 * Scenarios:
 *
 * 1. Fingerprint-only and review-only rewrites pass with one stable projection.
 * 2. Body, heading, general-comment, unowned reason, declaration count, and
 *    declaration-address changes fail.
 * 3. Non-normalized paths and unsupported ownership fail at admission.
 */
const fingerprint = verifyAutoMovieEvidenceMetadataRewrite({
  path: "docs/contracts/local.md",
  before: source("#abcdef0"),
  after: source("#1234567"),
  ownership: "fingerprints",
});
assert.equal(fingerprint.metadataChanged, true);
assert.equal(fingerprint.declarationCount, 2);
assert.match(fingerprint.projectionSha256, /^[0-9a-f]{64}$/u);

assert.doesNotThrow(() =>
  verifyAutoMovieEvidenceMetadataRewrite({
    path: "docs/contracts/local.md",
    before: source("#abcdef0"),
    after: source("#abcdef0", "Revised exact observation."),
    ownership: "reviews",
  }),
);
assert.throws(
  () =>
    verifyAutoMovieEvidenceMetadataRewrite({
      path: "docs/contracts/local.md",
      before: source("#abcdef0"),
      after: source("#abcdef0", "Revised exact observation."),
      ownership: "fingerprints",
    }),
  /changed an unowned evidence field/u,
);

for (const after of [
  source("#abcdef0").replace("Authored body.", "Changed body."),
  source("#abcdef0").replace("## Rule", "## Revised rule"),
  source("#abcdef0").replace("ordinary author note", "changed author note"),
])
  assert.throws(
    () =>
      verifyAutoMovieEvidenceMetadataRewrite({
        path: "docs/contracts/local.md",
        before: source("#abcdef0"),
        after,
        ownership: "comments",
      }),
    /protected authored bytes changed/u,
  );

assert.throws(
  () =>
    verifyAutoMovieEvidenceMetadataRewrite({
      path: "docs/contracts/local.md",
      before: source("#abcdef0"),
      after: source("#abcdef0").replace(
        "@evidenceReview",
        "@evidence contracts/shared.md#other Another.\n@evidenceReview",
      ),
      ownership: "comments",
    }),
  /cardinality or source address changed/u,
);
for (const after of [
  source("#abcdef0").replace(
    "@evidence contracts/shared.md#item",
    "@evidence contracts/shared.md#other",
  ),
  source("#abcdef0").replace("@evidence ", "@evidenceExclude "),
])
  assert.throws(
    () =>
      verifyAutoMovieEvidenceMetadataRewrite({
        path: "docs/contracts/local.md",
        before: source("#abcdef0"),
        after,
        ownership: "comments",
      }),
    /changed an unowned evidence field/u,
  );
assert.throws(
  () =>
    verifyAutoMovieEvidenceMetadataRewrite({
      path: "docs/contracts/local.md",
      before: source("#abcdef0"),
      after: source("#abcdef0").replace("Exact acknowledgement.", ""),
      ownership: "comments",
    }),
  /changed an unowned evidence field/u,
);
assert.throws(
  () =>
    verifyAutoMovieEvidenceMetadataRewrite({
      path: "../local.md",
      before: source("#abcdef0"),
      after: source("#1234567"),
      ownership: "fingerprints",
    }),
  /normalized relative Markdown path/u,
);
assert.throws(
  () =>
    verifyAutoMovieEvidenceMetadataRewrite({
      path: "docs/contracts/local.md",
      before: source("#abcdef0"),
      after: source("#1234567"),
      ownership: "everything" as never,
    }),
  /expected comments, acknowledgements, reviews, or fingerprints/u,
);

process.stdout.write("evidence metadata rewrite preservation passed\n");
