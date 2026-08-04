import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveSingleProductionProjectFixtureCleanup } from "./test_mcp_production_project";

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

const invalidProductionRootCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_project.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const owners = source.statements.flatMap((statement) =>
    ts.isVariableStatement(statement)
      ? [...statement.declarationList.declarations].flatMap((declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === "test_mcp_production_project" &&
          declaration.initializer !== undefined &&
          ts.isArrowFunction(declaration.initializer)
            ? [declaration.initializer]
            : [],
        )
      : [],
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
        const acquisition = compact(statements[index - 1]!, source);
        if (acquisition.startsWith("constinvalidRoot=fs.mkdtempSync(") === true)
          lifecycles.push({
            acquisition,
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
    visit(owner.body);
  }
  return {
    owner: {
      count: owners.length,
      lifecycles,
      statementCounts: owners.flatMap((owner) =>
        ts.isBlock(owner.body) ? [owner.body.statements.length] : [],
      ),
    },
    parseDiagnostics: (
      source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics.map((diagnostic) => String(diagnostic.messageText)),
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

export const test_mcp_production_project_invalid_root_cleanup = (): void => {
  const primaryFailure = { phase: "invalid production-root assertion" };
  const cleanupFailure = { phase: "invalid production-root removal" };
  const nestedPrimaryFailure = new AggregateError(
    [{ phase: "nested invalid production-root cleanup" }],
    "Nested invalid production-root cleanup failed.",
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
    "invalid production-root cleanup preserves failure identity and order",
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
      ["nestedCombinedCaught", () => nestedCombined.caught],
      [
        "aggregateContainsExactlyNestedCombined",
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
      nestedCombinedCaught: true,
      aggregateContainsExactlyNestedCombined: true,
      nestedCombinedAttempts: true,
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
    "production-project test owns one invalid-root lifecycle",
    invalidProductionRootCleanupContract(
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
            acquisition:
              'constinvalidRoot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-production-root-"),);',
            catchBodies: ["invalidRootFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "ArrowFunction",
            containerStatements: 23,
            failureHolder:
              "letinvalidRootFailure:ISingleProductionProjectFixtureFailure|undefined;",
            finallyBodies: [
              "preserveSingleProductionProjectFixtureCleanup(invalidRootFailure,()=>fs.rmSync(invalidRoot,{force:true,recursive:true}),);",
            ],
            index: 22,
            substantive: {
              digest:
                "a9bda55a379e47b9c4cb1eae6df7e0491303887f606de4ca6693e6e21e2d1987",
              tokens: 9111,
            },
            tryDigest:
              "95dadd734e53ee599154006d2b6df20e8caeb834db51de923ac689384bef0afb",
            tryStatements: 240,
          },
        ],
        statementCounts: [23],
      },
      parseDiagnostics: [],
    },
  );
};
