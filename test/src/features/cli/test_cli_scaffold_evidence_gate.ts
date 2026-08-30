import assert from "node:assert/strict";

import {
  scaffoldEvidenceTestContract as contract,
  runScaffoldEvidenceGate,
} from "../../integrity/scaffoldEvidence";

const result = (
  output: string,
  status: number = 0,
): {
  output: string;
  status: number;
} => ({
  output,
  status,
});

const testClassifiersAndGuards = (): void => {
  assert.equal(contract.packageOf("@scope/package/subpath"), "@scope/package");
  assert.equal(contract.packageOf("package/subpath"), "package");
  assert.equal(
    contract.axisOf({
      code: "TS9000",
      message: "[evidence/graph] rejected",
      text: "evidence diagnostic",
    }),
    "evidence",
  );
  assert.equal(
    contract.axisOf({
      code: "TS9000",
      message: "[typescript/no-floating-promises] rejected",
      text: "correctness diagnostic",
    }),
    "correctness",
  );
  assert.equal(
    contract.axisOf({
      code: "TS2307",
      message: "Cannot find module 'mp4box' or its type declarations.",
      text: "declared package diagnostic",
    }),
    "uninstalled",
  );
  assert.equal(
    contract.axisOf({
      code: "TS2307",
      message: "Cannot find module 'undeclared-package'.",
      text: "undeclared package diagnostic",
    }),
    "correctness",
  );
  assert.equal(
    contract.axisOf({
      code: "TS2322",
      message: "A plain compiler diagnostic.",
      text: "compiler diagnostic",
    }),
    "correctness",
  );
  assert.deepEqual(
    contract.parse("tool notice\nwarning TS1000: parsed warning"),
    [
      {
        code: "TS1000",
        message: "parsed warning",
        text: "warning TS1000: parsed warning",
      },
    ],
  );

  assert.throws(() => contract.inherit("scripts/*.ts"), /teach the probe/u);
  contract.assertBuiltPackages([]);
  assert.throws(
    () => contract.assertBuiltPackages(["@automovie/missing"]),
    /carry no built/u,
  );

  assert.throws(
    () =>
      contract.processResult({
        signal: "SIGTERM",
        status: null,
        stderr: null,
        stdout: null,
      }),
    /did not return an exit status/u,
  );
  assert.throws(
    () =>
      contract.processResult({
        error: new Error("spawn failed"),
        signal: null,
        status: null,
      }),
    /spawn failed/u,
  );

  assert.throws(
    () => contract.activeSettingsConfig("kind missing"),
    /selector/u,
  );
  assert.throws(
    () => contract.activeSettingsConfig("  kind: null,"),
    /selector/u,
  );
  const unit = {
    anchor: "unit",
    body: "A complete unit body.",
    obligations: ["obligation#owned"],
    title: "Complete unit",
  };
  assert.throws(
    () => contract.paidPrincipleReason("principles/test.md#unknown", unit),
    /No paid-probe reason/u,
  );
  contract.assertOwnedObligations(["obligation#owned"], [unit]);
  assert.throws(
    () => contract.assertOwnedObligations(["obligation#missing"], [unit]),
    /No paid-probe H2/u,
  );
  assert.throws(
    () =>
      contract.obligationUnderpayment(
        "obligation#missing",
        [unit],
        "settings.md",
      ),
    /lost its obligation#missing owner/u,
  );
};

const testOutcomeRefusals = (): void => {
  const synchronized = result("Synchronized 3 generated instruction path(s).");
  contract.assertInstructionSync({
    result: synchronized,
    installedPackageDocs: false,
    localContractUnchanged: true,
  });
  for (const invalid of [
    {
      result: result("sync failed", 1),
      installedPackageDocs: false,
      localContractUnchanged: true,
    },
    {
      result: result("sync output missing"),
      installedPackageDocs: false,
      localContractUnchanged: true,
    },
    {
      result: synchronized,
      installedPackageDocs: true,
      localContractUnchanged: true,
    },
    {
      result: synchronized,
      installedPackageDocs: false,
      localContractUnchanged: false,
    },
  ])
    assert.throws(
      () => contract.assertInstructionSync(invalid),
      /did not preserve its local contract inventory/u,
    );

  const planted = [
    {
      axis: "evidence" as const,
      file: "test/canary.ts",
      path: "test/canary.ts",
      rule: "evidence/graph",
      source: "evidence canary",
    },
    {
      axis: "correctness" as const,
      file: "viewer/src/canary.ts",
      path: "viewer/src/canary.ts",
      rule: "typescript/switch-exhaustiveness-check",
      source: "correctness canary",
    },
  ];
  const canaryOutput = [
    "test/canary.ts error TS9001: [evidence/graph] evidence canary",
    "viewer/src/canary.ts error TS9002: [typescript/switch-exhaustiveness-check] correctness canary",
  ].join("\n");
  assert.throws(
    () => contract.validateInitialCompile(result("tool notice"), planted),
    /instrument is not running/u,
  );
  assert.throws(
    () =>
      contract.validateInitialCompile(
        result(`${canaryOutput}\nsrc/owed.ts error TS2322: owed diagnostic`),
        planted,
      ),
    /scaffold owes the diagnostics/u,
  );

  assert.throws(
    () => contract.assertGraphConsumer(result("graph failed", 1)),
    /FAIL:/u,
  );
  contract.assertGraphConsumer(result(""));

  assert.throws(
    () =>
      contract.assertPaidCompile(
        result("error TS9001: [evidence/graph] paid graph rejected"),
      ),
    /completely paid/u,
  );
  const underpayment = {
    file: "settings.md",
    line: "paid line",
    target: "obligations/test.md#target",
  };
  contract.assertPaidSourceLine(underpayment, "before paid line after");
  assert.throws(
    () => contract.assertPaidSourceLine(underpayment, "line missing"),
    /no longer has exactly one/u,
  );
  assert.throws(
    () => contract.assertUnderpayment(underpayment, result("")),
    /did not produce an isolated/u,
  );
  assert.throws(
    () =>
      contract.assertUnderpayment(
        underpayment,
        result("error TS9001: [evidence/graph] wrong target"),
      ),
    /did not produce an isolated/u,
  );
  assert.throws(
    () =>
      contract.assertUnderpayment(
        underpayment,
        result(
          "error TS9001: [evidence/graph] obligations/test.md#target\nerror TS2322: correctness leak",
        ),
      ),
    /did not produce an isolated/u,
  );

  assert.deepEqual(
    contract.processResult({
      signal: null,
      status: 0,
      stderr: null,
      stdout: null,
    }),
    { output: "", status: 0 },
  );

  assert.equal(contract.replaceOnce("a b a", "b", "c"), "a c a");
  assert.throws(
    () => contract.replaceOnce("a a", "a", "b"),
    /update the refusal probes/u,
  );
  assert.throws(
    () => contract.replaceOnce("a", "missing", "b"),
    /update the refusal probes/u,
  );

  assert.equal(contract.resolveLink("a/b/c.md", "./d.md"), "a/b/d.md");
  assert.equal(contract.resolveLink("a/b/c.md", "../../e/f.md"), "e/f.md");
  assert.equal(contract.resolveLink("a/b/c.md", "d//e.md"), "a/b/d/e.md");

  assert.deepEqual(
    [
      ...contract.markdownAnchors(
        "## A Title {#explicit}\n\n### Plain Heading\n",
      ),
    ],
    ["explicit", "a-title", "plain-heading"],
  );

  contract.assertRetiredSurfacesAbsent([
    ".claudette/keep.md",
    "lint.config.ts",
  ]);
  for (const [key, fragment] of [
    [".claude", /provider-specific control plane/u],
    [".claude/settings.json", /provider-specific control plane/u],
    ["lint.config.mjs", /second graph declaration/u],
    ["scripts/productionEvidence.json", /second graph declaration/u],
    [".cache/ttsc/entry.json", /tool cache/u],
    ["scripts/compile.js", /compiler output/u],
    ["scripts/compile.d.ts", /compiler output/u],
  ] as const)
    assert.throws(
      () => contract.assertRetiredSurfacesAbsent([key]),
      fragment,
      key,
    );

  contract.assertInventoryIgnoresArtifacts(["a.md"], ["a.md"]);
  assert.throws(
    () => contract.assertInventoryIgnoresArtifacts(["a.md"], ["a.md", "b.js"]),
    /shipped: b\.js/u,
  );
  assert.throws(
    () => contract.assertInventoryIgnoresArtifacts(["a.md", "b.md"], ["a.md"]),
    /lost: b\.md/u,
  );

  assert.equal(
    contract.assertResolvableLinks({
      "docs/a.md":
        "[external](https://example.invalid) [self](#top) [file](../b.md) [anchored](../b.md#unit) [asset](../c.json#fragment)\n",
      "b.md": "## Unit {#unit}\n",
      "c.json": "{}\n",
      "d.txt": "[ignored](nowhere.md)\n",
    }),
    3,
  );
  assert.throws(
    () => contract.assertResolvableLinks({ "a.md": "[gone](missing.md)\n" }),
    /no missing\.md is shipped/u,
  );
  assert.throws(
    () =>
      contract.assertResolvableLinks({
        "a.md": "[gone](b.md#absent)\n",
        "b.md": "## Unit {#unit}\n",
      }),
    /no such anchor in b\.md/u,
  );

  const emptyLinkPopulations: Readonly<Record<string, string>>[] = [
    {},
    { "a.txt": "[x](y.md)\n" },
    { "a.md": "[x](#top)\n" },
  ];
  for (const emptyLinkPopulation of emptyLinkPopulations)
    assert.throws(
      () => contract.assertResolvableLinks(emptyLinkPopulation),
      /selected no link at all/u,
    );

  const syncedInstructions = {
    claude: "@AGENTS.md\n",
    divergent: [] as readonly string[],
    router: [
      "evidence-graph",
      "production-lifecycle",
      "review-verification",
      "source-authoring",
    ]
      .map((skill) => `[x](.agents/skills/${skill}/SKILL.md)`)
      .join("\n"),
  };
  contract.assertSynchronizedInstructions(syncedInstructions);
  assert.throws(
    () =>
      contract.assertSynchronizedInstructions({
        ...syncedInstructions,
        claude: "@AGENTS.md\nplus a local fork\n",
      }),
    /cannot reach its own authoring/u,
  );
  assert.throws(
    () =>
      contract.assertSynchronizedInstructions({
        ...syncedInstructions,
        router: syncedInstructions.router.replace(
          ".agents/skills/source-authoring/SKILL.md",
          "",
        ),
      }),
    /source-authoring is not routed/u,
  );
  assert.throws(
    () =>
      contract.assertSynchronizedInstructions({
        ...syncedInstructions,
        divergent: ["review-verification/review.md"],
      }),
    /review-verification\/review\.md differs/u,
  );

  const refusal = {
    edits: [] as readonly (readonly [string, string])[],
    expect: "settings cannot enter evidence without a Markdown host.",
    name: "an active settings layer with no Markdown host",
  };
  contract.assertConfigRefusal(refusal, result(`error: ${refusal.expect}`, 2));
  assert.throws(
    () => contract.assertConfigRefusal(refusal, result(refusal.expect, 0)),
    /was not refused with its own diagnostic/u,
  );
  assert.throws(
    () =>
      contract.assertConfigRefusal(refusal, result("some other failure", 2)),
    /was not refused with its own diagnostic/u,
  );
};

/**
 * A generated project compiles its complete inherited scaffold, executes its
 * local evidence graph, synchronizes provider-neutral instructions, rejects
 * isolated underpayment, and restores to the blank consumer without residue.
 */
export const test_cli_scaffold_evidence_gate = (): void => {
  testClassifiersAndGuards();
  testOutcomeRefusals();
  runScaffoldEvidenceGate();
};
