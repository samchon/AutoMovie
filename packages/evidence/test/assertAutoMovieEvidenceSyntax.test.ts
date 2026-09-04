import assert from "node:assert/strict";

import { assertAutoMovieEvidenceSyntax } from "../src/assertAutoMovieEvidenceSyntax";

const markdown = (body: string) => ({
  path: "docs/models/example.md",
  source: `# Model\n\n## Owner {#owner}\n\n<!--\n${body}\n-->\n`,
});

/**
 * Evidence grammar preflight rejects only native deterministic contradictions.
 *
 * Scenarios:
 *
 * 1. One exact acknowledgement/review pair passes.
 * 2. Duplicate, contradictory, orphan, malformed-fingerprint, and
 *    non-normalized-target rows fail with their stable diagnostic codes.
 * 3. Tag-shaped text outside a native carrier is ignored.
 */
assert.doesNotThrow(() =>
  assertAutoMovieEvidenceSyntax([
    markdown(
      [
        "@evidence contracts/local.md#rule The host implements the rule.",
        "@evidenceReview contracts/local.md#rule #abcdef0 Comparison found the exact owner.",
      ].join("\n"),
    ),
    {
      path: "src/inert.ts",
      source:
        "const sample = `@evidence contracts/local.md#rule not a carrier`;\n",
    },
  ]),
);

const failures: Array<[string, string]> = [
  [
    [
      "@evidence contracts/local.md#rule First answer.",
      "@evidence contracts/local.md#rule Second answer.",
    ].join("\n"),
    "evidence-duplicate",
  ],
  [
    [
      "@evidence contracts/local.md#rule Positive answer.",
      "@evidenceExclude contracts/local.md#rule Negative answer.",
    ].join("\n"),
    "evidence-contradiction",
  ],
  [
    "@evidenceReview contracts/local.md#rule #abcdef0 Orphan review.",
    "evidence-review-orphan",
  ],
  [
    "@evidenceReview contracts/local.md#rule #abcdef0 #1234567 Two fingerprints.",
    "evidence-fingerprint-extra",
  ],
  ["@evidence contracts\\local.md#rule Wrong path.", "evidence-target"],
  ["@evidence C:local.md#rule Drive path.", "evidence-target"],
  ["@evidence contracts/local.md#bad--anchor Bad anchor.", "evidence-target"],
  [
    "@evidenceReview contracts/local.md#rule no-hash malformed",
    "evidence-syntax",
  ],
];
for (const [body, code] of failures)
  assert.throws(
    () => assertAutoMovieEvidenceSyntax([markdown(body)]),
    new RegExp(code, "u"),
  );

assert.throws(
  () =>
    assertAutoMovieEvidenceSyntax([
      {
        path: "src/owner.ts",
        source:
          "/** @evidenceReview contracts/local.md#rule #abcdef0 Orphan. */\nexport const owner = true;\n",
      },
    ]),
  /evidence-review-orphan/u,
);

process.stdout.write("evidence syntax preflight passed\n");
