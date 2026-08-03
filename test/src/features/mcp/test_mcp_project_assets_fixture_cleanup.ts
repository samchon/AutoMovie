import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveProjectAssetsFixtureCleanup } from "./test_mcp_project_assets";

const compact = (node: ts.Node, source: ts.SourceFile): string =>
  node.getText(source).replace(/\s+/g, "");

const digestText = (text: string): string =>
  createHash("sha256").update(text).digest("hex");

const aggregateContainsExactly = (
  error: unknown,
  expected: readonly unknown[],
): boolean =>
  error instanceof AggregateError &&
  error.errors.length === expected.length &&
  expected.every((failure, index) => error.errors[index] === failure);

const projectAssetsFixtureContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_project_assets.ts",
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
    (entry) => entry.name === "test_mcp_project_assets",
  );
  const lifecycles: Array<{
    bodyStatements: number;
    catchBodies: string[];
    catchVariables: string[];
    finallyBodies: string[];
    index: number;
    prefixDigest: string;
    prefixStringLiterals: string[];
    prefixes: string[];
    tryDigest: string;
    tryStatements: number;
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
          .includes("preserveProjectAssetsFixtureCleanup") !== true
      )
        continue;
      const prefixStatements = [...body.statements].slice(0, index);
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
        prefixDigest: digestText(
          prefixStatements
            .slice(0, -1)
            .map((statement) => statement.getText(source))
            .join("\n"),
        ),
        prefixStringLiterals: prefixStatements.flatMap((statement) => {
          const values: string[] = [];
          const visit = (node: ts.Node): void => {
            if (ts.isStringLiteral(node)) values.push(node.text);
            ts.forEachChild(node, visit);
          };
          visit(statement);
          return values;
        }),
        prefixes: prefixStatements.map((statement) =>
          compact(statement, source),
        ),
        tryDigest: digestText(lifecycle.tryBlock.getText(source)),
        tryStatements: lifecycle.tryBlock.statements.length,
      });
    }
  }
  const policies = arrows.filter(
    (entry) => entry.name === "preserveProjectAssetsFixtureCleanup",
  );
  return {
    owner: { count: owners.length, lifecycles },
    policy: {
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "ProjectAssetsFixtureCleanupError"
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
  cleanupFailure?: { error: unknown; present: true };
  primaryFailure?: { error: unknown; present: true };
}): { attempts: number; caught: boolean; failure: unknown } => {
  let attempts = 0;
  let caught = false;
  let failure: unknown;
  let primaryState: { error: unknown } | undefined;
  try {
    try {
      if (props.primaryFailure !== undefined) throw props.primaryFailure.error;
    } catch (error) {
      primaryState = { error };
      throw error;
    } finally {
      preserveProjectAssetsFixtureCleanup(primaryState, (): void => {
        ++attempts;
        if (props.cleanupFailure !== undefined)
          throw props.cleanupFailure.error;
      });
    }
  } catch (error) {
    caught = true;
    failure = error;
  }
  return { attempts, caught, failure };
};

export const test_mcp_project_assets_fixture_cleanup = (): void => {
  const primaryFailure = { phase: "project-assets regression" };
  const cleanupFailure = { phase: "project-assets root removal" };
  const success = captureCleanup({});
  const primaryOnly = captureCleanup({
    primaryFailure: { error: primaryFailure, present: true },
  });
  const standalone = captureCleanup({
    cleanupFailure: { error: cleanupFailure, present: true },
  });
  const combined = captureCleanup({
    cleanupFailure: { error: cleanupFailure, present: true },
    primaryFailure: { error: primaryFailure, present: true },
  });
  const undefinedPrimary = captureCleanup({
    primaryFailure: { error: undefined, present: true },
  });
  const undefinedStandalone = captureCleanup({
    cleanupFailure: { error: undefined, present: true },
  });
  const undefinedCombined = captureCleanup({
    cleanupFailure: { error: undefined, present: true },
    primaryFailure: { error: undefined, present: true },
  });
  TestValidator.predicate(
    "project-assets cleanup preserves exact failure identity and order",
    success.caught === false &&
      success.failure === undefined &&
      success.attempts === 1 &&
      primaryOnly.caught &&
      primaryOnly.failure === primaryFailure &&
      primaryOnly.attempts === 1 &&
      standalone.caught &&
      standalone.failure === cleanupFailure &&
      standalone.attempts === 1 &&
      combined.caught &&
      aggregateContainsExactly(combined.failure, [
        primaryFailure,
        cleanupFailure,
      ]) &&
      combined.attempts === 1 &&
      undefinedPrimary.caught &&
      undefinedPrimary.failure === undefined &&
      undefinedPrimary.attempts === 1 &&
      undefinedStandalone.caught &&
      undefinedStandalone.failure === undefined &&
      undefinedStandalone.attempts === 1 &&
      undefinedCombined.caught &&
      aggregateContainsExactly(undefinedCombined.failure, [
        undefined,
        undefined,
      ]) &&
      undefinedCombined.attempts === 1,
  );
  TestValidator.equals(
    "project-assets regression owns its complete fixture lifecycle",
    projectAssetsFixtureContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_project_assets.ts"),
        "utf8",
      ),
    ),
    {
      owner: {
        count: 1,
        lifecycles: [
          {
            bodyStatements: 3,
            catchBodies: ["projectAssetsFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            finallyBodies: [
              "preserveProjectAssetsFixtureCleanup(projectAssetsFailure,()=>fs.rmSync(root,{recursive:true,force:true}),);",
            ],
            index: 2,
            prefixDigest:
              "4cea7f5c1ce95ec59d5d181069a81d4d143cd1c78b53ebf4c9a1c97a4e263f11",
            prefixStringLiterals: ["automovie-assets-"],
            prefixes: [
              'constroot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-assets-"));',
              "letprojectAssetsFailure:IProjectAssetsFixtureFailure|undefined;",
            ],
            tryDigest:
              "57d938c86be3943442db3cda8b7e21d8c295ec0b21205c43d215c4d5a6818305",
            tryStatements: 10,
          },
        ],
      },
      policy: {
        bodies: [
          '{try{cleanup();}catch(cleanupFailure){if(failure===undefined)throwcleanupFailure;thrownewProjectAssetsFixtureCleanupError([failure.error,cleanupFailure],"Project-assetsfixturecleanupfailedafterthetestfailed.",);}}',
        ],
        classes: ["AggregateError"],
        parameters: [
          [
            "failure:IProjectAssetsFixtureFailure|undefined",
            "cleanup:()=>unknown",
          ],
        ],
      },
    },
  );
};
