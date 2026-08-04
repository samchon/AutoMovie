import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveProductionOracleHookCleanup } from "./test_mcp_production_oracle";

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

const productionOracleHookCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_oracle.ts",
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
    failureHolder: string;
    finallyDigest: string;
    finallySubstantive: { digest: string; tokens: number };
    index: number;
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
        "preserveProductionOracleHookCleanup(",
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
        failureHolder: compact(statements[index - 1]!, source),
        finallyDigest: digestText(node.finallyBlock.getText(source)),
        finallySubstantive: leafTokenContract(
          node.finallyBlock.statements,
          source,
        ),
        index,
        substantive: leafTokenContract(node.tryBlock.statements, source),
        tryBody: compact(node.tryBlock, source),
        tryDigest: digestText(node.tryBlock.getText(source)),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const policies = arrows.filter(
    (entry) => entry.name === "preserveProductionOracleHookCleanup",
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
        statement.name?.text === "ProductionOracleHookCleanupError"
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
  resources?: number;
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
      preserveProductionOracleHookCleanup(
        primaryState,
        Array.from({ length: props.resources ?? 2 }, (_, index) => ({
          resource: `hook-${index}`,
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

export const test_mcp_production_oracle_hook_cleanup = (): void => {
  const primaryFailure = { phase: "oracle preview" };
  const manifestFailure = { phase: "verified-manifest hook restoration" };
  const readFailure = { phase: "read-file hook restoration" };
  const cleanupFailures = [
    { error: manifestFailure, present: true as const },
    { error: readFailure, present: true as const },
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
  const selective = captureCleanup({
    cleanupFailures: [cleanupFailures[0], undefined, cleanupFailures[1]],
    resources: 3,
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
    "production-oracle hook cleanup preserves failure and restoration order",
    namedFacts([
      ["successCaught", () => success.caught === false],
      ["successFailure", () => success.failure === undefined],
      ["successOrder", () => success.order.join(",") === fullOrder],
      ["primaryOnlyCaught", () => primaryOnly.caught],
      ["primaryOnlyFailure", () => primaryOnly.failure === primaryFailure],
      ["primaryOnlyOrder", () => primaryOnly.order.join(",") === fullOrder],
      ["standaloneCaught", () => standalone.caught],
      ["standaloneFailure", () => standalone.failure === manifestFailure],
      ["standaloneOrder", () => standalone.order.join(",") === fullOrder],
      ["multipleCaught", () => multiple.caught],
      [
        "aggregateContainsExactlyMultiple",
        () =>
          aggregateContainsExactly(multiple.failure, [
            manifestFailure,
            readFailure,
          ]),
      ],
      ["multipleOrder", () => multiple.order.join(",") === fullOrder],
      ["combinedCaught", () => combined.caught],
      [
        "aggregateContainsExactlyCombined",
        () =>
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            manifestFailure,
            readFailure,
          ]),
      ],
      ["combinedOrder", () => combined.order.join(",") === fullOrder],
      ["selectiveCaught", () => selective.caught],
      [
        "aggregateContainsExactlySelective",
        () =>
          aggregateContainsExactly(selective.failure, [
            manifestFailure,
            readFailure,
          ]),
      ],
      ["selectiveMessage", () => selective.message.includes("hook-0")],
      ["selectiveMessage2", () => selective.message.includes("hook-2")],
      [
        "selectiveMessage3",
        () => selective.message.includes("hook-1") === false,
      ],
      [
        "selectiveOrder",
        () => selective.order.join(",") === "cleanup-0,cleanup-1,cleanup-2",
      ],
      ["undefinedPrimaryCaught", () => undefinedPrimary.caught],
      ["undefinedPrimaryFailure", () => undefinedPrimary.failure === undefined],
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
      multipleOrder: true,
      combinedCaught: true,
      aggregateContainsExactlyCombined: true,
      combinedOrder: true,
      selectiveCaught: true,
      aggregateContainsExactlySelective: true,
      selectiveMessage: true,
      selectiveMessage2: true,
      selectiveMessage3: true,
      selectiveOrder: true,
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
    "production-oracle test owns the retained-read hook lifecycle",
    productionOracleHookCleanupContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_production_oracle.ts"),
        "utf8",
      ),
    ),
    {
      lifecycles: [
        {
          catchBodies: ["retainedReadRaceFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "IfStatement",
          containerStatements: 28,
          failureHolder:
            "letretainedReadRaceFailure:IProductionOracleFixtureFailure|undefined;",
          finallyDigest:
            "f1ee7002d948b4b9644b30fca6933f7f609dfbfaf0f41bf38a67502f37eae851",
          finallySubstantive: {
            digest:
              "8c38c6b586a8dd81f93ae92bac314408ff651823e119c4bf8514394b5ae47a6e",
            tokens: 50,
          },
          index: 25,
          substantive: {
            digest:
              "3a412ec6181fa49d02ecdb3538ca08bc06ccb2e0b8d19b0155c150def01b6dab",
            tokens: 37,
          },
          tryBody:
            '{retainedReadRace=awaitactual.preview({target:{kind:"shot",id:"opening"},time:3/24,width:2,height:2,});}',
          tryDigest:
            "6c6da656fef8e0889ed9f6b1a400345fd25d3fd57d5dc724e29dc50fcf3154c8",
        },
      ],
      parseDiagnostics: [],
      policy: {
        bodies: [
          "{constcleanupFailures:Array<{error:unknown;resource:string}>=[];for(constresourceofresources)try{resource.cleanup();}catch(error){cleanupFailures.push({error,resource:resource.resource});}if(cleanupFailures.length===1&&failure===undefined)throwcleanupFailures[0]!.error;if(cleanupFailures.length!==0)thrownewProductionOracleHookCleanupError([...(failure===undefined?[]:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`Productionoraclehookcleanupfailed$" +
            '{failure===undefined?"":"afterthepreviewfailed"}:$' +
            '{cleanupFailures.map((entry)=>entry.resource).join(",")}.`,);}',
        ],
        classes: ["AggregateError"],
        count: 1,
        parameters: [
          [
            "failure:IProductionOracleFixtureFailure|undefined",
            "resources:readonlyIProductionOracleHookCleanup[]",
          ],
        ],
      },
    },
  );
};
