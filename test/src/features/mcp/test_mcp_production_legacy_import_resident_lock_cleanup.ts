import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";
import { preserveLegacyImportFixtureCleanup } from "./test_mcp_production_legacy_import";

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

const legacyResidentLockCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_legacy_import.ts",
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
    tryDigest: string;
    tryPrefixes: string[];
  }> = [];
  const ownedResidentLock = (node: ts.Block): boolean =>
    [
      "apply resident-lock transient root",
      "rollback resident-lock transient root",
    ].some((resource) => node.getText(source).includes(resource));
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
        "preserveLegacyImportFixtureCleanup(",
      ) &&
      ownedResidentLock(node.finallyBlock) &&
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
        tryDigest: digestText(node.tryBlock.getText(source)),
        tryPrefixes: [...node.tryBlock.statements]
          .slice(0, 3)
          .map((statement) => compact(statement, source)),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const policies = arrows.filter(
    (entry) => entry.name === "preserveLegacyImportFixtureCleanup",
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
        statement.name?.text === "LegacyImportFixtureCleanupError"
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
      preserveLegacyImportFixtureCleanup(
        primaryState,
        Array.from({ length: 5 }, (_, index) => ({
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

export const test_mcp_production_legacy_import_resident_lock_cleanup =
  (): void => {
    const primaryFailure = { phase: "legacy resident-lock guard" };
    const firstCleanupFailure = { phase: "first resident-lock cleanup" };
    const lastCleanupFailure = { phase: "last resident-lock cleanup" };
    const cleanupFailures = [
      { error: firstCleanupFailure, present: true as const },
      undefined,
      undefined,
      undefined,
      { error: lastCleanupFailure, present: true as const },
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
    const fullOrder = "cleanup-0,cleanup-1,cleanup-2,cleanup-3,cleanup-4";
    TestValidator.equals(
      "legacy resident-lock cleanup preserves failure and resource order",
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
        ["primaryOnlyCaught", () => primaryOnly.caught],
        [
          "primaryOnlyFailurePrimaryFailure",
          () => primaryOnly.failure === primaryFailure,
        ],
        [
          "primaryOnlyOrderJoin",
          () => primaryOnly.order.join(",") === fullOrder,
        ],
        ["standaloneCaught", () => standalone.caught],
        [
          "standaloneFailureFirstCleanupFailure",
          () => standalone.failure === firstCleanupFailure,
        ],
        ["standaloneOrderJoin", () => standalone.order.join(",") === fullOrder],
        ["multipleCaught", () => multiple.caught],
        [
          "aggregateContainsExactlyMultipleFailure",
          () =>
            aggregateContainsExactly(multiple.failure, [
              firstCleanupFailure,
              lastCleanupFailure,
            ]),
        ],
        [
          "multipleMessageIncludes",
          () => multiple.message.includes("resource-0"),
        ],
        [
          "multipleMessageIncludes2",
          () => multiple.message.includes("resource-4"),
        ],
        [
          "multipleMessageIncludes3",
          () => multiple.message.includes("resource-1") === false,
        ],
        [
          "multipleMessageIncludes4",
          () => multiple.message.includes("resource-2") === false,
        ],
        [
          "multipleMessageIncludes5",
          () => multiple.message.includes("resource-3") === false,
        ],
        ["multipleOrderJoin", () => multiple.order.join(",") === fullOrder],
        ["combinedCaught", () => combined.caught],
        [
          "aggregateContainsExactlyCombinedFailure",
          () =>
            aggregateContainsExactly(combined.failure, [
              primaryFailure,
              firstCleanupFailure,
              lastCleanupFailure,
            ]),
        ],
        ["combinedOrderJoin", () => combined.order.join(",") === fullOrder],
        ["undefinedPrimaryCaught", () => undefinedPrimary.caught],
        [
          "undefinedPrimaryFailure",
          () => undefinedPrimary.failure === undefined,
        ],
        [
          "undefinedPrimaryOrderJoin",
          () => undefinedPrimary.order.join(",") === fullOrder,
        ],
        ["undefinedStandaloneCaught", () => undefinedStandalone.caught],
        [
          "undefinedStandaloneFailure",
          () => undefinedStandalone.failure === undefined,
        ],
        [
          "undefinedStandaloneOrderJoin",
          () => undefinedStandalone.order.join(",") === fullOrder,
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
          () => undefinedCombined.order.join(",") === fullOrder,
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
        standaloneFailureFirstCleanupFailure: true,
        standaloneOrderJoin: true,
        multipleCaught: true,
        aggregateContainsExactlyMultipleFailure: true,
        multipleMessageIncludes: true,
        multipleMessageIncludes2: true,
        multipleMessageIncludes3: true,
        multipleMessageIncludes4: true,
        multipleMessageIncludes5: true,
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
      "legacy import owns two resident-lock cleanup lifecycles",
      legacyResidentLockCleanupContract(
        fs.readFileSync(
          path.join(__dirname, "test_mcp_production_legacy_import.ts"),
          "utf8",
        ),
      ),
      {
        lifecycles: [
          {
            catchBodies: [
              "applyResidentLockCleanupFailure={error};",
              "throwerror;",
            ],
            catchVariables: ["error"],
            containerKind: "Block",
            containerStatements: 2,
            finallyDigest:
              "bd336e7b7d4403105ec6f1b2fc5bd8c82d6a05b274a0e7150617984d98e89297",
            finallySubstantive: {
              digest:
                "60e9281c3fa40f077c57868cf5131ce5f87d534fa99b1cfbd405344ce110d25d",
              tokens: 222,
            },
            index: 1,
            preceding:
              "letapplyResidentLockCleanupFailure:|ILegacyImportFixtureFailure|undefined;",
            substantive: {
              digest:
                "af84deed78c571468d24da66f5bcd2819e82cddccbf4838ba08d67f80b70979d",
              tokens: 393,
            },
            tryDigest:
              "c8fab2deefd16643158ac7e11bc76da8728553d7a92e64dca980305cdb3b0b04",
            tryPrefixes: [
              'constresidentLock=path.join(replacedAfterResidentLock.root,"revision.lock",);',
              "constnativeWrite=fs.writeFileSync;",
              "letreplaced=false;",
            ],
          },
          {
            catchBodies: [
              "rollbackResidentLockCleanupFailure={error};",
              "throwerror;",
            ],
            catchVariables: ["error"],
            containerKind: "Block",
            containerStatements: 2,
            finallyDigest:
              "945260f2864dbd0789f272d2f8294eb59852b7b0eb0b77b8ac2bdb8462bb6d33",
            finallySubstantive: {
              digest:
                "e3596ff7b0384cf3bf21a0a1df96db7bf342099c5e0a665f5e2e1db14a5011fe",
              tokens: 223,
            },
            index: 1,
            preceding:
              "letrollbackResidentLockCleanupFailure:|ILegacyImportFixtureFailure|undefined;",
            substantive: {
              digest:
                "5d8aa304104745bf1303e97181fc3509e64caf4b4b2970fb9a5aabd1808160e0",
              tokens: 391,
            },
            tryDigest:
              "4b0fe482c6545d7c11f6a9a732485f5228cf39ddb03cd305e630080fad860f2d",
            tryPrefixes: [
              "constimporter=newAutoMovieLegacyImporter(replacedAfterRollbackLock.root,);",
              "importer.apply();",
              'fs.mkdirSync(path.join(rollbackReplacement,".automovie"));',
            ],
          },
        ],
        parseDiagnostics: [],
        policy: {
          bodies: [
            "{constcleanupFailures:Array<{error:unknown;resource:string}>=[];for(constresourceofresources)try{resource.cleanup();}catch(error){cleanupFailures.push({error,resource:resource.resource});}if(cleanupFailures.length===1&&failure===undefined)throwcleanupFailures[0]!.error;if(cleanupFailures.length!==0)thrownewLegacyImportFixtureCleanupError([...(failure===undefined?[]:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`Legacy-importfixturecleanupfailed$" +
              '{failure===undefined?"":"afterthetestfailed"}:$' +
              '{cleanupFailures.map((entry)=>entry.resource).join(",")}.`,);}',
          ],
          classes: ["AggregateError"],
          count: 1,
          parameters: [
            [
              "failure:ILegacyImportFixtureFailure|undefined",
              "resources:readonlyILegacyImportFixtureCleanup[]",
            ],
          ],
        },
      },
    );
  };
