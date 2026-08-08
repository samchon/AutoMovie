import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";
import { preserveProductionProjectFixtureCleanup } from "./test_mcp_production_project";

const compact = (node: ts.Node, source: ts.SourceFile): string =>
  node.getText(source).replace(/\s+/g, "");

const digest = (node: ts.Node, source: ts.SourceFile): string =>
  createHash("sha256").update(node.getText(source)).digest("hex");

const aggregateContainsExactly = (
  error: unknown,
  expected: readonly unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

/**
 * The atomic-recovery harness lifecycle that owns three restorations at one
 * boundary: the rename hook, the remove hook, and the flag that keeps the two
 * consistent.
 *
 * The selection is a multi-resource protected cleanup whose every resource is
 * an `atomic` one, because this file owns a dozen other protected lifecycles
 * that belong to their own contracts. A later harness change that splits,
 * extends, or renames this lifecycle moves the count or the labels rather than
 * passing unnoticed.
 */
export const productionProjectMultiResourceContract = (
  text: string,
): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_project.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const lifecycles: Array<{
    catchBodies: string[];
    containerStatements: number;
    index: number;
    labels: string[];
    primaryArgument: string;
    resources: string[];
    tryDigest: string;
  }> = [];
  const hookRestorations = (block: ts.Block): ts.ArrayLiteralExpression[] => {
    if (block.statements.length !== 1) return [];
    const statement = block.statements[0];
    if (
      statement === undefined ||
      ts.isExpressionStatement(statement) === false ||
      ts.isCallExpression(statement.expression) === false ||
      ts.isIdentifier(statement.expression.expression) === false ||
      statement.expression.expression.text !==
        "preserveProductionProjectFixtureCleanup" ||
      statement.expression.arguments.length !== 2
    )
      return [];
    const resources = statement.expression.arguments[1];
    if (
      resources === undefined ||
      ts.isArrayLiteralExpression(resources) === false ||
      // A spread element is a conditional resource, which belongs to the outer
      // fixture lifecycles rather than to this one.
      resources.elements.some((element) => ts.isSpreadElement(element)) ||
      resources.elements.length < 2
    )
      return [];
    // This file owns many protected lifecycles; the atomic-recovery harness is
    // the one this contract governs, and it names every resource it owns.
    return resources.elements.every((element) =>
      /resource:"atomic/u.test(compact(element, source)),
    )
      ? [resources]
      : [];
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isTryStatement(node) &&
      node.catchClause !== undefined &&
      node.finallyBlock !== undefined &&
      ts.isBlock(node.parent)
    ) {
      const [resources] = hookRestorations(node.finallyBlock);
      if (resources !== undefined) {
        const statements = [...node.parent.statements];
        const call = (node.finallyBlock.statements[0] as ts.ExpressionStatement)
          .expression as ts.CallExpression;
        lifecycles.push({
          catchBodies: node.catchClause.block.statements.map((statement) =>
            compact(statement, source),
          ),
          containerStatements: statements.length,
          index: statements.indexOf(node),
          labels: resources.elements.flatMap((element) => {
            const found = /resource:"([^"]+)"/u.exec(compact(element, source));
            return found === null ? [] : [found[1]!];
          }),
          primaryArgument: compact(call.arguments[0]!, source),
          resources: resources.elements.map((element) =>
            compact(element, source),
          ),
          tryDigest: digest(node.tryBlock, source),
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return {
    count: lifecycles.length,
    lifecycles,
    // The three restorations of this lifecycle may never run as bare
    // statements in a `finally` again.
    rawFinalizers: [
      ...text.matchAll(
        /finally\s*\{\s*(?:fs\.renameSync\s*=|Reflect\.set\(\s*fs,\s*"rmSync"|hooksInstalled\s*=)/gu,
      ),
    ].length,
  };
};

const captureCleanup = (props: {
  cleanupFailures?: readonly ({ error: unknown; present: true } | undefined)[];
  primaryFailure?: { error: unknown; present: true };
  resources?: number;
}): { caught: boolean; failure: unknown; order: string[] } => {
  let caught = false;
  const order: string[] = [];
  let failure: unknown;
  try {
    preserveProductionProjectFixtureCleanup(
      props.primaryFailure === undefined
        ? undefined
        : { error: props.primaryFailure.error },
      Array.from({ length: props.resources ?? 3 }, (_, index) => ({
        resource: `resource-${index}`,
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

export const test_mcp_production_project_combined_recovery_cleanup =
  (): void => {
    const firstFailure = { phase: "rename hook restoration" };
    const lastFailure = { phase: "installation flag reset" };
    const success = captureCleanup({});
    const leading = captureCleanup({
      cleanupFailures: [{ error: firstFailure, present: true }],
    });
    const both = captureCleanup({
      cleanupFailures: [
        { error: firstFailure, present: true },
        undefined,
        { error: lastFailure, present: true },
      ],
    });
    TestValidator.equals(
      "a failed restoration never skips the rest of the lifecycle",
      namedFacts([
        ["successCaught", () => success.caught === false],
        [
          "successOrderJoin",
          () =>
            success.caught === false &&
            success.order.join(",") === "cleanup-0,cleanup-1,cleanup-2",
        ],
        ["leadingCaught", () => leading.caught],
        ["leadingFailureFirstFailure", () => leading.failure === firstFailure],
        [
          "leadingOrderJoin",
          () => leading.order.join(",") === "cleanup-0,cleanup-1,cleanup-2",
        ],
        ["bothCaught", () => both.caught],
        [
          "aggregateContainsExactlyBothFailure",
          () =>
            aggregateContainsExactly(both.failure, [firstFailure, lastFailure]),
        ],
        [
          "bothOrderJoin",
          () =>
            success.caught === false &&
            success.order.join(",") === "cleanup-0,cleanup-1,cleanup-2" &&
            leading.caught &&
            leading.failure === firstFailure &&
            leading.order.join(",") === "cleanup-0,cleanup-1,cleanup-2" &&
            both.caught &&
            aggregateContainsExactly(both.failure, [
              firstFailure,
              lastFailure,
            ]) &&
            both.order.join(",") === "cleanup-0,cleanup-1,cleanup-2",
        ],
      ]),
      {
        successCaught: true,
        successOrderJoin: true,
        leadingCaught: true,
        leadingFailureFirstFailure: true,
        leadingOrderJoin: true,
        bothCaught: true,
        aggregateContainsExactlyBothFailure: true,
        bothOrderJoin: true,
      },
    );
    TestValidator.equals(
      "the atomic-recovery harness restores every hook through the policy",
      productionProjectMultiResourceContract(
        fs.readFileSync(
          path.join(__dirname, "test_mcp_production_project.ts"),
          "utf8",
        ),
      ),
      CONTRACT,
    );
  };

const CONTRACT = {
  count: 1,
  lifecycles: [
    {
      catchBodies: ["caught=error;"],
      containerStatements: 21,
      index: 18,
      labels: [
        "atomicrenamehook",
        "atomicremovehook",
        "atomichookinstallationflag",
      ],
      primaryArgument: "undefined",
      resources: [
        '{resource:"atomicrenamehook",cleanup:()=>{fs.renameSync=nativeRename;},}',
        '{resource:"atomicremovehook",cleanup:()=>{Reflect.set(fs,"rmSync",nativeRemove);},}',
        '{resource:"atomichookinstallationflag",cleanup:()=>{hooksInstalled=false;},}',
      ],
      tryDigest:
        "a579901d4eca07fe0471d8d012c80856e3989a8f190d31a2b933eb99e7c32ac7",
    },
  ],
  rawFinalizers: 0,
};
