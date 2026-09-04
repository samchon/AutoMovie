import assert from "node:assert/strict";

import { inspectAutoMovieEvidenceReviewAlarms } from "../src/inspectAutoMovieEvidenceReviewAlarms";

/**
 * Semantic alarms expose suspicious review frames without deciding meaning.
 *
 * Scenarios:
 *
 * 1. Quoted facts, paths, and numbers collapse into one repeated layer frame.
 * 2. Two host-specific observations remain below the alarm boundary.
 * 3. A target's exact Review question is reported only when targets are supplied.
 * 4. Account frames remain partitioned by their owned layer.
 * 5. Threshold-minus-one, keyword reuse, and acknowledgement/exclusion twins stay green.
 * 6. A threshold below two is refused because it cannot describe repetition.
 */
const target = {
  path: "docs/principles/core/common.md",
  source: [
    "# Common",
    "",
    "## Scope preservation {#scope-preservation}",
    "",
    "Review question: which scope would become unowned if this unit disappeared?",
  ].join("\n"),
};
const host = (index: number, reason: string) => ({
  path: `docs/models/${index}.md`,
  source: [
    "# Model",
    "",
    `## Owner ${index} {#owner-${index}}`,
    "",
    "<!--",
    `@evidenceReview principles/core/common.md#scope-preservation #abc${index} ${reason}`,
    "-->",
  ].join("\n"),
});

const repeated = inspectAutoMovieEvidenceReviewAlarms({
  documents: [
    host(
      1,
      "I compared `left profile` with models/a.md#form and found 12 edges.",
    ),
    host(
      2,
      "I compared `right profile` with models/b.md#form and found 18 edges.",
    ),
    host(
      3,
      "I compared `front profile` with models/c.md#form and found 24 edges.",
    ),
  ],
  frameThreshold: 3,
});
assert.equal(repeated.questionPasteChecked, false);
assert.equal(repeated.alarms.length, 3);
assert(
  repeated.alarms.every((alarm) => alarm.code === "evidence-review-frame"),
);
assert(repeated.alarms.every((alarm) => alarm.occurrences === 3));

const distinct = inspectAutoMovieEvidenceReviewAlarms({
  documents: [
    host(4, "The left silhouette keeps the hand clear of the torso."),
    host(5, "The rear view exposes the unsupported ankle pivot."),
  ],
  targets: [target],
  frameThreshold: 2,
});
assert.equal(distinct.questionPasteChecked, true);
assert.deepEqual(distinct.alarms, []);

const pasted = inspectAutoMovieEvidenceReviewAlarms({
  documents: [
    host(
      6,
      "I checked which scope would become unowned if this unit disappeared?",
    ),
  ],
  targets: [target],
});
assert.equal(pasted.alarms.length, 1);
assert.equal(pasted.alarms[0]!.code, "evidence-review-question-paste");

const accountHost = (layer: string, question: string) => ({
  path: `docs/accounts/${layer}/core-common.md`,
  source: [
    `# ${layer} account`,
    "",
    `## Scope {#${layer}-scope}`,
    "",
    "<!--",
    `@evidenceReview obligations/core/common.md#scope #${layer} ${question}`,
    "-->",
  ].join("\n"),
});
assert.deepEqual(
  inspectAutoMovieEvidenceReviewAlarms({
    documents: [
      accountHost("models", "I compared `one` with models/a.md#form."),
      accountHost("spaces", "I compared `two` with spaces/a.md#form."),
    ],
    targets: [
      {
        path: "docs/obligations/core/common.md",
        source: "## Scope {#scope}\n\nReview question:\n",
      },
    ],
    frameThreshold: 2,
  }),
  { alarms: [], questionPasteChecked: true },
);

const belowThreshold = inspectAutoMovieEvidenceReviewAlarms({
  documents: [
    host(7, "I compared `left` with models/a.md#form and found 12 edges."),
    host(8, "I compared `right` with models/b.md#form and found 18 edges."),
  ],
  targets: [target],
  frameThreshold: 3,
});
assert.deepEqual(belowThreshold.alarms, []);
assert.deepEqual(
  inspectAutoMovieEvidenceReviewAlarms({
    documents: [
      host(9, "This unit preserves scope when its concrete shell disappears."),
    ],
    targets: [target],
  }).alarms,
  [],
);
const exclusion = (index: number) => ({
  path: `src/models/${index}.ts`,
  source: [
    "/**",
    ` * @evidenceExcludeReview principles/core/common.md#scope-preservation #exclude${index} I compared \`profile ${index}\` with models/${index}.md#form and found ${index} edges.`,
    " */",
    `export const model${index} = true;`,
  ].join("\n"),
});
assert.deepEqual(
  inspectAutoMovieEvidenceReviewAlarms({
    documents: [
      host(
        10,
        "I compared `profile 10` with models/10.md#form and found 10 edges.",
      ),
      exclusion(10),
    ],
    frameThreshold: 2,
  }).alarms,
  [],
);
assert.throws(
  () =>
    inspectAutoMovieEvidenceReviewAlarms({
      documents: [],
      frameThreshold: 2.5,
    }),
  /integer of at least two/u,
);

assert.throws(
  () =>
    inspectAutoMovieEvidenceReviewAlarms({ documents: [], frameThreshold: 1 }),
  /integer of at least two/u,
);
