import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveBenchmarkRunnerFixtureCleanup } from "./test_benchmark_runner";

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

const benchmarkRunnerFixtureContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_benchmark_runner.ts",
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
    (entry) => entry.name === "test_benchmark_runner",
  );
  const lifecycles: Array<{
    catchBodies: string[];
    catchVariables: string[];
    finallyBodies: string[];
    tryDigest: string;
  }> = [];
  const prefixes: string[][] = [];
  for (const owner of owners) {
    const body = owner.arrow.body;
    if (ts.isBlock(body) === false || body.statements.length !== 3) continue;
    const root = body.statements[0];
    const failure = body.statements[1];
    const lifecycle = body.statements[2];
    const catchClause =
      lifecycle !== undefined && ts.isTryStatement(lifecycle)
        ? lifecycle.catchClause
        : undefined;
    const finallyBlock =
      lifecycle !== undefined && ts.isTryStatement(lifecycle)
        ? lifecycle.finallyBlock
        : undefined;
    if (
      root === undefined ||
      failure === undefined ||
      lifecycle === undefined ||
      ts.isVariableStatement(root) === false ||
      ts.isVariableStatement(failure) === false ||
      ts.isTryStatement(lifecycle) === false ||
      catchClause === undefined ||
      finallyBlock === undefined
    )
      continue;
    prefixes.push([compact(root, source), compact(failure, source)]);
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
      tryDigest: digest(lifecycle.tryBlock, source),
    });
  }
  const policies = arrows.filter(
    (entry) => entry.name === "preserveBenchmarkRunnerFixtureCleanup",
  );
  return {
    owner: { count: owners.length, lifecycles, prefixes },
    policy: {
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "BenchmarkRunnerFixtureCleanupError"
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
  cleanupFailure?: unknown;
  primaryFailure?: unknown;
}): { attempts: number; failure: unknown } => {
  let attempts = 0;
  let failure: unknown;
  try {
    preserveBenchmarkRunnerFixtureCleanup(
      props.primaryFailure === undefined
        ? undefined
        : { error: props.primaryFailure },
      () => {
        ++attempts;
        if (props.cleanupFailure !== undefined)
          throw props.cleanupFailure as Error;
      },
    );
    if (props.primaryFailure !== undefined) throw props.primaryFailure as Error;
  } catch (error) {
    failure = error;
  }
  return { attempts, failure };
};

export const test_benchmark_runner_fixture_cleanup = (): void => {
  const primaryFailure = { phase: "benchmark" };
  const cleanupFailure = { phase: "root cleanup" };
  const success = captureCleanup({});
  const primaryOnly = captureCleanup({ primaryFailure });
  const cleanupOnly = captureCleanup({ cleanupFailure });
  const combined = captureCleanup({ cleanupFailure, primaryFailure });
  TestValidator.equals(
    "benchmark runner fixture cleanup preserves phase identity and order",
    namedFacts([
      ["successFailure", () => success.failure === undefined],
      ["primaryOnlyFailure", () => primaryOnly.failure === primaryFailure],
      ["cleanupOnlyFailure", () => cleanupOnly.failure === cleanupFailure],
      [
        "aggregateContainsExactlyCombined",
        () =>
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            cleanupFailure,
          ]),
      ],
      [
        "successPrimaryOnly",
        () =>
          [success, primaryOnly, cleanupOnly, combined].every(
            (capture) => capture.attempts === 1,
          ),
      ],
    ]),
    {
      successFailure: true,
      primaryOnlyFailure: true,
      cleanupOnlyFailure: true,
      aggregateContainsExactlyCombined: true,
      successPrimaryOnly: true,
    },
  );
  TestValidator.equals(
    "benchmark runner owns its root through setup, execution, and cleanup",
    benchmarkRunnerFixtureContract(
      fs.readFileSync(path.join(__dirname, "test_benchmark_runner.ts"), "utf8"),
    ),
    {
      owner: {
        count: 1,
        lifecycles: [
          {
            catchBodies: ["benchmarkFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            finallyBodies: [
              "preserveBenchmarkRunnerFixtureCleanup(benchmarkFailure,()=>fs.rmSync(root,{force:true,maxRetries:3,recursive:true,retryDelay:100,}),);",
            ],
            tryDigest:
              "7c45f3f44ddf22fe0475ee30fe28cd11af98c5469a548344359724749bc5d7cc",
          },
        ],
        prefixes: [
          [
            'constroot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-runner-test-"));',
            "letbenchmarkFailure:IBenchmarkRunnerFixtureFailure|undefined;",
          ],
        ],
      },
      policy: {
        bodies: [
          '{try{cleanup();}catch(cleanupFailure){if(failure===undefined)throwcleanupFailure;thrownewBenchmarkRunnerFixtureCleanupError([failure.error,cleanupFailure],"Benchmarkrunnerfixturecleanupfailedafterthebenchmarkfailed.",);}}',
        ],
        classes: ["AggregateError"],
        parameters: [
          [
            "failure:IBenchmarkRunnerFixtureFailure|undefined",
            "cleanup:()=>unknown",
          ],
        ],
      },
    },
  );
};
