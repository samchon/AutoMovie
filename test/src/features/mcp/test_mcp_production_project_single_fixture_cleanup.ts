import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";
import { preserveSingleProductionProjectFixtureCleanup } from "./test_mcp_production_project";

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

const productionProjectSingleFixtureContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_project.ts",
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
    (entry) => entry.name === "test_mcp_production_project",
  );
  const lifecycles: Array<{
    acquisition: string;
    catchBodies: string[];
    catchVariables: string[];
    containerKind: string;
    containerStatements: number;
    failureHolder: string;
    finallyBodies: string[];
    index: number;
    substantive: { digest: string; tokens: number };
    tryDigest: string;
    tryStatements: number;
  }> = [];
  for (const owner of owners) {
    const visit = (node: ts.Node): void => {
      if (
        ts.isTryStatement(node) &&
        node.catchClause !== undefined &&
        node.finallyBlock
          ?.getText(source)
          .includes("preserveSingleProductionProjectFixtureCleanup") === true &&
        ts.isBlock(node.parent)
      ) {
        const statements = [...node.parent.statements];
        const index = statements.indexOf(node);
        if (
          compact(statements[index - 1]!, source).endsWith(
            "=productionFixture();",
          ) === false
        ) {
          ts.forEachChild(node, visit);
          return;
        }
        lifecycles.push({
          acquisition: compact(statements[index - 1]!, source),
          catchBodies: node.catchClause.block.statements.map((statement) =>
            compact(statement, source),
          ),
          catchVariables:
            node.catchClause.variableDeclaration === undefined
              ? []
              : [compact(node.catchClause.variableDeclaration, source)],
          containerKind: ts.SyntaxKind[node.parent.parent.kind]!,
          containerStatements: statements.length,
          failureHolder: compact(statements[index - 2]!, source),
          finallyBodies: node.finallyBlock.statements.map((statement) =>
            compact(statement, source),
          ),
          index,
          substantive: leafTokenContract(node.tryBlock.statements, source),
          tryDigest: digestText(node.tryBlock.getText(source)),
          tryStatements: node.tryBlock.statements.length,
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(owner.arrow.body);
  }
  const policies = arrows.filter(
    (entry) => entry.name === "preserveSingleProductionProjectFixtureCleanup",
  );
  return {
    owner: {
      count: owners.length,
      lifecycles,
      statementCounts: owners.flatMap((owner) =>
        ts.isBlock(owner.arrow.body)
          ? [owner.arrow.body.statements.length]
          : [],
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
        statement.name?.text === "SingleProductionProjectFixtureCleanupError"
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
      preserveSingleProductionProjectFixtureCleanup(primaryState, (): void => {
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

export const test_mcp_production_project_single_fixture_cleanup = (): void => {
  const primaryFailure = { phase: "single production-project assertion" };
  const cleanupFailure = { phase: "single production-project disposal" };
  const nestedPrimaryFailure = new AggregateError(
    [{ phase: "nested production-project cleanup" }],
    "Nested production-project cleanup failed.",
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
    "single production-project cleanup preserves failure identity and order",
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
      [
        "combinedAttempts",
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
          ]) &&
          combined.attempts === 1,
      ],
      [
        "nestedCombinedCaught",
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
          ]) &&
          combined.attempts === 1 &&
          nestedCombined.caught,
      ],
      [
        "aggregateContainsExactlyNestedCombinedFailure",
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
          ]) &&
          combined.attempts === 1 &&
          nestedCombined.caught &&
          aggregateContainsExactly(nestedCombined.failure, [
            nestedPrimaryFailure,
            cleanupFailure,
          ]),
      ],
      [
        "nestedCombinedAttempts",
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
          ]) &&
          combined.attempts === 1 &&
          nestedCombined.caught &&
          aggregateContainsExactly(nestedCombined.failure, [
            nestedPrimaryFailure,
            cleanupFailure,
          ]) &&
          nestedCombined.attempts === 1,
      ],
      [
        "undefinedPrimaryCaught",
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
          ]) &&
          combined.attempts === 1 &&
          nestedCombined.caught &&
          aggregateContainsExactly(nestedCombined.failure, [
            nestedPrimaryFailure,
            cleanupFailure,
          ]) &&
          nestedCombined.attempts === 1 &&
          undefinedPrimary.caught,
      ],
      [
        "undefinedPrimaryFailure",
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
          ]) &&
          combined.attempts === 1 &&
          nestedCombined.caught &&
          aggregateContainsExactly(nestedCombined.failure, [
            nestedPrimaryFailure,
            cleanupFailure,
          ]) &&
          nestedCombined.attempts === 1 &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined,
      ],
      [
        "undefinedPrimaryAttempts",
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
          undefinedPrimary.attempts === 1,
      ],
      [
        "undefinedStandaloneCaught",
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
          undefinedStandalone.caught,
      ],
      [
        "undefinedStandaloneFailure",
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
          undefinedStandalone.failure === undefined,
      ],
      [
        "undefinedStandaloneAttempts",
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
          undefinedStandalone.attempts === 1,
      ],
      [
        "undefinedCombinedCaught",
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
          undefinedCombined.caught,
      ],
      [
        "aggregateContainsExactlyUndefinedCombinedFailure",
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
          ]),
      ],
      [
        "undefinedCombinedAttempts",
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
      ],
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
    "production-project test owns nine single fixture lifecycles",
    productionProjectSingleFixtureContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_production_project.ts"),
        "utf8",
      ),
    ),
    {
      owner: {
        count: 1,
        lifecycles: [
          {
            acquisition: "constfixture=productionFixture();",
            catchBodies: ["productionProjectFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "ArrowFunction",
            containerStatements: 23,
            failureHolder:
              "letproductionProjectFailure:|ISingleProductionProjectFixtureFailure|undefined;",
            finallyBodies: [
              "preserveSingleProductionProjectFixtureCleanup(productionProjectFailure,()=>fixture.dispose(),);",
            ],
            index: 3,
            substantive: {
              digest:
                "13c63e6d75ef92f41135544faa6fa11d727408cb006e873383ec1ba75a496951",
              tokens: 14493,
            },
            tryDigest:
              "5fe9eb32d42e912a39bd6f758fc89e91db62014d39ab111589290a43a2b8f71c",
            tryStatements: 296,
          },
          {
            acquisition: "constdependencyCycleFixture=productionFixture();",
            catchBodies: ["dependencyCycleFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "TryStatement",
            containerStatements: 296,
            failureHolder:
              "letdependencyCycleFailure:|ISingleProductionProjectFixtureFailure|undefined;",
            finallyBodies: [
              "preserveSingleProductionProjectFixtureCleanup(dependencyCycleFailure,()=>dependencyCycleFixture.dispose(),);",
            ],
            index: 93,
            substantive: {
              digest:
                "480b4ec15a2f992254ff2a7a19527407577ca8a724762e193462f46bc83eac3a",
              tokens: 199,
            },
            tryDigest:
              "20a498f0a002abdc78b05eac55f7ec8bc8ea09a2923e86795182750db273bf94",
            tryStatements: 6,
          },
          {
            acquisition: "constcontentFixture=productionFixture();",
            catchBodies: ["contentFixtureFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "ArrowFunction",
            containerStatements: 23,
            failureHolder:
              "letcontentFixtureFailure:ISingleProductionProjectFixtureFailure|undefined;",
            finallyBodies: [
              "preserveSingleProductionProjectFixtureCleanup(contentFixtureFailure,()=>contentFixture.dispose(),);",
            ],
            index: 6,
            substantive: {
              digest:
                "0bc133ff458d73e7343d0858053048ecf278d48d799bd13057d91517dc097101",
              tokens: 1475,
            },
            tryDigest:
              "a96eca1531c7c98e20b001f6213a0da453796ae682086882c7e2862e3c827fa2",
            tryStatements: 20,
          },
          {
            acquisition: "constassetManifestFixture=productionFixture();",
            catchBodies: [
              "assetManifestFixtureFailure={error};",
              "throwerror;",
            ],
            catchVariables: ["error"],
            containerKind: "ForOfStatement",
            containerStatements: 3,
            failureHolder:
              "letassetManifestFixtureFailure:|ISingleProductionProjectFixtureFailure|undefined;",
            finallyBodies: [
              "preserveSingleProductionProjectFixtureCleanup(assetManifestFixtureFailure,()=>assetManifestFixture.dispose(),);",
            ],
            index: 2,
            substantive: {
              digest:
                "9c1ffabe6ab403328fed4062115a4fc673e23777d349da0a8620b6e02d4c1647",
              tokens: 68,
            },
            tryDigest:
              "4d9e355c8f6d97a8ef874536d406a18c088966b890f9e89ec94762617f8f2cb2",
            tryStatements: 4,
          },
          {
            acquisition: "constinvalidContent=productionFixture();",
            catchBodies: ["invalidContentFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "ForOfStatement",
            containerStatements: 3,
            failureHolder:
              "letinvalidContentFailure:|ISingleProductionProjectFixtureFailure|undefined;",
            finallyBodies: [
              "preserveSingleProductionProjectFixtureCleanup(invalidContentFailure,()=>invalidContent.dispose(),);",
            ],
            index: 2,
            substantive: {
              digest:
                "107aa2a83fcca4025cfbcc14447f6378287968080493e26c3710d7a281c8a579",
              tokens: 91,
            },
            tryDigest:
              "cebf1116fecb779434381b86eb1f66e7b393f162bac93706d0bd0e7898b934fc",
            tryStatements: 5,
          },
          {
            acquisition: "constreplacedOwner=productionFixture();",
            catchBodies: ["replacedOwnerFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "ArrowFunction",
            containerStatements: 23,
            failureHolder:
              "letreplacedOwnerFailure:ISingleProductionProjectFixtureFailure|undefined;",
            finallyBodies: [
              "preserveSingleProductionProjectFixtureCleanup(replacedOwnerFailure,()=>replacedOwner.dispose(),);",
            ],
            index: 19,
            substantive: {
              digest:
                "b4a5fd95daf201fbf28d04699b5e3541fa616ffc8012565bea0d986d88473445",
              tokens: 95,
            },
            tryDigest:
              "3c832b6d1321c10bb407b62fe172368c9fa7b3d151a4a3cde5ad7c1f3e81f0cb",
            tryStatements: 5,
          },
          {
            acquisition: "constinternalAlias=productionFixture();",
            catchBodies: ["internalAliasFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "TryStatement",
            containerStatements: 240,
            failureHolder:
              "letinternalAliasFailure:|ISingleProductionProjectFixtureFailure|undefined;",
            finallyBodies: [
              "preserveSingleProductionProjectFixtureCleanup(internalAliasFailure,()=>internalAlias.dispose(),);",
            ],
            index: 223,
            substantive: {
              digest:
                "8ac7e322bb9c8e1d50a51f06739da0337772cca992d6bdfff5ee950ebcfbf1da",
              tokens: 80,
            },
            tryDigest:
              "ba4576df71a0eab639b3d95fc120aa45cef07678bad7f052f3f424c98f2ca422",
            tryStatements: 3,
          },
          {
            acquisition: "constmalformedDesign=productionFixture();",
            catchBodies: ["malformedDesignFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "TryStatement",
            containerStatements: 240,
            failureHolder:
              "letmalformedDesignFailure:|ISingleProductionProjectFixtureFailure|undefined;",
            finallyBodies: [
              "preserveSingleProductionProjectFixtureCleanup(malformedDesignFailure,()=>malformedDesign.dispose(),);",
            ],
            index: 236,
            substantive: {
              digest:
                "53acaa5ffa6c86ed6b53ba0ef0314a1649ab490d01b0f693877ec9d50c3a1f42",
              tokens: 119,
            },
            tryDigest:
              "15c343540dde913e403372f52cfcfbf130f5e689a8a30d41b42659f002684c1a",
            tryStatements: 5,
          },
          {
            acquisition: "constinvalidRevision=productionFixture();",
            catchBodies: ["invalidRevisionFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "TryStatement",
            containerStatements: 240,
            failureHolder:
              "letinvalidRevisionFailure:|ISingleProductionProjectFixtureFailure|undefined;",
            finallyBodies: [
              "preserveSingleProductionProjectFixtureCleanup(invalidRevisionFailure,()=>invalidRevision.dispose(),);",
            ],
            index: 239,
            substantive: {
              digest:
                "99a96969a91cfad1e46a15fefca532351084eeef9188b2f1dd26e6c0a06f5b38",
              tokens: 42,
            },
            tryDigest:
              "c91f671427d5c825288276a240bc9d8a077710e6fc6458bf73d866ccfcf32b33",
            tryStatements: 2,
          },
        ],
        statementCounts: [23],
      },
      parseDiagnostics: [],
      policy: {
        bodies: [
          '{try{cleanup();}catch(cleanupFailure){if(failure===undefined)throwcleanupFailure;thrownewSingleProductionProjectFixtureCleanupError([failure.error,cleanupFailure],"Singleproduction-projectfixtureteardownfailedafterthetestfailed.",);}}',
        ],
        bodyDigests: [
          "50f699809ee4b552d1bbed533178aa9940cf2b0f5dbdbef0cdba880d3d14da32",
        ],
        classes: ["AggregateError"],
        parameters: [
          [
            "failure:ISingleProductionProjectFixtureFailure|undefined",
            "cleanup:()=>void",
          ],
        ],
      },
    },
  );
};
