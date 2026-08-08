import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";
import { preserveLegacyImportFixtureCleanup } from "./test_mcp_production_legacy_import";

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
 * Every legacy-import lifecycle whose protected cleanup releases exactly one
 * resident-lock retry token.
 *
 * A lifecycle carrying more than one resource belongs to its own issue, so the
 * selection is the single-resource shape itself rather than a name list.
 */
export const legacyImportRetryTokenContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_legacy_import.ts",
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
        "preserveLegacyImportFixtureCleanup" ||
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
    return /^\{resource:"[^"]+",cleanup:\(\)=>releaseCommitLock\([A-Za-z_$][\w$]*,[A-Za-z_$][\w$]*\),\}$/u.test(
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
          .slice(Math.max(0, index - 2), index)
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
    // Nothing of this shape may be left running as a raw call in `finally`.
    rawFinalizers: [
      ...text.matchAll(
        /finally\s*\{\s*releaseCommitLock\(([A-Za-z_$][\w$]*),/gu,
      ),
    ].map((found) => found[1]!),
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
    preserveLegacyImportFixtureCleanup(
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

export const test_mcp_production_legacy_import_retry_token_cleanup =
  (): void => {
    const primaryFailure = { phase: "legacy-import regression" };
    const releaseFailure = { phase: "legacy retry-token release" };
    const success = captureCleanup({});
    const primaryOnly = captureCleanup({
      primaryFailure: { error: primaryFailure, present: true },
    });
    const standalone = captureCleanup({
      cleanupFailures: [{ error: releaseFailure, present: true }],
    });
    const combined = captureCleanup({
      cleanupFailures: [{ error: releaseFailure, present: true }],
      primaryFailure: { error: primaryFailure, present: true },
    });
    const undefinedPrimary = captureCleanup({
      primaryFailure: { error: undefined, present: true },
    });
    TestValidator.equals(
      "single legacy-import release preserves the guarded failure first",
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
          "standaloneFailureReleaseFailure",
          () => standalone.failure === releaseFailure,
        ],
        [
          "standaloneOrderJoin",
          () => standalone.order.join(",") === "cleanup-0",
        ],
        ["combinedCaught", () => combined.caught],
        [
          "aggregateContainsExactlyCombinedFailure",
          () =>
            aggregateContainsExactly(combined.failure, [
              primaryFailure,
              releaseFailure,
            ]),
        ],
        ["combinedOrderJoin", () => combined.order.join(",") === "cleanup-0"],
        ["undefinedPrimaryCaught", () => undefinedPrimary.caught],
        [
          "undefinedPrimaryFailure",
          () => undefinedPrimary.failure === undefined,
        ],
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
        standaloneFailureReleaseFailure: true,
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
      "legacy-import regression protects every retry-token release",
      legacyImportRetryTokenContract(
        fs.readFileSync(
          path.join(__dirname, "test_mcp_production_legacy_import.ts"),
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
      catchBodies: ["residentLockFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 11,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(residentLockFailure,[{resource:"applyresident-lockretrytoken",cleanup:()=>releaseCommitLock(residentLock,retryToken),},]);',
      ],
      index: 10,
      prefixes: [
        "constretryToken=acquireCommitLock(residentLock);",
        "letresidentLockFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "43f7b25da3517b516689cde201d2f39484649b99ca98a25cc5882e277fb86146",
    },
    {
      catchBodies: ["residentLockFailure2={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 14,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(residentLockFailure2,[{resource:"rollbackresident-lockretrytoken",cleanup:()=>releaseCommitLock(residentLock,retryToken),},]);',
      ],
      index: 13,
      prefixes: [
        "constretryToken=acquireCommitLock(residentLock);",
        "letresidentLockFailure2:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "8c4117de59eb850bcb9361c753b0f5323c492389cafc656f6b18273c6d35a674",
    },
  ],
  rawFinalizers: [],
};
