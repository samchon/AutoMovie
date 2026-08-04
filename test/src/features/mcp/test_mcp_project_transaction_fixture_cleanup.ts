import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveProjectTransactionFixtureCleanup } from "./test_mcp_project_transactions";

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

const transactionFixtureContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_project_transactions.ts",
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
    (entry) => entry.name === "test_mcp_project_transactions",
  );
  const lifecycles: Array<{
    bodyStatements: number;
    catchBodies: string[];
    catchVariables: string[];
    finallyBodies: string[];
    index: number;
    prefixes: string[];
    rootDigest: string;
    rootStringLiterals: string[];
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
          .includes("preserveProjectTransactionFixtureCleanup") !== true
      )
        continue;
      const prefixes = [...body.statements].slice(index - 2, index);
      const root = prefixes[0]!;
      lifecycles.push({
        bodyStatements: body.statements.length,
        catchBodies: lifecycle.catchClause.block.statements.map((statement) =>
          compact(statement, source),
        ),
        catchVariables:
          lifecycle.catchClause.variableDeclaration === undefined
            ? []
            : [compact(lifecycle.catchClause.variableDeclaration, source)],
        finallyBodies: lifecycle.finallyBlock.statements.map((statement) =>
          compact(statement, source),
        ),
        index,
        prefixes: prefixes.map((statement) => compact(statement, source)),
        rootDigest: digestText(root.getText(source)),
        rootStringLiterals: stringLiterals(root),
        tryDigest: digestText(lifecycle.tryBlock.getText(source)),
        tryStatements: lifecycle.tryBlock.statements.length,
      });
    }
  }
  const policies = arrows.filter(
    (entry) => entry.name === "preserveProjectTransactionFixtureCleanup",
  );
  return {
    owner: { count: owners.length, lifecycles },
    policy: {
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "ProjectTransactionFixtureCleanupError"
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
      preserveProjectTransactionFixtureCleanup(
        primaryState,
        (): void => {
          ++attempts;
          if (props.cleanupFailure !== undefined)
            throw props.cleanupFailure.error;
        },
        "probe",
      );
    }
  } catch (error) {
    caught = true;
    failure = error;
  }
  return { attempts, caught, failure };
};

export const test_mcp_project_transaction_fixture_cleanup = (): void => {
  const primaryFailure = { phase: "project-transaction regression" };
  const cleanupFailure = { phase: "transaction root removal" };
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
    "project-transaction cleanup preserves exact failure identity and order",
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
    "project transactions own both complete fixture lifecycles",
    transactionFixtureContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_project_transactions.ts"),
        "utf8",
      ),
    ),
    {
      owner: {
        count: 1,
        lifecycles: [
          {
            bodyStatements: 6,
            catchBodies: ["transactionFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            finallyBodies: [
              'preserveProjectTransactionFixtureCleanup(transactionFailure,()=>fs.rmSync(root,{recursive:true,force:true}),"main-root",);',
            ],
            index: 2,
            prefixes: [
              'constroot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-txn-"));',
              "lettransactionFailure:IProjectTransactionFixtureFailure|undefined;",
            ],
            rootDigest:
              "a81bbdcffb3eec2261a6d19f4441e610d8197b48cd39746d0da10a743bdb53ce",
            rootStringLiterals: ["automovie-txn-"],
            tryDigest:
              "fa7bbc08b58608b208d971dbd28a2dc1b49c9bbf44160b2b9f80d4823c4803dd",
            tryStatements: 136,
          },
          {
            bodyStatements: 6,
            catchBodies: ["aliasFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            finallyBodies: [
              'preserveProjectTransactionFixtureCleanup(aliasFailure,()=>fs.rmSync(aliasSandbox,{recursive:true,force:true}),"alias-sandbox",);',
            ],
            index: 5,
            prefixes: [
              'constaliasSandbox=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-txn-alias-"),);',
              "letaliasFailure:IProjectTransactionFixtureFailure|undefined;",
            ],
            rootDigest:
              "a0b7ebd5e86c6f9a9599a8971c0e63c52e574bdcd89e324da392bc945cc7c1b9",
            rootStringLiterals: ["automovie-txn-alias-"],
            tryDigest:
              "50395f59f182d0c45f0fe5bf817c8247ac0d8c61fa114663a00f75d77e087e5a",
            tryStatements: 14,
          },
        ],
      },
      policy: {
        bodies: [
          "{try{cleanup();}catch(cleanupFailure){if(failure===undefined)throwcleanupFailure;thrownewProjectTransactionFixtureCleanupError([failure.error,cleanupFailure],`Project-transaction$" +
            "{resource}cleanupfailedafterthetestfailed.`,);}}",
        ],
        classes: ["AggregateError"],
        parameters: [
          [
            "failure:IProjectTransactionFixtureFailure|undefined",
            "cleanup:()=>unknown",
            "resource:string",
          ],
        ],
      },
    },
  );
};
