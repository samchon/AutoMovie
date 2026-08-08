import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";
import { preserveProductionNamespaceReplacementCleanup } from "./test_mcp_production_namespaces";

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

const productionNamespaceAliasCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_namespaces.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const arrows: Array<{ arrow: ts.ArrowFunction; name: string }> = [];
  const lifecycles: Array<{
    catchBodies: string[];
    catchVariables: string[];
    containerKind: string;
    containerStatements: number;
    finallyDigest: string;
    finallySubstantive: { digest: string; tokens: number };
    index: number;
    preceding: string;
    substantive: { digest: string; tokens: number };
    tryBody: string;
    tryDigest: string;
  }> = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer !== undefined &&
      ts.isArrowFunction(node.initializer)
    )
      arrows.push({ arrow: node.initializer, name: node.name.text });
    if (
      ts.isTryStatement(node) &&
      node.catchClause !== undefined &&
      node.finallyBlock !== undefined &&
      compact(node.finallyBlock, source).includes(
        "preserveProductionNamespaceReplacementCleanup(",
      ) &&
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
        containerKind: ts.SyntaxKind[node.parent.parent.kind]!,
        containerStatements: statements.length,
        finallyDigest: digestText(node.finallyBlock.getText(source)),
        finallySubstantive: leafTokenContract(
          node.finallyBlock.statements,
          source,
        ),
        index,
        preceding: compact(statements[index - 1]!, source),
        substantive: leafTokenContract(node.tryBlock.statements, source),
        tryBody: compact(node.tryBlock, source),
        tryDigest: digestText(node.tryBlock.getText(source)),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const policies = arrows.filter(
    (entry) => entry.name === "preserveProductionNamespaceReplacementCleanup",
  );
  return {
    lifecycles,
    parseDiagnostics: (
      source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics.map((diagnostic) => String(diagnostic.messageText)),
    policy: {
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "ProductionNamespaceReplacementCleanupError"
          ? (statement.heritageClauses ?? []).flatMap((clause) =>
              clause.types.map((type) => compact(type, source)),
            )
          : [],
      ),
      count: policies.length,
      parameters: policies.map((entry) =>
        entry.arrow.parameters.map((parameter) => compact(parameter, source)),
      ),
    },
  };
};

const captureCleanup = (props: {
  cleanupFailures?: readonly ({ error: unknown; present: true } | undefined)[];
  primaryFailure?: { error: unknown; present: true };
}): { caught: boolean; failure: unknown; message: string; order: string[] } => {
  let caught = false;
  let failure: unknown;
  let message = "";
  const order: string[] = [];
  let primaryState: { error: unknown } | undefined;
  try {
    try {
      if (props.primaryFailure !== undefined) throw props.primaryFailure.error;
    } catch (error) {
      primaryState = { error };
      throw error;
    } finally {
      preserveProductionNamespaceReplacementCleanup(
        primaryState,
        Array.from({ length: 2 }, (_, index) => ({
          resource: `resource-${index}`,
          cleanup: (): void => {
            order.push(`cleanup-${index}`);
            const cleanupFailure = props.cleanupFailures?.[index];
            if (cleanupFailure !== undefined) throw cleanupFailure.error;
          },
        })),
      );
    }
  } catch (error) {
    caught = true;
    failure = error;
    if (error instanceof Error) message = error.message;
  }
  return { caught, failure, message, order };
};

export const test_mcp_production_namespace_alias_cleanup = (): void => {
  const primaryFailure = { phase: "namespace alias assertion" };
  const unlinkFailure = { phase: "namespace alias unlink" };
  const renameFailure = { phase: "namespace alias resident rename" };
  const cleanupFailures = [
    { error: unlinkFailure, present: true as const },
    { error: renameFailure, present: true as const },
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
  const undefinedPrimary = captureCleanup({
    primaryFailure: { error: undefined, present: true },
  });
  const undefinedStandalone = captureCleanup({
    cleanupFailures: [{ error: undefined, present: true }],
  });
  const undefinedCombined = captureCleanup({
    cleanupFailures: [{ error: undefined, present: true }],
    primaryFailure: { error: undefined, present: true },
  });
  const fullOrder = "cleanup-0,cleanup-1";
  TestValidator.equals(
    "namespace alias cleanup preserves failure and resource order",
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
          success.order.join(",") === fullOrder,
      ],
      [
        "primaryOnlyCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught,
      ],
      [
        "primaryOnlyFailurePrimaryFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure,
      ],
      [
        "primaryOnlyOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder,
      ],
      [
        "standaloneCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught,
      ],
      [
        "standaloneFailureUnlinkFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === unlinkFailure,
      ],
      [
        "standaloneOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === unlinkFailure &&
          standalone.order.join(",") === fullOrder,
      ],
      [
        "multipleCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === unlinkFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught,
      ],
      [
        "aggregateContainsExactlyMultipleFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === unlinkFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            unlinkFailure,
            renameFailure,
          ]),
      ],
      [
        "multipleMessageIncludes",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === unlinkFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            unlinkFailure,
            renameFailure,
          ]) &&
          multiple.message.includes("resource-0"),
      ],
      [
        "multipleMessageIncludes2",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === unlinkFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            unlinkFailure,
            renameFailure,
          ]) &&
          multiple.message.includes("resource-0") &&
          multiple.message.includes("resource-1"),
      ],
      [
        "multipleOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === unlinkFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            unlinkFailure,
            renameFailure,
          ]) &&
          multiple.message.includes("resource-0") &&
          multiple.message.includes("resource-1") &&
          multiple.order.join(",") === fullOrder,
      ],
      [
        "combinedCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === unlinkFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            unlinkFailure,
            renameFailure,
          ]) &&
          multiple.message.includes("resource-0") &&
          multiple.message.includes("resource-1") &&
          multiple.order.join(",") === fullOrder &&
          combined.caught,
      ],
      [
        "aggregateContainsExactlyCombinedFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === unlinkFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            unlinkFailure,
            renameFailure,
          ]) &&
          multiple.message.includes("resource-0") &&
          multiple.message.includes("resource-1") &&
          multiple.order.join(",") === fullOrder &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            unlinkFailure,
            renameFailure,
          ]),
      ],
      [
        "combinedOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === unlinkFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            unlinkFailure,
            renameFailure,
          ]) &&
          multiple.message.includes("resource-0") &&
          multiple.message.includes("resource-1") &&
          multiple.order.join(",") === fullOrder &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            unlinkFailure,
            renameFailure,
          ]) &&
          combined.order.join(",") === fullOrder,
      ],
      [
        "undefinedPrimaryCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === unlinkFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            unlinkFailure,
            renameFailure,
          ]) &&
          multiple.message.includes("resource-0") &&
          multiple.message.includes("resource-1") &&
          multiple.order.join(",") === fullOrder &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            unlinkFailure,
            renameFailure,
          ]) &&
          combined.order.join(",") === fullOrder &&
          undefinedPrimary.caught,
      ],
      [
        "undefinedPrimaryFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === unlinkFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            unlinkFailure,
            renameFailure,
          ]) &&
          multiple.message.includes("resource-0") &&
          multiple.message.includes("resource-1") &&
          multiple.order.join(",") === fullOrder &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            unlinkFailure,
            renameFailure,
          ]) &&
          combined.order.join(",") === fullOrder &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined,
      ],
      [
        "undefinedPrimaryOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === unlinkFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            unlinkFailure,
            renameFailure,
          ]) &&
          multiple.message.includes("resource-0") &&
          multiple.message.includes("resource-1") &&
          multiple.order.join(",") === fullOrder &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            unlinkFailure,
            renameFailure,
          ]) &&
          combined.order.join(",") === fullOrder &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined &&
          undefinedPrimary.order.join(",") === fullOrder,
      ],
      [
        "undefinedStandaloneCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === unlinkFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            unlinkFailure,
            renameFailure,
          ]) &&
          multiple.message.includes("resource-0") &&
          multiple.message.includes("resource-1") &&
          multiple.order.join(",") === fullOrder &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            unlinkFailure,
            renameFailure,
          ]) &&
          combined.order.join(",") === fullOrder &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined &&
          undefinedPrimary.order.join(",") === fullOrder &&
          undefinedStandalone.caught,
      ],
      [
        "undefinedStandaloneFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === unlinkFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            unlinkFailure,
            renameFailure,
          ]) &&
          multiple.message.includes("resource-0") &&
          multiple.message.includes("resource-1") &&
          multiple.order.join(",") === fullOrder &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            unlinkFailure,
            renameFailure,
          ]) &&
          combined.order.join(",") === fullOrder &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined &&
          undefinedPrimary.order.join(",") === fullOrder &&
          undefinedStandalone.caught &&
          undefinedStandalone.failure === undefined,
      ],
      [
        "undefinedStandaloneOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === unlinkFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            unlinkFailure,
            renameFailure,
          ]) &&
          multiple.message.includes("resource-0") &&
          multiple.message.includes("resource-1") &&
          multiple.order.join(",") === fullOrder &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            unlinkFailure,
            renameFailure,
          ]) &&
          combined.order.join(",") === fullOrder &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined &&
          undefinedPrimary.order.join(",") === fullOrder &&
          undefinedStandalone.caught &&
          undefinedStandalone.failure === undefined &&
          undefinedStandalone.order.join(",") === fullOrder,
      ],
      [
        "undefinedCombinedCaught",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === unlinkFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            unlinkFailure,
            renameFailure,
          ]) &&
          multiple.message.includes("resource-0") &&
          multiple.message.includes("resource-1") &&
          multiple.order.join(",") === fullOrder &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            unlinkFailure,
            renameFailure,
          ]) &&
          combined.order.join(",") === fullOrder &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined &&
          undefinedPrimary.order.join(",") === fullOrder &&
          undefinedStandalone.caught &&
          undefinedStandalone.failure === undefined &&
          undefinedStandalone.order.join(",") === fullOrder &&
          undefinedCombined.caught,
      ],
      [
        "aggregateContainsExactlyUndefinedCombinedFailure",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === unlinkFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            unlinkFailure,
            renameFailure,
          ]) &&
          multiple.message.includes("resource-0") &&
          multiple.message.includes("resource-1") &&
          multiple.order.join(",") === fullOrder &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            unlinkFailure,
            renameFailure,
          ]) &&
          combined.order.join(",") === fullOrder &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined &&
          undefinedPrimary.order.join(",") === fullOrder &&
          undefinedStandalone.caught &&
          undefinedStandalone.failure === undefined &&
          undefinedStandalone.order.join(",") === fullOrder &&
          undefinedCombined.caught &&
          aggregateContainsExactly(undefinedCombined.failure, [
            undefined,
            undefined,
          ]),
      ],
      [
        "undefinedCombinedOrderJoin",
        () =>
          success.caught === false &&
          success.failure === undefined &&
          success.order.join(",") === fullOrder &&
          primaryOnly.caught &&
          primaryOnly.failure === primaryFailure &&
          primaryOnly.order.join(",") === fullOrder &&
          standalone.caught &&
          standalone.failure === unlinkFailure &&
          standalone.order.join(",") === fullOrder &&
          multiple.caught &&
          aggregateContainsExactly(multiple.failure, [
            unlinkFailure,
            renameFailure,
          ]) &&
          multiple.message.includes("resource-0") &&
          multiple.message.includes("resource-1") &&
          multiple.order.join(",") === fullOrder &&
          combined.caught &&
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            unlinkFailure,
            renameFailure,
          ]) &&
          combined.order.join(",") === fullOrder &&
          undefinedPrimary.caught &&
          undefinedPrimary.failure === undefined &&
          undefinedPrimary.order.join(",") === fullOrder &&
          undefinedStandalone.caught &&
          undefinedStandalone.failure === undefined &&
          undefinedStandalone.order.join(",") === fullOrder &&
          undefinedCombined.caught &&
          aggregateContainsExactly(undefinedCombined.failure, [
            undefined,
            undefined,
          ]) &&
          undefinedCombined.order.join(",") === fullOrder,
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
      standaloneFailureUnlinkFailure: true,
      standaloneOrderJoin: true,
      multipleCaught: true,
      aggregateContainsExactlyMultipleFailure: true,
      multipleMessageIncludes: true,
      multipleMessageIncludes2: true,
      multipleOrderJoin: true,
      combinedCaught: true,
      aggregateContainsExactlyCombinedFailure: true,
      combinedOrderJoin: true,
      undefinedPrimaryCaught: true,
      undefinedPrimaryFailure: true,
      undefinedPrimaryOrderJoin: true,
      undefinedStandaloneCaught: true,
      undefinedStandaloneFailure: true,
      undefinedStandaloneOrderJoin: true,
      undefinedCombinedCaught: true,
      aggregateContainsExactlyUndefinedCombinedFailure: true,
      undefinedCombinedOrderJoin: true,
    },
  );
  TestValidator.equals(
    "production namespaces own the replacement-alias cleanup lifecycle",
    productionNamespaceAliasCleanupContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_production_namespaces.ts"),
        "utf8",
      ),
    ),
    {
      lifecycles: [
        {
          catchBodies: ["replacementAliasFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 8,
          finallyDigest:
            "a07dc8041b30f975152d4941a7a55b633c6bca02b829181fb860513ccd66512c",
          finallySubstantive: {
            digest:
              "6453428fd321fe3962d4967f2017edaac4a998be6f3399dedc399002a0ae0f0a",
            tokens: 58,
          },
          index: 7,
          preceding:
            "letreplacementAliasFailure:IProductionNamespaceFixtureFailure|undefined;",
          substantive: {
            digest:
              "5906bc9372d26a3fba63f5fa7813fc6e066a0a146e4ad567f03346eabdebe2d5",
            tokens: 58,
          },
          tryBody:
            '{fs.symlinkSync(alphaDesignRoot,betaDesignRoot,process.platform==="win32"?"junction":"dir",);TestValidator.predicate("anopenedhandlerejectsalaterinternalnamespacealias",throws(()=>beta.design({kind:"production"}),"changedphysicalidentity",)&&alpha.summary().productionId==="fixture-film",);}',
          tryDigest:
            "86d20de7713cb4660fd7f953d97e1726d8ad59ef5e4658983c98cd7666ad242b",
        },
      ],
      parseDiagnostics: [],
      policy: {
        bodies: [
          "{constcleanupFailures:Array<{error:unknown;resource:string}>=[];for(constresourceofresources)try{resource.cleanup();}catch(error){cleanupFailures.push({error,resource:resource.resource});}if(cleanupFailures.length===1&&failure===undefined)throwcleanupFailures[0]!.error;if(cleanupFailures.length!==0)thrownewProductionNamespaceReplacementCleanupError([...(failure===undefined?[]:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`Production-namespacereplacementcleanupfailed$" +
            '{failure===undefined?"":"afterthetestfailed"}:$' +
            '{cleanupFailures.map((entry)=>entry.resource).join(",")}.`,);}',
        ],
        classes: ["AggregateError"],
        count: 1,
        parameters: [
          [
            "failure:IProductionNamespaceFixtureFailure|undefined",
            "resources:readonlyIProductionNamespaceReplacementCleanup[]",
          ],
        ],
      },
    },
  );
};
