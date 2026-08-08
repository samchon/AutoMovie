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
 * Every legacy-import lifecycle whose protected cleanup removes exactly one raw
 * temporary root.
 *
 * These roots come from `mkdtempSync` rather than `createLegacy()`, so they are
 * outside the fixture-disposal class and are selected by the removal itself.
 */
export const legacyImportTemporaryRootContract = (text: string): unknown => {
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
  const singleRemoval = (block: ts.Block): boolean => {
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
    return /^\{resource:"[^"]+",cleanup:\(\)=>fs\.rmSync\([A-Za-z_$][\w$]*,\{force:true,recursive:true\}\),\}$/u.test(
      compact(resources.elements[0]!, source),
    );
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isTryStatement(node) &&
      node.catchClause !== undefined &&
      node.finallyBlock !== undefined &&
      singleRemoval(node.finallyBlock) &&
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
    // No removal may be left running as a raw call in `finally`.
    rawRemovals: [
      ...text.matchAll(
        /finally\s*\{\s*fs\.rmSync\(([A-Za-z_$][\w$]*),[^}]*\}\);\s*\}/gu,
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

export const test_mcp_production_legacy_import_temporary_root_cleanup =
  (): void => {
    const primaryFailure = { phase: "legacy-import regression" };
    const removalFailure = { phase: "legacy temporary-root removal" };
    const success = captureCleanup({});
    const primaryOnly = captureCleanup({
      primaryFailure: { error: primaryFailure, present: true },
    });
    const standalone = captureCleanup({
      cleanupFailures: [{ error: removalFailure, present: true }],
    });
    const combined = captureCleanup({
      cleanupFailures: [{ error: removalFailure, present: true }],
      primaryFailure: { error: primaryFailure, present: true },
    });
    const undefinedPrimary = captureCleanup({
      primaryFailure: { error: undefined, present: true },
    });
    TestValidator.equals(
      "single legacy-import removal preserves the guarded failure first",
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
        [
          "primaryOnlyCaught",
          () =>
            success.caught === false &&
            success.failure === undefined &&
            success.order.join(",") === "cleanup-0" &&
            primaryOnly.caught,
        ],
        [
          "primaryOnlyFailurePrimaryFailure",
          () =>
            success.caught === false &&
            success.failure === undefined &&
            success.order.join(",") === "cleanup-0" &&
            primaryOnly.caught &&
            primaryOnly.failure === primaryFailure,
        ],
        [
          "primaryOnlyOrderJoin",
          () =>
            success.caught === false &&
            success.failure === undefined &&
            success.order.join(",") === "cleanup-0" &&
            primaryOnly.caught &&
            primaryOnly.failure === primaryFailure &&
            primaryOnly.order.join(",") === "cleanup-0",
        ],
        [
          "standaloneCaught",
          () =>
            success.caught === false &&
            success.failure === undefined &&
            success.order.join(",") === "cleanup-0" &&
            primaryOnly.caught &&
            primaryOnly.failure === primaryFailure &&
            primaryOnly.order.join(",") === "cleanup-0" &&
            standalone.caught,
        ],
        [
          "standaloneFailureRemovalFailure",
          () =>
            success.caught === false &&
            success.failure === undefined &&
            success.order.join(",") === "cleanup-0" &&
            primaryOnly.caught &&
            primaryOnly.failure === primaryFailure &&
            primaryOnly.order.join(",") === "cleanup-0" &&
            standalone.caught &&
            standalone.failure === removalFailure,
        ],
        [
          "standaloneOrderJoin",
          () =>
            success.caught === false &&
            success.failure === undefined &&
            success.order.join(",") === "cleanup-0" &&
            primaryOnly.caught &&
            primaryOnly.failure === primaryFailure &&
            primaryOnly.order.join(",") === "cleanup-0" &&
            standalone.caught &&
            standalone.failure === removalFailure &&
            standalone.order.join(",") === "cleanup-0",
        ],
        [
          "combinedCaught",
          () =>
            success.caught === false &&
            success.failure === undefined &&
            success.order.join(",") === "cleanup-0" &&
            primaryOnly.caught &&
            primaryOnly.failure === primaryFailure &&
            primaryOnly.order.join(",") === "cleanup-0" &&
            standalone.caught &&
            standalone.failure === removalFailure &&
            standalone.order.join(",") === "cleanup-0" &&
            combined.caught,
        ],
        [
          "aggregateContainsExactlyCombinedFailure",
          () =>
            success.caught === false &&
            success.failure === undefined &&
            success.order.join(",") === "cleanup-0" &&
            primaryOnly.caught &&
            primaryOnly.failure === primaryFailure &&
            primaryOnly.order.join(",") === "cleanup-0" &&
            standalone.caught &&
            standalone.failure === removalFailure &&
            standalone.order.join(",") === "cleanup-0" &&
            combined.caught &&
            aggregateContainsExactly(combined.failure, [
              primaryFailure,
              removalFailure,
            ]),
        ],
        [
          "combinedOrderJoin",
          () =>
            success.caught === false &&
            success.failure === undefined &&
            success.order.join(",") === "cleanup-0" &&
            primaryOnly.caught &&
            primaryOnly.failure === primaryFailure &&
            primaryOnly.order.join(",") === "cleanup-0" &&
            standalone.caught &&
            standalone.failure === removalFailure &&
            standalone.order.join(",") === "cleanup-0" &&
            combined.caught &&
            aggregateContainsExactly(combined.failure, [
              primaryFailure,
              removalFailure,
            ]) &&
            combined.order.join(",") === "cleanup-0",
        ],
        [
          "undefinedPrimaryCaught",
          () =>
            success.caught === false &&
            success.failure === undefined &&
            success.order.join(",") === "cleanup-0" &&
            primaryOnly.caught &&
            primaryOnly.failure === primaryFailure &&
            primaryOnly.order.join(",") === "cleanup-0" &&
            standalone.caught &&
            standalone.failure === removalFailure &&
            standalone.order.join(",") === "cleanup-0" &&
            combined.caught &&
            aggregateContainsExactly(combined.failure, [
              primaryFailure,
              removalFailure,
            ]) &&
            combined.order.join(",") === "cleanup-0" &&
            undefinedPrimary.caught,
        ],
        [
          "undefinedPrimaryFailure",
          () =>
            success.caught === false &&
            success.failure === undefined &&
            success.order.join(",") === "cleanup-0" &&
            primaryOnly.caught &&
            primaryOnly.failure === primaryFailure &&
            primaryOnly.order.join(",") === "cleanup-0" &&
            standalone.caught &&
            standalone.failure === removalFailure &&
            standalone.order.join(",") === "cleanup-0" &&
            combined.caught &&
            aggregateContainsExactly(combined.failure, [
              primaryFailure,
              removalFailure,
            ]) &&
            combined.order.join(",") === "cleanup-0" &&
            undefinedPrimary.caught &&
            undefinedPrimary.failure === undefined,
        ],
        [
          "undefinedPrimaryOrderJoin",
          () =>
            success.caught === false &&
            success.failure === undefined &&
            success.order.join(",") === "cleanup-0" &&
            primaryOnly.caught &&
            primaryOnly.failure === primaryFailure &&
            primaryOnly.order.join(",") === "cleanup-0" &&
            standalone.caught &&
            standalone.failure === removalFailure &&
            standalone.order.join(",") === "cleanup-0" &&
            combined.caught &&
            aggregateContainsExactly(combined.failure, [
              primaryFailure,
              removalFailure,
            ]) &&
            combined.order.join(",") === "cleanup-0" &&
            undefinedPrimary.caught &&
            undefinedPrimary.failure === undefined &&
            undefinedPrimary.order.join(",") === "cleanup-0",
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
        standaloneFailureRemovalFailure: true,
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
      "legacy-import regression protects every raw temporary-root removal",
      legacyImportTemporaryRootContract(
        fs.readFileSync(
          path.join(__dirname, "test_mcp_production_legacy_import.ts"),
          "utf8",
        ),
      ),
      CONTRACT,
    );
  };

const CONTRACT = {
  count: 3,
  duplicateLabels: [],
  lifecycles: [
    {
      catchBodies: ["emptyFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(emptyFailure,[{resource:"empty-projectdrafttemporaryroot",cleanup:()=>fs.rmSync(empty,{force:true,recursive:true}),},]);',
      ],
      index: 11,
      prefixes: [
        'constempty=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-empty-import-"),);',
        "letemptyFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "79e53b23f835ae508232d5e2fabc5749a0c53ba8275e1fbe57921b1178e2dc7c",
    },
    {
      catchBodies: ["missingAssetFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 145,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(missingAssetFailure,[{resource:"missing-assetdrafttemporaryroot",cleanup:()=>fs.rmSync(missingAsset,{force:true,recursive:true}),},]);',
      ],
      index: 14,
      prefixes: [
        'constmissingAsset=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-missing-asset-"),);',
        "letmissingAssetFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "92c8421f93e92b18dc78f391614d7aeb2a3a356445d9dc5bf753310423033d4d",
    },
    {
      catchBodies: ["rootFailure={error};", "throwerror;"],
      catchVariables: ["error"],
      containerStatements: 3,
      finallyBodies: [
        'preserveLegacyImportFixtureCleanup(rootFailure,[{resource:"unsafe-inventoryoutertemporaryroot",cleanup:()=>fs.rmSync(root,{force:true,recursive:true}),},]);',
      ],
      index: 2,
      prefixes: [
        'constroot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-bad-import-"),);',
        "letrootFailure:ILegacyImportFixtureFailure|undefined;",
      ],
      tryDigest:
        "c09b5e6d5cc1a4be52e8510a79be17090a169f4eb1fbe0bd63fca3d32a3b2a90",
    },
  ],
  rawRemovals: [],
};
