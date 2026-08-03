import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveLegacySceneFixtureCleanup } from "./test_mcp_project_legacy_scene_slice";

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

const legacySceneFixtureContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_project_legacy_scene_slice.ts",
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
    (entry) => entry.name === "test_mcp_project_legacy_scene_slice",
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
          .includes("preserveLegacySceneFixtureCleanup") !== true
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
    (entry) => entry.name === "preserveLegacySceneFixtureCleanup",
  );
  return {
    owner: { count: owners.length, lifecycles },
    policy: {
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "LegacySceneFixtureCleanupError"
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
      preserveLegacySceneFixtureCleanup(primaryState, (): void => {
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

export const test_mcp_legacy_scene_fixture_cleanup = (): void => {
  const primaryFailure = { phase: "legacy-scene regression" };
  const cleanupFailure = { phase: "legacy-scene root removal" };
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
    "legacy-scene cleanup preserves exact failure identity and order",
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
    "legacy-scene regression owns its complete fixture lifecycle",
    legacySceneFixtureContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_project_legacy_scene_slice.ts"),
        "utf8",
      ),
    ),
    {
      owner: {
        count: 1,
        lifecycles: [
          {
            bodyStatements: 3,
            catchBodies: ["legacySceneFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            finallyBodies: [
              "preserveLegacySceneFixtureCleanup(legacySceneFailure,()=>fs.rmSync(root,{recursive:true,force:true}),);",
            ],
            index: 2,
            prefixDigest:
              "7e3135c8030167c2a1a65a16dcfdd6cc1051955c8db22d319d5eb8b4943f78ff",
            prefixStringLiterals: ["automovie-legacy-"],
            prefixes: [
              'constroot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-legacy-"));',
              "letlegacySceneFailure:ILegacySceneFixtureFailure|undefined;",
            ],
            tryDigest:
              "2fc9a360db4fe92fe07a77952474fae850b5a30510b68191a0e46ea56967085d",
            tryStatements: 13,
          },
        ],
      },
      policy: {
        bodies: [
          '{try{cleanup();}catch(cleanupFailure){if(failure===undefined)throwcleanupFailure;thrownewLegacySceneFixtureCleanupError([failure.error,cleanupFailure],"Legacy-scenefixturecleanupfailedafterthetestfailed.",);}}',
        ],
        classes: ["AggregateError"],
        parameters: [
          [
            "failure:ILegacySceneFixtureFailure|undefined",
            "cleanup:()=>unknown",
          ],
        ],
      },
    },
  );
};
