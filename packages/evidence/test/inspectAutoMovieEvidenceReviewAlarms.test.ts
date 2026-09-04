import assert from "node:assert/strict";

import { inspectAutoMovieEvidenceReviewAlarms } from "../src/inspectAutoMovieEvidenceReviewAlarms";

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

assert.throws(
  () =>
    inspectAutoMovieEvidenceReviewAlarms({ documents: [], frameThreshold: 1 }),
  /integer of at least two/u,
);
