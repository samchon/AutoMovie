import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";
import { preserveProductionNamespaceFixtureCleanup } from "./test_mcp_production_namespaces";

const compact = (node: ts.Node, source: ts.SourceFile): string =>
  node.getText(source).replace(/\s+/g, "");

const digestText = (text: string): string =>
  createHash("sha256").update(text).digest("hex");

const leafTokenContract = (
  nodes: readonly ts.Node[],
  source: ts.SourceFile,
): { digest: string; tokens: number } => {
  const tokens: Array<[ts.SyntaxKind, string]> = [];
  const visit = (node: ts.Node): void => {
    const children = node.getChildren(source);
    if (children.length !== 0) children.forEach(visit);
    else {
      const text = node.getText(source);
      if (text.length !== 0) tokens.push([node.kind, text]);
    }
  };
  nodes.forEach(visit);
  return {
    digest: digestText(JSON.stringify(tokens)),
    tokens: tokens.length,
  };
};

const aggregateContainsExactly = (
  error: unknown,
  expected: readonly unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

const productionNamespaceFixtureContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_namespaces.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const arrows = source.statements.flatMap((statement) =>
    ts.isVariableStatement(statement)
      ? [...statement.declarationList.declarations].flatMap((declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.initializer !== undefined &&
          ts.isArrowFunction(declaration.initializer)
            ? [
                {
                  arrow: declaration.initializer,
                  name: declaration.name.text,
                },
              ]
            : [],
        )
      : [],
  );
  const owners = arrows.filter(
    (entry) => entry.name === "test_mcp_production_namespaces",
  );
  const indices = [2, 5, 8, 11, 14, 17, 20] as const;
  const kinds = [
    "unsafe-ids",
    "mismatched-legacy",
    "migration-isolation",
    "internal-alias",
    "incarnation",
    "prototype-incarnation",
    "replacement-alias",
  ] as const;
  const lifecycles = owners.flatMap((owner) => {
    const body = owner.arrow.body;
    if (ts.isBlock(body) === false) return [];
    return indices.map((index, offset) => {
      const lifecycle = body.statements[index];
      if (lifecycle === undefined || ts.isTryStatement(lifecycle) === false)
        return null;
      return {
        acquisition: compact(body.statements[index - 1]!, source),
        bodyStatements: body.statements.length,
        catchBodies: (lifecycle.catchClause?.block.statements ?? []).map(
          (statement) => compact(statement, source),
        ),
        catchVariables:
          lifecycle.catchClause?.variableDeclaration === undefined
            ? []
            : [compact(lifecycle.catchClause.variableDeclaration, source)],
        failureHolder: compact(body.statements[index - 2]!, source),
        finallyBodies: (lifecycle.finallyBlock?.statements ?? []).map(
          (statement) => compact(statement, source),
        ),
        index,
        kind: kinds[offset],
        substantive: leafTokenContract(lifecycle.tryBlock.statements, source),
        tryDigest: digestText(lifecycle.tryBlock.getText(source)),
        tryStatements: lifecycle.tryBlock.statements.length,
      };
    });
  });
  const ownerBodies = owners.flatMap((owner) =>
    ts.isBlock(owner.arrow.body) ? [owner.arrow.body] : [],
  );
  const policies = arrows.filter(
    (entry) => entry.name === "preserveProductionNamespaceFixtureCleanup",
  );
  return {
    audit: ownerBodies.map((body) => {
      const lifecycle = body.statements[24];
      return {
        bodyStatements: body.statements.length,
        index: 24,
        prefixes: [...body.statements]
          .slice(21, 24)
          .map((statement) => compact(statement, source)),
        tryDigest:
          lifecycle !== undefined && ts.isTryStatement(lifecycle)
            ? digestText(lifecycle.tryBlock.getText(source))
            : null,
      };
    }),
    owner: {
      count: owners.length,
      lifecycles,
      parameters: owners.map((entry) =>
        entry.arrow.parameters.map((parameter) => compact(parameter, source)),
      ),
    },
    parseDiagnostics: (
      source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics.map((diagnostic) => String(diagnostic.messageText)),
    policy: {
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      bodyDigests: policies.map((entry) =>
        digestText(entry.arrow.body.getText(source)),
      ),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "ProductionNamespaceFixtureCleanupError"
          ? (statement.heritageClauses ?? []).flatMap((clause) =>
              clause.types.map((type) => compact(type, source)),
            )
          : [],
      ),
      parameters: policies.map((entry) =>
        entry.arrow.parameters.map((parameter) => compact(parameter, source)),
      ),
    },
  };
};

const captureCleanup = (props: {
  cleanupFailure?: { error: unknown; present: true };
  primaryFailure?: { error: unknown; present: true };
}): { attempts: number; caught: boolean; failure: unknown } => {
  let attempts = 0;
  let caught = false;
  let failure: unknown;
  let primaryState: { error: unknown } | undefined;
  try {
    try {
      if (props.primaryFailure !== undefined) throw props.primaryFailure.error;
    } catch (error) {
      primaryState = { error };
      throw error;
    } finally {
      preserveProductionNamespaceFixtureCleanup(primaryState, (): void => {
        ++attempts;
        if (props.cleanupFailure !== undefined)
          throw props.cleanupFailure.error;
      });
    }
  } catch (error) {
    caught = true;
    failure = error;
  }
  return { attempts, caught, failure };
};

export const test_mcp_production_namespace_fixture_cleanup = (): void => {
  const primaryFailure = { phase: "production-namespace assertion" };
  const cleanupFailure = { phase: "production-namespace fixture removal" };
  const nestedPrimaryFailure = new AggregateError(
    [{ phase: "nested namespace restoration" }],
    "Nested namespace restoration failed.",
  );
  const success = captureCleanup({});
  const primaryOnly = captureCleanup({
    primaryFailure: { error: primaryFailure, present: true },
  });
  const standalone = captureCleanup({
    cleanupFailure: { error: cleanupFailure, present: true },
  });
  const combined = captureCleanup({
    cleanupFailure: { error: cleanupFailure, present: true },
    primaryFailure: { error: primaryFailure, present: true },
  });
  const nestedCombined = captureCleanup({
    cleanupFailure: { error: cleanupFailure, present: true },
    primaryFailure: { error: nestedPrimaryFailure, present: true },
  });
  const undefinedPrimary = captureCleanup({
    primaryFailure: { error: undefined, present: true },
  });
  const undefinedStandalone = captureCleanup({
    cleanupFailure: { error: undefined, present: true },
  });
  const undefinedCombined = captureCleanup({
    cleanupFailure: { error: undefined, present: true },
    primaryFailure: { error: undefined, present: true },
  });
  TestValidator.equals(
    "production-namespace cleanup preserves failure identity and order",
    namedFacts([
      ["successCaught", () => success.caught === false],
      [
        "successFailure",
        () => success.caught === false && success.failure === undefined,
      ],
      [
        "successAttempts",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.attempts === 1,
      ],
      [
        "primaryOnlyCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.attempts === 1 &&
          primaryOnly.caught,
      ],
      [
        "primaryOnlyFailurePrimaryFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.attempts === 1 &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure,
      ],
      [
        "primaryOnlyAttempts",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.attempts === 1 &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.attempts === 1,
      ],
      [
        "standaloneCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.attempts === 1 &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.attempts === 1 &&
          standalone.caught,
      ],
      [
        "standaloneFailureCleanupFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.attempts === 1 &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.attempts === 1 &&
          standalone.caught &&
          standalone.failure === cleanupFailure,
      ],
      [
        "standaloneAttempts",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.attempts === 1 &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.attempts === 1 &&
          standalone.caught &&
          standalone.failure === cleanupFailure &&
          standalone.attempts === 1,
      ],
      [
        "combinedCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.attempts === 1 &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.attempts === 1 &&
          standalone.caught &&
          standalone.failure === cleanupFailure &&
          standalone.attempts === 1 &&
          combined.caught,
      ],
      [
        "aggregateContainsExactlyCombinedFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.attempts === 1 &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.attempts === 1 &&
          standalone.caught &&
          standalone.failure === cleanupFailure &&
          standalone.attempts === 1 &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            cleanupFailure,
          ]),
      ],
      ["combinedAttempts", () => combined.attempts === 1],
      ["nestedCombinedCaught", () => nestedCombined.caught],
      [
        "aggregateContainsExactlyNestedCombinedFailure",
        () =>
          aggregateContainsExactly(nestedCombined.failure, [
            nestedPrimaryFailure,
            cleanupFailure,
          ]),
      ],
      ["nestedCombinedAttempts", () => nestedCombined.attempts === 1],
      ["undefinedPrimaryCaught", () => undefinedPrimary.caught],
      ["undefinedPrimaryFailure", () => undefinedPrimary.failure === undefined],
      ["undefinedPrimaryAttempts", () => undefinedPrimary.attempts === 1],
      ["undefinedStandaloneCaught", () => undefinedStandalone.caught],
      [
        "undefinedStandaloneFailure",
        () => undefinedStandalone.failure === undefined,
      ],
      ["undefinedStandaloneAttempts", () => undefinedStandalone.attempts === 1],
      ["undefinedCombinedCaught", () => undefinedCombined.caught],
      [
        "aggregateContainsExactlyUndefinedCombinedFailure",
        () =>
          aggregateContainsExactly(undefinedCombined.failure, [
            undefined,
            undefined,
          ]),
      ],
      ["undefinedCombinedAttempts", () => undefinedCombined.attempts === 1],
    ]),
    {
      successCaught: true,
      successFailure: true,
      successAttempts: true,
      primaryOnlyCaught: true,
      primaryOnlyFailurePrimaryFailure: true,
      primaryOnlyAttempts: true,
      standaloneCaught: true,
      standaloneFailureCleanupFailure: true,
      standaloneAttempts: true,
      combinedCaught: true,
      aggregateContainsExactlyCombinedFailure: true,
      combinedAttempts: true,
      nestedCombinedCaught: true,
      aggregateContainsExactlyNestedCombinedFailure: true,
      nestedCombinedAttempts: true,
      undefinedPrimaryCaught: true,
      undefinedPrimaryFailure: true,
      undefinedPrimaryAttempts: true,
      undefinedStandaloneCaught: true,
      undefinedStandaloneFailure: true,
      undefinedStandaloneAttempts: true,
      undefinedCombinedCaught: true,
      aggregateContainsExactlyUndefinedCombinedFailure: true,
      undefinedCombinedAttempts: true,
    },
  );
  TestValidator.equals(
    "production namespaces own seven single-fixture lifecycles",
    productionNamespaceFixtureContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_production_namespaces.ts"),
        "utf8",
      ),
    ),
    {
      audit: [
        {
          bodyStatements: 25,
          index: 24,
          prefixes: [
            "constauditFixture=productionFixture();",
            "letexternalAudit:string|undefined;",
            "letauditFailure:INamespaceAuditFixtureFailure|undefined;",
          ],
          tryDigest:
            "db961ec4e8dea64dafbc6ea35f2979fcb6310e92f27c284b294b1fb7abfa7f52",
        },
      ],
      owner: {
        count: 1,
        lifecycles: [
          {
            acquisition: "constunsafeIds=productionFixture();",
            bodyStatements: 25,
            catchBodies: ["unsafeIdsFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            failureHolder:
              "letunsafeIdsFailure:IProductionNamespaceFixtureFailure|undefined;",
            finallyBodies: [
              "preserveProductionNamespaceFixtureCleanup(unsafeIdsFailure,()=>unsafeIds.dispose(),);",
            ],
            index: 2,
            kind: "unsafe-ids",
            substantive: {
              digest:
                "b5ef88f441507c7171685867dcacf478f9deebf5f6840a02361e57cc518447b1",
              tokens: 43,
            },
            tryDigest:
              "12eb64ec08b74e72f55bc1458788e568e203172078ab349fe43982c7601c6360",
            tryStatements: 1,
          },
          {
            acquisition: "constmismatchedLegacy=productionFixture();",
            bodyStatements: 25,
            catchBodies: ["mismatchedLegacyFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            failureHolder:
              "letmismatchedLegacyFailure:IProductionNamespaceFixtureFailure|undefined;",
            finallyBodies: [
              "preserveProductionNamespaceFixtureCleanup(mismatchedLegacyFailure,()=>mismatchedLegacy.dispose(),);",
            ],
            index: 5,
            kind: "mismatched-legacy",
            substantive: {
              digest:
                "432ffd45de6b8c4e419e44165bbc82ce42e53907af1ed7742f31912f52020a30",
              tokens: 28,
            },
            tryDigest:
              "ed86c95d62498d7f20f6ab3e82a0c0603c0ee3f2d5753fafeb392e9d476727ea",
            tryStatements: 1,
          },
          {
            acquisition: "constfixture=productionFixture();",
            bodyStatements: 25,
            catchBodies: ["namespaceFixtureFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            failureHolder:
              "letnamespaceFixtureFailure:IProductionNamespaceFixtureFailure|undefined;",
            finallyBodies: [
              "preserveProductionNamespaceFixtureCleanup(namespaceFixtureFailure,()=>fixture.dispose(),);",
            ],
            index: 8,
            kind: "migration-isolation",
            substantive: {
              digest:
                "21d45a33b6a624e88e57139eec62761cda9ad53c1a527414f61b792ce5c2eac8",
              tokens: 1859,
            },
            tryDigest:
              "8b377364a91be7bd656f577d544ae72daf27886cdf9bd5d808bd90cac9720ede",
            tryStatements: 59,
          },
          {
            acquisition: "constaliasFixture=productionFixture();",
            bodyStatements: 25,
            catchBodies: ["aliasFixtureFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            failureHolder:
              "letaliasFixtureFailure:IProductionNamespaceFixtureFailure|undefined;",
            finallyBodies: [
              "preserveProductionNamespaceFixtureCleanup(aliasFixtureFailure,()=>aliasFixture.dispose(),);",
            ],
            index: 11,
            kind: "internal-alias",
            substantive: {
              digest:
                "20adc4772b2678749d5f67c54e5ecd430f9e4c502e87482c6e1e74efa5f83f95",
              tokens: 142,
            },
            tryDigest:
              "3ed9e66a4cd3d17b35a4a43d69325186c1d3dca74923752313150bed6a30722f",
            tryStatements: 5,
          },
          {
            acquisition: "constincarnationFixture=productionFixture();",
            bodyStatements: 25,
            catchBodies: ["incarnationFixtureFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            failureHolder:
              "letincarnationFixtureFailure:IProductionNamespaceFixtureFailure|undefined;",
            finallyBodies: [
              "preserveProductionNamespaceFixtureCleanup(incarnationFixtureFailure,()=>incarnationFixture.dispose(),);",
            ],
            index: 14,
            kind: "incarnation",
            substantive: {
              digest:
                "65c7211a1122135072c8d36aeb00e87bf8dfbf3346be6eb82559e1918d2a44cb",
              tokens: 316,
            },
            tryDigest:
              "f212f5f49f3350aa759888026be49b0820b94a8f9d8cb56a12e05278972e2c89",
            tryStatements: 7,
          },
          {
            acquisition: "constprotoFixture=productionFixture();",
            bodyStatements: 25,
            catchBodies: ["protoFixtureFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            failureHolder:
              "letprotoFixtureFailure:IProductionNamespaceFixtureFailure|undefined;",
            finallyBodies: [
              "preserveProductionNamespaceFixtureCleanup(protoFixtureFailure,()=>protoFixture.dispose(),);",
            ],
            index: 17,
            kind: "prototype-incarnation",
            substantive: {
              digest:
                "a6fc90a39285163933af2905c11ff3d49fee63429d6d34ccddd6c6308f16be8b",
              tokens: 188,
            },
            tryDigest:
              "bde691f0a3328220850e7f4445f81345fe48e15ae56c2a3b2c9722c8fe587866",
            tryStatements: 7,
          },
          {
            acquisition: "constreplacementFixture=productionFixture();",
            bodyStatements: 25,
            catchBodies: ["replacementFixtureFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            failureHolder:
              "letreplacementFixtureFailure:IProductionNamespaceFixtureFailure|undefined;",
            finallyBodies: [
              "preserveProductionNamespaceFixtureCleanup(replacementFixtureFailure,()=>replacementFixture.dispose(),);",
            ],
            index: 20,
            kind: "replacement-alias",
            substantive: {
              digest:
                "5ee77d8b5540759bdbe790a4c26c0c89d06f75c24aa992c19148a8ff8f969977",
              tokens: 249,
            },
            tryDigest:
              "9fb86e801ced8c9a8adf3b9e32fccb359e0f7bdeeb0af2e1a9bf7bcae6f1be46",
            tryStatements: 8,
          },
        ],
        parameters: [[]],
      },
      parseDiagnostics: [],
      policy: {
        bodies: [
          '{try{cleanup();}catch(cleanupFailure){if(failure===undefined)throwcleanupFailure;thrownewProductionNamespaceFixtureCleanupError([failure.error,cleanupFailure],"Production-namespacefixtureteardownfailedafterthetestfailed.",);}}',
        ],
        bodyDigests: [
          "fb2ea545755ab2b3a2a27962b95500f1da96e13207a4c682797d97d704436c5c",
        ],
        classes: ["AggregateError"],
        parameters: [
          [
            "failure:IProductionNamespaceFixtureFailure|undefined",
            "cleanup:()=>void",
          ],
        ],
      },
    },
  );
};
