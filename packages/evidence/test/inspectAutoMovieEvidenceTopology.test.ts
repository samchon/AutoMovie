import assert from "node:assert/strict";

import { inspectAutoMovieEvidenceTopology } from "../src/inspectAutoMovieEvidenceTopology";

/**
 * Foundation topology accounts distinguish real edges from stale declarations.
 *
 * Scenarios:
 *
 * 1. Exact active edges and one truthful inactive edge produce no diagnostic.
 * 2. Missing, extra, duplicate, disabled, unknown, and reasonless rows are named.
 * 3. Coordinated cycles are admitted while an ordinary reversed edge is refused.
 */
const branches = [
  { name: "settings", active: true, order: 0 },
  { name: "maps", active: true, order: 1 },
  { name: "spaces", active: true, order: 2 },
  { name: "models", active: false, order: 2 },
];
const expected = [
  { provider: "settings", consumer: "maps" },
  { provider: "maps", consumer: "spaces" },
  { provider: "spaces", consumer: "models" },
];

assert.deepEqual(
  inspectAutoMovieEvidenceTopology({
    branches,
    expected,
    declarations: [
      {
        provider: "settings",
        consumer: "maps",
        status: "uses",
        reason: "Map decisions consume the selected world basis.",
      },
      {
        provider: "maps",
        consumer: "spaces",
        status: "uses",
        reason: "Spaces consume the map site boundary.",
      },
      {
        provider: "spaces",
        consumer: "models",
        status: "inapplicable",
        reason: "The model branch is disabled.",
      },
    ],
  }),
  [],
);
assert.equal(
  inspectAutoMovieEvidenceTopology({
    branches,
    expected,
    declarations: [
      {
        provider: "settings",
        consumer: "maps",
        status: "uses",
        reason: "Map decisions consume the selected world basis.",
      },
      {
        provider: "maps",
        consumer: "spaces",
        status: "uses",
        reason: "Spaces consume the map site boundary.",
      },
    ],
  }).find(
    (diagnostic) =>
      diagnostic.provider === "spaces" && diagnostic.consumer === "models",
  )?.code,
  "missing-consumer",
);

const diagnostics = inspectAutoMovieEvidenceTopology({
  branches: [
    ...branches.map((branch) =>
      branch.name === "spaces" ? { ...branch, order: 0 } : branch,
    ),
    { name: "materials", active: false, order: 3 },
  ],
  expected,
  declarations: [
    {
      provider: "settings",
      consumer: "maps",
      status: "uses",
      reason: "",
    },
    {
      provider: "settings",
      consumer: "maps",
      status: "uses",
      reason: "duplicate",
    },
    {
      provider: "materials",
      consumer: "maps",
      status: "uses",
      reason: "stale row",
    },
    {
      provider: "ghost",
      consumer: "spaces",
      status: "uses",
      reason: "unknown row",
    },
  ],
});
assert.deepEqual(
  new Set(diagnostics.map((diagnostic) => diagnostic.code)),
  new Set([
    "disabled-residue",
    "duplicate-declaration",
    "extra-provider",
    "invalid-reason",
    "missing-consumer",
    "unknown-branch",
  ]),
);

assert.deepEqual(
  inspectAutoMovieEvidenceTopology({
    branches: [
      { name: "motions", active: true, order: 1 },
      { name: "systems", active: true, order: 1 },
    ],
    expected: [
      { provider: "motions", consumer: "systems", simultaneous: true },
      { provider: "systems", consumer: "motions", simultaneous: true },
    ],
    declarations: [
      {
        provider: "motions",
        consumer: "systems",
        status: "uses",
        reason: "Systems sample authored motion.",
      },
      {
        provider: "systems",
        consumer: "motions",
        status: "uses",
        reason: "Motion consumes coupled state.",
      },
    ],
  }),
  [],
);
assert.equal(
  inspectAutoMovieEvidenceTopology({
    branches: [
      { name: "maps", active: true, order: 2 },
      { name: "spaces", active: true, order: 1 },
    ],
    expected: [{ provider: "maps", consumer: "spaces" }],
    declarations: [
      {
        provider: "maps",
        consumer: "spaces",
        status: "uses",
        reason: "Space consumes site.",
      },
    ],
  })[0]!.code,
  "wrong-order",
);
