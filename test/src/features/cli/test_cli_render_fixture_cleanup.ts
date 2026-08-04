import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveCliRenderFixtureCleanup } from "./test_cli_render";

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

const digest = (node: ts.Node, source: ts.SourceFile): string =>
  createHash("sha256").update(node.getText(source)).digest("hex");

const aggregateContainsExactly = (
  error: unknown,
  expected: readonly unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

const cliRenderFixtureContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_render.ts",
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
  const owners = arrows.filter((entry) => entry.name === "test_cli_render");
  const lifecycles: Array<{
    catchBodies: string[];
    catchVariables: string[];
    finallyBodies: string[];
    prefixes: string[];
    tryDigest: string;
  }> = [];
  for (const owner of owners) {
    const body = owner.arrow.body;
    if (ts.isBlock(body) === false || body.statements.length !== 5) continue;
    const lifecycle = body.statements[4];
    const catchClause =
      lifecycle !== undefined && ts.isTryStatement(lifecycle)
        ? lifecycle.catchClause
        : undefined;
    const finallyBlock =
      lifecycle !== undefined && ts.isTryStatement(lifecycle)
        ? lifecycle.finallyBlock
        : undefined;
    if (
      lifecycle === undefined ||
      ts.isTryStatement(lifecycle) === false ||
      catchClause === undefined ||
      finallyBlock === undefined
    )
      continue;
    lifecycles.push({
      catchBodies: catchClause.block.statements.map((statement) =>
        compact(statement, source),
      ),
      catchVariables:
        catchClause.variableDeclaration === undefined
          ? []
          : [compact(catchClause.variableDeclaration, source)],
      finallyBodies: finallyBlock.statements.map((statement) =>
        compact(statement, source),
      ),
      prefixes: [...body.statements]
        .slice(0, 4)
        .map((statement) => compact(statement, source)),
      tryDigest: digest(lifecycle.tryBlock, source),
    });
  }
  const policies = arrows.filter(
    (entry) => entry.name === "preserveCliRenderFixtureCleanup",
  );
  return {
    owner: { count: owners.length, lifecycles },
    policy: {
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "CliRenderFixtureCleanupError"
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
  cleanupFailures?: readonly unknown[];
  primaryFailure?: unknown;
  resources?: number;
}): { failure: unknown; order: string[] } => {
  const order: string[] = [];
  let failure: unknown;
  try {
    preserveCliRenderFixtureCleanup(
      props.primaryFailure === undefined
        ? undefined
        : { error: props.primaryFailure },
      Array.from({ length: props.resources ?? 3 }, (_, index) => ({
        resource: `resource-${index}`,
        cleanup: (): void => {
          order.push(`cleanup-${index}`);
          const cleanupFailure = props.cleanupFailures?.[index];
          if (cleanupFailure !== undefined) throw cleanupFailure as Error;
        },
      })),
    );
    if (props.primaryFailure !== undefined) throw props.primaryFailure as Error;
  } catch (error) {
    failure = error;
  }
  return { failure, order };
};

export const test_cli_render_fixture_cleanup = (): void => {
  const primaryFailure = { phase: "CLI render test" };
  const firstCleanupFailure = { phase: "cwd restoration" };
  const secondCleanupFailure = { phase: "outside root removal" };
  const success = captureCleanup({});
  const partialSetup = captureCleanup({ primaryFailure, resources: 2 });
  const primaryOnly = captureCleanup({ primaryFailure });
  const standalone = captureCleanup({
    cleanupFailures: [firstCleanupFailure],
  });
  const multiple = captureCleanup({
    cleanupFailures: [firstCleanupFailure, secondCleanupFailure],
  });
  const combined = captureCleanup({
    cleanupFailures: [firstCleanupFailure, secondCleanupFailure],
    primaryFailure,
  });
  TestValidator.equals(
    "CLI render fixture cleanup preserves acquisition and failure order",
    namedFacts([
      ["successFailure", () => success.failure === undefined],
      [
        "successOrder",
        () => success.order.join(",") === "cleanup-0,cleanup-1,cleanup-2",
      ],
      ["partialSetupFailure", () => partialSetup.failure === primaryFailure],
      [
        "partialSetupOrder",
        () => partialSetup.order.join(",") === "cleanup-0,cleanup-1",
      ],
      ["primaryOnlyFailure", () => primaryOnly.failure === primaryFailure],
      [
        "primaryOnlyOrder",
        () => primaryOnly.order.join(",") === "cleanup-0,cleanup-1,cleanup-2",
      ],
      ["standaloneFailure", () => standalone.failure === firstCleanupFailure],
      [
        "standaloneOrder",
        () => standalone.order.join(",") === "cleanup-0,cleanup-1,cleanup-2",
      ],
      [
        "aggregateContainsExactlyMultiple",
        () =>
          aggregateContainsExactly(multiple.failure, [
            firstCleanupFailure,
            secondCleanupFailure,
          ]),
      ],
      [
        "multipleOrder",
        () => multiple.order.join(",") === "cleanup-0,cleanup-1,cleanup-2",
      ],
      [
        "aggregateContainsExactlyCombined",
        () =>
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            firstCleanupFailure,
            secondCleanupFailure,
          ]),
      ],
      [
        "combinedOrder",
        () => combined.order.join(",") === "cleanup-0,cleanup-1,cleanup-2",
      ],
    ]),
    {
      successFailure: true,
      successOrder: true,
      partialSetupFailure: true,
      partialSetupOrder: true,
      primaryOnlyFailure: true,
      primaryOnlyOrder: true,
      standaloneFailure: true,
      standaloneOrder: true,
      aggregateContainsExactlyMultiple: true,
      multipleOrder: true,
      aggregateContainsExactlyCombined: true,
      combinedOrder: true,
    },
  );
  TestValidator.equals(
    "CLI render test owns cwd and every acquired temporary root",
    cliRenderFixtureContract(
      fs.readFileSync(path.join(__dirname, "test_cli_render.ts"), "utf8"),
    ),
    {
      owner: {
        count: 1,
        lifecycles: [
          {
            catchBodies: ["renderFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            finallyBodies: [
              "constcompletedProjectRoot=projectRoot;",
              'preserveCliRenderFixtureCleanup(renderFailure,[{resource:"workingdirectory",cleanup:()=>process.chdir(nativeCwd),},{resource:"outsidefixtureroot",cleanup:()=>fs.rmSync(outside,{force:true,recursive:true}),},...(completedProjectRoot===undefined?[]:[{resource:"projectfixtureroot",cleanup:()=>fs.rmSync(completedProjectRoot,{force:true,recursive:true,}),},]),]);',
            ],
            prefixes: [
              "constnativeCwd=process.cwd();",
              'constoutside=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-cli-out-"));',
              "letprojectRoot:string|undefined;",
              "letrenderFailure:ICliRenderFixtureFailure|undefined;",
            ],
            tryDigest:
              "b1f9df682652d6fe4fba0d4b46842951fb5f6dfcd792811f1e2646e2818f23be",
          },
        ],
      },
      policy: {
        bodies: [
          "{constcleanupFailures:Array<{error:unknown;resource:string}>=[];for(constresourceofresources)try{resource.cleanup();}catch(error){cleanupFailures.push({error,resource:resource.resource});}if(cleanupFailures.length===1&&failure===undefined)throwcleanupFailures[0]!.error;if(cleanupFailures.length!==0)thrownewCliRenderFixtureCleanupError([...(failure===undefined?[]:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`CLIrenderfixturecleanupfailed$" +
            '{failure===undefined?"":"afterthetestfailed"}:$' +
            '{cleanupFailures.map((entry)=>entry.resource).join(",")}.`,);}',
        ],
        classes: ["AggregateError"],
        parameters: [
          [
            "failure:ICliRenderFixtureFailure|undefined",
            "resources:readonlyICliRenderFixtureCleanup[]",
          ],
        ],
      },
    },
  );
};
