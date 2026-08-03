import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

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
    parseDiagnostics: source.parseDiagnostics.map((diagnostic) =>
      String(diagnostic.messageText),
    ),
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
    TestValidator.predicate(
      "reentrant namespace cleanup preserves failure and release order",
      success.caught === false &&
        success.failure === undefined &&
        success.order.join(",") === "cleanup-0,cleanup-1,cleanup-2" &&
        primaryOnly.caught &&
        primaryOnly.failure === primaryFailure &&
        primaryOnly.order.join(",") === "cleanup-0,cleanup-1,cleanup-2" &&
        standalone.caught &&
        standalone.failure === hookFailure &&
        standalone.order.join(",") === "cleanup-0,cleanup-1,cleanup-2" &&
        multiple.caught &&
        aggregateContainsExactly(multiple.failure, [
          hookFailure,
          innerFailure,
          outerFailure,
        ]) &&
        multiple.order.join(",") === "cleanup-0,cleanup-1,cleanup-2" &&
        combined.caught &&
        aggregateContainsExactly(combined.failure, [
          primaryFailure,
          hookFailure,
          innerFailure,
          outerFailure,
        ]) &&
        combined.order.join(",") === "cleanup-0,cleanup-1,cleanup-2" &&
        successfulBoth.caught === false &&
        successfulBoth.failure === undefined &&
        successfulBoth.order.join(",") === "hook,inner-check,outer-check" &&
        noneAcquired.caught &&
        noneAcquired.failure === primaryFailure &&
        noneAcquired.order.join(",") === "hook" &&
        outerAcquired.caught &&
        outerAcquired.failure === primaryFailure &&
        outerAcquired.order.join(",") === "hook,outer-check,outer-release" &&
        bothAcquired.caught &&
        bothAcquired.failure === primaryFailure &&
        bothAcquired.order.join(",") ===
          "hook,inner-check,inner-release,outer-check,outer-release" &&
        hookFailedAfterAcquisition.caught &&
        hookFailedAfterAcquisition.failure === hookFailure &&
        hookFailedAfterAcquisition.order.join(",") ===
          "hook,inner-check,inner-release,outer-check,outer-release" &&
        undefinedStandalone.caught &&
        undefinedStandalone.failure === undefined &&
        undefinedStandalone.order.join(",") ===
          "cleanup-0,cleanup-1,cleanup-2" &&
        undefinedCombined.caught &&
        aggregateContainsExactly(undefinedCombined.failure, [
          undefined,
          undefined,
        ]) &&
        undefinedCombined.order.join(",") === "cleanup-0,cleanup-1,cleanup-2",
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
              containerStatements: 215,
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
              index: 85,
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
