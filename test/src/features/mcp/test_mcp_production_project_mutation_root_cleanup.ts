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

const mutationRootCleanupContract = (text: string): unknown => {
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
    guardedBodies: Array<{
      catchBodies: string[];
      catchVariables: string[];
      compactBody: string;
      containerKind: string;
      containerStatements: number;
      index: number;
      substantive: { digest: string; tokens: number };
      tryStatements: number;
    }>;
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
        if (failureHolder.startsWith("letmutationHarnessFailure:")) {
          const guardedBodies: Array<{
            catchBodies: string[];
            catchVariables: string[];
            compactBody: string;
            containerKind: string;
            containerStatements: number;
            index: number;
            substantive: { digest: string; tokens: number };
            tryStatements: number;
          }> = [];
          const inspectGuardedBody = (child: ts.Node): void => {
            if (
              ts.isTryStatement(child) &&
              child.catchClause !== undefined &&
              child.tryBlock
                .getText(source)
                .includes("mutationProject.commitProductionDeliverableFiles") &&
              ts.isBlock(child.parent)
            ) {
              const container = [...child.parent.statements];
              guardedBodies.push({
                catchBodies: child.catchClause.block.statements.map(
                  (statement) => compact(statement, source),
                ),
                catchVariables:
                  child.catchClause.variableDeclaration === undefined
                    ? []
                    : [compact(child.catchClause.variableDeclaration, source)],
                compactBody: compact(child.tryBlock, source),
                containerKind: ts.SyntaxKind[child.parent.parent.kind]!,
                containerStatements: container.length,
                index: container.indexOf(child),
                substantive: leafTokenContract(
                  child.tryBlock.statements,
                  source,
                ),
                tryStatements: child.tryBlock.statements.length,
              });
            }
            ts.forEachChild(child, inspectGuardedBody);
          };
          inspectGuardedBody(node.tryBlock);
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
            guardedBodies,
            index,
            substantive: leafTokenContract(node.tryBlock.statements, source),
            tryDigest: digestText(node.tryBlock.getText(source)),
            tryStatements: node.tryBlock.statements.length,
          });
        }
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
      [
        "hook",
        "replacement-release",
        "active-remove",
        "parked-restore",
        "abandoned-release",
      ].map((resource, index) => ({
        resource: `mutation-root ${resource}`,
        cleanup: (): void => {
          order.push(resource);
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
  acquired: "abandoned" | "none" | "parked" | "replacement";
  activeFailure?: { error: unknown; present: true };
  hookFailure?: { error: unknown; present: true };
  parkedFailure?: { error: unknown; present: true };
  primaryFailure?: { error: unknown; present: true };
}): {
  abandonedPath: "canonical" | "parked" | undefined;
  caught: boolean;
  failure: unknown;
  order: string[];
} => {
  let abandonedPath: "canonical" | "parked" | undefined;
  let caught = false;
  const order: string[] = [];
  let failure: unknown;
  let rootRestored = false;
  try {
    preserveProductionProjectFixtureCleanup(
      props.primaryFailure === undefined
        ? undefined
        : { error: props.primaryFailure.error },
      [
        {
          resource: "mutation-root rename hook",
          cleanup: (): void => {
            order.push("hook");
            if (props.hookFailure !== undefined) throw props.hookFailure.error;
          },
        },
        ...(props.acquired === "replacement"
          ? [
              {
                resource: "mutation-root replacement lock",
                cleanup: (): void => {
                  order.push("replacement-release");
                },
              },
            ]
          : []),
        ...(props.acquired === "none"
          ? []
          : [
              {
                resource: "mutation-root active replacement",
                cleanup: (): void => {
                  order.push("active-remove");
                  if (props.activeFailure !== undefined)
                    throw props.activeFailure.error;
                },
              },
              {
                resource: "mutation-root parked original",
                cleanup: (): void => {
                  order.push("parked-restore");
                  if (props.parkedFailure !== undefined)
                    throw props.parkedFailure.error;
                  rootRestored = true;
                },
              },
            ]),
        ...(props.acquired === "abandoned" || props.acquired === "replacement"
          ? [
              {
                resource: "mutation-root abandoned lock",
                cleanup: (): void => {
                  order.push("abandoned-release");
                  abandonedPath = rootRestored ? "canonical" : "parked";
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
  return { abandonedPath, caught, failure, order };
};

export const test_mcp_production_project_mutation_root_cleanup = (): void => {
  const primaryFailure = { phase: "mutation-root assertion" };
  const hookFailure = { phase: "mutation-root rename-hook restoration" };
  const replacementFailure = { phase: "replacement lock release" };
  const activeFailure = { phase: "active replacement removal" };
  const parkedFailure = { phase: "parked root restoration" };
  const abandonedFailure = { phase: "abandoned lock release" };
  const cleanupFailures = [
    { error: hookFailure, present: true as const },
    { error: replacementFailure, present: true as const },
    { error: activeFailure, present: true as const },
    { error: parkedFailure, present: true as const },
    { error: abandonedFailure, present: true as const },
  ];
  const success = captureCleanup({});
  const primaryOnly = captureCleanup({
    primaryFailure: { error: primaryFailure, present: true },
  });
  const standalone = captureCleanup({
    cleanupFailures: [cleanupFailures[0]],
  });
  const multiple = captureCleanup({ cleanupFailures });
  const combined = captureCleanup({
    cleanupFailures,
    primaryFailure: { error: primaryFailure, present: true },
  });
  const noSwap = capturePartialAcquisition({
    acquired: "none",
    primaryFailure: { error: primaryFailure, present: true },
  });
  const parked = capturePartialAcquisition({
    acquired: "parked",
    primaryFailure: { error: primaryFailure, present: true },
  });
  const abandoned = capturePartialAcquisition({
    acquired: "abandoned",
    primaryFailure: { error: primaryFailure, present: true },
  });
  const replacement = capturePartialAcquisition({
    acquired: "replacement",
    primaryFailure: { error: primaryFailure, present: true },
  });
  const hookFailedAfterReplacement = capturePartialAcquisition({
    acquired: "replacement",
    hookFailure: { error: hookFailure, present: true },
  });
  const physicalRecoveryFailed = capturePartialAcquisition({
    acquired: "replacement",
    activeFailure: { error: activeFailure, present: true },
    parkedFailure: { error: parkedFailure, present: true },
    primaryFailure: { error: primaryFailure, present: true },
  });
  const undefinedStandalone = captureCleanup({
    cleanupFailures: [{ error: undefined, present: true }],
  });
  const undefinedCombined = captureCleanup({
    cleanupFailures: [{ error: undefined, present: true }],
    primaryFailure: { error: undefined, present: true },
  });
  const fullOrder =
    "hook,replacement-release,active-remove,parked-restore,abandoned-release";
  TestValidator.predicate(
    "mutation-root cleanup preserves failures and partial recovery order",
    success.caught === false &&
      success.failure === undefined &&
      success.order.join(",") === fullOrder &&
      primaryOnly.caught &&
      primaryOnly.failure === primaryFailure &&
      primaryOnly.order.join(",") === fullOrder &&
      standalone.caught &&
      standalone.failure === hookFailure &&
      standalone.order.join(",") === fullOrder &&
      multiple.caught &&
      aggregateContainsExactly(multiple.failure, [
        hookFailure,
        replacementFailure,
        activeFailure,
        parkedFailure,
        abandonedFailure,
      ]) &&
      multiple.order.join(",") === fullOrder &&
      combined.caught &&
      aggregateContainsExactly(combined.failure, [
        primaryFailure,
        hookFailure,
        replacementFailure,
        activeFailure,
        parkedFailure,
        abandonedFailure,
      ]) &&
      combined.order.join(",") === fullOrder &&
      noSwap.caught &&
      noSwap.failure === primaryFailure &&
      noSwap.abandonedPath === undefined &&
      noSwap.order.join(",") === "hook" &&
      parked.caught &&
      parked.failure === primaryFailure &&
      parked.abandonedPath === undefined &&
      parked.order.join(",") === "hook,active-remove,parked-restore" &&
      abandoned.caught &&
      abandoned.failure === primaryFailure &&
      abandoned.abandonedPath === "canonical" &&
      abandoned.order.join(",") ===
        "hook,active-remove,parked-restore,abandoned-release" &&
      replacement.caught &&
      replacement.failure === primaryFailure &&
      replacement.abandonedPath === "canonical" &&
      replacement.order.join(",") === fullOrder &&
      hookFailedAfterReplacement.caught &&
      hookFailedAfterReplacement.failure === hookFailure &&
      hookFailedAfterReplacement.abandonedPath === "canonical" &&
      hookFailedAfterReplacement.order.join(",") === fullOrder &&
      physicalRecoveryFailed.caught &&
      aggregateContainsExactly(physicalRecoveryFailed.failure, [
        primaryFailure,
        activeFailure,
        parkedFailure,
      ]) &&
      physicalRecoveryFailed.abandonedPath === "parked" &&
      physicalRecoveryFailed.order.join(",") === fullOrder &&
      undefinedStandalone.caught &&
      undefinedStandalone.failure === undefined &&
      undefinedStandalone.order.join(",") === fullOrder &&
      undefinedCombined.caught &&
      aggregateContainsExactly(undefinedCombined.failure, [
        undefined,
        undefined,
      ]) &&
      undefinedCombined.order.join(",") === fullOrder,
  );
  TestValidator.equals(
    "production-project test owns one mutation-root cleanup lifecycle",
    mutationRootCleanupContract(
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
            catchBodies: ["mutationHarnessFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "TryStatement",
            containerStatements: 228,
            failureHolder:
              "letmutationHarnessFailure:IProductionProjectFixtureFailure|undefined;",
            finallyDigest:
              "6466151d9b98ee451e6daef69733165d426022eb6270525262e54a70709a1240",
            finallyStatements: 5,
            finallySubstantive: {
              digest:
                "095df184c9e10fe0379eb8bf8d09e2159805fb20ed453ad7f68bb1a994421f48",
              tokens: 217,
            },
            guardedBodies: [
              {
                catchBodies: [
                  'mutationSwapRejected=errorinstanceofAggregateError&&error.message.includes("Nostale-pathrollbackwasattempted");',
                  "if(mutationSwapRejected===false)throwerror;",
                ],
                catchVariables: ["error"],
                compactBody:
                  '{mutationProject.commitProductionDeliverableFiles("root-swap",newMap([["frame.bin",Buffer.from("unsafe")]]),);}',
                containerKind: "TryStatement",
                containerStatements: 3,
                index: 0,
                substantive: {
                  digest:
                    "6f1a734fdd04913382e71586167a6d05f95c3bdeec3f335e878aa5af00a90ead",
                  tokens: 25,
                },
                tryStatements: 1,
              },
            ],
            index: 193,
            substantive: {
              digest:
                "6c5fbe085cd13d9a291d835ee7889739b4917eb2a2e7798b924995955b81a746",
              tokens: 145,
            },
            tryDigest:
              "9fa59789d7c3e6e995d2a194487dfd8bff4c690df7adef4e9a9d27d236008da9",
            tryStatements: 3,
          },
        ],
        statementCounts: [23],
      },
      parseDiagnostics: [],
    },
  );
};
