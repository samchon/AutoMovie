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

const rootIdentityRaceCleanupContract = (text: string): unknown => {
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
  const holderNames = ["missingIdentityFailure", "preLeaseFailure"] as const;
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
        resource: `root-identity-race-${index}`,
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
  primaryFailure: unknown;
  swapped: boolean;
}): { failure: unknown; order: string[] } => {
  const order: string[] = [];
  let failure: unknown;
  try {
    preserveProductionProjectFixtureCleanup({ error: props.primaryFailure }, [
      { resource: "read hook", cleanup: () => order.push("hook") },
      { resource: "observation", cleanup: () => order.push("observe") },
      ...(props.swapped
        ? [
            {
              resource: "active replacement",
              cleanup: () => order.push("active-remove"),
            },
            {
              resource: "parked root",
              cleanup: () => order.push("parked-restore"),
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

export const test_mcp_production_project_root_identity_race_cleanup =
  (): void => {
    const primaryFailure = { phase: "root-identity race assertion" };
    const hookFailure = { phase: "root-identity read-hook restoration" };
    const observationFailure = { phase: "root-identity observation" };
    const activeFailure = { phase: "root-identity active replacement" };
    const parkedFailure = { phase: "root-identity parked root" };
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
        { error: observationFailure, present: true },
        { error: activeFailure, present: true },
        { error: parkedFailure, present: true },
      ],
    });
    const combined = captureCleanup({
      cleanupFailures: [
        { error: hookFailure, present: true },
        { error: observationFailure, present: true },
        { error: activeFailure, present: true },
        { error: parkedFailure, present: true },
      ],
      primaryFailure: { error: primaryFailure, present: true },
    });
    const partialSetup = captureCleanup({
      primaryFailure: { error: primaryFailure, present: true },
      resources: 1,
    });
    const noSwap = capturePartialSwap({ primaryFailure, swapped: false });
    const swapped = capturePartialSwap({ primaryFailure, swapped: true });
    const undefinedStandalone = captureCleanup({
      cleanupFailures: [{ error: undefined, present: true }],
    });
    const undefinedCombined = captureCleanup({
      cleanupFailures: [{ error: undefined, present: true }],
      primaryFailure: { error: undefined, present: true },
    });
    TestValidator.predicate(
      "root-identity race cleanup preserves failure and recovery order",
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
          observationFailure,
          activeFailure,
          parkedFailure,
        ]) &&
        multiple.order.join(",") ===
          "cleanup-0,cleanup-1,cleanup-2,cleanup-3" &&
        combined.caught &&
        aggregateContainsExactly(combined.failure, [
          primaryFailure,
          hookFailure,
          observationFailure,
          activeFailure,
          parkedFailure,
        ]) &&
        combined.order.join(",") ===
          "cleanup-0,cleanup-1,cleanup-2,cleanup-3" &&
        partialSetup.caught &&
        partialSetup.failure === primaryFailure &&
        partialSetup.order.join(",") === "cleanup-0" &&
        noSwap.failure === primaryFailure &&
        noSwap.order.join(",") === "hook,observe" &&
        swapped.failure === primaryFailure &&
        swapped.order.join(",") ===
          "hook,observe,active-remove,parked-restore" &&
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
      "production-project test owns two root-identity race cleanup lifecycles",
      rootIdentityRaceCleanupContract(
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
              catchBodies: ["missingIdentityFailure={error};", "throwerror;"],
              catchVariables: ["error"],
              containerKind: "TryStatement",
              containerStatements: 230,
              failureHolder:
                "letmissingIdentityFailure:IProductionProjectFixtureFailure|undefined;",
              finallyDigest:
                "5ddd2805c85da5229b8f5a0d186c213589eac7d05f2b1a89a77e40254e6a41c5",
              finallyStatements: 1,
              finallySubstantive: {
                digest:
                  "474d0df1caf3abe4640ea5182e91ba5a23ab12d6ceda76f7fce78d7968e4c5e0",
                tokens: 29,
              },
              index: 138,
              substantive: {
                digest:
                  "5ee4cdbd2a9fdc2cdf7b4997b112c70bdf984bac60d142e8452f0e0513ffbfee",
                tokens: 23,
              },
              tryDigest:
                "e5c330e43e370ff7263a60f722574dd79dae8408dd630101573472f2e6e0c66a",
              tryStatements: 1,
            },
            {
              catchBodies: ["preLeaseFailure={error};", "throwerror;"],
              catchVariables: ["error"],
              containerKind: "TryStatement",
              containerStatements: 230,
              failureHolder:
                "letpreLeaseFailure:IProductionProjectFixtureFailure|undefined;",
              finallyDigest:
                "4b7013cddf788926ec8925baa31bc1b5c4a5d8815999675ef1ba21cf2a0037a8",
              finallyStatements: 2,
              finallySubstantive: {
                digest:
                  "b253516d5cacb655e5c534ec97170f65f6abd60be33faa72d0f9ac64b48f28fc",
                tokens: 135,
              },
              index: 165,
              substantive: {
                digest:
                  "b37c4ffc20e6d1ed19fa9b1b66f197adc761ff6d68a62fff16171cf6cc315944",
                tokens: 36,
              },
              tryDigest:
                "8bb8103068457632849114189755ff8016fe3cb5c62d5ec689a25b24cd1f4587",
              tryStatements: 1,
            },
          ],
          statementCounts: [23],
        },
        parseDiagnostics: [],
      },
    );
  };
