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

const aggregateContainsExactly = (
  error: unknown,
  expected: readonly unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

const renderRollbackCleanupContract = (text: string): unknown => {
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
  const holderNames = [
    "rollbackTransientReadFailure",
    "renderRollbackFailure",
    "rollbackAggregateFailure",
  ] as const;
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
        if (holderNames.some((name) => failureHolder.startsWith(`let${name}:`)))
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
      Array.from({ length: props.resources ?? 4 }, (_, index) => ({
        resource: `render-rollback-${index}`,
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

export const test_mcp_production_project_render_rollback_cleanup = (): void => {
  const primaryFailure = { phase: "render rollback assertion" };
  const hookFailure = { phase: "render rollback hook restoration" };
  const activeFailure = { phase: "render rollback active baseline" };
  const parkedFailure = { phase: "render rollback parked baseline" };
  const manifestFailure = { phase: "render rollback manifest baseline" };
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
      { error: activeFailure, present: true },
      { error: parkedFailure, present: true },
      { error: manifestFailure, present: true },
    ],
  });
  const combined = captureCleanup({
    cleanupFailures: [
      { error: hookFailure, present: true },
      { error: activeFailure, present: true },
      { error: parkedFailure, present: true },
      { error: manifestFailure, present: true },
    ],
    primaryFailure: { error: primaryFailure, present: true },
  });
  const partialSetup = captureCleanup({
    primaryFailure: { error: primaryFailure, present: true },
    resources: 1,
  });
  const undefinedStandalone = captureCleanup({
    cleanupFailures: [{ error: undefined, present: true }],
  });
  const undefinedCombined = captureCleanup({
    cleanupFailures: [{ error: undefined, present: true }],
    primaryFailure: { error: undefined, present: true },
  });
  TestValidator.equals(
    "render rollback cleanup preserves failure and recovery order",
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
          success.order.join(",") === "cleanup-0,cleanup-1,cleanup-2,cleanup-3",
      ],
      ["primaryOnlyCaught", () => primaryOnly.caught],
      [
        "primaryOnlyFailurePrimaryFailure",
        () => primaryOnly.failure === primaryFailure,
      ],
      [
        "primaryOnlyOrderJoin",
        () =>
          primaryOnly.order.join(",") ===
          "cleanup-0,cleanup-1,cleanup-2,cleanup-3",
      ],
      ["standaloneCaught", () => standalone.caught],
      [
        "standaloneFailureHookFailure",
        () => standalone.failure === hookFailure,
      ],
      [
        "standaloneOrderJoin",
        () =>
          standalone.order.join(",") ===
          "cleanup-0,cleanup-1,cleanup-2,cleanup-3",
      ],
      ["multipleCaught", () => multiple.caught],
      [
        "aggregateContainsExactlyMultipleFailure",
        () =>
          aggregateContainsExactly(multiple.failure, [
            hookFailure,
            activeFailure,
            parkedFailure,
            manifestFailure,
          ]),
      ],
      [
        "multipleOrderJoin",
        () =>
          multiple.order.join(",") ===
          "cleanup-0,cleanup-1,cleanup-2,cleanup-3",
      ],
      ["combinedCaught", () => combined.caught],
      [
        "aggregateContainsExactlyCombinedFailure",
        () =>
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            hookFailure,
            activeFailure,
            parkedFailure,
            manifestFailure,
          ]),
      ],
      [
        "combinedOrderJoin",
        () =>
          combined.order.join(",") ===
          "cleanup-0,cleanup-1,cleanup-2,cleanup-3",
      ],
      ["partialSetupCaught", () => partialSetup.caught],
      [
        "partialSetupFailurePrimaryFailure",
        () => partialSetup.failure === primaryFailure,
      ],
      [
        "partialSetupOrderJoin",
        () => partialSetup.order.join(",") === "cleanup-0",
      ],
      ["undefinedStandaloneCaught", () => undefinedStandalone.caught],
      [
        "undefinedStandaloneFailure",
        () => undefinedStandalone.failure === undefined,
      ],
      [
        "undefinedStandaloneOrderJoin",
        () =>
          undefinedStandalone.order.join(",") ===
          "cleanup-0,cleanup-1,cleanup-2,cleanup-3",
      ],
      ["undefinedCombinedCaught", () => undefinedCombined.caught],
      [
        "aggregateContainsExactlyUndefinedCombinedFailure",
        () =>
          aggregateContainsExactly(undefinedCombined.failure, [
            undefined,
            undefined,
          ]),
      ],
      [
        "undefinedCombinedOrderJoin",
        () =>
          undefinedCombined.order.join(",") ===
          "cleanup-0,cleanup-1,cleanup-2,cleanup-3",
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
      standaloneFailureHookFailure: true,
      standaloneOrderJoin: true,
      multipleCaught: true,
      aggregateContainsExactlyMultipleFailure: true,
      multipleOrderJoin: true,
      combinedCaught: true,
      aggregateContainsExactlyCombinedFailure: true,
      combinedOrderJoin: true,
      partialSetupCaught: true,
      partialSetupFailurePrimaryFailure: true,
      partialSetupOrderJoin: true,
      undefinedStandaloneCaught: true,
      undefinedStandaloneFailure: true,
      undefinedStandaloneOrderJoin: true,
      undefinedCombinedCaught: true,
      aggregateContainsExactlyUndefinedCombinedFailure: true,
      undefinedCombinedOrderJoin: true,
    },
  );
  TestValidator.equals(
    "production-project test owns three render rollback cleanup lifecycles",
    renderRollbackCleanupContract(
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
              "rollbackTransientReadFailure={error};",
              "throwerror;",
            ],
            catchVariables: ["error"],
            containerKind: "IfStatement",
            containerStatements: 5,
            failureHolder:
              "letrollbackTransientReadFailure:|IProductionProjectFixtureFailure|undefined;",
            finallyDigest:
              "cc3714e8be2579093e198ea7b8d7da346e31575558d33432beb3a8982ab529b6",
            finallyStatements: 1,
            finallySubstantive: {
              digest:
                "70c868a1c08714c53cd95a67bbba6b1ae472ee862e65f10bc9c075794ab8e200",
              tokens: 49,
            },
            index: 4,
            substantive: {
              digest:
                "32f16c6b6ab2122c8d9ed0eb089f4ad090c155a78daaf73994e3f5c64891100a",
              tokens: 17,
            },
            tryDigest:
              "290a82744ce04ee3a9c0e87b71fad20fb14bb3a78afdf3384d93cfbaf21f1910",
            tryStatements: 1,
          },
          {
            catchBodies: ["renderRollbackFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "TryStatement",
            containerStatements: 296,
            failureHolder:
              "letrenderRollbackFailure:IProductionProjectFixtureFailure|undefined;",
            finallyDigest:
              "8e3c297b6cf5d2a6f37f2ba9e67f9d4fda6998aed43c0b3b0f33195fd3be0cf0",
            finallyStatements: 2,
            finallySubstantive: {
              digest:
                "d95d53c7b0588e36d1e7d4d588495a8797a6b96811b09012808b0aea0b668427",
              tokens: 117,
            },
            index: 254,
            substantive: {
              digest:
                "fc3bb18e2adaf32501737b3228a28d15e4b75e057ae07bc4f5efc3d99212ce11",
              tokens: 190,
            },
            tryDigest:
              "f57e6d5e9c2cbb44c15c5fb2127d267c7ab03b4481caeb1cc0c5d2641cd5b700",
            tryStatements: 1,
          },
          {
            catchBodies: ["rollbackAggregateFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "TryStatement",
            containerStatements: 296,
            failureHolder:
              "letrollbackAggregateFailure:IProductionProjectFixtureFailure|undefined;",
            finallyDigest:
              "5a48b71079b08a2567f921a78f1d9116ae1854a5dfcd8317e4ac67ce7d2a98a1",
            finallyStatements: 1,
            finallySubstantive: {
              digest:
                "618c4f2bea87fef790760d0e48c8fc3da9b92492e5d7e02aaaa537e1a748f4f0",
              tokens: 71,
            },
            index: 258,
            substantive: {
              digest:
                "73cd1c02831ae510ac1f781d9f6083243079bfaa30aafdd8d82ff51e99ab864f",
              tokens: 96,
            },
            tryDigest:
              "7d91b7d430b9556f5de623834c4652a735a1cb70853ca4d0aeb52958a8fa9dd1",
            tryStatements: 3,
          },
        ],
        statementCounts: [23],
      },
      parseDiagnostics: [],
    },
  );
};
