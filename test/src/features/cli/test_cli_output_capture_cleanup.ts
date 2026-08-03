import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveCliOutputCaptureCleanup } from "./CliOutputCapture";

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

const cliOutputCaptureContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "CliOutputCapture.ts",
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
  const owners = arrows.filter((entry) => entry.name === "captureCliOutput");
  const lifecycles: Array<{
    catchBodies: string[];
    catchVariables: string[];
    finallyBodies: string[];
    prefixes: string[];
    tryDigest: string;
  }> = [];
  for (const owner of owners) {
    const body = owner.arrow.body;
    if (ts.isBlock(body) === false || body.statements.length !== 8) continue;
    const lifecycle = body.statements[7];
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
        .slice(0, 7)
        .map((statement) => compact(statement, source)),
      tryDigest: digest(lifecycle.tryBlock, source),
    });
  }
  const policies = arrows.filter(
    (entry) => entry.name === "preserveCliOutputCaptureCleanup",
  );
  return {
    owner: { count: owners.length, lifecycles },
    policy: {
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "CliOutputCaptureCleanupError"
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

const cliOutputConsumerContract = (
  file: string,
  functionName: string,
): unknown => {
  const text = fs.readFileSync(path.join(__dirname, file), "utf8");
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const localCaptures = source.statements.flatMap((statement) =>
    ts.isVariableStatement(statement)
      ? [...statement.declarationList.declarations].filter(
          (declaration) =>
            ts.isIdentifier(declaration.name) &&
            declaration.name.text === "captureCli",
        )
      : [],
  );
  const imports = source.statements.flatMap((statement) => {
    if (
      ts.isImportDeclaration(statement) === false ||
      ts.isStringLiteral(statement.moduleSpecifier) === false ||
      statement.moduleSpecifier.text !== "./CliOutputCapture"
    )
      return [];
    return (
      statement.importClause?.namedBindings !== undefined &&
      ts.isNamedImports(statement.importClause.namedBindings)
        ? statement.importClause.namedBindings.elements
        : []
    ).map(
      (element) =>
        `${element.propertyName?.text ?? element.name.text}:${element.name.text}`,
    );
  });
  const functions = source.statements.flatMap((statement) =>
    ts.isVariableStatement(statement)
      ? [...statement.declarationList.declarations].flatMap((declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === functionName &&
          declaration.initializer !== undefined &&
          ts.isArrowFunction(declaration.initializer) &&
          ts.isBlock(declaration.initializer.body)
            ? [digest(declaration.initializer.body, source)]
            : [],
        )
      : [],
  );
  return { functions, imports, localCaptures: localCaptures.length };
};

const captureCleanup = (props: {
  cleanupFailures?: readonly (unknown | undefined)[];
  primaryFailure?: unknown;
  resources?: number;
}): { failure: unknown; order: string[] } => {
  const order: string[] = [];
  let failure: unknown;
  try {
    preserveCliOutputCaptureCleanup(
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

export const test_cli_output_capture_cleanup = (): void => {
  const primaryFailure = { phase: "CLI invocation" };
  const firstCleanupFailure = { phase: "stdout restoration" };
  const secondCleanupFailure = { phase: "stderr restoration" };
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
    "CLI output capture preserves acquisition and restoration failure order",
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
    "CLI output capture owns both installed stream hooks",
    cliOutputCaptureContract(
      fs.readFileSync(path.join(__dirname, "CliOutputCapture.ts"), "utf8"),
    ),
    {
      owner: {
        count: 1,
        lifecycles: [
          {
            catchBodies: ["captureFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            finallyBodies: [
              "constcompletedStdoutCapture=stdoutCaptureInstalled;",
              "constcompletedStderrCapture=stderrCaptureInstalled;",
              'preserveCliOutputCaptureCleanup(captureFailure,[...(completedStdoutCapture?[{resource:"standardoutput",cleanup:():void=>{process.stdout.write=nativeStdout;},},]:[]),...(completedStderrCapture?[{resource:"standarderror",cleanup:():void=>{process.stderr.write=nativeStderr;},},]:[]),]);',
            ],
            prefixes: [
              "constnativeStdout=process.stdout.write;",
              "constnativeStderr=process.stderr.write;",
              'letstdout="";',
              'letstderr="";',
              "letstdoutCaptureInstalled=false;",
              "letstderrCaptureInstalled=false;",
              "letcaptureFailure:ICliOutputCaptureFailure|undefined;",
            ],
            tryDigest:
              "511b0c4f49b51922a137a892fe823a44dcb03bea26d233c7a866624c2ed26fda",
          },
        ],
      },
      policy: {
        bodies: [
          '{constcleanupFailures:Array<{error:unknown;resource:string}>=[];for(constresourceofresources)try{resource.cleanup();}catch(error){cleanupFailures.push({error,resource:resource.resource});}if(cleanupFailures.length===1&&failure===undefined)throwcleanupFailures[0]!.error;if(cleanupFailures.length!==0)thrownewCliOutputCaptureCleanupError([...(failure===undefined?[]:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`CLIoutputrestorationfailed${failure===undefined?"":"aftertheCLIfailed"}:${cleanupFailures.map((entry)=>entry.resource).join(",")}.`,);}',
        ],
        classes: ["AggregateError"],
        parameters: [
          [
            "failure:ICliOutputCaptureFailure|undefined",
            "resources:readonlyICliOutputCaptureCleanup[]",
          ],
        ],
      },
    },
  );
  TestValidator.equals(
    "render and migrate use only the shared output capture",
    [
      cliOutputConsumerContract("test_cli_render.ts", "test_cli_render"),
      cliOutputConsumerContract("test_cli_migrate.ts", "test_cli_migrate"),
    ],
    [
      {
        functions: [
          "8b8bd6630b7ea0b30166560288acf3f1c26f0ad9e5d1dc042e909af02251d2e1",
        ],
        imports: ["captureCliOutput:captureCli"],
        localCaptures: 0,
      },
      {
        functions: [
          "e6390f802bebbea8231d45b40e9ad2172ce5367c4313ed8fa6913d81f47a8fba",
        ],
        imports: ["captureCliOutput:captureCli"],
        localCaptures: 0,
      },
    ],
  );
};
