import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveProductionInstancesFixtureCleanup } from "./test_mcp_production_instances";

/**
 * Evaluate named facts in order and stop at the first false one, so a failed
 * comparison names the fact instead of collapsing into one boolean. Stopping
 * keeps the short-circuit semantics the original conjunction had, which some
 * facts depend on to guard the ones after them.
 */
const namedFacts = (
  entries: ReadonlyArray<readonly [string, () => boolean]>,
): Record<string, boolean> => {
  const output: Record<string, boolean> = {};
  for (const [name, evaluate] of entries) {
    output[name] = evaluate();
    if (output[name] === false) break;
  }
  return output;
};

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

const productionInstancesFixtureContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_instances.ts",
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
    (entry) => entry.name === "test_mcp_production_instances",
  );
  const lifecycles: Array<{
    acquisition: string;
    bodyStatements: number;
    catchBodies: string[];
    catchVariables: string[];
    failureHolder: string;
    finallyBodies: string[];
    index: number;
    ownerParameters: string[];
    prefixDigest: string;
    prefixStatements: number;
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
          .includes("preserveProductionInstancesFixtureCleanup") !== true
      )
        continue;
      const prefix = [...body.statements].slice(0, index - 2);
      lifecycles.push({
        acquisition: compact(body.statements[index - 1]!, source),
        bodyStatements: body.statements.length,
        catchBodies: lifecycle.catchClause.block.statements.map((statement) =>
          compact(statement, source),
        ),
        catchVariables:
          lifecycle.catchClause.variableDeclaration === undefined
            ? []
            : [compact(lifecycle.catchClause.variableDeclaration, source)],
        failureHolder: compact(body.statements[index - 2]!, source),
        finallyBodies: lifecycle.finallyBlock.statements.map((statement) =>
          compact(statement, source),
        ),
        index,
        ownerParameters: owner.arrow.parameters.map((parameter) =>
          compact(parameter, source),
        ),
        prefixDigest: digestText(
          prefix.map((statement) => statement.getText(source)).join("\n"),
        ),
        prefixStatements: prefix.length,
        tryDigest: digestText(lifecycle.tryBlock.getText(source)),
        tryStatements: lifecycle.tryBlock.statements.length,
      });
    }
  }
  const policies = arrows.filter(
    (entry) => entry.name === "preserveProductionInstancesFixtureCleanup",
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
        statement.name?.text === "ProductionInstancesFixtureCleanupError"
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
      preserveProductionInstancesFixtureCleanup(primaryState, (): void => {
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

export const test_mcp_production_instances_fixture_cleanup = (): void => {
  const primaryFailure = { phase: "production-instances assertion" };
  const cleanupFailure = { phase: "production-instances fixture disposal" };
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
    "production-instances cleanup preserves exact failure identity and order",
    namedFacts([
      ["successCaught", () => success.caught === false],
      ["successFailure", () => success.failure === undefined],
      ["successAttempts", () => success.attempts === 1],
      ["primaryOnlyCaught", () => primaryOnly.caught],
      ["primaryOnlyFailure", () => primaryOnly.failure === primaryFailure],
      ["primaryOnlyAttempts", () => primaryOnly.attempts === 1],
      ["standaloneCaught", () => standalone.caught],
      ["standaloneFailure", () => standalone.failure === cleanupFailure],
      ["standaloneAttempts", () => standalone.attempts === 1],
      ["combinedCaught", () => combined.caught],
      [
        "aggregateContainsExactlyCombined",
        () =>
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
        "aggregateContainsExactlyUndefinedCombined",
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
      primaryOnlyFailure: true,
      primaryOnlyAttempts: true,
      standaloneCaught: true,
      standaloneFailure: true,
      standaloneAttempts: true,
      combinedCaught: true,
      aggregateContainsExactlyCombined: true,
      combinedAttempts: true,
      undefinedPrimaryCaught: true,
      undefinedPrimaryFailure: true,
      undefinedPrimaryAttempts: true,
      undefinedStandaloneCaught: true,
      undefinedStandaloneFailure: true,
      undefinedStandaloneAttempts: true,
      undefinedCombinedCaught: true,
      aggregateContainsExactlyUndefinedCombined: true,
      undefinedCombinedAttempts: true,
    },
  );
  TestValidator.equals(
    "production-instances test owns its complete fixture lifecycle",
    productionInstancesFixtureContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_production_instances.ts"),
        "utf8",
      ),
    ),
    {
      owner: {
        count: 1,
        lifecycles: [
          {
            acquisition: "constfixture=productionFixture();",
            bodyStatements: 26,
            catchBodies: ["productionInstancesFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            failureHolder:
              "letproductionInstancesFailure:|IProductionInstancesFixtureFailure|undefined;",
            finallyBodies: [
              "preserveProductionInstancesFixtureCleanup(productionInstancesFailure,()=>fixture.dispose(),);",
            ],
            index: 25,
            ownerParameters: [],
            prefixDigest:
              "63a7848ce3959eaecbbb158ec132cdafca9d8aff803895d5748ea3a66b5e07a1",
            prefixStatements: 23,
            tryDigest:
              "d5fa191a24b54cc64ffc3ff00e3e2962ef1dc80185bdc0428abfc070fa5b8ac1",
            tryStatements: 10,
          },
        ],
      },
      parseDiagnostics: [],
      policy: {
        bodies: [
          '{try{cleanup();}catch(cleanupFailure){if(failure===undefined)throwcleanupFailure;thrownewProductionInstancesFixtureCleanupError([failure.error,cleanupFailure],"Production-instancesfixtureteardownfailedafterthetestfailed.",);}}',
        ],
        classes: ["AggregateError"],
        parameters: [
          [
            "failure:IProductionInstancesFixtureFailure|undefined",
            "cleanup:()=>unknown",
          ],
        ],
      },
    },
  );
};
