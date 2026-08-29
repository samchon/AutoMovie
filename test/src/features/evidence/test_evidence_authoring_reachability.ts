import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  AuthoringReachabilityError,
  collectRequirementFamilies,
  inspectAuthoringReachability,
} from "../../integrity/authoringReachability";

const REPOSITORY_ROOT = path.resolve(__dirname, "../../../..");
const roots: string[] = [];

interface IMutableLedger {
  contractInventory: Record<string, number>;
  acceptedDebt: {
    unpaidAuthoringFamilies: number;
    unpaidSpecificationFragments: number;
    unpaidSpecificationTargets: string[];
  };
  repositoryReviewPolicy: {
    evidenceReview: string;
    reason: string;
    substitutes: unknown;
    reconsiderWhen: string;
  };
  families: Record<string, unknown>[];
}

const mutableLedger = (ledger: unknown): IMutableLedger =>
  structuredClone(ledger) as IMutableLedger;

const write = (root: string, relative: string, text: string): void => {
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
    "packages/template/scaffold/docs/discovery/core/common.md",
    "# Discovery\n\n## Search {#search}\n",
  );
  write(
    root,
    "packages/template/scaffold/docs/principles/core/common.md",
    "# Principles\n\n## Principle {#principle}\n",
  );
  write(
    root,
    "packages/template/scaffold/docs/obligations/core/common.md",
    "# Obligations\n\n## Obligation {#obligation}\n",
  );
  write(
    root,
    "packages/example/src/example.ts",
    '/**\n * Example.\n * @evidence requirements/alpha/contract.md#alpha-unit Implements alpha.\n * @evidenceReview requirements/alpha/contract.md#alpha-unit #fingerprint Inspects the implemented relationship.\n * @evidenceExclude requirements/alpha/contract.md#other Leaves the other concern upstream.\n * @evidenceExclude requirements/alpha/contract.md#another Leaves another concern with a different owner.\n * @evidencePart specifications/alpha/contract.md#alpha-spec::paid-fragment Implements the fragment.\n */\nexport const example = 1;\nexport const diagnostic = "@evidence requirements/alpha/contract.md#alpha-unit This string is not a carrier.";\n',
  );
  write(
    root,
    "packages/example/native/lint.config.ts",
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
    "test/src/integrity/contractOwnership.ts",
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
        "test/src/integrity/contractOwnership.ts",
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
          "packages/template/scaffold/docs/principles/core/common.md#principle",
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

const testCompleteFamilyLedger = (): void => {
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
};

const testAccumulatedDrift = (): void => {
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
    "packages/template/scaffold/docs/principles/decoy.md",
    "# Decoy\n\nA prose mention {#missing} is not an anchored heading.\n",
  );
  write(
    root,
    "packages/example/src/orphan.ts",
    "/** @evidencePart specifications/alpha/contract.md#alpha-spec::orphan */\nexport const orphan = 1;\n",
  );
  const invalid = mutableLedger(ledger);
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
    correspondences: [
      "packages/template/scaffold/docs/principles/core/common.md#missing",
    ],
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
};

const testUnsupportedLedgerShapes = (): void => {
  const { root, ledger } = fixture();
  assert.throws(
    () => inspectAuthoringReachability(root, { version: 2, families: "alpha" }),
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /ledger version must be 1/u);
      assert.match(error.message, /ledger families must be an array/u);
      return true;
    },
  );

  const invalid = mutableLedger(ledger);
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
      assert.ok(error instanceof Error);
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
};

const testMissingRootsAndFragments = (): void => {
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
};

const testTypedEntryPoint = (): void => {
  const { root } = fixture();
  const report = inspectAuthoringReachability(root);
  assert.equal(report.requirementFamilies, 1);
  assert.equal(report.requirementUnits, 1);
  assert.equal(report.specificationFragments.unpaid, 0);
  assert.equal(report.specificationFragments.declared, 1);
  assert.equal(report.repositoryEvidence.evidence, 2);

  write(root, "docs/authoring-reachability/families.json", "not json\n");
  assert.throws(
    () => inspectAuthoringReachability(root),
    /cannot read authoring reachability ledger/u,
  );

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
  assert.throws(() => inspectAuthoringReachability(unexpected), /ENOENT/u);
};

/**
 * The repository's authoring reachability ledger classifies every requirement,
 * resolves every declared owner, and fixes every accepted debt population.
 */
export const test_evidence_authoring_reachability = (): void => {
  try {
    testCompleteFamilyLedger();
    testAccumulatedDrift();
    testUnsupportedLedgerShapes();
    testMissingRootsAndFragments();
    testTypedEntryPoint();

    const report = inspectAuthoringReachability(REPOSITORY_ROOT);
    assert.ok(report.requirementFamilies > 0);
    assert.ok(report.requirementUnits > 0);
    assert.ok(report.specificationFragments.declared > 0);
  } finally {
    for (const root of roots.splice(0))
      fs.rmSync(root, { force: true, recursive: true });
  }
};
