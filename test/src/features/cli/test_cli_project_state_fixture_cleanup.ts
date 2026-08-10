import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";
import { preserveProjectStateFixtureCleanup } from "./test_cli_project_state";

const compact = (node: ts.Node, source: ts.SourceFile): string =>
  node.getText(source).replace(/\s+/g, "");

/** Every call in one owner that takes out a fixture somebody has to give back. */
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

const aggregateContainsExactly = (
  error: unknown,
  expected: readonly unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

const projectStateFixtureContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_project_state.ts",
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
    (entry) => entry.name === "test_cli_project_state",
  );
  const lifecycles: Array<{
    acquisition: string;
    catchBodies: string[];
    catchVariables: string[];
    failureHolder: string;
    finallyBodies: string[];
    ownerParameters: string[];
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
          .includes("preserveProjectStateFixtureCleanup") !== true
      )
        continue;
      lifecycles.push({
        acquisition: compact(body.statements[0]!, source),
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
        ownerParameters: owner.arrow.parameters.map((parameter) =>
          compact(parameter, source),
        ),
      });
    }
  }
  const policies = arrows.filter(
    (entry) => entry.name === "preserveProjectStateFixtureCleanup",
  );
  return {
    owner: {
      // Every fixture the owner takes out, against every lifecycle that gives
      // one back. What the guarded body contains is deliberately not pinned: a
      // digest of it moves whenever any case inside the owner is edited, which
      // says nothing about whether the fixture is disposed.
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
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "ProjectStateFixtureCleanupError"
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
      preserveProjectStateFixtureCleanup(primaryState, (): void => {
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

export const test_cli_project_state_fixture_cleanup = (): void => {
  const primaryFailure = { phase: "project-state assertion" };
  const cleanupFailure = { phase: "production fixture disposal" };
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
    "project-state fixture cleanup preserves exact failure identity and order",
    namedFacts([
      ["successSilent", () => success.caught === false],
      ["successNoFailure", () => success.failure === undefined],
      ["successDisposed", () => success.attempts === 1],
      ["primaryOnlyThrew", () => primaryOnly.caught],
      ["primaryOnlyPreserved", () => primaryOnly.failure === primaryFailure],
      ["primaryOnlyDisposed", () => primaryOnly.attempts === 1],
      ["standaloneThrew", () => standalone.caught],
      ["standalonePreserved", () => standalone.failure === cleanupFailure],
      ["standaloneDisposed", () => standalone.attempts === 1],
      ["combinedThrew", () => combined.caught],
      [
        "combinedAggregated",
        () =>
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            cleanupFailure,
          ]),
      ],
      ["combinedDisposed", () => combined.attempts === 1],
      ["undefinedPrimaryThrew", () => undefinedPrimary.caught],
      [
        "undefinedPrimaryPreserved",
        () => undefinedPrimary.failure === undefined,
      ],
      ["undefinedPrimaryDisposed", () => undefinedPrimary.attempts === 1],
      ["undefinedStandaloneThrew", () => undefinedStandalone.caught],
      [
        "undefinedStandalonePreserved",
        () => undefinedStandalone.failure === undefined,
      ],
      ["undefinedStandaloneDisposed", () => undefinedStandalone.attempts === 1],
      ["undefinedCombinedThrew", () => undefinedCombined.caught],
      [
        "undefinedCombinedAggregated",
        () =>
          aggregateContainsExactly(undefinedCombined.failure, [
            undefined,
            undefined,
          ]),
      ],
      ["undefinedCombinedDisposed", () => undefinedCombined.attempts === 1],
    ]),
    {
      successSilent: true,
      successNoFailure: true,
      successDisposed: true,
      primaryOnlyThrew: true,
      primaryOnlyPreserved: true,
      primaryOnlyDisposed: true,
      standaloneThrew: true,
      standalonePreserved: true,
      standaloneDisposed: true,
      combinedThrew: true,
      combinedAggregated: true,
      combinedDisposed: true,
      undefinedPrimaryThrew: true,
      undefinedPrimaryPreserved: true,
      undefinedPrimaryDisposed: true,
      undefinedStandaloneThrew: true,
      undefinedStandalonePreserved: true,
      undefinedStandaloneDisposed: true,
      undefinedCombinedThrew: true,
      undefinedCombinedAggregated: true,
      undefinedCombinedDisposed: true,
    },
  );
  TestValidator.equals(
    "project-state test owns its complete post-handoff fixture lifecycle",
    projectStateFixtureContract(
      fs.readFileSync(
        path.join(__dirname, "test_cli_project_state.ts"),
        "utf8",
      ),
    ),
    {
      owner: {
        acquisitions: ["productionFixture"],
        count: 1,
        lifecycles: [
          {
            acquisition: "constfixture=productionFixture();",
            catchBodies: ["projectStateFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            failureHolder:
              "letprojectStateFailure:IProjectStateFixtureFailure|undefined;",
            finallyBodies: [
              "preserveProjectStateFixtureCleanup(projectStateFailure,()=>fixture.dispose(),);",
            ],
            ownerParameters: [],
          },
        ],
      },
      parseDiagnostics: [],
      policy: {
        bodies: [
          '{try{cleanup();}catch(cleanupFailure){if(failure===undefined)throwcleanupFailure;thrownewProjectStateFixtureCleanupError([failure.error,cleanupFailure],"Project-statefixtureteardownfailedafterthetestfailed.",);}}',
        ],
        classes: ["AggregateError"],
        parameters: [
          [
            "failure:IProjectStateFixtureFailure|undefined",
            "cleanup:()=>unknown",
          ],
        ],
      },
    },
  );
};
