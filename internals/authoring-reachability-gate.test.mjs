import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";

import {
  AuthoringReachabilityError,
  collectRequirementFamilies,
  inspectAuthoringReachability,
  parseRoot,
} from "./authoring-reachability-gate.mjs";

const SCRIPT = path.resolve(
  import.meta.dirname,
  "authoring-reachability-gate.mjs",
);
const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true });
});

const write = (root, relative, text) => {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
};

const fixture = () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-reachability-"),
  );
  roots.push(root);
  write(
    root,
    "docs/requirements/alpha/contract.md",
    "# Alpha\n\n### Unit {#alpha-unit}\n\nObservable promise.\n",
  );
  write(
    root,
    "docs/specifications/alpha/contract.md",
    "# Alpha spec\n\n### Unit {#alpha-spec}\n\n<!-- @evidence requirements/alpha/contract.md#alpha-unit Refines the alpha requirement. -->\n<!-- @evidenceReview requirements/alpha/contract.md#alpha-unit #spec-fingerprint Inspects the refinement. -->\n<!-- @evidenceExclude requirements/alpha/contract.md#other Leaves another target outside this specification. -->\n<!-- @evidenceExcludeReview requirements/alpha/contract.md#other #exclude-fingerprint Inspects the exclusion. -->\n\nLiteral @evidence requirements/alpha/contract.md#alpha-unit in prose is not a carrier.\n\n<!-- @evidenceObligation paid-fragment Paid fragment. -->\n",
  );
  write(
    root,
    "packages/template/docs/discovery/common.md",
    "# Discovery\n\n## Search {#search}\n",
  );
  write(
    root,
    "packages/template/docs/principles/common.md",
    "# Principles\n\n## Principle {#principle}\n",
  );
  write(
    root,
    "packages/template/docs/obligations/common.md",
    "# Obligations\n\n## Obligation {#obligation}\n",
  );
  write(
    root,
    "packages/example/src/example.ts",
    '/**\n * Example.\n * @evidence requirements/alpha/contract.md#alpha-unit Implements alpha.\n * @evidenceReview requirements/alpha/contract.md#alpha-unit #fingerprint Inspects the implemented relationship.\n * @evidenceExclude requirements/alpha/contract.md#other Leaves the other concern upstream.\n * @evidenceExclude requirements/alpha/contract.md#another Leaves another concern with a different owner.\n * @evidencePart specifications/alpha/contract.md#alpha-spec::paid-fragment Implements the fragment.\n */\nexport const example = 1;\nexport const diagnostic = "@evidence requirements/alpha/contract.md#alpha-unit This string is not a carrier.";\n',
  );
  write(
    root,
    "packages/example/lint.config.ts",
    'export default { rules: { "evidence/graph": "error" } };\n',
  );
  write(root, "packages/README.md", "# Packages\n");
  write(
    root,
    "docs/requirements/alpha/.cache/ignored.md",
    "### Ignored {#ignored-unit}\n",
  );
  for (const relative of [
    ".agents/skills/review/SKILL.md",
    ".agents/skills/development/SKILL.md",
    ".agents/skills/evidence-graph/SKILL.md",
    "internals/contract-ownership.mjs",
  ])
    write(root, relative, "control\n");
  const ledger = {
    version: 1,
    contractInventory: { discovery: 1, principles: 1, obligations: 1 },
    acceptedDebt: {
      unpaidAuthoringFamilies: 0,
      unpaidSpecificationFragments: 0,
      unpaidSpecificationTargets: [],
    },
    repositoryReviewPolicy: {
      evidenceReview: "disabled",
      reason:
        "Per-edge companion prose would repeat the relationship instead of inspecting its meaning.",
      substitutes: [
        ".agents/skills/review/SKILL.md",
        ".agents/skills/development/SKILL.md",
        ".agents/skills/evidence-graph/SKILL.md",
        "internals/contract-ownership.mjs",
      ],
      reconsiderWhen:
        "Reconsider when changed semantic relationships can be selected without copied acknowledgements.",
    },
    families: [
      {
        family: "alpha",
        requirementUnits: 1,
        classification: "authoring-contract",
        correspondences: [
          "packages/template/docs/principles/common.md#principle",
        ],
        reason:
          "The shared principle gives every alpha unit a concrete authoring owner.",
      },
    ],
  };
  write(
    root,
    "docs/authoring-reachability/families.json",
    `${JSON.stringify(ledger, null, 2)}\n`,
  );
  return { root, ledger };
};

test("a complete family ledger reports every measured population", () => {
  const { root } = fixture();
  assert.deepEqual([...collectRequirementFamilies(root)], [["alpha", 1]]);
  const report = inspectAuthoringReachability(root);
  assert.equal(report.requirementFamilies, 1);
  assert.equal(report.requirementUnits, 1);
  assert.deepEqual(report.contractInventory, {
    discovery: 1,
    principles: 1,
    obligations: 1,
  });
  assert.equal(report.classifications["authoring-contract"], 1);
  assert.equal(report.classifications["unpaid-authoring-edge"], 0);
  assert.equal(report.unpaidAuthoringUnits, 0);
  assert.deepEqual(report.specificationFragments, {
    declared: 1,
    paid: 1,
    unpaid: 0,
    unpaidTargets: [],
  });
  assert.deepEqual(report.sourceEvidence, {
    evidence: 1,
    exclusions: 2,
    reviews: 1,
    uniqueExclusionReasons: 2,
    topExclusionReasonCount: 1,
    topTwentyExclusionCount: 2,
  });
  assert.deepEqual(report.repositoryEvidence, {
    evidence: 2,
    exclusions: 3,
    reviews: 3,
  });
  assert.deepEqual(report.evidenceReviewConfigs, []);

  const unpaidLedger = structuredClone(
    JSON.parse(
      fs.readFileSync(
        path.join(root, "docs/authoring-reachability/families.json"),
        "utf8",
      ),
    ),
  );
  unpaidLedger.families[0].classification = "unpaid-authoring-edge";
  unpaidLedger.families[0].issue = 123;
  unpaidLedger.acceptedDebt.unpaidAuthoringFamilies = 1;
  assert.equal(
    inspectAuthoringReachability(root, unpaidLedger).unpaidAuthoringUnits,
    1,
  );

  write(
    root,
    "packages/example/src/example.ts",
    "/**\n * Example.\n * @evidence requirements/alpha/contract.md#alpha-unit Implements alpha.\n * @evidencePart specifications/alpha/contract.md#alpha-spec::paid-fragment Implements the fragment.\n */\nexport const example = 1;\n",
  );
  assert.deepEqual(inspectAuthoringReachability(root).sourceEvidence, {
    evidence: 1,
    exclusions: 0,
    reviews: 0,
    uniqueExclusionReasons: 0,
    topExclusionReasonCount: 0,
    topTwentyExclusionCount: 0,
  });
  assert.deepEqual(inspectAuthoringReachability(root).repositoryEvidence, {
    evidence: 2,
    exclusions: 1,
    reviews: 2,
  });
});

test("the gate accumulates classification, path, debt, and review-policy drift", () => {
  const { root, ledger } = fixture();
  write(
    root,
    "docs/requirements/beta/contract.md",
    "# Beta\n\n### Unit {#beta-unit}\n",
  );
  write(
    root,
    "packages/example/lint.config.ts",
    "export default { rules: { 'evidence/review': 'error' } };\n",
  );
  write(
    root,
    "packages/template/docs/principles/decoy.md",
    "# Decoy\n\nA prose mention {#missing} is not an anchored heading.\n",
  );
  write(
    root,
    "packages/example/src/orphan.ts",
    "/** @evidencePart specifications/alpha/contract.md#alpha-spec::orphan */\nexport const orphan = 1;\n",
  );
  const invalid = structuredClone(ledger);
  invalid.contractInventory.discovery = 2;
  invalid.acceptedDebt.unpaidSpecificationFragments = 1;
  invalid.acceptedDebt.unpaidSpecificationTargets = [
    "alpha/contract.md#alpha-spec::ghost-fragment",
  ];
  invalid.repositoryReviewPolicy.reason = "TBD";
  invalid.repositoryReviewPolicy.reconsiderWhen = "none";
  invalid.families[0] = {
    family: "alpha",
    requirementUnits: 2,
    classification: "intentional-exclusion",
    correspondences: ["packages/template/docs/principles/common.md#missing"],
    reason: "none",
  };
  assert.throws(
    () => inspectAuthoringReachability(root, invalid),
    (error) => {
      assert.ok(error instanceof AuthoringReachabilityError);
      const message = error.message;
      assert.match(message, /records 2 H3 units; actual is 1/u);
      assert.match(message, /needs a concrete reason/u);
      assert.match(message, /has no matching anchor/u);
      assert.match(message, /needs a resumption condition/u);
      assert.match(message, /requirement family 'beta' is missing/u);
      assert.match(
        message,
        /contract inventory 'discovery' records 2; actual is 1/u,
      );
      assert.match(message, /source evidence part has no declaration/u);
      assert.match(message, /accepted unpaid specification targets/u);
      assert.match(message, /review policy needs a concrete reason/u);
      assert.match(message, /review policy needs a reconsideration condition/u);
      assert.match(message, /configs enable it/u);
      return true;
    },
  );
});

test("the ledger schema refuses every unsupported family and reference shape", () => {
  const { root, ledger } = fixture();
  assert.throws(
    () => inspectAuthoringReachability(root, { version: 2, families: "alpha" }),
    (error) => {
      assert.match(error.message, /ledger version must be 1/u);
      assert.match(error.message, /ledger families must be an array/u);
      return true;
    },
  );

  const invalid = structuredClone(ledger);
  invalid.acceptedDebt.unpaidAuthoringFamilies = 7;
  invalid.repositoryReviewPolicy = {
    evidenceReview: "enabled",
    reason: "A deliberately unsupported repository review policy for testing.",
    substitutes: "review",
    reconsiderWhen:
      "This sentence is long enough to isolate the unsupported policy value.",
  };
  invalid.families = [
    {
      family: "beta",
      requirementUnits: 0,
      classification: "unsupported",
      correspondences: [
        null,
        ".",
        "missing.md",
        "docs/requirements/alpha/contract.md#BAD",
      ],
      workflow: "not-an-array",
      reason: "A ghost family exercises a missing requirement directory.",
    },
    {
      family: "alpha",
      requirementUnits: 1,
      classification: "authoring-contract",
      reason:
        "An authoring classification without a correspondence is invalid.",
    },
    {
      family: "alpha",
      requirementUnits: 1,
      classification: "unpaid-authoring-edge",
      issue: 0,
      reason: "An unpaid classification must name a positive issue number.",
    },
    {
      family: "alpha-owner",
      requirementUnits: 1,
      classification: "not-author-driven",
      owner: "host",
      reason: "A host-owned classification requires concrete owner evidence.",
    },
    {
      family: "alpha-owner-evidence",
      requirementUnits: 1,
      classification: "not-author-driven",
      owner: "A concrete host system owns this behavior outside authoring.",
      reason: "A host-owned classification requires an owner evidence array.",
    },
    {
      family: "alpha-owner-empty",
      requirementUnits: 1,
      classification: "not-author-driven",
      owner: "A concrete host system owns this behavior outside authoring.",
      ownerEvidence: [],
      reason: "A host-owned classification requires non-empty owner evidence.",
    },
    {
      family: "",
      requirementUnits: 0,
      classification: "intentional-exclusion",
      reason: "A blank family identity is never a valid ledger entry.",
    },
  ];
  assert.throws(
    () => inspectAuthoringReachability(root, invalid),
    (error) => {
      const message = error.message;
      assert.match(message, /has no requirement directory/u);
      assert.match(message, /invalid classification/u);
      assert.match(message, /must be a non-empty repository path/u);
      assert.match(message, /escapes the repository/u);
      assert.match(message, /does not exist/u);
      assert.match(message, /has an invalid anchor/u);
      assert.match(message, /must be an array/u);
      assert.match(message, /families must be sorted/u);
      assert.match(message, /duplicate family/u);
      assert.match(message, /has no authoring correspondence/u);
      assert.match(message, /needs its owning issue/u);
      assert.match(message, /needs an owner and owner evidence/u);
      assert.match(message, /family must be a non-empty string/u);
      assert.match(message, /accepted unpaid authoring families/u);
      assert.match(message, /must be 'disabled'/u);
      assert.match(message, /needs substitute controls/u);
      return true;
    },
  );
});

test("missing roots and unanchored fragment declarations fail explicitly", () => {
  const empty = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-reachability-"),
  );
  roots.push(empty);
  assert.throws(
    () => collectRequirementFamilies(empty),
    /missing requirement root/u,
  );

  const { root, ledger } = fixture();
  write(
    root,
    "docs/specifications/broken.md",
    "<!-- @evidenceObligation floating No heading owns this. -->\n",
  );
  assert.throws(
    () => inspectAuthoringReachability(root, ledger),
    /has no anchored owner/u,
  );
});

test("the command emits human and JSON reports and refuses malformed arguments", () => {
  const { root } = fixture();
  assert.equal(parseRoot([]), path.resolve(import.meta.dirname, ".."));
  const human = spawnSync(process.execPath, [SCRIPT, "--root", root], {
    encoding: "utf8",
  });
  assert.equal(human.status, 0, human.stderr);
  assert.match(human.stdout, /1 families \/ 1 H3 units/u);
  assert.match(human.stdout, /unpaid specification fragments: 0\/1/u);
  assert.match(human.stdout, /repository graph tags: 2 positive/u);

  const json = spawnSync(process.execPath, [SCRIPT, "--root", root, "--json"], {
    encoding: "utf8",
  });
  assert.equal(json.status, 0, json.stderr);
  assert.equal(JSON.parse(json.stdout).requirementFamilies, 1);

  const missingRoot = spawnSync(process.execPath, [SCRIPT, "--root"], {
    encoding: "utf8",
  });
  assert.equal(missingRoot.status, 1);
  assert.match(missingRoot.stderr, /--root requires a path/u);

  write(root, "docs/authoring-reachability/families.json", "not json\n");
  const malformed = spawnSync(process.execPath, [SCRIPT, "--root", root], {
    encoding: "utf8",
  });
  assert.equal(malformed.status, 1);
  assert.match(malformed.stderr, /cannot read authoring reachability ledger/u);

  const unexpected = fs.mkdtempSync(
    path.join(os.tmpdir(), "automovie-reachability-"),
  );
  roots.push(unexpected);
  write(
    unexpected,
    "docs/requirements/alpha/contract.md",
    "### Unit {#alpha-unit}\n",
  );
  write(
    unexpected,
    "docs/authoring-reachability/families.json",
    `${JSON.stringify({
      version: 1,
      contractInventory: { discovery: 0, principles: 0, obligations: 0 },
      acceptedDebt: {
        unpaidAuthoringFamilies: 0,
        unpaidSpecificationFragments: 0,
        unpaidSpecificationTargets: [],
      },
      repositoryReviewPolicy: {
        evidenceReview: "disabled",
        reason: "This fixture reaches an unexpected missing packages failure.",
        substitutes: ["docs/requirements/alpha/contract.md"],
        reconsiderWhen:
          "Reconsider when the fixture has a complete package directory.",
      },
      families: [
        {
          family: "alpha",
          requirementUnits: 1,
          classification: "authoring-contract",
          correspondences: ["docs/requirements/alpha/contract.md#alpha-unit"],
          reason: "The temporary unit provides a valid correspondence path.",
        },
      ],
    })}\n`,
  );
  const unexpectedFailure = spawnSync(
    process.execPath,
    [SCRIPT, "--root", unexpected],
    { encoding: "utf8" },
  );
  assert.equal(unexpectedFailure.status, 1);
  assert.match(unexpectedFailure.stderr, /ENOENT/u);
});
