import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";
import { preserveRenderJobFixtureCleanup } from "./test_mcp_production_render_job";

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

const renderJobHookCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_render_job.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const arrows = source.statements.flatMap((statement) =>
    ts.isVariableStatement(statement)
      ? [...statement.declarationList.declarations].flatMap((declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.initializer !== undefined &&
          ts.isArrowFunction(declaration.initializer)
            ? [{ arrow: declaration.initializer, name: declaration.name.text }]
            : [],
        )
      : [],
  );
  const owners = arrows.filter(
    (entry) => entry.name === "captureProductionOwnedDescriptorFailure",
  );
  const lifecycles: Array<{
    catchBodies: string[];
    catchVariables: string[];
    containerKind: string;
    containerStatements: number;
    failureHolder: string;
    finallyDigest: string;
    finallySubstantive: { digest: string; tokens: number };
    index: number;
    returnBody: string;
    substantive: { digest: string; tokens: number };
    tryBody: string;
    tryDigest: string;
  }> = [];
  for (const owner of owners) {
    const body = owner.arrow.body;
    if (ts.isBlock(body) === false) continue;
    for (const [index, statement] of [...body.statements].entries())
      if (
        ts.isTryStatement(statement) &&
        statement.catchClause !== undefined &&
        statement.finallyBlock !== undefined &&
        compact(statement.finallyBlock, source).includes(
          "preserveRenderJobFixtureCleanup(descriptorReadFailure",
        )
      )
        lifecycles.push({
          catchBodies: statement.catchClause.block.statements.map((child) =>
            compact(child, source),
          ),
          catchVariables:
            statement.catchClause.variableDeclaration === undefined
              ? []
              : [compact(statement.catchClause.variableDeclaration, source)],
          containerKind: ts.SyntaxKind[body.parent.kind]!,
          containerStatements: body.statements.length,
          failureHolder: compact(body.statements[index - 1]!, source),
          finallyDigest: digestText(statement.finallyBlock.getText(source)),
          finallySubstantive: leafTokenContract(
            statement.finallyBlock.statements,
            source,
          ),
          index,
          returnBody: compact(body.statements[index + 1]!, source),
          substantive: leafTokenContract(statement.tryBlock.statements, source),
          tryBody: compact(statement.tryBlock, source),
          tryDigest: digestText(statement.tryBlock.getText(source)),
        });
  }
  const policies = arrows.filter(
    (entry) => entry.name === "preserveRenderJobFixtureCleanup",
  );
  return {
    lifecycles,
    ownerCount: owners.length,
    parseDiagnostics: (
      source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics.map((diagnostic) => String(diagnostic.messageText)),
    policy: {
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "RenderJobFixtureCleanupError"
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
}): {
  captured: boolean;
  capturedFailure: unknown;
  cleanupCaught: boolean;
  cleanupFailure: unknown;
  message: string;
  order: string[];
  returned: boolean;
} => {
  let captured = false;
  let capturedFailure: unknown;
  let cleanupCaught = false;
  let cleanupFailure: unknown;
  let message = "";
  const order: string[] = [];
  let returned = false;
  try {
    let primaryState: { error: unknown } | undefined;
    try {
      if (props.primaryFailure !== undefined) throw props.primaryFailure.error;
    } catch (error) {
      captured = true;
      capturedFailure = error;
      primaryState = { error };
    } finally {
      preserveRenderJobFixtureCleanup(
        primaryState,
        Array.from({ length: props.resources ?? 3 }, (_, index) => ({
          resource: `hook-${index}`,
          cleanup: (): void => {
            order.push(`cleanup-${index}`);
            const cleanupFailure = props.cleanupFailures?.[index];
            if (cleanupFailure !== undefined) throw cleanupFailure.error;
          },
        })),
      );
    }
    returned = true;
  } catch (error) {
    cleanupCaught = true;
    cleanupFailure = error;
    if (error instanceof Error) message = error.message;
  }
  return {
    captured,
    capturedFailure,
    cleanupCaught,
    cleanupFailure,
    message,
    order,
    returned,
  };
};

export const test_mcp_production_render_job_hook_cleanup = (): void => {
  const primaryFailure = { phase: "owned-file read" };
  const openFailure = { phase: "open hook restoration" };
  const closeFailure = { phase: "close hook restoration" };
  const cleanupFailures = [
    { error: openFailure, present: true as const },
    undefined,
    { error: closeFailure, present: true as const },
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
  TestValidator.equals(
    "owned-descriptor harness cleanup preserves capture and restoration order",
    namedFacts([
      ["successReturned", () => success.returned],
      ["successCaptured", () => success.returned && success.captured === false],
      [
        "successCleanupCaught",
        () =>
          success.returned &&
          success.captured === false &&
          success.cleanupCaught === false,
      ],
      [
        "successOrderJoin",
        () =>
          success.returned &&
          success.captured === false &&
          success.cleanupCaught === false &&
          success.order.join(",") === fullOrder,
      ],
      ["primaryOnlyReturned", () => primaryOnly.returned],
      ["primaryOnlyCaptured", () => primaryOnly.captured],
      [
        "primaryOnlyCapturedFailurePrimaryFailure",
        () => primaryOnly.capturedFailure === primaryFailure,
      ],
      ["primaryOnlyCleanupCaught", () => primaryOnly.cleanupCaught === false],
      ["primaryOnlyOrderJoin", () => primaryOnly.order.join(",") === fullOrder],
      ["standaloneReturned", () => standalone.returned === false],
      ["standaloneCaptured", () => standalone.captured === false],
      ["standaloneCleanupCaught", () => standalone.cleanupCaught],
      [
        "standaloneCleanupFailureOpenFailure",
        () => standalone.cleanupFailure === openFailure,
      ],
      ["standaloneOrderJoin", () => standalone.order.join(",") === fullOrder],
      ["multipleCleanupCaught", () => multiple.cleanupCaught],
      [
        "aggregateContainsExactlyMultipleCleanupFailure",
        () =>
          aggregateContainsExactly(multiple.cleanupFailure, [
            openFailure,
            closeFailure,
          ]),
      ],
      ["multipleMessageIncludes", () => multiple.message.includes("hook-0")],
      ["multipleMessageIncludes2", () => multiple.message.includes("hook-2")],
      [
        "multipleMessageIncludes3",
        () => multiple.message.includes("hook-1") === false,
      ],
      ["multipleOrderJoin", () => multiple.order.join(",") === fullOrder],
      ["combinedCaptured", () => combined.captured],
      [
        "combinedCapturedFailurePrimaryFailure",
        () => combined.capturedFailure === primaryFailure,
      ],
      ["combinedCleanupCaught", () => combined.cleanupCaught],
      [
        "aggregateContainsExactlyCombinedCleanupFailure",
        () =>
          aggregateContainsExactly(combined.cleanupFailure, [
            primaryFailure,
            openFailure,
            closeFailure,
          ]),
      ],
      ["combinedOrderJoin", () => combined.order.join(",") === fullOrder],
      ["undefinedPrimaryReturned", () => undefinedPrimary.returned],
      ["undefinedPrimaryCaptured", () => undefinedPrimary.captured],
      [
        "undefinedPrimaryCapturedFailure",
        () => undefinedPrimary.capturedFailure === undefined,
      ],
      [
        "undefinedPrimaryCleanupCaught",
        () => undefinedPrimary.cleanupCaught === false,
      ],
      [
        "undefinedPrimaryOrderJoin",
        () => undefinedPrimary.order.join(",") === fullOrder,
      ],
      [
        "undefinedStandaloneReturned",
        () => undefinedStandalone.returned === false,
      ],
      [
        "undefinedStandaloneCaptured",
        () => undefinedStandalone.captured === false,
      ],
      [
        "undefinedStandaloneCleanupCaught",
        () => undefinedStandalone.cleanupCaught,
      ],
      [
        "undefinedStandaloneCleanupFailure",
        () => undefinedStandalone.cleanupFailure === undefined,
      ],
      [
        "undefinedStandaloneOrderJoin",
        () => undefinedStandalone.order.join(",") === fullOrder,
      ],
      ["undefinedCombinedReturned", () => undefinedCombined.returned === false],
      ["undefinedCombinedCaptured", () => undefinedCombined.captured],
      [
        "undefinedCombinedCapturedFailure",
        () => undefinedCombined.capturedFailure === undefined,
      ],
      ["undefinedCombinedCleanupCaught", () => undefinedCombined.cleanupCaught],
      [
        "aggregateContainsExactlyUndefinedCombinedCleanupFailure",
        () =>
          aggregateContainsExactly(undefinedCombined.cleanupFailure, [
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
      successReturned: true,
      successCaptured: true,
      successCleanupCaught: true,
      successOrderJoin: true,
      primaryOnlyReturned: true,
      primaryOnlyCaptured: true,
      primaryOnlyCapturedFailurePrimaryFailure: true,
      primaryOnlyCleanupCaught: true,
      primaryOnlyOrderJoin: true,
      standaloneReturned: true,
      standaloneCaptured: true,
      standaloneCleanupCaught: true,
      standaloneCleanupFailureOpenFailure: true,
      standaloneOrderJoin: true,
      multipleCleanupCaught: true,
      aggregateContainsExactlyMultipleCleanupFailure: true,
      multipleMessageIncludes: true,
      multipleMessageIncludes2: true,
      multipleMessageIncludes3: true,
      multipleOrderJoin: true,
      combinedCaptured: true,
      combinedCapturedFailurePrimaryFailure: true,
      combinedCleanupCaught: true,
      aggregateContainsExactlyCombinedCleanupFailure: true,
      combinedOrderJoin: true,
      undefinedPrimaryReturned: true,
      undefinedPrimaryCaptured: true,
      undefinedPrimaryCapturedFailure: true,
      undefinedPrimaryCleanupCaught: true,
      undefinedPrimaryOrderJoin: true,
      undefinedStandaloneReturned: true,
      undefinedStandaloneCaptured: true,
      undefinedStandaloneCleanupCaught: true,
      undefinedStandaloneCleanupFailure: true,
      undefinedStandaloneOrderJoin: true,
      undefinedCombinedReturned: true,
      undefinedCombinedCaptured: true,
      undefinedCombinedCapturedFailure: true,
      undefinedCombinedCleanupCaught: true,
      aggregateContainsExactlyUndefinedCombinedCleanupFailure: true,
      undefinedCombinedOrderJoin: true,
    },
  );
  TestValidator.equals(
    "render-job descriptor capture owns its three hook restorations",
    renderJobHookCleanupContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_production_render_job.ts"),
        "utf8",
      ),
    ),
    {
      lifecycles: [
        {
          catchBodies: ["caught=error;", "descriptorReadFailure={error};"],
          catchVariables: ["error"],
          containerKind: "ArrowFunction",
          containerStatements: 16,
          failureHolder:
            "letdescriptorReadFailure:IRenderJobFixtureFailure|undefined;",
          finallyDigest:
            "25c7150a85c2876682418b8f90d82d63ad202e8945cba4e51ab704a4e144c336",
          finallySubstantive: {
            digest:
              "ccc3f3d386540bd1f8980292225e7088fc2b914c370e76cf2c853aa732daba82",
            tokens: 71,
          },
          index: 14,
          returnBody:
            "return{caught,primaryFailure,residentCloseFailure,sourceCloseFailure,};",
          substantive: {
            digest:
              "5b33c5f97699e9bda866afd66c0aa57b23b12ec3484a794cf8641989cc8da8f9",
            tokens: 5,
          },
          tryBody: "{readAutoMovieProductionOwnedFile(props);}",
          tryDigest:
            "0d1e8b7bf5de8c4f9784dd21c2426491801eb7a87ca1715b5290888bdb390ab8",
        },
      ],
      ownerCount: 1,
      parseDiagnostics: [],
      policy: {
        bodies: [
          "{constcleanupFailures:Array<{error:unknown;resource:string}>=[];for(constresourceofresources)try{resource.cleanup();}catch(error){cleanupFailures.push({error,resource:resource.resource});}if(cleanupFailures.length===1&&failure===undefined)throwcleanupFailures[0]!.error;if(cleanupFailures.length!==0)thrownewRenderJobFixtureCleanupError([...(failure===undefined?[]:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`Render-jobfixturecleanupfailed$" +
            '{failure===undefined?"":"afterthetestfailed"}:$' +
            '{cleanupFailures.map((entry)=>entry.resource).join(",")}.`,);}',
        ],
        classes: ["AggregateError"],
        count: 1,
        parameters: [
          [
            "failure:IRenderJobFixtureFailure|undefined",
            "resources:readonlyIRenderJobFixtureCleanup[]",
          ],
        ],
      },
    },
  );
};
