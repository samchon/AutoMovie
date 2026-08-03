import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveCreateAutoMovieFixtureCleanup } from "./test_cli_create_automovie";

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

const createAutoMovieFixtureContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_create_automovie.ts",
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
    (entry) => entry.name === "test_cli_create_automovie",
  );
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
    (entry) => entry.name === "preserveCreateAutoMovieFixtureCleanup",
  );
  return {
    owner: { count: owners.length, lifecycles },
    policy: {
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "CreateAutoMovieFixtureCleanupError"
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
  cleanupFailures?: readonly (unknown | undefined)[];
  primaryFailure?: unknown;
  resources?: number;
}): { failure: unknown; order: string[] } => {
  const order: string[] = [];
  let failure: unknown;
  try {
    preserveCreateAutoMovieFixtureCleanup(
      props.primaryFailure === undefined
        ? undefined
        : { error: props.primaryFailure },
      Array.from({ length: props.resources ?? 2 }, (_, index) => ({
        resource: `resource-${index}`,
        cleanup: (): void => {
          order.push(`cleanup-${index}`);
          const cleanupFailure = props.cleanupFailures?.[index];
          if (cleanupFailure !== undefined) throw cleanupFailure;
        },
      })),
    );
    if (props.primaryFailure !== undefined) throw props.primaryFailure;
  } catch (error) {
    failure = error;
  }
  return { failure, order };
};

export const test_cli_create_automovie_fixture_cleanup = (): void => {
  const primaryFailure = { phase: "create-automovie test" };
  const firstCleanupFailure = { phase: "stdout restoration" };
  const secondCleanupFailure = { phase: "temporary root removal" };
  const success = captureCleanup({});
  const partialSetup = captureCleanup({ primaryFailure, resources: 1 });
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
  TestValidator.predicate(
    "create-automovie fixture cleanup preserves acquisition and failure order",
    success.failure === undefined &&
      success.order.join(",") === "cleanup-0,cleanup-1" &&
      partialSetup.failure === primaryFailure &&
      partialSetup.order.join(",") === "cleanup-0" &&
      primaryOnly.failure === primaryFailure &&
      primaryOnly.order.join(",") === "cleanup-0,cleanup-1" &&
      standalone.failure === firstCleanupFailure &&
      standalone.order.join(",") === "cleanup-0,cleanup-1" &&
      aggregateContainsExactly(multiple.failure, [
        firstCleanupFailure,
        secondCleanupFailure,
      ]) &&
      multiple.order.join(",") === "cleanup-0,cleanup-1" &&
      aggregateContainsExactly(combined.failure, [
        primaryFailure,
        firstCleanupFailure,
        secondCleanupFailure,
      ]) &&
      combined.order.join(",") === "cleanup-0,cleanup-1",
  );
  TestValidator.equals(
    "create-automovie test owns stdout capture and its temporary root",
    createAutoMovieFixtureContract(
      fs.readFileSync(
        path.join(__dirname, "test_cli_create_automovie.ts"),
        "utf8",
      ),
    ),
    {
      owner: {
        count: 1,
        lifecycles: [
          {
            catchBodies: ["createFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            finallyBodies: [
              "constcompletedStdoutCapture=stdoutCaptureInstalled;",
              'preserveCreateAutoMovieFixtureCleanup(createFailure,[...(completedStdoutCapture?[{resource:"standardoutput",cleanup:():void=>{process.stdout.write=nativeStdout;},},]:[]),{resource:"temporaryprojectroot",cleanup:()=>fs.rmSync(base,{force:true,recursive:true}),},]);',
            ],
            prefixes: [
              "constnativeStdout=process.stdout.write;",
              'constbase=fs.mkdtempSync(path.join(os.tmpdir(),"create-automovie-"));',
              "letstdoutCaptureInstalled=false;",
              "letcreateFailure:ICreateAutoMovieFixtureFailure|undefined;",
            ],
            tryDigest:
              "8f03014dd68a50d9b69f43dafcc509670be20fd7d0c5a29d9d6062ea6186f895",
          },
        ],
      },
      policy: {
        bodies: [
          '{constcleanupFailures:Array<{error:unknown;resource:string}>=[];for(constresourceofresources)try{resource.cleanup();}catch(error){cleanupFailures.push({error,resource:resource.resource});}if(cleanupFailures.length===1&&failure===undefined)throwcleanupFailures[0]!.error;if(cleanupFailures.length!==0)thrownewCreateAutoMovieFixtureCleanupError([...(failure===undefined?[]:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`Create-automoviefixturecleanupfailed${failure===undefined?"":"afterthetestfailed"}:${cleanupFailures.map((entry)=>entry.resource).join(",")}.`,);}',
        ],
        classes: ["AggregateError"],
        parameters: [
          [
            "failure:ICreateAutoMovieFixtureFailure|undefined",
            "resources:readonlyICreateAutoMovieFixtureCleanup[]",
          ],
        ],
      },
    },
  );
};
