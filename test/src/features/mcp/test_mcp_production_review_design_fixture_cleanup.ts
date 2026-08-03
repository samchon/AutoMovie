import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveProductionReviewDesignFixtureCleanup } from "./test_mcp_production_review_design_edges";

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

const productionReviewDesignFixtureContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_review_design_edges.ts",
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
    (entry) => entry.name === "test_mcp_production_review_design_edges",
  );
  const lifecycles = owners.flatMap((owner) => {
    const body = owner.arrow.body;
    if (ts.isBlock(body) === false) return [];
    const lifecycle = body.statements[2];
    if (lifecycle === undefined || ts.isTryStatement(lifecycle) === false)
      return [];
    return [
      {
        acquisition: compact(body.statements[1]!, source),
        bodyStatements: body.statements.length,
        catchBodies: (lifecycle.catchClause?.block.statements ?? []).map(
          (statement) => compact(statement, source),
        ),
        catchVariables:
          lifecycle.catchClause?.variableDeclaration === undefined
            ? []
            : [compact(lifecycle.catchClause.variableDeclaration, source)],
        failureHolder: compact(body.statements[0]!, source),
        finallyBodies: (lifecycle.finallyBlock?.statements ?? []).map(
          (statement) => compact(statement, source),
        ),
        index: 2,
        ownerParameters: owner.arrow.parameters.map((parameter) =>
          compact(parameter, source),
        ),
        substantive: leafTokenContract(lifecycle.tryBlock.statements, source),
        tryDigest: digestText(lifecycle.tryBlock.getText(source)),
        tryStatements: lifecycle.tryBlock.statements.length,
      },
    ];
  });
  const policies = arrows.filter(
    (entry) => entry.name === "preserveProductionReviewDesignFixtureCleanup",
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
        statement.name?.text === "ProductionReviewDesignFixtureCleanupError"
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
      preserveProductionReviewDesignFixtureCleanup(primaryState, (): void => {
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

export const test_mcp_production_review_design_fixture_cleanup = (): void => {
  const primaryFailure = { phase: "production review-design assertion" };
  const cleanupFailure = { phase: "production review-design fixture removal" };
  const nestedPrimaryFailure = new AggregateError(
    [{ phase: "nested design review" }],
    "Nested design review failed.",
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
    "production review-design cleanup preserves failure identity and order",
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
    "production review-design test owns its complete fixture lifecycle",
    productionReviewDesignFixtureContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_production_review_design_edges.ts"),
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
            catchBodies: [
              "productionReviewDesignFailure={error};",
              "throwerror;",
            ],
            catchVariables: ["error"],
            failureHolder:
              "letproductionReviewDesignFailure:|IProductionReviewDesignFixtureFailure|undefined;",
            finallyBodies: [
              "preserveProductionReviewDesignFixtureCleanup(productionReviewDesignFailure,()=>fixture.dispose(),);",
            ],
            index: 2,
            ownerParameters: [],
            substantive: {
              digest:
                "ddef913627c4c1bd3cd9c4c8c81d2eaef5f8ca572c9396ec5e1569ec471b9cf7",
              tokens: 1999,
            },
            tryDigest:
              "8404beb0ba44776f6171b50fa9ee98b76696c3329a570fecaf7ded36f3e5c9a3",
            tryStatements: 74,
          },
        ],
      },
      parseDiagnostics: [],
      policy: {
        bodies: [
          '{try{cleanup();}catch(cleanupFailure){if(failure===undefined)throwcleanupFailure;thrownewProductionReviewDesignFixtureCleanupError([failure.error,cleanupFailure],"Productionreview-designfixtureteardownfailedafterthetestfailed.",);}}',
        ],
        bodyDigests: [
          "6c0e13fbb4d371fa342342ba0de635b08779f10ca841004c110e773dde142f7e",
        ],
        classes: ["AggregateError"],
        parameters: [
          [
            "failure:IProductionReviewDesignFixtureFailure|undefined",
            "cleanup:()=>void",
          ],
        ],
      },
    },
  );
};
