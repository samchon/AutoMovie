import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveProductionProjectFixtureCleanup } from "./test_mcp_production_project";

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

const invalidRootSetupHookCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_project.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const owners = source.statements.flatMap((statement) =>
    ts.isVariableStatement(statement)
      ? [...statement.declarationList.declarations].flatMap((declaration) =>
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === "test_mcp_production_project" &&
          declaration.initializer !== undefined &&
          ts.isArrowFunction(declaration.initializer)
            ? [declaration.initializer]
            : [],
        )
      : [],
  );
  const holderNames = [
    "existingRootHookFailure",
    "aliasOpenHookFailure",
    "missingBaseHookFailure",
  ] as const;
  const lifecycles: Array<{
    catchBodies: string[];
    catchVariables: string[];
    containerKind: string;
    containerStatements: number;
    failureHolder: string;
    finallyDigest: string;
    finallyStatements: number;
    finallySubstantive: { digest: string; tokens: number };
    index: number;
    substantive: { digest: string; tokens: number };
    tryBody: string;
    tryDigest: string;
    tryStatements: number;
  }> = [];
  for (const owner of owners) {
    const visit = (node: ts.Node): void => {
      if (
        ts.isTryStatement(node) &&
        node.catchClause !== undefined &&
        node.finallyBlock !== undefined &&
        ts.isBlock(node.parent)
      ) {
        const statements = [...node.parent.statements];
        const index = statements.indexOf(node);
        const failureHolder = compact(statements[index - 1]!, source);
        if (holderNames.some((name) => failureHolder.startsWith(`let${name}:`)))
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
            failureHolder,
            finallyDigest: digestText(node.finallyBlock.getText(source)),
            finallyStatements: node.finallyBlock.statements.length,
            finallySubstantive: leafTokenContract(
              node.finallyBlock.statements,
              source,
            ),
            index,
            substantive: leafTokenContract(node.tryBlock.statements, source),
            tryBody: compact(node.tryBlock, source),
            tryDigest: digestText(node.tryBlock.getText(source)),
            tryStatements: node.tryBlock.statements.length,
          });
      }
      ts.forEachChild(node, visit);
    };
    visit(owner.body);
  }
  return {
    owner: {
      count: owners.length,
      lifecycles,
      statementCounts: owners.flatMap((owner) =>
        ts.isBlock(owner.body) ? [owner.body.statements.length] : [],
      ),
    },
    parseDiagnostics: (
      source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics.map((diagnostic) => String(diagnostic.messageText)),
  };
};

const captureCleanup = (props: {
  cleanupFailure?: { error: unknown; present: true };
  primaryFailure?: { error: unknown; present: true };
}): { attempts: number; caught: boolean; failure: unknown } => {
  let attempts = 0;
  let caught = false;
  let failure: unknown;
  try {
    let primaryState: { error: unknown } | undefined;
    try {
      if (props.primaryFailure !== undefined) throw props.primaryFailure.error;
    } catch (error) {
      primaryState = { error };
      throw error;
    } finally {
      preserveProductionProjectFixtureCleanup(primaryState, [
        {
          resource: "invalid-root setup hook",
          cleanup: (): void => {
            ++attempts;
            if (props.cleanupFailure !== undefined)
              throw props.cleanupFailure.error;
          },
        },
      ]);
    }
  } catch (error) {
    caught = true;
    failure = error;
  }
  return { attempts, caught, failure };
};

export const test_mcp_production_project_invalid_root_setup_hook_cleanup =
  (): void => {
    const primaryFailure = { phase: "invalid-root setup assertion" };
    const cleanupFailure = { phase: "invalid-root setup hook restoration" };
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
      "invalid-root setup hook cleanup preserves failure identity and order",
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
      "production-project test owns three invalid-root setup hook lifecycles",
      invalidRootSetupHookCleanupContract(
        fs.readFileSync(
          path.join(__dirname, "test_mcp_production_project.ts"),
          "utf8",
        ),
      ),
      {
        owner: {
          count: 1,
          lifecycles: [
            {
              catchBodies: ["existingRootHookFailure={error};", "throwerror;"],
              catchVariables: ["error"],
              containerKind: "TryStatement",
              containerStatements: 240,
              failureHolder:
                "letexistingRootHookFailure:IProductionProjectFixtureFailure|undefined;",
              finallyDigest:
                "21d7de9889dc61e51ec8fa8d17a4958bb9ce4446d7d79a47f58e320f591686d1",
              finallyStatements: 1,
              finallySubstantive: {
                digest:
                  "df4544153f83b4ba20bb4e88c65e22e122bee23349b93dcdd612b72aa30a1b3b",
                tokens: 29,
              },
              index: 11,
              substantive: {
                digest:
                  "85ec1d7266b5f93b96573acb99fe3b4d09da84ae5343fd372a559807085880cf",
                tokens: 28,
              },
              tryBody:
                '{TestValidator.predicate("anexistingwritableprojectdoesnotrequirewritableparentaccess",AutoMovieProductionProject.open(fresh).root===fs.realpathSync(fresh)&&attemptedParentSiblingLock===false,);}',
              tryDigest:
                "8f13895af5005751845cf612e842c009d9cb8b70ca2e9e190ca94f62c2e2fa69",
              tryStatements: 1,
            },
            {
              catchBodies: ["aliasOpenHookFailure={error};", "throwerror;"],
              catchVariables: ["error"],
              containerKind: "TryStatement",
              containerStatements: 240,
              failureHolder:
                "letaliasOpenHookFailure:IProductionProjectFixtureFailure|undefined;",
              finallyDigest:
                "a1405adc10f82b7aeb7ea561bfeb46f05813ab76522b86664bdac6856c13ae60",
              finallyStatements: 1,
              finallySubstantive: {
                digest:
                  "1a8ef1453c00c47bab2cb8b323662149a3c435b4cc7da8ece011b0c47dbff7e1",
                tokens: 29,
              },
              index: 23,
              substantive: {
                digest:
                  "67b206c5685b95e5c988b5638e5de7bc3074d34acc6fa9a59618bd7f660752cd",
                tokens: 7,
              },
              tryBody: "{AutoMovieProductionProject.open(aliasProject);}",
              tryDigest:
                "22a6c3fee0f69beed0519be21659aec223dcc15ef17264dc19905f6e3f866ab4",
              tryStatements: 1,
            },
            {
              catchBodies: ["missingBaseHookFailure={error};", "throwerror;"],
              catchVariables: ["error"],
              containerKind: "TryStatement",
              containerStatements: 240,
              failureHolder:
                "letmissingBaseHookFailure:IProductionProjectFixtureFailure|undefined;",
              finallyDigest:
                "dc41e7200c3363ff40fa666feb4b573370835b1409cf7c74ddddb422d99c234c",
              finallyStatements: 1,
              finallySubstantive: {
                digest:
                  "ea2b371046a842ed06a17d1959937f7376cf93a1dd9706e9a0657abef7325c88",
                tokens: 29,
              },
              index: 39,
              substantive: {
                digest:
                  "d0cf73c20c2a45f57ce231d5318923eeb5b55c2fa007d61a273d1fb67e8e079d",
                tokens: 34,
              },
              tryBody:
                '{TestValidator.predicate("arecursivelyabsentfilesystembaseisrejectedwithoutunboundedparentwalking",throws(()=>AutoMovieProductionProject.open(path.join(filesystemRoot,"automovie-absent-base","project"),),"doesnotexistasaphysicaldirectory",),);}',
              tryDigest:
                "fda83200d39019795c8ec6e9eaed48cf8b13c68dd486753bbd1d7686cee3e424",
              tryStatements: 1,
            },
          ],
          statementCounts: [23],
        },
        parseDiagnostics: [],
      },
    );
  };
