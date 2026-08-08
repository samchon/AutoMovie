import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";
import { preserveProductionEffectFixtureCleanup } from "./test_mcp_production_effect";

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

const countTryStatements = (node: ts.Node): number => {
  let count = 0;
  const visit = (cursor: ts.Node): void => {
    if (ts.isTryStatement(cursor)) ++count;
    ts.forEachChild(cursor, visit);
  };
  ts.forEachChild(node, visit);
  return count;
};

const productionEffectFixtureContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_effect.ts",
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
    (entry) => entry.name === "test_mcp_production_effect",
  );
  const lifecycles: Array<{
    acquisition: string;
    bodyStatements: number;
    catchBodies: string[];
    catchVariables: string[];
    failureHolder: string;
    finallyBodies: string[];
    index: number;
    nestedTryStatements: number;
    ownerParameters: string[];
    tryDigest: string;
    tryStatements: number;
  }> = [];
  for (const owner of owners) {
    const body = owner.arrow.body;
    if (ts.isBlock(body) === false) continue;
    for (const [index, lifecycle] of [...body.statements].entries()) {
      if (
        ts.isTryStatement(lifecycle) === false ||
        lifecycle.catchClause === undefined ||
        lifecycle.finallyBlock
          ?.getText(source)
          .includes("preserveProductionEffectFixtureCleanup") !== true
      )
        continue;
      lifecycles.push({
        acquisition: compact(body.statements[0]!, source),
        bodyStatements: body.statements.length,
        catchBodies: lifecycle.catchClause.block.statements.map((statement) =>
          compact(statement, source),
        ),
        catchVariables:
          lifecycle.catchClause.variableDeclaration === undefined
            ? []
            : [compact(lifecycle.catchClause.variableDeclaration, source)],
        failureHolder: compact(body.statements[index - 1]!, source),
        finallyBodies: lifecycle.finallyBlock.statements.map((statement) =>
          compact(statement, source),
        ),
        index,
        nestedTryStatements: countTryStatements(lifecycle.tryBlock),
        ownerParameters: owner.arrow.parameters.map((parameter) =>
          compact(parameter, source),
        ),
        tryDigest: digestText(lifecycle.tryBlock.getText(source)),
        tryStatements: lifecycle.tryBlock.statements.length,
      });
    }
  }
  const policies = arrows.filter(
    (entry) => entry.name === "preserveProductionEffectFixtureCleanup",
  );
  return {
    owner: { count: owners.length, lifecycles },
    parseDiagnostics: (
      source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics.map((diagnostic) => String(diagnostic.messageText)),
    policy: {
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "ProductionEffectFixtureCleanupError"
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
      preserveProductionEffectFixtureCleanup(primaryState, (): void => {
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

export const test_mcp_production_effect_fixture_cleanup = (): void => {
  const primaryFailure = { phase: "production-effect assertion" };
  const cleanupFailure = { phase: "production-effect fixture disposal" };
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
    "production-effect cleanup preserves exact failure identity and order",
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
    "production-effect test owns its complete fixture lifecycle",
    productionEffectFixtureContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_production_effect.ts"),
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
            catchBodies: ["productionEffectFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            failureHolder:
              "letproductionEffectFailure:IProductionEffectFixtureFailure|undefined;",
            finallyBodies: [
              "preserveProductionEffectFixtureCleanup(productionEffectFailure,()=>fixture.dispose(),);",
            ],
            index: 2,
            nestedTryStatements: 0,
            ownerParameters: [],
            tryDigest:
              "6d5a764afa5d4fdd41a5848786d1391fd3e696bc9fc0c606c5528302fbe567a5",
            tryStatements: 52,
          },
        ],
      },
      parseDiagnostics: [],
      policy: {
        bodies: [
          '{try{cleanup();}catch(cleanupFailure){if(failure===undefined)throwcleanupFailure;thrownewProductionEffectFixtureCleanupError([failure.error,cleanupFailure],"Production-effectfixtureteardownfailedafterthetestfailed.",);}}',
        ],
        classes: ["AggregateError"],
        parameters: [
          [
            "failure:IProductionEffectFixtureFailure|undefined",
            "cleanup:()=>unknown",
          ],
        ],
      },
    },
  );
};
