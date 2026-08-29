import assert from "node:assert/strict";
import fs from "node:fs";

import lint from "../lint.config";

const rule = lint.rules["evidence/graph"];
assert.ok(Array.isArray(rule), "the scaffold must enable its evidence graph");
const graph = rule[1];
if (typeof graph === "string")
  throw new Error(
    "The scaffold evidence rule must carry one inline graph configuration.",
  );
assert.equal(
  graph.claims.length,
  54,
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
assert.equal(
  JSON.stringify(graph).includes("node_modules/@automovie/template"),
  false,
  "the generated graph must resolve contracts only from project-local docs",
);
for (const skill of [
  "evidence-graph",
  "production-lifecycle",
  "review-verification",
  "source-authoring",
])
  assert.equal(
    fs.existsSync(
      new URL(`../.agents/skills/${skill}/SKILL.md`, import.meta.url),
    ),
    true,
    `the generated project must ship the ${skill} trigger entry point`,
  );
for (const forbidden of [
  "../.claude/settings.json",
  "../.agents/skills/production/SKILL.md",
  "../lint.config.mjs",
  "../productionEvidence.mjs",
  "../productionEvidence.ts",
])
  assert.equal(
    fs.existsSync(new URL(forbidden, import.meta.url)),
    false,
    `the generated project must not ship ${forbidden}`,
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
