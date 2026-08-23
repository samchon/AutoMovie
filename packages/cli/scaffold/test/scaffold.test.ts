import assert from "node:assert/strict";

import lint from "../lint.config";

const rule = lint.rules["evidence/graph"];
assert.ok(Array.isArray(rule), "the scaffold must enable its evidence graph");
const graph = rule[1];
assert.equal(
  graph.claims.length,
  50,
  "the blank scaffold must retain every prewired shared claim",
);
assert.equal(
  graph.claims.filter((claim) => claim.disabled !== true).length,
  1,
  "only the permanent instrument canary may be active before kind selection",
);
assert.equal(
  graph.claims.at(-1)?.name,
  "the reserved evidence-lint canary proves the generated graph is running",
  "the permanent instrument canary must remain the final shared claim",
);

process.stdout.write("blank scaffold graph passed\n");
