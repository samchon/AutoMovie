import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

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
  TestValidator.predicate(
    "production-namespace cleanup preserves failure identity and order",
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
      ]) &&
      combined.attempts === 1 &&
      nestedCombined.caught &&
      aggregateContainsExactly(nestedCombined.failure, [
        nestedPrimaryFailure,
        cleanupFailure,
      ]) &&
      nestedCombined.attempts === 1 &&
      undefinedPrimary.caught &&
      undefinedPrimary.failure === undefined &&
      undefinedPrimary.attempts === 1 &&
      undefinedStandalone.caught &&
      undefinedStandalone.failure === undefined &&
      undefinedStandalone.attempts === 1 &&
      undefinedCombined.caught &&
      aggregateContainsExactly(undefinedCombined.failure, [
        undefined,
        undefined,
      ]) &&
      undefinedCombined.attempts === 1,
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
            "1db2e207c524a3d8b9b81a2cf2e497bb3d05cfea9ec3cc34d60abd66d0056fa1",
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
                "be769c150dbe5843336c8127be9b128c6cd58812a1132551aedaa25a32b86d11",
              tokens: 1656,
            },
            tryDigest:
              "0eb8604e44deacb59f5be83018d1bb00b7eaa80c63991fbd227e782f44259a74",
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
                "88f7bf4c443f95ffb8d6b9b1d3b4733595cf357a9c34c6bcca0af6d37cc05bcc",
              tokens: 109,
            },
            tryDigest:
              "db570d13f81577396fa26e791dbed2a7903b25e7b762b5e49681fa5c18c97f4a",
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
                "dbae573d7e14c9fd988979415238d0d5e666f6558812315acfd76d77440e93bb",
              tokens: 143,
            },
            tryDigest:
              "8bff9334b855b988cf3a8725370bf710e97f3600417059faca1fe98b787b40e1",
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
                "80e98a96d781eafbe242f4dd2967888ddde474002525e95ab9d55c4adb87ac8f",
              tokens: 217,
            },
            tryDigest:
              "133d2c2dd3c06a5ef042765a43fe59c67f8d50ec533fc713ed509d7be898f3b7",
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
