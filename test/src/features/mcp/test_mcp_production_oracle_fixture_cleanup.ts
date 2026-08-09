import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";
import { preserveProductionOracleFixtureCleanup } from "./test_mcp_production_oracle";

const compact = (node: ts.Node, source: ts.SourceFile): string =>
  node.getText(source).replace(/\s+/g, "");

const digestText = (text: string): string =>
  createHash("sha256").update(text).digest("hex");

const leafTokenDigest = (
  nodes: readonly ts.Node[],
  source: ts.SourceFile,
): string => {
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
  return digestText(JSON.stringify(tokens));
};

const aggregateContainsExactly = (
  error: unknown,
  expected: readonly unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

const lifecycleContract = (
  lifecycle: ts.TryStatement,
  source: ts.SourceFile,
): {
  catchBodies: string[];
  catchVariables: string[];
  finallyBodies: string[];
  tryDigest: string;
  tryStatements: number;
} => ({
  catchBodies: (lifecycle.catchClause?.block.statements ?? []).map(
    (statement) => compact(statement, source),
  ),
  catchVariables:
    lifecycle.catchClause?.variableDeclaration === undefined
      ? []
      : [compact(lifecycle.catchClause.variableDeclaration, source)],
  finallyBodies: (lifecycle.finallyBlock?.statements ?? []).map((statement) =>
    compact(statement, source),
  ),
  tryDigest: digestText(lifecycle.tryBlock.getText(source)),
  tryStatements: lifecycle.tryBlock.statements.length,
});

const productionOracleFixtureContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_oracle.ts",
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
    (entry) => entry.name === "test_mcp_production_oracle",
  );
  const lifecycles = owners.flatMap((owner) => {
    const body = owner.arrow.body;
    if (ts.isBlock(body) === false) return [];
    const outer = body.statements[2];
    if (outer === undefined || ts.isTryStatement(outer) === false) return [];
    const statements = outer.tryBlock.statements;
    const empty = statements[280];
    if (empty === undefined || ts.isTryStatement(empty) === false) return [];
    const substantive = [
      ...statements.slice(0, 278),
      statements[279]!,
      ...empty.tryBlock.statements,
    ];
    return [
      {
        acquisition: compact(body.statements[1]!, source),
        bodyStatements: body.statements.length,
        failureHolder: compact(body.statements[0]!, source),
        index: 2,
        kind: "main",
        ownerParameters: owner.arrow.parameters.map((parameter) =>
          compact(parameter, source),
        ),
        substantiveStatements: substantive.length,
        substantiveTokenDigest: leafTokenDigest(substantive, source),
        ...lifecycleContract(outer, source),
      },
      {
        acquisition: compact(statements[279]!, source),
        bodyStatements: statements.length,
        failureHolder: compact(statements[278]!, source),
        index: 280,
        kind: "empty-production",
        ownerParameters: [],
        substantiveStatements: empty.tryBlock.statements.length,
        substantiveTokenDigest: leafTokenDigest(
          empty.tryBlock.statements,
          source,
        ),
        ...lifecycleContract(empty, source),
      },
    ];
  });
  const policies = arrows.filter(
    (entry) => entry.name === "preserveProductionOracleFixtureCleanup",
  );
  return {
    owner: { count: owners.length, lifecycles },
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
        statement.name?.text === "ProductionOracleFixtureCleanupError"
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
      preserveProductionOracleFixtureCleanup(primaryState, (): void => {
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

export const test_mcp_production_oracle_fixture_cleanup = (): void => {
  const primaryFailure = { phase: "production-oracle assertion" };
  const cleanupFailure = { phase: "production-oracle fixture removal" };
  const nestedPrimaryFailure = new AggregateError(
    [{ phase: "nested oracle assertion" }],
    "Nested oracle assertion failed.",
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
    "production-oracle cleanup preserves failure identity and order",
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
    "production-oracle test owns both fixture lifecycles",
    productionOracleFixtureContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_production_oracle.ts"),
        "utf8",
      ),
    ),
    {
      owner: {
        count: 1,
        lifecycles: [
          {
            acquisition: "constfixture=productionFixture();",
            bodyStatements: 3,
            failureHolder:
              "letproductionOracleFailure:IProductionOracleFixtureFailure|undefined;",
            index: 2,
            kind: "main",
            ownerParameters: [],
            substantiveStatements: 284,
            substantiveTokenDigest:
              "07f8e24b058371b8e4c1e7012e3556ffd0a187d90c3a19d6abdae41dbaa2b266",
            catchBodies: ["productionOracleFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            finallyBodies: [
              "preserveProductionOracleFixtureCleanup(productionOracleFailure,()=>fixture.dispose(),);",
            ],
            tryDigest:
              "12fd3896538920740faa2bae507dbb997e012a36e71d20adb1bbe5e2924412f8",
            tryStatements: 281,
          },
          {
            acquisition: "constemptyRoot=productionFixture();",
            bodyStatements: 281,
            failureHolder:
              "letemptyRootFailure:IProductionOracleFixtureFailure|undefined;",
            index: 280,
            kind: "empty-production",
            ownerParameters: [],
            substantiveStatements: 5,
            substantiveTokenDigest:
              "4913f8febce4a05d205c90efc41395c9f729c6c49277e5de39fae6c7f4cf1dcb",
            catchBodies: ["emptyRootFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            finallyBodies: [
              "preserveProductionOracleFixtureCleanup(emptyRootFailure,()=>emptyRoot.dispose(),);",
            ],
            tryDigest:
              "72d84807137f79643a74c4bdb22b3b2d78fc946ae50ab68a974c18593e3c1f8e",
            tryStatements: 5,
          },
        ],
      },
      parseDiagnostics: [],
      policy: {
        bodies: [
          '{try{cleanup();}catch(cleanupFailure){if(failure===undefined)throwcleanupFailure;thrownewProductionOracleFixtureCleanupError([failure.error,cleanupFailure],"Production-oraclefixtureteardownfailedafterthetestfailed.",);}}',
        ],
        bodyDigests: [
          "afa3d4e77103ad1c15557c0eeda50487f12c0197915513c2f70e2a65d8552277",
        ],
        classes: ["AggregateError"],
        parameters: [
          [
            "failure:IProductionOracleFixtureFailure|undefined",
            "cleanup:()=>void",
          ],
        ],
      },
    },
  );
};
