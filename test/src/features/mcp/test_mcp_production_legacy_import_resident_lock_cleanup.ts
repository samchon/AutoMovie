import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveLegacyImportFixtureCleanup } from "./test_mcp_production_legacy_import";

/**
 * Evaluate named facts in order and stop at the first false one, so a failed
 * comparison names the fact instead of collapsing into one boolean. Stopping
 * keeps the short-circuit semantics the original conjunction had, which some
 * facts depend on to guard the ones after them.
 */
const namedFacts = (
  entries: ReadonlyArray<readonly [string, () => boolean]>,
): Record<string, boolean> => {
  const output: Record<string, boolean> = {};
  for (const [name, evaluate] of entries) {
    output[name] = evaluate();
    if (output[name] === false) break;
  }
  return output;
};

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
        ["successFailure", () => success.failure === undefined],
        ["successOrder", () => success.order.join(",") === fullOrder],
        ["primaryOnlyCaught", () => primaryOnly.caught],
        ["primaryOnlyFailure", () => primaryOnly.failure === primaryFailure],
        ["primaryOnlyOrder", () => primaryOnly.order.join(",") === fullOrder],
        ["standaloneCaught", () => standalone.caught],
        ["standaloneFailure", () => standalone.failure === firstCleanupFailure],
        ["standaloneOrder", () => standalone.order.join(",") === fullOrder],
        ["multipleCaught", () => multiple.caught],
        [
          "aggregateContainsExactlyMultiple",
          () =>
            aggregateContainsExactly(multiple.failure, [
              firstCleanupFailure,
              lastCleanupFailure,
            ]),
        ],
        ["multipleMessage", () => multiple.message.includes("resource-0")],
        ["multipleMessage2", () => multiple.message.includes("resource-4")],
        [
          "multipleMessage3",
          () => multiple.message.includes("resource-1") === false,
        ],
        [
          "multipleMessage4",
          () => multiple.message.includes("resource-2") === false,
        ],
        [
          "multipleMessage5",
          () => multiple.message.includes("resource-3") === false,
        ],
        ["multipleOrder", () => multiple.order.join(",") === fullOrder],
        ["combinedCaught", () => combined.caught],
        [
          "aggregateContainsExactlyCombined",
          () =>
            aggregateContainsExactly(combined.failure, [
              primaryFailure,
              firstCleanupFailure,
              lastCleanupFailure,
            ]),
        ],
        ["combinedOrder", () => combined.order.join(",") === fullOrder],
        ["undefinedPrimaryCaught", () => undefinedPrimary.caught],
        [
          "undefinedPrimaryFailure",
          () => undefinedPrimary.failure === undefined,
        ],
        [
          "undefinedPrimaryOrder",
          () => undefinedPrimary.order.join(",") === fullOrder,
        ],
        ["undefinedStandaloneCaught", () => undefinedStandalone.caught],
        [
          "undefinedStandaloneFailure",
          () => undefinedStandalone.failure === undefined,
        ],
        [
          "undefinedStandaloneOrder",
          () => undefinedStandalone.order.join(",") === fullOrder,
        ],
        ["undefinedCombinedCaught", () => undefinedCombined.caught],
        [
          "aggregateContainsExactlyUndefinedCombined",
          () =>
            aggregateContainsExactly(undefinedCombined.failure, [
              undefined,
              undefined,
            ]),
        ],
        [
          "undefinedCombinedOrder",
          () => undefinedCombined.order.join(",") === fullOrder,
        ],
      ]),
      {
        successCaught: true,
        successFailure: true,
        successOrder: true,
        primaryOnlyCaught: true,
        primaryOnlyFailure: true,
        primaryOnlyOrder: true,
        standaloneCaught: true,
        standaloneFailure: true,
        standaloneOrder: true,
        multipleCaught: true,
        aggregateContainsExactlyMultiple: true,
        multipleMessage: true,
        multipleMessage2: true,
        multipleMessage3: true,
        multipleMessage4: true,
        multipleMessage5: true,
        multipleOrder: true,
        combinedCaught: true,
        aggregateContainsExactlyCombined: true,
        combinedOrder: true,
        undefinedPrimaryCaught: true,
        undefinedPrimaryFailure: true,
        undefinedPrimaryOrder: true,
        undefinedStandaloneCaught: true,
        undefinedStandaloneFailure: true,
        undefinedStandaloneOrder: true,
        undefinedCombinedCaught: true,
        aggregateContainsExactlyUndefinedCombined: true,
        undefinedCombinedOrder: true,
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
                "e6e9eae1d850495b8d84c2d82cec082861e6256e4a05933ecb723e079b9efecd",
              tokens: 307,
            },
            tryDigest:
              "2504545369ee8b910570e96f752ee5bd9f5e828434d66c2a9a9e74792d760fd0",
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
                "87e84fe4b64f682b45eb1cdbb4fe791cd7bfd8970f2e171b9d35099013005036",
              tokens: 273,
            },
            tryDigest:
              "97722c245cd421dbc1ccb234f715ffdfece032e41b9f97e815b8f0a5ef91ba62",
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
