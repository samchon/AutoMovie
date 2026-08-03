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

const namespaceSwapCleanupContract = (text: string): unknown => {
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
    "requestedSwapFailure",
    "createdAliasFailure",
    "fenceTransientReadFailure",
    "fenceAssertionFailure",
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
    parseDiagnostics: source.parseDiagnostics.map((diagnostic) =>
      String(diagnostic.messageText),
    ),
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
        resource: `namespace-swap-${index}`,
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

const capturePartialSwap = (props: {
  active: boolean;
  attempted: boolean;
  primaryFailure: unknown;
}): { failure: unknown; order: string[] } => {
  const order: string[] = [];
  let failure: unknown;
  try {
    preserveProductionProjectFixtureCleanup({ error: props.primaryFailure }, [
      { resource: "hook", cleanup: () => order.push("hook") },
      ...(props.attempted
        ? [
            {
              resource: "active alias",
              cleanup: (): void => {
                order.push("active-check");
                if (props.active) order.push("active-remove");
              },
            },
            {
              resource: "physical alias",
              cleanup: () => order.push("physical-restore"),
            },
          ]
        : []),
    ]);
    throw props.primaryFailure;
  } catch (error) {
    failure = error;
  }
  return { failure, order };
};

export const test_mcp_production_project_namespace_swap_cleanup = (): void => {
  const primaryFailure = { phase: "namespace-swap assertion" };
  const hookFailure = { phase: "namespace-swap hook restoration" };
  const activeFailure = { phase: "namespace-swap active replacement" };
  const parkedFailure = { phase: "namespace-swap parked resident" };
  const leaseFailure = { phase: "namespace-swap lease release" };
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
      { error: leaseFailure, present: true },
    ],
  });
  const combined = captureCleanup({
    cleanupFailures: [
      { error: hookFailure, present: true },
      { error: activeFailure, present: true },
      { error: parkedFailure, present: true },
      { error: leaseFailure, present: true },
    ],
    primaryFailure: { error: primaryFailure, present: true },
  });
  const partialSetup = captureCleanup({
    primaryFailure: { error: primaryFailure, present: true },
    resources: 1,
  });
  const noSwap = capturePartialSwap({
    active: true,
    attempted: false,
    primaryFailure,
  });
  const removedWithoutReplacement = capturePartialSwap({
    active: false,
    attempted: true,
    primaryFailure,
  });
  const undefinedStandalone = captureCleanup({
    cleanupFailures: [{ error: undefined, present: true }],
  });
  const undefinedCombined = captureCleanup({
    cleanupFailures: [{ error: undefined, present: true }],
    primaryFailure: { error: undefined, present: true },
  });
  TestValidator.predicate(
    "namespace-swap cleanup preserves failure and recovery order",
    success.caught === false &&
      success.failure === undefined &&
      success.order.join(",") === "cleanup-0,cleanup-1,cleanup-2,cleanup-3" &&
      primaryOnly.caught &&
      primaryOnly.failure === primaryFailure &&
      primaryOnly.order.join(",") ===
        "cleanup-0,cleanup-1,cleanup-2,cleanup-3" &&
      standalone.caught &&
      standalone.failure === hookFailure &&
      standalone.order.join(",") ===
        "cleanup-0,cleanup-1,cleanup-2,cleanup-3" &&
      multiple.caught &&
      aggregateContainsExactly(multiple.failure, [
        hookFailure,
        activeFailure,
        parkedFailure,
        leaseFailure,
      ]) &&
      multiple.order.join(",") === "cleanup-0,cleanup-1,cleanup-2,cleanup-3" &&
      combined.caught &&
      aggregateContainsExactly(combined.failure, [
        primaryFailure,
        hookFailure,
        activeFailure,
        parkedFailure,
        leaseFailure,
      ]) &&
      combined.order.join(",") === "cleanup-0,cleanup-1,cleanup-2,cleanup-3" &&
      partialSetup.caught &&
      partialSetup.failure === primaryFailure &&
      partialSetup.order.join(",") === "cleanup-0" &&
      noSwap.failure === primaryFailure &&
      noSwap.order.join(",") === "hook" &&
      removedWithoutReplacement.failure === primaryFailure &&
      removedWithoutReplacement.order.join(",") ===
        "hook,active-check,physical-restore" &&
      undefinedStandalone.caught &&
      undefinedStandalone.failure === undefined &&
      undefinedStandalone.order.join(",") ===
        "cleanup-0,cleanup-1,cleanup-2,cleanup-3" &&
      undefinedCombined.caught &&
      aggregateContainsExactly(undefinedCombined.failure, [
        undefined,
        undefined,
      ]) &&
      undefinedCombined.order.join(",") ===
        "cleanup-0,cleanup-1,cleanup-2,cleanup-3",
  );
  TestValidator.equals(
    "production-project test owns four namespace-swap cleanup lifecycles",
    namespaceSwapCleanupContract(
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
            catchBodies: ["requestedSwapFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "TryStatement",
            containerStatements: 225,
            failureHolder:
              "letrequestedSwapFailure:IProductionProjectFixtureFailure|undefined;",
            finallyDigest:
              "0b0ee92a427702c4dc76603cf870d90342686ea804ab81d9af0b3fe8a551ecd2",
            finallyStatements: 2,
            finallySubstantive: {
              digest:
                "75e463d606f212ea62fce2094904da43b90a0897cda3e5a559005c6bafd9dfab",
              tokens: 101,
            },
            index: 30,
            substantive: {
              digest:
                "9fa29ebc3cdc07cd53996d9f98b566fdce370d21fa0b73a3448ab095de4b2ffa",
              tokens: 16,
            },
            tryDigest:
              "eb4ca8096245e2cf0cc0a5cfa8cae39888ba5d31344b36651d224e7b10f2fe9a",
            tryStatements: 1,
          },
          {
            catchBodies: ["createdAliasFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "TryStatement",
            containerStatements: 225,
            failureHolder:
              "letcreatedAliasFailure:IProductionProjectFixtureFailure|undefined;",
            finallyDigest:
              "91fd0b95e6486b99efccb4df1a9446ac08e21bbf774576e19886e5a78839e083",
            finallyStatements: 2,
            finallySubstantive: {
              digest:
                "8d19c581125f46728959c74f49239e7da5bedc8335911e8a79d5fccac531de0f",
              tokens: 104,
            },
            index: 66,
            substantive: {
              digest:
                "e04d3404fb71b2b26d2f19496d1daa471fdceb6f009f91484954ccab9edaaa03",
              tokens: 18,
            },
            tryDigest:
              "d8bffbdbfbc810534cb28ee9cb435b87f03a11e01d9f6daeeee4613532fa0715",
            tryStatements: 1,
          },
          {
            catchBodies: ["fenceTransientReadFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "IfStatement",
            containerStatements: 5,
            failureHolder:
              "letfenceTransientReadFailure:|IProductionProjectFixtureFailure|undefined;",
            finallyDigest:
              "f9f026ee137c555945b432cc1cf7bd31149852e63b30b36e4187f38506d82aa0",
            finallyStatements: 1,
            finallySubstantive: {
              digest:
                "d09ffd8cd89a6f5f799d9100b86c98855d390d5a7a703e803c867772488690fc",
              tokens: 66,
            },
            index: 4,
            substantive: {
              digest:
                "0326c6c4182aa6d182d4d10125dc59fa9353bf8638906b2506b3331c37c59fe0",
              tokens: 17,
            },
            tryDigest:
              "834d26032fc973923b2aaf051ed4b5e9b0119125611883577efd6011928a8022",
            tryStatements: 1,
          },
          {
            catchBodies: ["fenceAssertionFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "TryStatement",
            containerStatements: 225,
            failureHolder:
              "letfenceAssertionFailure:IProductionProjectFixtureFailure|undefined;",
            finallyDigest:
              "28b0e8e9c6d0649c57b916b4a36491dab885bb5738a783c5da7b40d07c2e50d9",
            finallyStatements: 2,
            finallySubstantive: {
              digest:
                "6f4d0e37abddbecfc8d87e7024b75e4165acb56a322b78608ca139da48e68b0a",
              tokens: 125,
            },
            index: 77,
            substantive: {
              digest:
                "66b2b596973e5cdad4fc1467f790bd80fa705f4a987480edf5b3e3bed9e5831a",
              tokens: 9,
            },
            tryDigest:
              "edbe457dc015029a77d3995d8043cf1dcd5f8d47ab2f5b83f89b8fa422f212db",
            tryStatements: 2,
          },
        ],
        statementCounts: [23],
      },
      parseDiagnostics: [],
    },
  );
};
