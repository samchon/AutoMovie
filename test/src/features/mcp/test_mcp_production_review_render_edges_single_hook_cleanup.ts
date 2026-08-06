import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveProductionReviewRenderHarnessCleanup } from "./test_mcp_production_review_render_edges";

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
 * Every review-render lifecycle whose protected cleanup restores exactly one
 * process-global filesystem hook.
 *
 * The selection is the single-resource shape itself rather than a name list, so
 * a later harness change that adds a second owned resource to one of these
 * boundaries moves the count rather than passing unnoticed.
 */
export const productionReviewRenderSingleHookContract = (
  text: string,
): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_review_render_edges.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const lifecycles: Array<{
    catchBodies: string[];
    catchVariables: string[];
    containerStatements: number;
    finallyBodies: string[];
    index: number;
    prefixes: string[];
    tryDigest: string;
  }> = [];
  const singleResource = (block: ts.Block): boolean => {
    if (block.statements.length !== 1) return false;
    const statement = block.statements[0];
    if (
      statement === undefined ||
      ts.isExpressionStatement(statement) === false ||
      ts.isCallExpression(statement.expression) === false ||
      ts.isIdentifier(statement.expression.expression) === false ||
      statement.expression.expression.text !==
        "preserveProductionReviewRenderHarnessCleanup" ||
      statement.expression.arguments.length !== 2
    )
      return false;
    const resources = statement.expression.arguments[1];
    if (
      resources === undefined ||
      ts.isArrayLiteralExpression(resources) === false ||
      resources.elements.length !== 1
    )
      return false;
    return /^\{resource:"[^"]+",cleanup:\(\)=>\{(?:fs\.[A-Za-z]+=[A-Za-z_$][\w$]*|Reflect\.set\(fs,"[A-Za-z]+",[A-Za-z_$][\w$]*\));\},\}$/u.test(
      compact(resources.elements[0]!, source),
    );
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isTryStatement(node) &&
      node.catchClause !== undefined &&
      node.finallyBlock !== undefined &&
      singleResource(node.finallyBlock) &&
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
        containerStatements: statements.length,
        finallyBodies: node.finallyBlock.statements.map((statement) =>
          compact(statement, source),
        ),
        index,
        prefixes: statements
          .slice(Math.max(0, index - 1), index)
          .map((statement) => compact(statement, source)),
        tryDigest: digest(node.tryBlock, source),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const labels = lifecycles.flatMap((lifecycle) =>
    lifecycle.finallyBodies.flatMap((body) => {
      const found = /resource:"([^"]+)"/u.exec(body);
      return found === null ? [] : [found[1]!];
    }),
  );
  return {
    count: lifecycles.length,
    // A label is how a cleanup failure names itself in the aggregate, so two
    // lifecycles sharing one would make the report ambiguous.
    duplicateLabels: labels.filter(
      (label, index) => labels.indexOf(label) !== index,
    ),
    lifecycles,
    // Nothing of this shape may be left running as a raw restoration whose
    // guarded body can propagate.
    rawFinalizers: [
      ...text.matchAll(
        /finally\s*\{\s*(?:fs\.[A-Za-z]+\s*=|Reflect\.set\(\s*fs,)/gu,
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
    preserveProductionReviewRenderHarnessCleanup(
      props.primaryFailure === undefined
        ? undefined
        : { error: props.primaryFailure.error },
      Array.from({ length: props.resources ?? 1 }, (_, index) => ({
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

export const test_mcp_production_review_render_edges_single_hook_cleanup =
  (): void => {
    const primaryFailure = { phase: "review render edge regression" };
    const restorationFailure = { phase: "review render edge restoration" };
    const success = captureCleanup({});
    const primaryOnly = captureCleanup({
      primaryFailure: { error: primaryFailure, present: true },
    });
    const standalone = captureCleanup({
      cleanupFailures: [{ error: restorationFailure, present: true }],
    });
    const combined = captureCleanup({
      cleanupFailures: [{ error: restorationFailure, present: true }],
      primaryFailure: { error: primaryFailure, present: true },
    });
    const undefinedPrimary = captureCleanup({
      primaryFailure: { error: undefined, present: true },
    });
    TestValidator.predicate(
      "a single review-render restoration preserves the guarded failure first",
      success.caught === false &&
        success.failure === undefined &&
        success.order.join(",") === "cleanup-0" &&
        primaryOnly.caught &&
        primaryOnly.failure === primaryFailure &&
        primaryOnly.order.join(",") === "cleanup-0" &&
        standalone.caught &&
        standalone.failure === restorationFailure &&
        standalone.order.join(",") === "cleanup-0" &&
        combined.caught &&
        aggregateContainsExactly(combined.failure, [
          primaryFailure,
          restorationFailure,
        ]) &&
        combined.order.join(",") === "cleanup-0" &&
        undefinedPrimary.caught &&
        undefinedPrimary.failure === undefined &&
        undefinedPrimary.order.join(",") === "cleanup-0",
    );
    TestValidator.equals(
      "review render edges protect every single-hook restoration",
      productionReviewRenderSingleHookContract(
        fs.readFileSync(
          path.join(__dirname, "test_mcp_production_review_render_edges.ts"),
          "utf8",
        ),
      ),
      CONTRACT,
    );
  };

const CONTRACT = {
  count: 1,
  duplicateLabels: [],
  lifecycles: [
    {
      catchBodies: ["disappearingManifestFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 170,
      finallyBodies: [
        'preserveProductionReviewRenderHarnessCleanup(disappearingManifestFailure,[{resource:"disappearingmanifestopenhook",cleanup:()=>{Reflect.set(fs,"openSync",stableOpenSync);},},],);',
      ],
      index: 144,
      prefixes: [
        "letdisappearingManifestFailure:|IProductionReviewRenderFixtureFailure|undefined;",
      ],
      tryDigest:
        "069dcb1909826b0df9c9cb92adcbd9e100c789dc9a77f219f62b84262606a799",
    },
  ],
  rawFinalizers: 0,
};
