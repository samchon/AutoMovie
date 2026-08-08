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

const countTryStatements = (node: ts.Node): number => {
  let count = 0;
  const visit = (cursor: ts.Node): void => {
    if (ts.isTryStatement(cursor)) ++count;
    ts.forEachChild(cursor, visit);
  };
  ts.forEachChild(node, visit);
  return count;
};

const aggregateContainsExactly = (
  error: unknown,
  expected: readonly unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

const atomicFailureHarnessContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_project.ts",
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
    (entry) => entry.name === "captureProductionAtomicFailure",
  );
  const lifecycles = owners.flatMap((owner) => {
    const body = owner.arrow.body;
    if (ts.isBlock(body) === false) return [];
    const lifecycle = body.statements[4];
    if (lifecycle === undefined || ts.isTryStatement(lifecycle) === false)
      return [];
    const substantive = [...lifecycle.tryBlock.statements].slice(2);
    return [
      {
        acquisition: compact(body.statements[3]!, source),
        bodyStatements: body.statements.length,
        catchBodies: (lifecycle.catchClause?.block.statements ?? []).map(
          (statement) => compact(statement, source),
        ),
        catchVariables:
          lifecycle.catchClause?.variableDeclaration === undefined
            ? []
            : [compact(lifecycle.catchClause.variableDeclaration, source)],
        finallyBodies: (lifecycle.finallyBlock?.statements ?? []).map(
          (statement) => compact(statement, source),
        ),
        index: 4,
        nestedTryStatements: countTryStatements(lifecycle.tryBlock),
        ownerParameters: owner.arrow.parameters.map((parameter) =>
          compact(parameter, source),
        ),
        prefixes: [...body.statements]
          .slice(0, 4)
          .map((statement) => compact(statement, source)),
        setup: [...lifecycle.tryBlock.statements]
          .slice(0, 2)
          .map((statement) => compact(statement, source)),
        substantive: {
          ...leafTokenContract(substantive, source),
          digest: digestText(
            substantive
              .map((statement) => statement.getText(source))
              .join("\n"),
          ),
          leafDigest: leafTokenContract(substantive, source).digest,
          statements: substantive.length,
        },
        tryDigest: digestText(lifecycle.tryBlock.getText(source)),
        tryStatements: lifecycle.tryBlock.statements.length,
      },
    ];
  });
  const policies = arrows.filter(
    (entry) => entry.name === "preserveProductionProjectFixtureCleanup",
  );
  return {
    owner: { count: owners.length, lifecycles },
    parseDiagnostics: (
      source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics.map((diagnostic) => String(diagnostic.messageText)),
    policy: {
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      bodyDigests: policies.map((entry) =>
        digestText(entry.arrow.body.getText(source)),
      ),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "ProductionProjectFixtureCleanupError"
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
  cleanupFailures?: readonly ({ error: unknown; present: true } | undefined)[];
  primaryFailure?: { error: unknown; present: true };
  resources?: number;
}): { caught: boolean; failure: unknown; order: number[] } => {
  let caught = false;
  let failure: unknown;
  const order: number[] = [];
  try {
    preserveProductionProjectFixtureCleanup(
      props.primaryFailure === undefined
        ? undefined
        : { error: props.primaryFailure.error },
      Array.from({ length: props.resources ?? 3 }, (_, index) => ({
        resource: `atomic-resource-${index}`,
        cleanup: (): void => {
          order.push(index);
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

export const test_mcp_production_atomic_failure_harness_cleanup = (): void => {
  const primaryFailure = { phase: "atomic harness primary" };
  const renameFailure = { phase: "rename hook restoration" };
  const removeFailure = { phase: "remove hook restoration" };
  const fixtureFailure = { phase: "atomic fixture disposal" };
  const nestedPrimaryFailure = new AggregateError(
    [{ phase: "atomic product cleanup" }],
    "Atomic product cleanup failed.",
  );
  const success = captureCleanup({});
  const partial = captureCleanup({
    primaryFailure: { error: primaryFailure, present: true },
    resources: 1,
  });
  const primaryOnly = captureCleanup({
    primaryFailure: { error: primaryFailure, present: true },
  });
  const standalone = captureCleanup({
    cleanupFailures: [undefined, { error: removeFailure, present: true }],
  });
  const multiple = captureCleanup({
    cleanupFailures: [
      { error: renameFailure, present: true },
      undefined,
      { error: fixtureFailure, present: true },
    ],
  });
  const combined = captureCleanup({
    cleanupFailures: [
      { error: renameFailure, present: true },
      undefined,
      { error: fixtureFailure, present: true },
    ],
    primaryFailure: { error: primaryFailure, present: true },
  });
  const nestedCombined = captureCleanup({
    cleanupFailures: [{ error: renameFailure, present: true }],
    primaryFailure: { error: nestedPrimaryFailure, present: true },
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
  TestValidator.equals(
    "atomic harness cleanup preserves acquisition and failure order",
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
          success.order.join(",") === "0,1,2",
      ],
      [
        "partialCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "0,1,2" &&
          partial.caught,
      ],
      [
        "partialFailurePrimaryFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "0,1,2" &&
          partial.caught &&
          partial.failure === primaryFailure,
      ],
      [
        "partialOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "0,1,2" &&
          partial.caught &&
          partial.failure === primaryFailure &&
          partial.order.join(",") === "0",
      ],
      [
        "primaryOnlyCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "0,1,2" &&
          partial.caught &&
          partial.failure === primaryFailure &&
          partial.order.join(",") === "0" &&
          primaryOnly.caught,
      ],
      [
        "primaryOnlyFailurePrimaryFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "0,1,2" &&
          partial.caught &&
          partial.failure === primaryFailure &&
          partial.order.join(",") === "0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure,
      ],
      [
        "primaryOnlyOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "0,1,2" &&
          partial.caught &&
          partial.failure === primaryFailure &&
          partial.order.join(",") === "0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "0,1,2",
      ],
      [
        "standaloneCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "0,1,2" &&
          partial.caught &&
          partial.failure === primaryFailure &&
          partial.order.join(",") === "0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "0,1,2" &&
          standalone.caught,
      ],
      [
        "standaloneFailureRemoveFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "0,1,2" &&
          partial.caught &&
          partial.failure === primaryFailure &&
          partial.order.join(",") === "0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "0,1,2" &&
          standalone.caught &&
          standalone.failure === removeFailure,
      ],
      [
        "standaloneOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "0,1,2" &&
          partial.caught &&
          partial.failure === primaryFailure &&
          partial.order.join(",") === "0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "0,1,2" &&
          standalone.caught &&
          standalone.failure === removeFailure &&
          standalone.order.join(",") === "0,1,2",
      ],
      [
        "multipleCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "0,1,2" &&
          partial.caught &&
          partial.failure === primaryFailure &&
          partial.order.join(",") === "0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "0,1,2" &&
          standalone.caught &&
          standalone.failure === removeFailure &&
          standalone.order.join(",") === "0,1,2" &&
          multiple.caught,
      ],
      [
        "aggregateContainsExactlyMultipleFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "0,1,2" &&
          partial.caught &&
          partial.failure === primaryFailure &&
          partial.order.join(",") === "0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "0,1,2" &&
          standalone.caught &&
          standalone.failure === removeFailure &&
          standalone.order.join(",") === "0,1,2" &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            renameFailure,
            fixtureFailure,
          ]),
      ],
      [
        "multipleOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "0,1,2" &&
          partial.caught &&
          partial.failure === primaryFailure &&
          partial.order.join(",") === "0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "0,1,2" &&
          standalone.caught &&
          standalone.failure === removeFailure &&
          standalone.order.join(",") === "0,1,2" &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            renameFailure,
            fixtureFailure,
          ]) &&
          multiple.order.join(",") === "0,1,2",
      ],
      [
        "combinedCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "0,1,2" &&
          partial.caught &&
          partial.failure === primaryFailure &&
          partial.order.join(",") === "0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "0,1,2" &&
          standalone.caught &&
          standalone.failure === removeFailure &&
          standalone.order.join(",") === "0,1,2" &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            renameFailure,
            fixtureFailure,
          ]) &&
          multiple.order.join(",") === "0,1,2" &&
          combined.caught,
      ],
      [
        "aggregateContainsExactlyCombinedFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "0,1,2" &&
          partial.caught &&
          partial.failure === primaryFailure &&
          partial.order.join(",") === "0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "0,1,2" &&
          standalone.caught &&
          standalone.failure === removeFailure &&
          standalone.order.join(",") === "0,1,2" &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            renameFailure,
            fixtureFailure,
          ]) &&
          multiple.order.join(",") === "0,1,2" &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            renameFailure,
            fixtureFailure,
          ]),
      ],
      [
        "combinedOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "0,1,2" &&
          partial.caught &&
          partial.failure === primaryFailure &&
          partial.order.join(",") === "0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "0,1,2" &&
          standalone.caught &&
          standalone.failure === removeFailure &&
          standalone.order.join(",") === "0,1,2" &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            renameFailure,
            fixtureFailure,
          ]) &&
          multiple.order.join(",") === "0,1,2" &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            renameFailure,
            fixtureFailure,
          ]) &&
          combined.order.join(",") === "0,1,2",
      ],
      [
        "nestedCombinedCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "0,1,2" &&
          partial.caught &&
          partial.failure === primaryFailure &&
          partial.order.join(",") === "0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "0,1,2" &&
          standalone.caught &&
          standalone.failure === removeFailure &&
          standalone.order.join(",") === "0,1,2" &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            renameFailure,
            fixtureFailure,
          ]) &&
          multiple.order.join(",") === "0,1,2" &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            renameFailure,
            fixtureFailure,
          ]) &&
          combined.order.join(",") === "0,1,2" &&
          nestedCombined.caught,
      ],
      [
        "aggregateContainsExactlyNestedCombinedFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "0,1,2" &&
          partial.caught &&
          partial.failure === primaryFailure &&
          partial.order.join(",") === "0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "0,1,2" &&
          standalone.caught &&
          standalone.failure === removeFailure &&
          standalone.order.join(",") === "0,1,2" &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            renameFailure,
            fixtureFailure,
          ]) &&
          multiple.order.join(",") === "0,1,2" &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            renameFailure,
            fixtureFailure,
          ]) &&
          combined.order.join(",") === "0,1,2" &&
          nestedCombined.caught &&
          aggregateContainsExactly(nestedCombined.failure, [
            nestedPrimaryFailure,
            renameFailure,
          ]),
      ],
      [
        "nestedCombinedOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "0,1,2" &&
          partial.caught &&
          partial.failure === primaryFailure &&
          partial.order.join(",") === "0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "0,1,2" &&
          standalone.caught &&
          standalone.failure === removeFailure &&
          standalone.order.join(",") === "0,1,2" &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            renameFailure,
            fixtureFailure,
          ]) &&
          multiple.order.join(",") === "0,1,2" &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            renameFailure,
            fixtureFailure,
          ]) &&
          combined.order.join(",") === "0,1,2" &&
          nestedCombined.caught &&
          aggregateContainsExactly(nestedCombined.failure, [
            nestedPrimaryFailure,
            renameFailure,
          ]) &&
          nestedCombined.order.join(",") === "0,1,2",
      ],
      [
        "undefinedPrimaryCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "0,1,2" &&
          partial.caught &&
          partial.failure === primaryFailure &&
          partial.order.join(",") === "0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "0,1,2" &&
          standalone.caught &&
          standalone.failure === removeFailure &&
          standalone.order.join(",") === "0,1,2" &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            renameFailure,
            fixtureFailure,
          ]) &&
          multiple.order.join(",") === "0,1,2" &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            renameFailure,
            fixtureFailure,
          ]) &&
          combined.order.join(",") === "0,1,2" &&
          nestedCombined.caught &&
          aggregateContainsExactly(nestedCombined.failure, [
            nestedPrimaryFailure,
            renameFailure,
          ]) &&
          nestedCombined.order.join(",") === "0,1,2" &&
          undefinedPrimary.caught,
      ],
      [
        "undefinedPrimaryFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "0,1,2" &&
          partial.caught &&
          partial.failure === primaryFailure &&
          partial.order.join(",") === "0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "0,1,2" &&
          standalone.caught &&
          standalone.failure === removeFailure &&
          standalone.order.join(",") === "0,1,2" &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            renameFailure,
            fixtureFailure,
          ]) &&
          multiple.order.join(",") === "0,1,2" &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            renameFailure,
            fixtureFailure,
          ]) &&
          combined.order.join(",") === "0,1,2" &&
          nestedCombined.caught &&
          aggregateContainsExactly(nestedCombined.failure, [
            nestedPrimaryFailure,
            renameFailure,
          ]) &&
          nestedCombined.order.join(",") === "0,1,2" &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined,
      ],
      [
        "undefinedPrimaryOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "0,1,2" &&
          partial.caught &&
          partial.failure === primaryFailure &&
          partial.order.join(",") === "0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "0,1,2" &&
          standalone.caught &&
          standalone.failure === removeFailure &&
          standalone.order.join(",") === "0,1,2" &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            renameFailure,
            fixtureFailure,
          ]) &&
          multiple.order.join(",") === "0,1,2" &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            renameFailure,
            fixtureFailure,
          ]) &&
          combined.order.join(",") === "0,1,2" &&
          nestedCombined.caught &&
          aggregateContainsExactly(nestedCombined.failure, [
            nestedPrimaryFailure,
            renameFailure,
          ]) &&
          nestedCombined.order.join(",") === "0,1,2" &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined &&
          undefinedPrimary.order.join(",") === "0,1,2",
      ],
      [
        "undefinedStandaloneCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "0,1,2" &&
          partial.caught &&
          partial.failure === primaryFailure &&
          partial.order.join(",") === "0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "0,1,2" &&
          standalone.caught &&
          standalone.failure === removeFailure &&
          standalone.order.join(",") === "0,1,2" &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            renameFailure,
            fixtureFailure,
          ]) &&
          multiple.order.join(",") === "0,1,2" &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            renameFailure,
            fixtureFailure,
          ]) &&
          combined.order.join(",") === "0,1,2" &&
          nestedCombined.caught &&
          aggregateContainsExactly(nestedCombined.failure, [
            nestedPrimaryFailure,
            renameFailure,
          ]) &&
          nestedCombined.order.join(",") === "0,1,2" &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined &&
          undefinedPrimary.order.join(",") === "0,1,2" &&
          undefinedStandalone.caught,
      ],
      [
        "undefinedStandaloneFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "0,1,2" &&
          partial.caught &&
          partial.failure === primaryFailure &&
          partial.order.join(",") === "0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "0,1,2" &&
          standalone.caught &&
          standalone.failure === removeFailure &&
          standalone.order.join(",") === "0,1,2" &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            renameFailure,
            fixtureFailure,
          ]) &&
          multiple.order.join(",") === "0,1,2" &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            renameFailure,
            fixtureFailure,
          ]) &&
          combined.order.join(",") === "0,1,2" &&
          nestedCombined.caught &&
          aggregateContainsExactly(nestedCombined.failure, [
            nestedPrimaryFailure,
            renameFailure,
          ]) &&
          nestedCombined.order.join(",") === "0,1,2" &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined &&
          undefinedPrimary.order.join(",") === "0,1,2" &&
          undefinedStandalone.caught &&
          undefinedStandalone.failure === undefined,
      ],
      [
        "undefinedStandaloneOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "0,1,2" &&
          partial.caught &&
          partial.failure === primaryFailure &&
          partial.order.join(",") === "0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "0,1,2" &&
          standalone.caught &&
          standalone.failure === removeFailure &&
          standalone.order.join(",") === "0,1,2" &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            renameFailure,
            fixtureFailure,
          ]) &&
          multiple.order.join(",") === "0,1,2" &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            renameFailure,
            fixtureFailure,
          ]) &&
          combined.order.join(",") === "0,1,2" &&
          nestedCombined.caught &&
          aggregateContainsExactly(nestedCombined.failure, [
            nestedPrimaryFailure,
            renameFailure,
          ]) &&
          nestedCombined.order.join(",") === "0,1,2" &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined &&
          undefinedPrimary.order.join(",") === "0,1,2" &&
          undefinedStandalone.caught &&
          undefinedStandalone.failure === undefined &&
          undefinedStandalone.order.join(",") === "0,1,2",
      ],
      [
        "undefinedCombinedCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "0,1,2" &&
          partial.caught &&
          partial.failure === primaryFailure &&
          partial.order.join(",") === "0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "0,1,2" &&
          standalone.caught &&
          standalone.failure === removeFailure &&
          standalone.order.join(",") === "0,1,2" &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            renameFailure,
            fixtureFailure,
          ]) &&
          multiple.order.join(",") === "0,1,2" &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            renameFailure,
            fixtureFailure,
          ]) &&
          combined.order.join(",") === "0,1,2" &&
          nestedCombined.caught &&
          aggregateContainsExactly(nestedCombined.failure, [
            nestedPrimaryFailure,
            renameFailure,
          ]) &&
          nestedCombined.order.join(",") === "0,1,2" &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined &&
          undefinedPrimary.order.join(",") === "0,1,2" &&
          undefinedStandalone.caught &&
          undefinedStandalone.failure === undefined &&
          undefinedStandalone.order.join(",") === "0,1,2" &&
          undefinedCombined.caught,
      ],
      [
        "aggregateContainsExactlyUndefinedCombinedFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === "0,1,2" &&
          partial.caught &&
          partial.failure === primaryFailure &&
          partial.order.join(",") === "0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "0,1,2" &&
          standalone.caught &&
          standalone.failure === removeFailure &&
          standalone.order.join(",") === "0,1,2" &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            renameFailure,
            fixtureFailure,
          ]) &&
          multiple.order.join(",") === "0,1,2" &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            renameFailure,
            fixtureFailure,
          ]) &&
          combined.order.join(",") === "0,1,2" &&
          nestedCombined.caught &&
          aggregateContainsExactly(nestedCombined.failure, [
            nestedPrimaryFailure,
            renameFailure,
          ]) &&
          nestedCombined.order.join(",") === "0,1,2" &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined &&
          undefinedPrimary.order.join(",") === "0,1,2" &&
          undefinedStandalone.caught &&
          undefinedStandalone.failure === undefined &&
          undefinedStandalone.order.join(",") === "0,1,2" &&
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
          success.order.join(",") === "0,1,2" &&
          partial.caught &&
          partial.failure === primaryFailure &&
          partial.order.join(",") === "0" &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === "0,1,2" &&
          standalone.caught &&
          standalone.failure === removeFailure &&
          standalone.order.join(",") === "0,1,2" &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            renameFailure,
            fixtureFailure,
          ]) &&
          multiple.order.join(",") === "0,1,2" &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            renameFailure,
            fixtureFailure,
          ]) &&
          combined.order.join(",") === "0,1,2" &&
          nestedCombined.caught &&
          aggregateContainsExactly(nestedCombined.failure, [
            nestedPrimaryFailure,
            renameFailure,
          ]) &&
          nestedCombined.order.join(",") === "0,1,2" &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined &&
          undefinedPrimary.order.join(",") === "0,1,2" &&
          undefinedStandalone.caught &&
          undefinedStandalone.failure === undefined &&
          undefinedStandalone.order.join(",") === "0,1,2" &&
          undefinedCombined.caught &&
          aggregateContainsExactly(undefinedCombined.failure, [
            undefined,
            undefined,
          ]) &&
          undefinedCombined.order.join(",") === "0,1,2",
      ],
    ]),
    {
      successCaught: true,
      successFailure: true,
      successOrderJoin: true,
      partialCaught: true,
      partialFailurePrimaryFailure: true,
      partialOrderJoin: true,
      primaryOnlyCaught: true,
      primaryOnlyFailurePrimaryFailure: true,
      primaryOnlyOrderJoin: true,
      standaloneCaught: true,
      standaloneFailureRemoveFailure: true,
      standaloneOrderJoin: true,
      multipleCaught: true,
      aggregateContainsExactlyMultipleFailure: true,
      multipleOrderJoin: true,
      combinedCaught: true,
      aggregateContainsExactlyCombinedFailure: true,
      combinedOrderJoin: true,
      nestedCombinedCaught: true,
      aggregateContainsExactlyNestedCombinedFailure: true,
      nestedCombinedOrderJoin: true,
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
    "atomic-failure harness owns hooks and fixture after handoff",
    atomicFailureHarnessContract(
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
            acquisition: "constfixture=productionFixture();",
            bodyStatements: 5,
            catchBodies: ["atomicHarnessFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            finallyBodies: [
              "constcompletedNativeHooks=nativeHooks;",
              'preserveProductionProjectFixtureCleanup(atomicHarnessFailure,[...(hooksInstalled&&completedNativeHooks!==undefined?[{resource:"atomicrenamehook",cleanup:():void=>{fs.renameSync=completedNativeHooks.rename;},},{resource:"atomicremovehook",cleanup:():void=>{Reflect.set(fs,"rmSync",completedNativeHooks.remove);},},]:[]),{resource:"atomicfailureproductionfixture",cleanup:()=>fixture.dispose(),},]);',
            ],
            index: 4,
            nestedTryStatements: 1,
            ownerParameters: ["mode:ProductionAtomicFailureMode"],
            prefixes: [
              "letnativeHooks:IProductionAtomicNativeHooks|undefined;",
              "lethooksInstalled=false;",
              "letatomicHarnessFailure:IProductionProjectFixtureFailure|undefined;",
              "constfixture=productionFixture();",
            ],
            setup: [
              "nativeHooks={remove:fs.rmSync,rename:fs.renameSync};",
              "const{remove:nativeRemove,rename:nativeRename}=nativeHooks;",
            ],
            substantive: {
              digest:
                "bbd38854323505aab169981cf15f2e090729b3beaa1a30d6192c3316e8c75726",
              leafDigest:
                "bd2c3c5b001793b9abd87e1b4d0d879e0ece4a8e0fff026e46dbb83011bed5e8",
              statements: 19,
              tokens: 660,
            },
            tryDigest:
              "3d7ebbe48cb6f333bf8bd2b956e69b84223ea16320642b62d548d90b80d35135",
            tryStatements: 21,
          },
        ],
      },
      parseDiagnostics: [],
      policy: {
        bodies: [
          "{constcleanupFailures:Array<{error:unknown;resource:string}>=[];for(constresourceofresources)try{resource.cleanup();}catch(error){cleanupFailures.push({error,resource:resource.resource});}if(cleanupFailures.length===1&&failure===undefined)throwcleanupFailures[0]!.error;if(cleanupFailures.length!==0)thrownewProductionProjectFixtureCleanupError([...(failure===undefined?[]:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`Production-projectfixturecleanupfailed$" +
            '{failure===undefined?"":"afterthetestfailed"}:$' +
            '{cleanupFailures.map((entry)=>entry.resource).join(",")}.`,);}',
        ],
        bodyDigests: [
          "374defeb06abf28a108b9729632296f834c0134aaad58c1582d7b43a20a9010a",
        ],
        classes: ["AggregateError"],
        parameters: [
          [
            "failure:IProductionProjectFixtureFailure|undefined",
            "resources:readonlyIProductionProjectFixtureCleanup[]",
          ],
        ],
      },
    },
  );
};
