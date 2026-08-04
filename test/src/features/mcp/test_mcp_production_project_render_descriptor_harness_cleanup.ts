import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveProductionProjectFixtureCleanup } from "./test_mcp_production_project";

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

const renderDescriptorHarnessCleanupContract = (text: string): unknown => {
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
          declaration.name.text === "captureRenderFileDescriptorFailure" &&
          declaration.initializer !== undefined &&
          ts.isArrowFunction(declaration.initializer)
            ? [declaration.initializer]
            : [],
        )
      : [],
  );
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
        if (failureHolder.startsWith("letrenderDescriptorHarnessFailure:"))
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
  cleanupFailures?: readonly ({ error: unknown; present: true } | undefined)[];
  primaryFailure?: { error: unknown; present: true };
}): {
  caught: boolean;
  failure: unknown;
  operationCaught: boolean;
  operationFailure: unknown;
  order: string[];
} => {
  let caught = false;
  let failure: unknown;
  let operationCaught = false;
  let operationFailure: unknown;
  const order: string[] = [];
  try {
    let primaryState: { error: unknown } | undefined;
    try {
      if (props.primaryFailure !== undefined) throw props.primaryFailure.error;
    } catch (error) {
      operationCaught = true;
      operationFailure = error;
      primaryState = { error };
    } finally {
      preserveProductionProjectFixtureCleanup(
        primaryState,
        ["open", "fstat", "close"].map((resource, index) => ({
          resource: `render descriptor ${resource} hook`,
          cleanup: (): void => {
            order.push(resource);
            const cleanupFailure = props.cleanupFailures?.[index];
            if (cleanupFailure !== undefined) throw cleanupFailure.error;
          },
        })),
      );
    }
  } catch (error) {
    caught = true;
    failure = error;
  }
  return { caught, failure, operationCaught, operationFailure, order };
};

export const test_mcp_production_project_render_descriptor_harness_cleanup =
  (): void => {
    const primaryFailure = { phase: "render descriptor read" };
    const openFailure = { phase: "render descriptor open restoration" };
    const fstatFailure = { phase: "render descriptor fstat restoration" };
    const closeFailure = { phase: "render descriptor close restoration" };
    const cleanupFailures = [
      { error: openFailure, present: true as const },
      { error: fstatFailure, present: true as const },
      { error: closeFailure, present: true as const },
    ];
    const success = captureCleanup({});
    const primaryOnly = captureCleanup({
      primaryFailure: { error: primaryFailure, present: true },
    });
    const standalone = captureCleanup({
      cleanupFailures: [cleanupFailures[0]],
    });
    const multiple = captureCleanup({ cleanupFailures });
    const combined = captureCleanup({
      cleanupFailures,
      primaryFailure: { error: primaryFailure, present: true },
    });
    const undefinedPrimary = captureCleanup({
      primaryFailure: { error: undefined, present: true },
    });
    const undefinedStandalone = captureCleanup({
      cleanupFailures: [{ error: undefined, present: true }],
    });
    const undefinedCombined = captureCleanup({
      cleanupFailures: [{ error: undefined, present: true }],
      primaryFailure: { error: undefined, present: true },
    });
    const order = "open,fstat,close";
    TestValidator.equals(
      "render descriptor harness cleanup preserves evidence and every hook",
      namedFacts([
        ["successCaught", () => success.caught === false],
        ["successFailure", () => success.failure === undefined],
        ["successOperationCaught", () => success.operationCaught === false],
        [
          "successOperationFailure",
          () => success.operationFailure === undefined,
        ],
        ["successOrder", () => success.order.join(",") === order],
        ["primaryOnlyCaught", () => primaryOnly.caught === false],
        ["primaryOnlyFailure", () => primaryOnly.failure === undefined],
        ["primaryOnlyOperationCaught", () => primaryOnly.operationCaught],
        [
          "primaryOnlyOperationFailure",
          () => primaryOnly.operationFailure === primaryFailure,
        ],
        ["primaryOnlyOrder", () => primaryOnly.order.join(",") === order],
        ["standaloneCaught", () => standalone.caught],
        ["standaloneFailure", () => standalone.failure === openFailure],
        [
          "standaloneOperationCaught",
          () => standalone.operationCaught === false,
        ],
        [
          "standaloneOperationFailure",
          () => standalone.operationFailure === undefined,
        ],
        ["standaloneOrder", () => standalone.order.join(",") === order],
        ["multipleCaught", () => multiple.caught],
        [
          "aggregateContainsExactlyMultiple",
          () =>
            aggregateContainsExactly(multiple.failure, [
              openFailure,
              fstatFailure,
              closeFailure,
            ]),
        ],
        ["multipleOperationCaught", () => multiple.operationCaught === false],
        [
          "multipleOperationFailure",
          () => multiple.operationFailure === undefined,
        ],
        ["multipleOrder", () => multiple.order.join(",") === order],
        ["combinedCaught", () => combined.caught],
        [
          "aggregateContainsExactlyCombined",
          () =>
            aggregateContainsExactly(combined.failure, [
              primaryFailure,
              openFailure,
              fstatFailure,
              closeFailure,
            ]),
        ],
        ["combinedOperationCaught", () => combined.operationCaught],
        [
          "combinedOperationFailure",
          () => combined.operationFailure === primaryFailure,
        ],
        ["combinedOrder", () => combined.order.join(",") === order],
        ["undefinedPrimaryCaught", () => undefinedPrimary.caught === false],
        [
          "undefinedPrimaryFailure",
          () => undefinedPrimary.failure === undefined,
        ],
        [
          "undefinedPrimaryOperationCaught",
          () => undefinedPrimary.operationCaught,
        ],
        [
          "undefinedPrimaryOperationFailure",
          () => undefinedPrimary.operationFailure === undefined,
        ],
        [
          "undefinedPrimaryOrder",
          () => undefinedPrimary.order.join(",") === order,
        ],
        ["undefinedStandaloneCaught", () => undefinedStandalone.caught],
        [
          "undefinedStandaloneFailure",
          () => undefinedStandalone.failure === undefined,
        ],
        [
          "undefinedStandaloneOperationCaught",
          () => undefinedStandalone.operationCaught === false,
        ],
        [
          "undefinedStandaloneOperationFailure",
          () => undefinedStandalone.operationFailure === undefined,
        ],
        [
          "undefinedStandaloneOrder",
          () => undefinedStandalone.order.join(",") === order,
        ],
        ["undefinedCombinedCaught", () => undefinedCombined.caught],
        [
          "aggregateContainsExactlyUndefinedCombined",
          () =>
            aggregateContainsExactly(undefinedCombined.failure, [
              undefined,
              undefined,
            ]),
        ],
        [
          "undefinedCombinedOperationCaught",
          () => undefinedCombined.operationCaught,
        ],
        [
          "undefinedCombinedOperationFailure",
          () => undefinedCombined.operationFailure === undefined,
        ],
        [
          "undefinedCombinedOrder",
          () => undefinedCombined.order.join(",") === order,
        ],
      ]),
      {
        successCaught: true,
        successFailure: true,
        successOperationCaught: true,
        successOperationFailure: true,
        successOrder: true,
        primaryOnlyCaught: true,
        primaryOnlyFailure: true,
        primaryOnlyOperationCaught: true,
        primaryOnlyOperationFailure: true,
        primaryOnlyOrder: true,
        standaloneCaught: true,
        standaloneFailure: true,
        standaloneOperationCaught: true,
        standaloneOperationFailure: true,
        standaloneOrder: true,
        multipleCaught: true,
        aggregateContainsExactlyMultiple: true,
        multipleOperationCaught: true,
        multipleOperationFailure: true,
        multipleOrder: true,
        combinedCaught: true,
        aggregateContainsExactlyCombined: true,
        combinedOperationCaught: true,
        combinedOperationFailure: true,
        combinedOrder: true,
        undefinedPrimaryCaught: true,
        undefinedPrimaryFailure: true,
        undefinedPrimaryOperationCaught: true,
        undefinedPrimaryOperationFailure: true,
        undefinedPrimaryOrder: true,
        undefinedStandaloneCaught: true,
        undefinedStandaloneFailure: true,
        undefinedStandaloneOperationCaught: true,
        undefinedStandaloneOperationFailure: true,
        undefinedStandaloneOrder: true,
        undefinedCombinedCaught: true,
        aggregateContainsExactlyUndefinedCombined: true,
        undefinedCombinedOperationCaught: true,
        undefinedCombinedOperationFailure: true,
        undefinedCombinedOrder: true,
      },
    );
    TestValidator.equals(
      "render descriptor harness owns one cleanup lifecycle",
      renderDescriptorHarnessCleanupContract(
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
              catchBodies: [
                "caught=error;",
                "renderDescriptorHarnessFailure={error};",
              ],
              catchVariables: ["error"],
              containerKind: "ArrowFunction",
              containerStatements: 16,
              failureHolder:
                "letrenderDescriptorHarnessFailure:|IProductionProjectFixtureFailure|undefined;",
              finallyDigest:
                "793e7bd16700b40d028ff85c769063743f57624193313d6841df4449d592e4b2",
              finallyStatements: 1,
              finallySubstantive: {
                digest:
                  "f39e7e55ad27c3c2739d2135f8ba0db4af8d4cd78c2ff110668c97ceebcf622b",
                tokens: 71,
              },
              index: 14,
              substantive: {
                digest:
                  "800057d47fa60dd724576e9d17d1cfa940ed1706ba1fd04d3c1c25ad718d7539",
                tokens: 7,
              },
              tryBody: "{project.readRenderFile(relativePath);}",
              tryDigest:
                "37bf4d400878ed3e7779b67f251cd6cfd4bc276293b8f2dea87dabbe3c32d79b",
              tryStatements: 1,
            },
          ],
          statementCounts: [16],
        },
        parseDiagnostics: [],
      },
    );
  };
