import assert from "node:assert/strict";
import fs from "node:fs";

import lint from "../lint.config";

const rule = lint.rules["evidence/graph"];
assert.ok(Array.isArray(rule), "the scaffold must enable its evidence graph");
const graph = rule[1];
assert.equal(
  graph.claims.length,
  40,
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

const agents = fs.readFileSync(
  new URL("../AGENTS.md", import.meta.url),
  "utf8",
);
for (const required of [
  "production-specific contract pass",
  "layer authorship pass",
  "evidence repair",
  "review verification",
  "authorized stage transition",
  "author who performed it rereads the complete affected process alone",
  "collect findings through the whole read",
  "repair them together at their earliest owners",
  "restart after any edit",
  "One complete no-edit round",
  "does not replace evidence gates",
  "final two-clean-round whole-production review",
])
  assert.ok(
    agents.includes(required),
    `the generated AGENTS.md lost its author process Self-Review instruction: ${required}`,
  );

process.stdout.write("blank scaffold graph passed\n");
