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
