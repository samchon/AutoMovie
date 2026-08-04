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

const reentrantNamespaceCleanupContract = (text: string): unknown => {
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
        if (failureHolder.startsWith("letreentrantAcquisitionFailure:"))
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
}): { caught: boolean; failure: unknown; order: string[] } => {
  let caught = false;
  const order: string[] = [];
  let failure: unknown;
  try {
    preserveProductionProjectFixtureCleanup(
      props.primaryFailure === undefined
        ? undefined
        : { error: props.primaryFailure.error },
      Array.from({ length: 3 }, (_, index) => ({
        resource: `reentrant-namespace-${index}`,
        cleanup: (): void => {
          order.push(`cleanup-${index}`);
          const cleanupFailure = props.cleanupFailures?.[index];
          if (cleanupFailure !== undefined) throw cleanupFailure.error;
        },
      })),
    );
    if (props.primaryFailure !== undefined) throw props.primaryFailure.error;
  } catch (error) {
    caught = true;
    failure = error;
  }
  return { caught, failure, order };
};

const capturePartialAcquisition = (props: {
  acquired: 0 | 1 | 2;
  hookFailure?: { error: unknown; present: true };
  primaryFailure?: { error: unknown; present: true };
}): { caught: boolean; failure: unknown; order: string[] } => {
  let caught = false;
  const order: string[] = [];
  let failure: unknown;
  let hookRestoreFailed = false;
  try {
    preserveProductionProjectFixtureCleanup(
      props.primaryFailure === undefined
        ? undefined
        : { error: props.primaryFailure.error },
      [
        {
          resource: "write hook",
          cleanup: (): void => {
            order.push("hook");
            if (props.hookFailure !== undefined) {
              hookRestoreFailed = true;
              throw props.hookFailure.error;
            }
          },
        },
        ...(props.acquired === 2
          ? [
              {
                resource: "inner lease",
                cleanup: (): void => {
                  order.push("inner-check");
                  if (props.primaryFailure !== undefined || hookRestoreFailed)
                    order.push("inner-release");
                },
              },
            ]
          : []),
        ...(props.acquired >= 1
          ? [
              {
                resource: "outer lease",
                cleanup: (): void => {
                  order.push("outer-check");
                  if (props.primaryFailure !== undefined || hookRestoreFailed)
                    order.push("outer-release");
                },
              },
            ]
          : []),
      ],
    );
    if (props.primaryFailure !== undefined) throw props.primaryFailure.error;
  } catch (error) {
    caught = true;
    failure = error;
  }
  return { caught, failure, order };
};

export const test_mcp_production_project_reentrant_namespace_cleanup =
  (): void => {
    const primaryFailure = { phase: "reentrant namespace acquisition" };
    const hookFailure = { phase: "reentrant write-hook restoration" };
    const innerFailure = { phase: "reentrant inner lease release" };
    const outerFailure = { phase: "reentrant outer lease release" };
    const success = captureCleanup({});
    const primaryOnly = captureCleanup({
      primaryFailure: { error: primaryFailure, present: true },
    });
    const standalone = captureCleanup({
      cleanupFailures: [{ error: hookFailure, present: true }],
    });
    const multiple = captureCleanup({
      cleanupFailures: [
        { error: hookFailure, present: true },
        { error: innerFailure, present: true },
        { error: outerFailure, present: true },
      ],
    });
    const combined = captureCleanup({
      cleanupFailures: [
        { error: hookFailure, present: true },
        { error: innerFailure, present: true },
        { error: outerFailure, present: true },
      ],
      primaryFailure: { error: primaryFailure, present: true },
    });
    const successfulBoth = capturePartialAcquisition({ acquired: 2 });
    const noneAcquired = capturePartialAcquisition({
      acquired: 0,
      primaryFailure: { error: primaryFailure, present: true },
    });
    const outerAcquired = capturePartialAcquisition({
      acquired: 1,
      primaryFailure: { error: primaryFailure, present: true },
    });
    const bothAcquired = capturePartialAcquisition({
      acquired: 2,
      primaryFailure: { error: primaryFailure, present: true },
    });
    const hookFailedAfterAcquisition = capturePartialAcquisition({
      acquired: 2,
      hookFailure: { error: hookFailure, present: true },
    });
    const undefinedStandalone = captureCleanup({
      cleanupFailures: [{ error: undefined, present: true }],
    });
    const undefinedCombined = captureCleanup({
      cleanupFailures: [{ error: undefined, present: true }],
      primaryFailure: { error: undefined, present: true },
    });
    TestValidator.equals(
      "reentrant namespace cleanup preserves failure and release order",
      namedFacts([
        ["successCaught", () => success.caught === false],
        ["successFailure", () => success.failure === undefined],
        [
          "successOrder",
          () => success.order.join(",") === "cleanup-0,cleanup-1,cleanup-2",
        ],
        ["primaryOnlyCaught", () => primaryOnly.caught],
        ["primaryOnlyFailure", () => primaryOnly.failure === primaryFailure],
        [
          "primaryOnlyOrder",
          () => primaryOnly.order.join(",") === "cleanup-0,cleanup-1,cleanup-2",
        ],
        ["standaloneCaught", () => standalone.caught],
        ["standaloneFailure", () => standalone.failure === hookFailure],
        [
          "standaloneOrder",
          () => standalone.order.join(",") === "cleanup-0,cleanup-1,cleanup-2",
        ],
        ["multipleCaught", () => multiple.caught],
        [
          "aggregateContainsExactlyMultiple",
          () =>
            aggregateContainsExactly(multiple.failure, [
              hookFailure,
              innerFailure,
              outerFailure,
            ]),
        ],
        [
          "multipleOrder",
          () => multiple.order.join(",") === "cleanup-0,cleanup-1,cleanup-2",
        ],
        ["combinedCaught", () => combined.caught],
        [
          "aggregateContainsExactlyCombined",
          () =>
            aggregateContainsExactly(combined.failure, [
              primaryFailure,
              hookFailure,
              innerFailure,
              outerFailure,
            ]),
        ],
        [
          "combinedOrder",
          () => combined.order.join(",") === "cleanup-0,cleanup-1,cleanup-2",
        ],
        ["successfulBothCaught", () => successfulBoth.caught === false],
        ["successfulBothFailure", () => successfulBoth.failure === undefined],
        [
          "successfulBothOrder",
          () =>
            successfulBoth.order.join(",") === "hook,inner-check,outer-check",
        ],
        ["noneAcquiredCaught", () => noneAcquired.caught],
        ["noneAcquiredFailure", () => noneAcquired.failure === primaryFailure],
        ["noneAcquiredOrder", () => noneAcquired.order.join(",") === "hook"],
        ["outerAcquiredCaught", () => outerAcquired.caught],
        [
          "outerAcquiredFailure",
          () => outerAcquired.failure === primaryFailure,
        ],
        [
          "outerAcquiredOrder",
          () =>
            outerAcquired.order.join(",") === "hook,outer-check,outer-release",
        ],
        ["bothAcquiredCaught", () => bothAcquired.caught],
        ["bothAcquiredFailure", () => bothAcquired.failure === primaryFailure],
        [
          "bothAcquiredOrder",
          () =>
            bothAcquired.order.join(",") ===
            "hook,inner-check,inner-release,outer-check,outer-release",
        ],
        [
          "hookFailedAfterAcquisitionCaught",
          () => hookFailedAfterAcquisition.caught,
        ],
        [
          "hookFailedAfterAcquisitionFailure",
          () => hookFailedAfterAcquisition.failure === hookFailure,
        ],
        [
          "hookFailedAfterAcquisitionOrder",
          () =>
            hookFailedAfterAcquisition.order.join(",") ===
            "hook,inner-check,inner-release,outer-check,outer-release",
        ],
        ["undefinedStandaloneCaught", () => undefinedStandalone.caught],
        [
          "undefinedStandaloneFailure",
          () => undefinedStandalone.failure === undefined,
        ],
        [
          "undefinedStandaloneOrder",
          () =>
            undefinedStandalone.order.join(",") ===
            "cleanup-0,cleanup-1,cleanup-2",
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
          "undefinedCombinedOrder",
          () =>
            undefinedCombined.order.join(",") ===
            "cleanup-0,cleanup-1,cleanup-2",
        ],
      ]),
      {
        successCaught: true,
        successFailure: true,
        successOrder: true,
        primaryOnlyCaught: true,
        primaryOnlyFailure: true,
        primaryOnlyOrder: true,
        standaloneCaught: true,
        standaloneFailure: true,
        standaloneOrder: true,
        multipleCaught: true,
        aggregateContainsExactlyMultiple: true,
        multipleOrder: true,
        combinedCaught: true,
        aggregateContainsExactlyCombined: true,
        combinedOrder: true,
        successfulBothCaught: true,
        successfulBothFailure: true,
        successfulBothOrder: true,
        noneAcquiredCaught: true,
        noneAcquiredFailure: true,
        noneAcquiredOrder: true,
        outerAcquiredCaught: true,
        outerAcquiredFailure: true,
        outerAcquiredOrder: true,
        bothAcquiredCaught: true,
        bothAcquiredFailure: true,
        bothAcquiredOrder: true,
        hookFailedAfterAcquisitionCaught: true,
        hookFailedAfterAcquisitionFailure: true,
        hookFailedAfterAcquisitionOrder: true,
        undefinedStandaloneCaught: true,
        undefinedStandaloneFailure: true,
        undefinedStandaloneOrder: true,
        undefinedCombinedCaught: true,
        aggregateContainsExactlyUndefinedCombined: true,
        undefinedCombinedOrder: true,
      },
    );
    TestValidator.equals(
      "production-project test owns one reentrant namespace cleanup lifecycle",
      reentrantNamespaceCleanupContract(
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
                "reentrantAcquisitionFailure={error};",
                "throwerror;",
              ],
              catchVariables: ["error"],
              containerKind: "TryStatement",
              containerStatements: 240,
              failureHolder:
                "letreentrantAcquisitionFailure:|IProductionProjectFixtureFailure|undefined;",
              finallyDigest:
                "6ef48d21afe0aae6f2beec4bf2546e9362d439c4a7f7b3ea5aaee32a3e779e9e",
              finallyStatements: 4,
              finallySubstantive: {
                digest:
                  "af696ad64a4e425fab3cceb08aee699f6bbf8dc89b2c52cb78e635f2a427be79",
                tokens: 142,
              },
              index: 88,
              substantive: {
                digest:
                  "5d087ab79e251353a1af7358b3a63909c44b2486864bbce57e7445784eb3b832",
                tokens: 14,
              },
              tryDigest:
                "e96e4edb5ff8882df61b4f0553cc8f54161e87a36f743cb15e419ac3dc189c39",
              tryStatements: 2,
            },
          ],
          statementCounts: [23],
        },
        parseDiagnostics: [],
      },
    );
  };
