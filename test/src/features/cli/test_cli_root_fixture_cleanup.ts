import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveCliRootFixtureCleanup } from "./CliRootFixtureCleanup";

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

const rootOwnerContract = (props: {
  file: string;
  functionName: string;
}): unknown => {
  const text = fs.readFileSync(path.join(__dirname, props.file), "utf8");
  const source = ts.createSourceFile(
    props.file,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const owners = source.statements.flatMap((statement) =>
    ts.isVariableStatement(statement)
      ? [...statement.declarationList.declarations].flatMap((declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === props.functionName &&
          declaration.initializer !== undefined &&
          ts.isArrowFunction(declaration.initializer) &&
          ts.isBlock(declaration.initializer.body)
            ? [declaration.initializer.body]
            : [],
        )
      : [],
  );
  return owners.map((body) => {
    const lifecycles = [...body.statements].flatMap((statement, index) =>
      ts.isTryStatement(statement) &&
      statement.catchClause !== undefined &&
      statement.finallyBlock
        ?.getText(source)
        .includes("preserveCliRootFixtureCleanup") === true
        ? [{ index, lifecycle: statement }]
        : [],
    );
    return {
      bodyStatements: body.statements.length,
      lifecycles: lifecycles.map(({ index, lifecycle }) => ({
        catchBodies: lifecycle.catchClause!.block.statements.map((statement) =>
          compact(statement, source),
        ),
        catchVariables:
          lifecycle.catchClause!.variableDeclaration === undefined
            ? []
            : [compact(lifecycle.catchClause!.variableDeclaration, source)],
        finallyBodies: lifecycle.finallyBlock!.statements.map((statement) =>
          compact(statement, source),
        ),
        index,
        prefixes: [...body.statements]
          .slice(Math.max(0, index - 2), index)
          .map((statement) => compact(statement, source)),
        tryDigest: digest(lifecycle.tryBlock, source),
      })),
    };
  });
};

const rootCleanupPolicyContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "CliRootFixtureCleanup.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const policies = source.statements.flatMap((statement) =>
    ts.isVariableStatement(statement)
      ? [...statement.declarationList.declarations].flatMap((declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === "preserveCliRootFixtureCleanup" &&
          declaration.initializer !== undefined &&
          ts.isArrowFunction(declaration.initializer)
            ? [declaration.initializer]
            : [],
        )
      : [],
  );
  return {
    bodies: policies.map((policy) => compact(policy.body, source)),
    classes: source.statements.flatMap((statement) =>
      ts.isClassDeclaration(statement) &&
      statement.name?.text === "CliRootFixtureCleanupError"
        ? (statement.heritageClauses ?? []).flatMap((clause) =>
            clause.types.map((type) => compact(type, source)),
          )
        : [],
    ),
    parameters: policies.map((policy) =>
      policy.parameters.map((parameter) => compact(parameter, source)),
    ),
  };
};

const captureCleanup = (props: {
  cleanupFailure?: unknown;
  primaryFailure?: unknown;
}): { attempts: number; failure: unknown } => {
  let attempts = 0;
  let failure: unknown;
  try {
    preserveCliRootFixtureCleanup(
      props.primaryFailure === undefined
        ? undefined
        : { error: props.primaryFailure },
      (): void => {
        ++attempts;
        if (props.cleanupFailure !== undefined)
          throw props.cleanupFailure as Error;
      },
      "fixture root",
    );
    if (props.primaryFailure !== undefined) throw props.primaryFailure as Error;
  } catch (error) {
    failure = error;
  }
  return { attempts, failure };
};

export const test_cli_root_fixture_cleanup = (): void => {
  const primaryFailure = { phase: "CLI regression" };
  const cleanupFailure = { phase: "root removal" };
  const success = captureCleanup({});
  const primaryOnly = captureCleanup({ primaryFailure });
  const standalone = captureCleanup({ cleanupFailure });
  const combined = captureCleanup({ cleanupFailure, primaryFailure });
  TestValidator.equals(
    "single-root CLI cleanup preserves exact failure identity and order",
    namedFacts([
      ["successFailure", () => success.failure === undefined],
      ["successAttempts", () => success.attempts === 1],
      ["primaryOnlyFailure", () => primaryOnly.failure === primaryFailure],
      ["primaryOnlyAttempts", () => primaryOnly.attempts === 1],
      ["standaloneFailure", () => standalone.failure === cleanupFailure],
      ["standaloneAttempts", () => standalone.attempts === 1],
      [
        "aggregateContainsExactlyCombined",
        () =>
          aggregateContainsExactly(combined.failure, [
            primaryFailure,
            cleanupFailure,
          ]),
      ],
      ["combinedAttempts", () => combined.attempts === 1],
    ]),
    {
      successFailure: true,
      successAttempts: true,
      primaryOnlyFailure: true,
      primaryOnlyAttempts: true,
      standaloneFailure: true,
      standaloneAttempts: true,
      aggregateContainsExactlyCombined: true,
      combinedAttempts: true,
    },
  );
  TestValidator.equals(
    "single-root CLI cleanup policy preserves both phases",
    rootCleanupPolicyContract(
      fs.readFileSync(path.join(__dirname, "CliRootFixtureCleanup.ts"), "utf8"),
    ),
    {
      bodies: [
        "{try{cleanup();}catch(cleanupFailure){if(failure===undefined)throwcleanupFailure;thrownewCliRootFixtureCleanupError([failure.error,cleanupFailure],`CLI$" +
          "{resource}cleanupfailedafterthetestfailed.`,);}}",
      ],
      classes: ["AggregateError"],
      parameters: [
        [
          "failure:ICliRootFixtureFailure|undefined",
          "cleanup:()=>unknown",
          "resource:string",
        ],
      ],
    },
  );
  TestValidator.equals(
    "every remaining single-root CLI owner uses the shared policy",
    [
      rootOwnerContract({
        file: "test_cli_migrate.ts",
        functionName: "test_cli_migrate",
      }),
      rootOwnerContract({
        file: "test_cli_ownership_guard.ts",
        functionName: "test_cli_ownership_guard",
      }),
      rootOwnerContract({
        file: "test_cli_scaffold.ts",
        functionName: "test_cli_scaffold",
      }),
    ],
    [
      [
        {
          bodyStatements: 3,
          lifecycles: [
            {
              catchBodies: ["migrateFailure={error};", "throwerror;"],
              catchVariables: ["error"],
              finallyBodies: [
                'preserveCliRootFixtureCleanup(migrateFailure,()=>fs.rmSync(root,{force:true,recursive:true}),"migratefixtureroot",);',
              ],
              index: 2,
              prefixes: [
                'constroot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-cli-migrate-"));',
                "letmigrateFailure:{error:unknown}|undefined;",
              ],
              tryDigest:
                "656158968ce09341eb3d7ae454a89d7bf6651f45fcb172fa99aca55db612c6ae",
            },
          ],
        },
      ],
      [
        {
          bodyStatements: 3,
          lifecycles: [
            {
              catchBodies: ["ownershipFailure={error};", "throwerror;"],
              catchVariables: ["error"],
              finallyBodies: [
                'preserveCliRootFixtureCleanup(ownershipFailure,()=>fs.rmSync(base,{force:true,recursive:true}),"ownership-guardfixtureroot",);',
              ],
              index: 2,
              prefixes: [
                'constbase=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-guard-"));',
                "letownershipFailure:{error:unknown}|undefined;",
              ],
              tryDigest:
                "a1eeb09006e2f294e5515fb658bf305135b419554a94eac22c272f55d69cd004",
            },
          ],
        },
      ],
      [
        {
          bodyStatements: 71,
          lifecycles: [
            {
              catchBodies: ["scaffoldFailure={error};", "throwerror;"],
              catchVariables: ["error"],
              finallyBodies: [
                'preserveCliRootFixtureCleanup(scaffoldFailure,()=>fs.rmSync(base,{recursive:true,force:true}),"scaffoldfixtureroot",);',
              ],
              index: 70,
              prefixes: [
                'constbase=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-scaffold-"));',
                "letscaffoldFailure:{error:unknown}|undefined;",
              ],
              tryDigest:
                "5918485593ff1372d26cd41615e50d3dda1292e3432d34c1c8bf1d3a05a5265f",
            },
          ],
        },
      ],
    ],
  );
};
