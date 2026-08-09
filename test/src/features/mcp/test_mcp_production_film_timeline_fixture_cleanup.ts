import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";
import { preserveFilmTimelineFixtureCleanup } from "./test_mcp_production_film_timeline";

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

const filmTimelineFixtureContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_film_timeline.ts",
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
    (entry) => entry.name === "test_mcp_production_film_timeline",
  );
  const lifecycles: Array<{
    acquisition: string;
    async: boolean;
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
          .includes("preserveFilmTimelineFixtureCleanup") !== true
      )
        continue;
      lifecycles.push({
        acquisition: compact(body.statements[index - 1]!, source),
        async:
          owner.arrow.modifiers?.some(
            (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword,
          ) ?? false,
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
    (entry) => entry.name === "preserveFilmTimelineFixtureCleanup",
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
        statement.name?.text === "FilmTimelineFixtureCleanupError"
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
      preserveFilmTimelineFixtureCleanup(primaryState, (): void => {
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

export const test_mcp_production_film_timeline_fixture_cleanup = (): void => {
  const primaryFailure = { phase: "film-timeline assertion" };
  const cleanupFailure = { phase: "film-timeline fixture disposal" };
  const nestedCleanupFailure = new AggregateError(
    [{ phase: "nested film-source cleanup" }],
    "Nested cleanup failed.",
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
    "film-timeline cleanup preserves nested and outer failure identity",
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
    "film-timeline test owns its complete outer fixture lifecycle",
    filmTimelineFixtureContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_production_film_timeline.ts"),
        "utf8",
      ),
    ),
    {
      owner: {
        count: 1,
        lifecycles: [
          {
            acquisition: "constfixture=productionFixture();",
            async: true,
            bodyStatements: 3,
            catchBodies: ["filmTimelineFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            failureHolder:
              "letfilmTimelineFailure:IFilmTimelineFixtureFailure|undefined;",
            finallyBodies: [
              "preserveFilmTimelineFixtureCleanup(filmTimelineFailure,()=>fixture.dispose(),);",
            ],
            index: 2,
            nestedTryStatements: 2,
            ownerParameters: [],
            tryDigest:
              "1ff72ac42147cf2a48a0bf70a03f5e7f0835f5a63385d402a68b57f5ff45b739",
            tryStatements: 158,
          },
        ],
      },
      parseDiagnostics: [],
      policy: {
        bodies: [
          '{try{cleanup();}catch(cleanupFailure){if(failure===undefined)throwcleanupFailure;thrownewFilmTimelineFixtureCleanupError([failure.error,cleanupFailure],"Film-timelinefixtureteardownfailedafterthetestfailed.",);}}',
        ],
        classes: ["AggregateError"],
        parameters: [
          [
            "failure:IFilmTimelineFixtureFailure|undefined",
            "cleanup:()=>unknown",
          ],
        ],
      },
    },
  );
};
