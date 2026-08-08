import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";
import { preserveProductionReviewHarnessCleanup } from "./test_mcp_production_review";

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
 * Every production-review lifecycle whose protected cleanup restores exactly
 * one resource: an injected project method, or the source bytes a race
 * mutated.
 *
 * The selection is the single-resource shape itself rather than a name list, so
 * a later harness change that adds a second owned resource to one of these
 * boundaries moves the count rather than passing unnoticed.
 */
export const productionReviewSingleResourceContract = (
  text: string,
): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_review.ts",
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
        "preserveProductionReviewHarnessCleanup" ||
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
    return /^\{resource:"[^"]+",cleanup:\(\)=>\{(?:project\.[A-Za-z]+=[A-Za-z_$][\w$]*|fs\.writeFileSync\([A-Za-z_$][\w$]*,[A-Za-z_$][\w$]*\));\},\}$/u.test(
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
        /finally\s*\{\s*(?:project\.readSource\s*=|fs\.writeFileSync\(\s*sourceFile)/gu,
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
    preserveProductionReviewHarnessCleanup(
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

export const test_mcp_production_review_single_resource_cleanup = (): void => {
  const primaryFailure = { phase: "production review regression" };
  const restorationFailure = { phase: "production review restoration" };
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
  TestValidator.equals(
    "a single review restoration preserves the guarded failure first",
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
          success.order.join(",") === "cleanup-0",
      ],
      ["primaryOnlyCaught", () => primaryOnly.caught],
      [
        "primaryOnlyFailurePrimaryFailure",
        () => primaryOnly.failure === primaryFailure,
      ],
      [
        "primaryOnlyOrderJoin",
        () => primaryOnly.order.join(",") === "cleanup-0",
      ],
      ["standaloneCaught", () => standalone.caught],
      [
        "standaloneFailureRestorationFailure",
        () => standalone.failure === restorationFailure,
      ],
      ["standaloneOrderJoin", () => standalone.order.join(",") === "cleanup-0"],
      ["combinedCaught", () => combined.caught],
      [
        "aggregateContainsExactlyCombinedFailure",
        () =>
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            restorationFailure,
          ]),
      ],
      ["combinedOrderJoin", () => combined.order.join(",") === "cleanup-0"],
      ["undefinedPrimaryCaught", () => undefinedPrimary.caught],
      ["undefinedPrimaryFailure", () => undefinedPrimary.failure === undefined],
      [
        "undefinedPrimaryOrderJoin",
        () => undefinedPrimary.order.join(",") === "cleanup-0",
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
      standaloneFailureRestorationFailure: true,
      standaloneOrderJoin: true,
      combinedCaught: true,
      aggregateContainsExactlyCombinedFailure: true,
      combinedOrderJoin: true,
      undefinedPrimaryCaught: true,
      undefinedPrimaryFailure: true,
      undefinedPrimaryOrderJoin: true,
    },
  );
  TestValidator.equals(
    "production review protects every single-resource restoration",
    productionReviewSingleResourceContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_production_review.ts"),
        "utf8",
      ),
    ),
    CONTRACT,
  );
};

const CONTRACT = {
  count: 2,
  duplicateLabels: [],
  lifecycles: [
    {
      catchBodies: ["shortenedSourceFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 355,
      finallyBodies: [
        'preserveProductionReviewHarnessCleanup(shortenedSourceFailure,[{resource:"shortenedsourcereadoverride",cleanup:()=>{project.readSource=residentReadSource;},},]);',
      ],
      index: 219,
      prefixes: [
        "letshortenedSourceFailure:IProductionReviewFixtureFailure|undefined;",
      ],
      tryDigest:
        "fefc8412001513663bfcc6b23406fc98cb9cb9e3f5e0eadd154e864628f8c2b0",
    },
    {
      catchBodies: ["racedSubmissionFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 355,
      finallyBodies: [
        'preserveProductionReviewHarnessCleanup(racedSubmissionFailure,[{resource:"racedsourcebytes",cleanup:()=>{fs.writeFileSync(sourceFile,sourceBeforeRace);},},]);',
      ],
      index: 229,
      prefixes: [
        "letracedSubmissionFailure:IProductionReviewFixtureFailure|undefined;",
      ],
      tryDigest:
        "a855bcb127a79404f5e7bc4aba42c221e38cfbedcc18d29c20d08f9bb73aaa03",
    },
  ],
  rawFinalizers: 0,
};
