import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";
import { preserveBenchmarkRunnerHookCleanup } from "./test_benchmark_runner";

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

const benchmarkRunnerHookCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_benchmark_runner.ts",
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
            ? [{ arrow: declaration.initializer, name: declaration.name.text }]
            : [],
        )
      : [],
  );
  const ownerNames = [
    "exerciseArchivePublicationSealRaces",
    "exerciseArchiveVerifierRecordRace",
    "exerciseArchiveShapeLinks",
  ] as const;
  const lifecycles: Array<{
    catchBodies: string[];
    catchVariables: string[];
    containerKind: string;
    containerStatements: number;
    failureHolder: string;
    finallyDigest: string;
    finallySubstantive: { digest: string; tokens: number };
    index: number;
    owner: string;
    substantive: { digest: string; tokens: number };
    tryBody: string;
    tryDigest: string;
  }> = [];
  for (const owner of arrows.filter((entry) =>
    ownerNames.some((name) => name === entry.name),
  )) {
    const visit = (node: ts.Node): void => {
      if (
        ts.isTryStatement(node) &&
        node.catchClause !== undefined &&
        node.finallyBlock !== undefined &&
        compact(node.finallyBlock, source).includes(
          "preserveBenchmarkRunnerHookCleanup(",
        ) &&
        ts.isBlock(node.parent)
      ) {
        const statements = [...node.parent.statements];
        const index = statements.indexOf(node);
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
          failureHolder: compact(statements[index - 1]!, source),
          finallyDigest: digestText(node.finallyBlock.getText(source)),
          finallySubstantive: leafTokenContract(
            node.finallyBlock.statements,
            source,
          ),
          index,
          owner: owner.name,
          substantive: leafTokenContract(node.tryBlock.statements, source),
          tryBody: compact(node.tryBlock, source),
          tryDigest: digestText(node.tryBlock.getText(source)),
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(owner.arrow.body);
  }
  const policies = arrows.filter(
    (entry) => entry.name === "preserveBenchmarkRunnerHookCleanup",
  );
  return {
    lifecycles,
    parseDiagnostics: (
      source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics.map((diagnostic) => String(diagnostic.messageText)),
    policy: {
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "BenchmarkRunnerHookCleanupError"
          ? (statement.heritageClauses ?? []).flatMap((clause) =>
              clause.types.map((type) => compact(type, source)),
            )
          : [],
      ),
      count: policies.length,
      parameters: policies.map((entry) =>
        entry.arrow.parameters.map((parameter) => compact(parameter, source)),
      ),
    },
  };
};

const captureCleanup = (props: {
  cleanupFailures?: readonly ({ error: unknown; present: true } | undefined)[];
  primaryFailure?: { error: unknown; present: true };
  resources?: number;
}): { caught: boolean; failure: unknown; message: string; order: string[] } => {
  let caught = false;
  let failure: unknown;
  let message = "";
  const order: string[] = [];
  let primaryState: { error: unknown } | undefined;
  try {
    try {
      if (props.primaryFailure !== undefined) throw props.primaryFailure.error;
    } catch (error) {
      primaryState = { error };
      throw error;
    } finally {
      preserveBenchmarkRunnerHookCleanup(
        primaryState,
        Array.from({ length: props.resources ?? 3 }, (_, index) => ({
          resource: `hook-${index}`,
          cleanup: (): void => {
            order.push(`cleanup-${index}`);
            const cleanupFailure = props.cleanupFailures?.[index];
            if (cleanupFailure !== undefined) throw cleanupFailure.error;
          },
        })),
      );
    }
  } catch (error) {
    caught = true;
    failure = error;
    if (error instanceof Error) message = error.message;
  }
  return { caught, failure, message, order };
};

export const test_benchmark_runner_hook_cleanup = (): void => {
  const primaryFailure = { phase: "benchmark" };
  const writeFailure = { phase: "write hook restoration" };
  const readFailure = { phase: "read hook restoration" };
  const cleanupFailures = [
    { error: writeFailure, present: true as const },
    undefined,
    { error: readFailure, present: true as const },
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
  const twoHooks = captureCleanup({
    cleanupFailures: [cleanupFailures[0]],
    primaryFailure: { error: primaryFailure, present: true },
    resources: 2,
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
  const fullOrder = "cleanup-0,cleanup-1,cleanup-2";
  TestValidator.equals(
    "benchmark runner hook cleanup preserves failure and restoration order",
    namedFacts([
      ["successCaught", () => success.caught === false],
      [
        "successFailure",
        () => success.caught === false && success.failure === undefined,
      ],
      [
        "successOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder,
      ],
      [
        "primaryOnlyCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught,
      ],
      [
        "primaryOnlyFailurePrimaryFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure,
      ],
      [
        "primaryOnlyOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder,
      ],
      [
        "standaloneCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught,
      ],
      [
        "standaloneFailureWriteFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === writeFailure,
      ],
      [
        "standaloneOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === writeFailure &&
          standalone.order.join(",") === fullOrder,
      ],
      [
        "multipleCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === writeFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught,
      ],
      [
        "aggregateContainsExactlyMultipleFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === writeFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            writeFailure,
            readFailure,
          ]),
      ],
      [
        "multipleMessageIncludes",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === writeFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            writeFailure,
            readFailure,
          ]) &&
          multiple.message.includes("hook-0"),
      ],
      [
        "multipleMessageIncludes2",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === writeFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            writeFailure,
            readFailure,
          ]) &&
          multiple.message.includes("hook-0") &&
          multiple.message.includes("hook-2"),
      ],
      [
        "multipleMessageIncludes3",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === writeFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            writeFailure,
            readFailure,
          ]) &&
          multiple.message.includes("hook-0") &&
          multiple.message.includes("hook-2") &&
          multiple.message.includes("hook-1") === false,
      ],
      [
        "multipleOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === writeFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            writeFailure,
            readFailure,
          ]) &&
          multiple.message.includes("hook-0") &&
          multiple.message.includes("hook-2") &&
          multiple.message.includes("hook-1") === false &&
          multiple.order.join(",") === fullOrder,
      ],
      [
        "combinedCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === writeFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            writeFailure,
            readFailure,
          ]) &&
          multiple.message.includes("hook-0") &&
          multiple.message.includes("hook-2") &&
          multiple.message.includes("hook-1") === false &&
          multiple.order.join(",") === fullOrder &&
          combined.caught,
      ],
      [
        "aggregateContainsExactlyCombinedFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === writeFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            writeFailure,
            readFailure,
          ]) &&
          multiple.message.includes("hook-0") &&
          multiple.message.includes("hook-2") &&
          multiple.message.includes("hook-1") === false &&
          multiple.order.join(",") === fullOrder &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            writeFailure,
            readFailure,
          ]),
      ],
      [
        "combinedOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === writeFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            writeFailure,
            readFailure,
          ]) &&
          multiple.message.includes("hook-0") &&
          multiple.message.includes("hook-2") &&
          multiple.message.includes("hook-1") === false &&
          multiple.order.join(",") === fullOrder &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            writeFailure,
            readFailure,
          ]) &&
          combined.order.join(",") === fullOrder,
      ],
      [
        "twoHooksCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === writeFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            writeFailure,
            readFailure,
          ]) &&
          multiple.message.includes("hook-0") &&
          multiple.message.includes("hook-2") &&
          multiple.message.includes("hook-1") === false &&
          multiple.order.join(",") === fullOrder &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            writeFailure,
            readFailure,
          ]) &&
          combined.order.join(",") === fullOrder &&
          twoHooks.caught,
      ],
      [
        "aggregateContainsExactlyTwoHooksFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === writeFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            writeFailure,
            readFailure,
          ]) &&
          multiple.message.includes("hook-0") &&
          multiple.message.includes("hook-2") &&
          multiple.message.includes("hook-1") === false &&
          multiple.order.join(",") === fullOrder &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            writeFailure,
            readFailure,
          ]) &&
          combined.order.join(",") === fullOrder &&
          twoHooks.caught &&
          aggregateContainsExactly(twoHooks.failure, [
            primaryFailure,
            writeFailure,
          ]),
      ],
      [
        "twoHooksOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === writeFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            writeFailure,
            readFailure,
          ]) &&
          multiple.message.includes("hook-0") &&
          multiple.message.includes("hook-2") &&
          multiple.message.includes("hook-1") === false &&
          multiple.order.join(",") === fullOrder &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            writeFailure,
            readFailure,
          ]) &&
          combined.order.join(",") === fullOrder &&
          twoHooks.caught &&
          aggregateContainsExactly(twoHooks.failure, [
            primaryFailure,
            writeFailure,
          ]) &&
          twoHooks.order.join(",") === "cleanup-0,cleanup-1",
      ],
      [
        "undefinedPrimaryCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === writeFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            writeFailure,
            readFailure,
          ]) &&
          multiple.message.includes("hook-0") &&
          multiple.message.includes("hook-2") &&
          multiple.message.includes("hook-1") === false &&
          multiple.order.join(",") === fullOrder &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            writeFailure,
            readFailure,
          ]) &&
          combined.order.join(",") === fullOrder &&
          twoHooks.caught &&
          aggregateContainsExactly(twoHooks.failure, [
            primaryFailure,
            writeFailure,
          ]) &&
          twoHooks.order.join(",") === "cleanup-0,cleanup-1" &&
          undefinedPrimary.caught,
      ],
      [
        "undefinedPrimaryFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === writeFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            writeFailure,
            readFailure,
          ]) &&
          multiple.message.includes("hook-0") &&
          multiple.message.includes("hook-2") &&
          multiple.message.includes("hook-1") === false &&
          multiple.order.join(",") === fullOrder &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            writeFailure,
            readFailure,
          ]) &&
          combined.order.join(",") === fullOrder &&
          twoHooks.caught &&
          aggregateContainsExactly(twoHooks.failure, [
            primaryFailure,
            writeFailure,
          ]) &&
          twoHooks.order.join(",") === "cleanup-0,cleanup-1" &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined,
      ],
      [
        "undefinedPrimaryOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === writeFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            writeFailure,
            readFailure,
          ]) &&
          multiple.message.includes("hook-0") &&
          multiple.message.includes("hook-2") &&
          multiple.message.includes("hook-1") === false &&
          multiple.order.join(",") === fullOrder &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            writeFailure,
            readFailure,
          ]) &&
          combined.order.join(",") === fullOrder &&
          twoHooks.caught &&
          aggregateContainsExactly(twoHooks.failure, [
            primaryFailure,
            writeFailure,
          ]) &&
          twoHooks.order.join(",") === "cleanup-0,cleanup-1" &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined &&
          undefinedPrimary.order.join(",") === fullOrder,
      ],
      [
        "undefinedStandaloneCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === writeFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            writeFailure,
            readFailure,
          ]) &&
          multiple.message.includes("hook-0") &&
          multiple.message.includes("hook-2") &&
          multiple.message.includes("hook-1") === false &&
          multiple.order.join(",") === fullOrder &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            writeFailure,
            readFailure,
          ]) &&
          combined.order.join(",") === fullOrder &&
          twoHooks.caught &&
          aggregateContainsExactly(twoHooks.failure, [
            primaryFailure,
            writeFailure,
          ]) &&
          twoHooks.order.join(",") === "cleanup-0,cleanup-1" &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined &&
          undefinedPrimary.order.join(",") === fullOrder &&
          undefinedStandalone.caught,
      ],
      [
        "undefinedStandaloneFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === writeFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            writeFailure,
            readFailure,
          ]) &&
          multiple.message.includes("hook-0") &&
          multiple.message.includes("hook-2") &&
          multiple.message.includes("hook-1") === false &&
          multiple.order.join(",") === fullOrder &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            writeFailure,
            readFailure,
          ]) &&
          combined.order.join(",") === fullOrder &&
          twoHooks.caught &&
          aggregateContainsExactly(twoHooks.failure, [
            primaryFailure,
            writeFailure,
          ]) &&
          twoHooks.order.join(",") === "cleanup-0,cleanup-1" &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined &&
          undefinedPrimary.order.join(",") === fullOrder &&
          undefinedStandalone.caught &&
          undefinedStandalone.failure === undefined,
      ],
      [
        "undefinedStandaloneOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === writeFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            writeFailure,
            readFailure,
          ]) &&
          multiple.message.includes("hook-0") &&
          multiple.message.includes("hook-2") &&
          multiple.message.includes("hook-1") === false &&
          multiple.order.join(",") === fullOrder &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            writeFailure,
            readFailure,
          ]) &&
          combined.order.join(",") === fullOrder &&
          twoHooks.caught &&
          aggregateContainsExactly(twoHooks.failure, [
            primaryFailure,
            writeFailure,
          ]) &&
          twoHooks.order.join(",") === "cleanup-0,cleanup-1" &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined &&
          undefinedPrimary.order.join(",") === fullOrder &&
          undefinedStandalone.caught &&
          undefinedStandalone.failure === undefined &&
          undefinedStandalone.order.join(",") === fullOrder,
      ],
      [
        "undefinedCombinedCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === writeFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            writeFailure,
            readFailure,
          ]) &&
          multiple.message.includes("hook-0") &&
          multiple.message.includes("hook-2") &&
          multiple.message.includes("hook-1") === false &&
          multiple.order.join(",") === fullOrder &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            writeFailure,
            readFailure,
          ]) &&
          combined.order.join(",") === fullOrder &&
          twoHooks.caught &&
          aggregateContainsExactly(twoHooks.failure, [
            primaryFailure,
            writeFailure,
          ]) &&
          twoHooks.order.join(",") === "cleanup-0,cleanup-1" &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined &&
          undefinedPrimary.order.join(",") === fullOrder &&
          undefinedStandalone.caught &&
          undefinedStandalone.failure === undefined &&
          undefinedStandalone.order.join(",") === fullOrder &&
          undefinedCombined.caught,
      ],
      [
        "aggregateContainsExactlyUndefinedCombinedFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === writeFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            writeFailure,
            readFailure,
          ]) &&
          multiple.message.includes("hook-0") &&
          multiple.message.includes("hook-2") &&
          multiple.message.includes("hook-1") === false &&
          multiple.order.join(",") === fullOrder &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            writeFailure,
            readFailure,
          ]) &&
          combined.order.join(",") === fullOrder &&
          twoHooks.caught &&
          aggregateContainsExactly(twoHooks.failure, [
            primaryFailure,
            writeFailure,
          ]) &&
          twoHooks.order.join(",") === "cleanup-0,cleanup-1" &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined &&
          undefinedPrimary.order.join(",") === fullOrder &&
          undefinedStandalone.caught &&
          undefinedStandalone.failure === undefined &&
          undefinedStandalone.order.join(",") === fullOrder &&
          undefinedCombined.caught &&
          aggregateContainsExactly(undefinedCombined.failure, [
            undefined,
            undefined,
          ]),
      ],
      [
        "undefinedCombinedOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === writeFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            writeFailure,
            readFailure,
          ]) &&
          multiple.message.includes("hook-0") &&
          multiple.message.includes("hook-2") &&
          multiple.message.includes("hook-1") === false &&
          multiple.order.join(",") === fullOrder &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            writeFailure,
            readFailure,
          ]) &&
          combined.order.join(",") === fullOrder &&
          twoHooks.caught &&
          aggregateContainsExactly(twoHooks.failure, [
            primaryFailure,
            writeFailure,
          ]) &&
          twoHooks.order.join(",") === "cleanup-0,cleanup-1" &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined &&
          undefinedPrimary.order.join(",") === fullOrder &&
          undefinedStandalone.caught &&
          undefinedStandalone.failure === undefined &&
          undefinedStandalone.order.join(",") === fullOrder &&
          undefinedCombined.caught &&
          aggregateContainsExactly(undefinedCombined.failure, [
            undefined,
            undefined,
          ]) &&
          undefinedCombined.order.join(",") === fullOrder,
      ],
    ]),
    {
      successCaught: true,
      successFailure: true,
      successOrderJoin: true,
      primaryOnlyCaught: true,
      primaryOnlyFailurePrimaryFailure: true,
      primaryOnlyOrderJoin: true,
      standaloneCaught: true,
      standaloneFailureWriteFailure: true,
      standaloneOrderJoin: true,
      multipleCaught: true,
      aggregateContainsExactlyMultipleFailure: true,
      multipleMessageIncludes: true,
      multipleMessageIncludes2: true,
      multipleMessageIncludes3: true,
      multipleOrderJoin: true,
      combinedCaught: true,
      aggregateContainsExactlyCombinedFailure: true,
      combinedOrderJoin: true,
      twoHooksCaught: true,
      aggregateContainsExactlyTwoHooksFailure: true,
      twoHooksOrderJoin: true,
      undefinedPrimaryCaught: true,
      undefinedPrimaryFailure: true,
      undefinedPrimaryOrderJoin: true,
      undefinedStandaloneCaught: true,
      undefinedStandaloneFailure: true,
      undefinedStandaloneOrderJoin: true,
      undefinedCombinedCaught: true,
      aggregateContainsExactlyUndefinedCombinedFailure: true,
      undefinedCombinedOrderJoin: true,
    },
  );
  TestValidator.equals(
    "benchmark runner owns three multi-hook archive lifecycles",
    benchmarkRunnerHookCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_benchmark_runner.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: ["archiveSealFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "ForOfStatement",
          containerStatements: 14,
          failureHolder:
            "letarchiveSealFailure:IBenchmarkRunnerFixtureFailure|undefined;",
          finallyDigest:
            "eccb912eca368b16090bbd624eca83ba38f779d161d138fb250c2db9a877c808",
          finallySubstantive: {
            digest:
              "152ac0e277ab3531a6012d37ec3ddce777fe8d1afc4db7337b4a84f357526bf4",
            tokens: 71,
          },
          index: 11,
          owner: "exerciseArchivePublicationSealRaces",
          substantive: {
            digest:
              "1f51faea90730746a189434b4057a72d363bd1edde3f79f8b59843a76dcdfe78",
            tokens: 20,
          },
          tryBody:
            "{message=awaitrejected(()=>runAutoMovieBenchmark({...base,campaign}),);}",
          tryDigest:
            "2818a403719df4e0516cf15d889b4d3f01230e382e9129a7c51c6ff5b177415d",
        },
        {
          catchBodies: ["archiveVerifierFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "ArrowFunction",
          containerStatements: 16,
          failureHolder:
            "letarchiveVerifierFailure:IBenchmarkRunnerFixtureFailure|undefined;",
          finallyDigest:
            "f213c265890050ec84c61b031990027fcba5bb32bef4f563cb3b2c4a3f3a451e",
          finallySubstantive: {
            digest:
              "f9601ba579b356a97e452a3a39ca87079c4bbc588c9920b457dcda2feac1b0ed",
            tokens: 50,
          },
          index: 13,
          owner: "exerciseArchiveVerifierRecordRace",
          substantive: {
            digest:
              "1f51faea90730746a189434b4057a72d363bd1edde3f79f8b59843a76dcdfe78",
            tokens: 20,
          },
          tryBody:
            "{message=awaitrejected(()=>runAutoMovieBenchmark({...base,campaign}),);}",
          tryDigest:
            "af4eaa7ca6b1543441a603e695a99566fa950c5388d223dd2ce73d064be3b482",
        },
        {
          catchBodies: ["archiveShapeFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "ForOfStatement",
          containerStatements: 14,
          failureHolder:
            "letarchiveShapeFailure:IBenchmarkRunnerFixtureFailure|undefined;",
          finallyDigest:
            "9ba2fe7dc644a25cb39e18b42ada0844c06f955dd7ac185e5e42d71b6dc41da0",
          finallySubstantive: {
            digest:
              "b01ce4bef0ecb8575d4bdf9c15e21b736cd3b7699c7f14dfa41ce3f6c0e90aec",
            tokens: 50,
          },
          index: 11,
          owner: "exerciseArchiveShapeLinks",
          substantive: {
            digest:
              "b1591479cedb4d9d2d5ffd135277f7db69c67cfde91c33741b6201de025eb48f",
            tokens: 38,
          },
          tryBody:
            '{if(phase==="stable")awaitrunAutoMovieBenchmark({...base,campaign});elsemessage=awaitrejected(()=>runAutoMovieBenchmark({...base,campaign}),);}',
          tryDigest:
            "cebbebf04fe65ab6f1a13910c4a229e4a40f8517567115787f383763b4c85dd2",
        },
      ],
      parseDiagnostics: [],
      policy: {
        bodies: [
          "{constcleanupFailures:Array<{error:unknown;resource:string}>=[];for(constresourceofresources)try{resource.cleanup();}catch(error){cleanupFailures.push({error,resource:resource.resource});}if(cleanupFailures.length===1&&failure===undefined)throwcleanupFailures[0]!.error;if(cleanupFailures.length!==0)thrownewBenchmarkRunnerHookCleanupError([...(failure===undefined?[]:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`Benchmarkrunnerhookcleanupfailed$" +
            '{failure===undefined?"":"afterthebenchmarkfailed"}:$' +
            '{cleanupFailures.map((entry)=>entry.resource).join(",")}.`,);}',
        ],
        classes: ["AggregateError"],
        count: 1,
        parameters: [
          [
            "failure:IBenchmarkRunnerFixtureFailure|undefined",
            "resources:readonlyIBenchmarkRunnerHookCleanup[]",
          ],
        ],
      },
    },
  );
};
