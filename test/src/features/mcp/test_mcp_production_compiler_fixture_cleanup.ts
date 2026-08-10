import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";
import { preserveProductionCompilerFixtureCleanup } from "./test_mcp_production_compiler";

const compact = (node: ts.Node, source: ts.SourceFile): string =>
  node.getText(source).replace(/\s+/g, "");

const digestText = (text: string): string =>
  createHash("sha256").update(text).digest("hex");

const aggregateContainsExactly = (
  error: unknown,
  expected: readonly unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

/**
 * What one lifecycle promises, and nothing about what it happens to contain.
 *
 * The guarded body is deliberately absent. A digest of it would move whenever
 * any case inside the owner is edited, which says nothing about whether a
 * fixture is torn down and everything about whether the file was touched -- and
 * a pin that fails for reasons unrelated to its claim is one a reader learns to
 * re-derive without looking.
 */
const lifecycleContract = (
  lifecycle: ts.TryStatement,
  source: ts.SourceFile,
): {
  catchBodies: string[];
  catchVariables: string[];
  finallyBodies: string[];
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
});

/** Every call in the owner that takes out a fixture somebody has to give back. */
const acquisitionSites = (owner: ts.Node, source: ts.SourceFile): string[] => {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = compact(node.expression, source);
      if (callee === "productionFixture" || callee === "fs.mkdtempSync")
        found.push(callee);
    }
    node.forEachChild(visit);
  };
  owner.forEachChild(visit);
  return found;
};

/**
 * Every fixture lifecycle in one statement list, found by what makes one.
 *
 * A lifecycle is a `try` whose `finally` hands teardown to the preserving
 * helper; the two statements before it are the failure holder it writes into
 * and the acquisition it guards. Finding them this way rather than by statement
 * index is what keeps this guard measuring. An index moves whenever a case is
 * added above it, and an index that no longer lands on a `try` made the whole
 * list empty -- which compared equal to an empty expectation and pinned
 * nothing. A moved lifecycle is still found here, and a deleted one shortens a
 * list that is pinned non-empty.
 */
const lifecycleSites = (
  statements: readonly ts.Statement[],
  source: ts.SourceFile,
): { index: number; statement: ts.TryStatement }[] =>
  statements.flatMap((statement, index) =>
    ts.isTryStatement(statement) &&
    (statement.finallyBlock?.statements ?? []).some((inner) =>
      compact(inner, source).startsWith(
        "preserveProductionCompilerFixtureCleanup(",
      ),
    )
      ? [{ index, statement }]
      : [],
  );

const productionCompilerFixtureContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_compiler.ts",
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
    (entry) => entry.name === "test_mcp_production_compiler",
  );
  const lifecycles = owners.flatMap((owner) => {
    const body = owner.arrow.body;
    if (ts.isBlock(body) === false) return [];
    const outerSites = lifecycleSites(body.statements, source);
    if (outerSites.length !== 1) return [];
    const outer = outerSites[0]!;
    const statements = outer.statement.tryBlock.statements;
    const nested = lifecycleSites(statements, source);
    return [
      {
        acquisition: compact(body.statements[outer.index - 1]!, source),
        failureHolder: compact(body.statements[outer.index - 2]!, source),
        kind: "main",
        ownerParameters: owner.arrow.parameters.map((parameter) =>
          compact(parameter, source),
        ),
        ...lifecycleContract(outer.statement, source),
      },
      ...nested.map((site) => ({
        acquisition: compact(statements[site.index - 1]!, source),
        failureHolder: compact(statements[site.index - 2]!, source),
        kind: "nested",
        ownerParameters: [],
        ...lifecycleContract(site.statement, source),
      })),
    ];
  });
  const policies = arrows.filter(
    (entry) => entry.name === "preserveProductionCompilerFixtureCleanup",
  );
  return {
    owner: {
      // Every fixture the owner takes out, against every lifecycle that gives
      // one back. A fourth acquisition added without a lifecycle around it
      // lengthens one list and not the other, which is the failure this guard
      // exists for and the one a body digest could never name.
      acquisitions: owners.flatMap((owner) =>
        acquisitionSites(owner.arrow, source),
      ),
      count: owners.length,
      lifecycles,
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
        statement.name?.text === "ProductionCompilerFixtureCleanupError"
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
      preserveProductionCompilerFixtureCleanup(primaryState, (): void => {
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

export const test_mcp_production_compiler_fixture_cleanup = (): void => {
  const primaryFailure = { phase: "production-compiler assertion" };
  const cleanupFailure = { phase: "production-compiler fixture removal" };
  const nestedCleanupFailure = new AggregateError(
    [{ phase: "nested compiler fixture cleanup" }],
    "Nested compiler cleanup failed.",
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
    primaryFailure: { error: nestedCleanupFailure, present: true },
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
    "production-compiler cleanup preserves nested and outer failures",
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
            nestedCleanupFailure,
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
    "production-compiler test owns all three fixture lifecycles",
    productionCompilerFixtureContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_production_compiler.ts"),
        "utf8",
      ),
    ),
    {
      owner: {
        acquisitions: [
          "productionFixture",
          "productionFixture",
          "fs.mkdtempSync",
        ],
        count: 1,
        lifecycles: [
          {
            acquisition: "constfixture=productionFixture();",
            catchBodies: ["productionCompilerFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            failureHolder:
              "letproductionCompilerFailure:IProductionCompilerFixtureFailure|undefined;",
            finallyBodies: [
              "preserveProductionCompilerFixtureCleanup(productionCompilerFailure,()=>fixture.dispose(),);",
            ],
            kind: "main",
            ownerParameters: [],
          },
          {
            acquisition: "constunmanifestedFixture=productionFixture();",
            catchBodies: ["unmanifestedFixtureFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            failureHolder:
              "letunmanifestedFixtureFailure:|IProductionCompilerFixtureFailure|undefined;",
            finallyBodies: [
              "preserveProductionCompilerFixtureCleanup(unmanifestedFixtureFailure,()=>unmanifestedFixture.dispose(),);",
            ],
            kind: "nested",
            ownerParameters: [],
          },
          {
            acquisition:
              'constnoDesignRoot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-production-empty-"),);',
            catchBodies: ["noDesignFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            failureHolder:
              "letnoDesignFailure:IProductionCompilerFixtureFailure|undefined;",
            finallyBodies: [
              "preserveProductionCompilerFixtureCleanup(noDesignFailure,()=>fs.rmSync(noDesignRoot,{force:true,recursive:true}),);",
            ],
            kind: "nested",
            ownerParameters: [],
          },
        ],
      },
      parseDiagnostics: [],
      policy: {
        bodies: [
          '{try{cleanup();}catch(cleanupFailure){if(failure===undefined)throwcleanupFailure;thrownewProductionCompilerFixtureCleanupError([failure.error,cleanupFailure],"Production-compilerfixtureteardownfailedafterthetestfailed.",);}}',
        ],
        bodyDigests: [
          "80d593808f53cbef7efac9a49669a8b6d8b70ff3dc1ea5544c4134a1746131d6",
        ],
        classes: ["AggregateError"],
        parameters: [
          [
            "failure:IProductionCompilerFixtureFailure|undefined",
            "cleanup:()=>unknown",
          ],
        ],
      },
    },
  );
};
