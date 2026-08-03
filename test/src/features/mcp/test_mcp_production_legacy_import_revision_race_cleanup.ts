import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

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

const legacyRevisionRaceCleanupContract = (text: string): unknown => {
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
        "preserveLegacyImportFixtureCleanup(",
      ) &&
      node.finallyBlock.getText(source).includes("revision-race open hook") &&
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
    (entry) => entry.name === "preserveLegacyImportFixtureCleanup",
  );
  return {
    lifecycles,
    parseDiagnostics: source.parseDiagnostics.map((diagnostic) =>
      String(diagnostic.messageText),
    ),
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
        Array.from({ length: 3 }, (_, index) => ({
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

export const test_mcp_production_legacy_import_revision_race_cleanup =
  (): void => {
    const primaryFailure = { phase: "legacy revision-race guard" };
    const firstCleanupFailure = { phase: "revision-race hook restoration" };
    const lastCleanupFailure = { phase: "revision-race resident restoration" };
    const cleanupFailures = [
      { error: firstCleanupFailure, present: true as const },
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
    const fullOrder = "cleanup-0,cleanup-1,cleanup-2";
    TestValidator.predicate(
      "legacy revision-race cleanup preserves failure and resource order",
      success.caught === false &&
        success.failure === undefined &&
        success.order.join(",") === fullOrder &&
        primaryOnly.caught &&
        primaryOnly.failure === primaryFailure &&
        primaryOnly.order.join(",") === fullOrder &&
        standalone.caught &&
        standalone.failure === firstCleanupFailure &&
        standalone.order.join(",") === fullOrder &&
        multiple.caught &&
        aggregateContainsExactly(multiple.failure, [
          firstCleanupFailure,
          lastCleanupFailure,
        ]) &&
        multiple.message.includes("resource-0") &&
        multiple.message.includes("resource-2") &&
        multiple.message.includes("resource-1") === false &&
        multiple.order.join(",") === fullOrder &&
        combined.caught &&
        aggregateContainsExactly(combined.failure, [
          primaryFailure,
          firstCleanupFailure,
          lastCleanupFailure,
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
    );
    TestValidator.equals(
      "legacy import owns the revision-race cleanup lifecycle",
      legacyRevisionRaceCleanupContract(
        fs.readFileSync(
          path.join(__dirname, "test_mcp_production_legacy_import.ts"),
          "utf8",
        ),
      ),
      {
        lifecycles: [
          {
            catchBodies: ["revisionRaceCleanupFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "TryStatement",
            containerStatements: 7,
            finallyDigest:
              "332728d798c8b527053d1cc0c04bfa0b209891e701919d4e120a71fcc34c78b0",
            finallySubstantive: {
              digest:
                "962d509d89497f01ce731e4a0ac65a202418f10a09a64fcbb76d86e6192ae49c",
              tokens: 99,
            },
            index: 6,
            preceding:
              "letrevisionRaceCleanupFailure:ILegacyImportFixtureFailure|undefined;",
            substantive: {
              digest:
                "16aae4a5b96e0510771358653b92502d38b1f9979c993b59c73f740fffd3d8a5",
              tokens: 31,
            },
            tryBody:
              '{TestValidator.predicate("achangingresidentrevisioncannotproduceamixedimportplan",throws(()=>newAutoMovieLegacyImporter(revisionRace.root).plan(),"changedphysicalidentity",)&&changed,);}',
            tryDigest:
              "e949f80ebf942f2779dbebfd4d42c63e2d14fd898a6982502c962447c71a40ce",
          },
        ],
        parseDiagnostics: [],
        policy: {
          bodies: [
            '{constcleanupFailures:Array<{error:unknown;resource:string}>=[];for(constresourceofresources)try{resource.cleanup();}catch(error){cleanupFailures.push({error,resource:resource.resource});}if(cleanupFailures.length===1&&failure===undefined)throwcleanupFailures[0]!.error;if(cleanupFailures.length!==0)thrownewLegacyImportFixtureCleanupError([...(failure===undefined?[]:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`Legacy-importfixturecleanupfailed${failure===undefined?"":"afterthetestfailed"}:${cleanupFailures.map((entry)=>entry.resource).join(",")}.`,);}',
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
