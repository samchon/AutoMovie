import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";
import { preserveProductionProjectFixtureCleanup } from "./test_mcp_production_project";

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

const observationHookCleanupContract = (text: string): unknown => {
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
  const holderNames = [
    "deniedLstatHookFailure",
    "inventoryReadHookFailure",
  ] as const;
  const lifecycles: Array<{
    catchBodies: string[];
    catchVariables: string[];
    containerKind: string;
    containerStatements: number;
    failureHolder: string;
    finallyDigest: string;
    finallyStatements: number;
    finallySubstantive: { digest: string; tokens: number };
    index: number;
    substantive: { digest: string; tokens: number };
    tryBody: string;
    tryDigest: string;
    tryStatements: number;
  }> = [];
  for (const owner of owners) {
    const visit = (node: ts.Node): void => {
      if (
        ts.isTryStatement(node) &&
        node.catchClause !== undefined &&
        node.finallyBlock !== undefined &&
        ts.isBlock(node.parent)
      ) {
        const statements = [...node.parent.statements];
        const index = statements.indexOf(node);
        const failureHolder = compact(statements[index - 1]!, source);
        if (holderNames.some((name) => failureHolder.startsWith(`let${name}:`)))
          lifecycles.push({
            catchBodies: node.catchClause.block.statements.map((statement) =>
              compact(statement, source),
            ),
            catchVariables:
              node.catchClause.variableDeclaration === undefined
                ? []
                : [compact(node.catchClause.variableDeclaration, source)],
            containerKind: ts.SyntaxKind[node.parent.parent.kind]!,
            containerStatements: statements.length,
            failureHolder,
            finallyDigest: digestText(node.finallyBlock.getText(source)),
            finallyStatements: node.finallyBlock.statements.length,
            finallySubstantive: leafTokenContract(
              node.finallyBlock.statements,
              source,
            ),
            index,
            substantive: leafTokenContract(node.tryBlock.statements, source),
            tryBody: compact(node.tryBlock, source),
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
  try {
    let primaryState: { error: unknown } | undefined;
    try {
      if (props.primaryFailure !== undefined) throw props.primaryFailure.error;
    } catch (error) {
      primaryState = { error };
      throw error;
    } finally {
      preserveProductionProjectFixtureCleanup(primaryState, [
        {
          resource: "observation hook",
          cleanup: (): void => {
            ++attempts;
            if (props.cleanupFailure !== undefined)
              throw props.cleanupFailure.error;
          },
        },
      ]);
    }
  } catch (error) {
    caught = true;
    failure = error;
  }
  return { attempts, caught, failure };
};

export const test_mcp_production_project_observation_hook_cleanup =
  (): void => {
    const primaryFailure = { phase: "project observation assertion" };
    const cleanupFailure = { phase: "project observation hook restoration" };
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
      "project observation hook cleanup preserves failure identity and order",
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
      "production-project test owns two observation hook cleanup lifecycles",
      observationHookCleanupContract(
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
              catchBodies: ["deniedLstatHookFailure={error};", "throwerror;"],
              catchVariables: ["error"],
              containerKind: "TryStatement",
              containerStatements: 296,
              failureHolder:
                "letdeniedLstatHookFailure:IProductionProjectFixtureFailure|undefined;",
              finallyDigest:
                "9fff35da5058711b5fa8e214d70a1cbfa36fca05013cb344cf391ec51f5a9895",
              finallyStatements: 1,
              finallySubstantive: {
                digest:
                  "da6438f6dac158c0fa72c1790ff9f991c2da1916f8d8b0ee2c252ea81aa8b541",
                tokens: 43,
              },
              index: 266,
              substantive: {
                digest:
                  "90fb5973b8d9a8c7834aefe49b5b2aae03c0c943a075d7e1206b05c1e1afccb7",
                tokens: 21,
              },
              tryBody:
                '{TestValidator.predicate("non-missinglstaterrorsarenothiddenasabsentfiles",throws(()=>ownerProject.readTrackedStateFile("denied.json")),);}',
              tryDigest:
                "69d6ffa3f6eacdd36468bc3d8ae7f27e12fce0527511189d8786967c96b1901a",
              tryStatements: 1,
            },
            {
              catchBodies: ["inventoryReadHookFailure={error};", "throwerror;"],
              catchVariables: ["error"],
              containerKind: "TryStatement",
              containerStatements: 296,
              failureHolder:
                "letinventoryReadHookFailure:IProductionProjectFixtureFailure|undefined;",
              finallyDigest:
                "753190f7b0109bef8d1f314bbe03d773ee5b3be65b49eab32c6f5d7086631492",
              finallyStatements: 1,
              finallySubstantive: {
                digest:
                  "4ac88163962d565e8ef16fcbaf79317d144ae500c52e1216cded106c10171187",
                tokens: 29,
              },
              index: 291,
              substantive: {
                digest:
                  "6ac70764cc4f3eafa1d67f4b2fd102b5db2ed416520fe769a9cc5e05bd0445a5",
                tokens: 22,
              },
              tryBody:
                '{TestValidator.predicate("adesigndisappearingduringinventoryisaloudrace",throws(()=>ownerProject.graph(),"disappearedwhilereading"),);}',
              tryDigest:
                "4768706f5b6bece0c5705e7ce4cce20f95ce88fb985967c4d944ba537e5fc901",
              tryStatements: 1,
            },
          ],
          statementCounts: [23],
        },
        parseDiagnostics: [],
      },
    );
  };
