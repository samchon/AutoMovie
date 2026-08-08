import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";
import { preserveRenderJobFixtureCleanup } from "./test_mcp_production_render_job";

const compact = (node: ts.Node, source: ts.SourceFile): string =>
  node.getText(source).replace(/\s+/g, "");

const digest = (node: ts.Node, source: ts.SourceFile): string =>
  createHash("sha256").update(node.getText(source)).digest("hex");

const aggregateContainsExactly = (
  error: unknown,
  expected: readonly unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

const renderJobFixtureContract = (text: string): unknown => {
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
            ? [
                {
                  arrow: declaration.initializer,
                  name: declaration.name.text,
                },
              ]
            : [],
        )
      : [],
  );
  const owners = arrows.filter(
    (entry) => entry.name === "test_mcp_production_render_job",
  );
  const lifecycles: Array<{
    bodyStatements: number;
    catchBodies: string[];
    catchVariables: string[];
    finallyBodies: string[];
    index: number;
    prefixes: string[];
    tryDigest: string;
    tryPrefixes: string[];
  }> = [];
  for (const owner of owners) {
    const body = owner.arrow.body;
    if (ts.isBlock(body) === false) continue;
    for (const [index, lifecycle] of [...body.statements].entries()) {
      if (
        ts.isTryStatement(lifecycle) === false ||
        lifecycle.catchClause === undefined ||
        lifecycle.finallyBlock
          ?.getText(source)
          .includes("preserveRenderJobFixtureCleanup") !== true
      )
        continue;
      lifecycles.push({
        bodyStatements: body.statements.length,
        catchBodies: lifecycle.catchClause.block.statements.map((statement) =>
          compact(statement, source),
        ),
        catchVariables:
          lifecycle.catchClause.variableDeclaration === undefined
            ? []
            : [compact(lifecycle.catchClause.variableDeclaration, source)],
        finallyBodies: lifecycle.finallyBlock.statements.map((statement) =>
          compact(statement, source),
        ),
        index,
        prefixes: [...body.statements]
          .slice(Math.max(0, index - 3), index)
          .map((statement) => compact(statement, source)),
        tryDigest: digest(lifecycle.tryBlock, source),
        tryPrefixes: [...lifecycle.tryBlock.statements]
          .slice(0, 1)
          .map((statement) => compact(statement, source)),
      });
    }
  }
  const policies = arrows.filter(
    (entry) => entry.name === "preserveRenderJobFixtureCleanup",
  );
  return {
    owner: { count: owners.length, lifecycles },
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
}): { caught: boolean; failure: unknown; order: string[] } => {
  let caught = false;
  const order: string[] = [];
  let failure: unknown;
  try {
    preserveRenderJobFixtureCleanup(
      props.primaryFailure === undefined
        ? undefined
        : { error: props.primaryFailure.error },
      Array.from({ length: props.resources ?? 2 }, (_, index) => ({
        resource: `resource-${index}`,
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

export const test_mcp_production_render_job_fixture_cleanup = (): void => {
  const primaryFailure = { phase: "owned-file regression" };
  const firstCleanupFailure = { phase: "owned root removal" };
  const secondCleanupFailure = { phase: "outside root removal" };
  const success = captureCleanup({});
  const partialSetup = captureCleanup({
    primaryFailure: { error: primaryFailure, present: true },
    resources: 1,
  });
  const primaryOnly = captureCleanup({
    primaryFailure: { error: primaryFailure, present: true },
  });
  const standalone = captureCleanup({
    cleanupFailures: [{ error: firstCleanupFailure, present: true }],
  });
  const multiple = captureCleanup({
    cleanupFailures: [
      { error: firstCleanupFailure, present: true },
      { error: secondCleanupFailure, present: true },
    ],
  });
  const combined = captureCleanup({
    cleanupFailures: [
      { error: firstCleanupFailure, present: true },
      { error: secondCleanupFailure, present: true },
    ],
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
  TestValidator.equals(
    "render-job fixture cleanup preserves acquisition and failure order",
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
          success.order.join(",") === "cleanup-0,cleanup-1",
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
      ["primaryOnlyCaught", () => primaryOnly.caught],
      [
        "primaryOnlyFailurePrimaryFailure",
        () => primaryOnly.failure === primaryFailure,
      ],
      [
        "primaryOnlyOrderJoin",
        () => primaryOnly.order.join(",") === "cleanup-0,cleanup-1",
      ],
      ["standaloneCaught", () => standalone.caught],
      [
        "standaloneFailureFirstCleanupFailure",
        () => standalone.failure === firstCleanupFailure,
      ],
      [
        "standaloneOrderJoin",
        () => standalone.order.join(",") === "cleanup-0,cleanup-1",
      ],
      ["multipleCaught", () => multiple.caught],
      [
        "aggregateContainsExactlyMultipleFailure",
        () =>
          aggregateContainsExactly(multiple.failure, [
            firstCleanupFailure,
            secondCleanupFailure,
          ]),
      ],
      [
        "multipleOrderJoin",
        () => multiple.order.join(",") === "cleanup-0,cleanup-1",
      ],
      ["combinedCaught", () => combined.caught],
      [
        "aggregateContainsExactlyCombinedFailure",
        () =>
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            firstCleanupFailure,
            secondCleanupFailure,
          ]),
      ],
      [
        "combinedOrderJoin",
        () => combined.order.join(",") === "cleanup-0,cleanup-1",
      ],
      ["undefinedPrimaryCaught", () => undefinedPrimary.caught],
      ["undefinedPrimaryFailure", () => undefinedPrimary.failure === undefined],
      [
        "undefinedPrimaryOrderJoin",
        () => undefinedPrimary.order.join(",") === "cleanup-0,cleanup-1",
      ],
      ["undefinedStandaloneCaught", () => undefinedStandalone.caught],
      [
        "undefinedStandaloneFailure",
        () => undefinedStandalone.failure === undefined,
      ],
      [
        "undefinedStandaloneOrderJoin",
        () => undefinedStandalone.order.join(",") === "cleanup-0,cleanup-1",
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
        () => undefinedCombined.order.join(",") === "cleanup-0,cleanup-1",
      ],
    ]),
    {
      successCaught: true,
      successFailure: true,
      successOrderJoin: true,
      partialSetupCaught: true,
      partialSetupFailurePrimaryFailure: true,
      partialSetupOrderJoin: true,
      primaryOnlyCaught: true,
      primaryOnlyFailurePrimaryFailure: true,
      primaryOnlyOrderJoin: true,
      standaloneCaught: true,
      standaloneFailureFirstCleanupFailure: true,
      standaloneOrderJoin: true,
      multipleCaught: true,
      aggregateContainsExactlyMultipleFailure: true,
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
    "render-job regression owns both temporary roots",
    renderJobFixtureContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_production_render_job.ts"),
        "utf8",
      ),
    ),
    {
      owner: {
        count: 1,
        lifecycles: [
          {
            bodyStatements: 169,
            catchBodies: ["renderJobFixtureFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            finallyBodies: [
              "constcompletedOutsideRoot=outsideRoot;",
              'preserveRenderJobFixtureCleanup(renderJobFixtureFailure,[{resource:"ownedfixtureroot",cleanup:()=>fs.rmSync(ownedRoot,{force:true,recursive:true}),},...(completedOutsideRoot===undefined?[]:[{resource:"outsidefixtureroot",cleanup:()=>fs.rmSync(completedOutsideRoot,{force:true,recursive:true,}),},]),]);',
            ],
            index: 168,
            prefixes: [
              'constownedRoot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-render-owned-"),);',
              "letoutsideRoot:string|undefined;",
              "letrenderJobFixtureFailure:IRenderJobFixtureFailure|undefined;",
            ],
            tryDigest:
              "d2e7148c2a071c10f4857f3643ab631e7d960fb35db5b48d68d9dc59f36e13d1",
            tryPrefixes: [
              'outsideRoot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-render-outside-"),);',
            ],
          },
        ],
      },
      policy: {
        bodies: [
          "{constcleanupFailures:Array<{error:unknown;resource:string}>=[];for(constresourceofresources)try{resource.cleanup();}catch(error){cleanupFailures.push({error,resource:resource.resource});}if(cleanupFailures.length===1&&failure===undefined)throwcleanupFailures[0]!.error;if(cleanupFailures.length!==0)thrownewRenderJobFixtureCleanupError([...(failure===undefined?[]:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`Render-jobfixturecleanupfailed$" +
            '{failure===undefined?"":"afterthetestfailed"}:$' +
            '{cleanupFailures.map((entry)=>entry.resource).join(",")}.`,);}',
        ],
        classes: ["AggregateError"],
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
