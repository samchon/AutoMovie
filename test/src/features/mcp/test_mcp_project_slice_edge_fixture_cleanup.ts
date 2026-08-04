import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveProjectSliceEdgeFixtureCleanup } from "./test_mcp_project_slice_shape_edges";

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

const stringLiterals = (node: ts.Node): string[] => {
  const values: string[] = [];
  const visit = (cursor: ts.Node): void => {
    if (ts.isStringLiteral(cursor)) values.push(cursor.text);
    ts.forEachChild(cursor, visit);
  };
  visit(node);
  return values;
};

const projectSliceEdgeFixtureContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_project_slice_shape_edges.ts",
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
    (entry) => entry.name === "test_mcp_project_slice_shape_edges",
  );
  const caseTables: Array<{ digest: string; entries: number; name: string }> =
    [];
  const lifecycles: Array<{
    catchBodies: string[];
    catchVariables: string[];
    containerStatements: number;
    finallyBodies: string[];
    index: number;
    loopHeader: string;
    prefixes: string[];
    rootDigest: string;
    rootStringLiterals: string[];
    tryDigest: string;
    tryStatements: number;
  }> = [];
  for (const owner of owners) {
    const body = owner.arrow.body;
    if (ts.isBlock(body) === false) continue;
    for (const statement of body.statements) {
      if (ts.isVariableStatement(statement))
        for (const declaration of statement.declarationList.declarations)
          if (
            ts.isIdentifier(declaration.name) &&
            declaration.name.text === "cases"
          )
            caseTables.push({
              digest: digestText(statement.getText(source)),
              entries:
                declaration.initializer !== undefined &&
                ts.isArrayLiteralExpression(declaration.initializer)
                  ? declaration.initializer.elements.length
                  : -1,
              name: declaration.name.text,
            });
      if (
        ts.isForOfStatement(statement) === false ||
        ts.isBlock(statement.statement) === false
      )
        continue;
      const container = statement.statement;
      for (const [index, lifecycle] of [...container.statements].entries()) {
        if (
          ts.isTryStatement(lifecycle) === false ||
          lifecycle.catchClause === undefined ||
          lifecycle.finallyBlock
            ?.getText(source)
            .includes("preserveProjectSliceEdgeFixtureCleanup") !== true
        )
          continue;
        const prefixes = [...container.statements].slice(index - 2, index);
        const root = prefixes[0]!;
        lifecycles.push({
          catchBodies: lifecycle.catchClause.block.statements.map((entry) =>
            compact(entry, source),
          ),
          catchVariables:
            lifecycle.catchClause.variableDeclaration === undefined
              ? []
              : [compact(lifecycle.catchClause.variableDeclaration, source)],
          containerStatements: container.statements.length,
          finallyBodies: lifecycle.finallyBlock!.statements.map((entry) =>
            compact(entry, source),
          ),
          index,
          loopHeader: `${compact(statement.initializer, source)}of${compact(
            statement.expression,
            source,
          )}`,
          prefixes: prefixes.map((entry) => compact(entry, source)),
          rootDigest: digestText(root.getText(source)),
          rootStringLiterals: stringLiterals(root),
          tryDigest: digestText(lifecycle.tryBlock.getText(source)),
          tryStatements: lifecycle.tryBlock.statements.length,
        });
      }
    }
  }
  const policies = arrows.filter(
    (entry) => entry.name === "preserveProjectSliceEdgeFixtureCleanup",
  );
  return {
    caseTables,
    owner: {
      bodyStatements: owners.map((owner) =>
        ts.isBlock(owner.arrow.body) ? owner.arrow.body.statements.length : -1,
      ),
      count: owners.length,
      lifecycles,
    },
    policy: {
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "ProjectSliceEdgeFixtureCleanupError"
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
      preserveProjectSliceEdgeFixtureCleanup(primaryState, (): void => {
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

export const test_mcp_project_slice_edge_fixture_cleanup = (): void => {
  const primaryFailure = { phase: "project-slice edge regression" };
  const cleanupFailure = { phase: "slice-edge root removal" };
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
    "project-slice edge cleanup preserves exact failure identity and order",
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
    "project-slice edges own their complete iteration lifecycle",
    projectSliceEdgeFixtureContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_project_slice_shape_edges.ts"),
        "utf8",
      ),
    ),
    {
      caseTables: [
        {
          digest:
            "f899e513af3f8f82ee529c4760efede561dc58a94f3e9ab2527b2e9a09f12251",
          entries: 18,
          name: "cases",
        },
      ],
      owner: {
        bodyStatements: [2],
        count: 1,
        lifecycles: [
          {
            catchBodies: ["sliceEdgeFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerStatements: 3,
            finallyBodies: [
              "preserveProjectSliceEdgeFixtureCleanup(sliceEdgeFailure,()=>fs.rmSync(root,{recursive:true,force:true}),);",
            ],
            index: 2,
            loopHeader: "constentryofcases",
            prefixes: [
              'constroot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-slice-edge-"),);',
              "letsliceEdgeFailure:IProjectSliceEdgeFixtureFailure|undefined;",
            ],
            rootDigest:
              "3bfaf7128089629629ff8a7651de305188c4ffc59c8b1fa60f78333ef344453d",
            rootStringLiterals: ["automovie-slice-edge-"],
            tryDigest:
              "96f2f1f1b9206a529b7f989b3268b39fc96d89b805797520389d2bf56326ea0a",
            tryStatements: 4,
          },
        ],
      },
      policy: {
        bodies: [
          '{try{cleanup();}catch(cleanupFailure){if(failure===undefined)throwcleanupFailure;thrownewProjectSliceEdgeFixtureCleanupError([failure.error,cleanupFailure],"Project-sliceedgefixturecleanupfailedafterthetestfailed.",);}}',
        ],
        classes: ["AggregateError"],
        parameters: [
          [
            "failure:IProjectSliceEdgeFixtureFailure|undefined",
            "cleanup:()=>unknown",
          ],
        ],
      },
    },
  );
};
