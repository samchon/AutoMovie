import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveSingleProductionProjectFixtureCleanup } from "./test_mcp_production_project";

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

const localTempRootCleanupContract = (text: string): unknown => {
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
  const acquisitionPrefixes = [
    "constoutsideRenderRead=fs.mkdtempSync(",
    "constoutsideRenderTarget=fs.mkdtempSync(",
    "constoutsideContent=fs.mkdtempSync(",
    "constracedOutside=fs.mkdtempSync(",
  ] as const;
  const lifecycles: Array<{
    acquisition: string;
    catchBodies: string[];
    catchVariables: string[];
    containerKind: string;
    containerStatements: number;
    failureHolder: string;
    finallyBodies: string[];
    index: number;
    substantive: { digest: string; tokens: number };
    tryDigest: string;
    tryStatements: number;
  }> = [];
  for (const owner of owners) {
    const visit = (node: ts.Node): void => {
      if (
        ts.isTryStatement(node) &&
        node.catchClause !== undefined &&
        node.finallyBlock
          ?.getText(source)
          .includes("preserveSingleProductionProjectFixtureCleanup") === true &&
        ts.isBlock(node.parent)
      ) {
        const statements = [...node.parent.statements];
        const index = statements.indexOf(node);
        const acquisition = compact(statements[index - 1]!, source);
        if (
          acquisitionPrefixes.some((prefix) => acquisition.startsWith(prefix))
        )
          lifecycles.push({
            acquisition,
            catchBodies: node.catchClause.block.statements.map((statement) =>
              compact(statement, source),
            ),
            catchVariables:
              node.catchClause.variableDeclaration === undefined
                ? []
                : [compact(node.catchClause.variableDeclaration, source)],
            containerKind: ts.SyntaxKind[node.parent.parent.kind]!,
            containerStatements: statements.length,
            failureHolder: compact(statements[index - 2]!, source),
            finallyBodies: node.finallyBlock.statements.map((statement) =>
              compact(statement, source),
            ),
            index,
            substantive: leafTokenContract(node.tryBlock.statements, source),
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
  let primaryState: { error: unknown } | undefined;
  try {
    try {
      if (props.primaryFailure !== undefined) throw props.primaryFailure.error;
    } catch (error) {
      primaryState = { error };
      throw error;
    } finally {
      preserveSingleProductionProjectFixtureCleanup(primaryState, (): void => {
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

export const test_mcp_production_project_local_temp_root_cleanup = (): void => {
  const primaryFailure = { phase: "local production-project assertion" };
  const cleanupFailure = { phase: "local production-project root removal" };
  const nestedPrimaryFailure = new AggregateError(
    [{ phase: "nested local-root cleanup" }],
    "Nested local-root cleanup failed.",
  );
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
  const nestedCombined = captureCleanup({
    cleanupFailure: { error: cleanupFailure, present: true },
    primaryFailure: { error: nestedPrimaryFailure, present: true },
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
    "local temp-root cleanup preserves failure identity and order",
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
      nestedCombined.caught &&
      aggregateContainsExactly(nestedCombined.failure, [
        nestedPrimaryFailure,
        cleanupFailure,
      ]) &&
      nestedCombined.attempts === 1 &&
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
    "production-project test owns four local temp-root lifecycles",
    localTempRootCleanupContract(
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
            acquisition:
              'constoutsideRenderRead=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-render-read-"),);',
            catchBodies: ["outsideRenderReadFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "TryStatement",
            containerStatements: 296,
            failureHolder:
              "letoutsideRenderReadFailure:|ISingleProductionProjectFixtureFailure|undefined;",
            finallyBodies: [
              "preserveSingleProductionProjectFixtureCleanup(outsideRenderReadFailure,()=>fs.rmSync(outsideRenderRead,{force:true,recursive:true}),);",
            ],
            index: 240,
            substantive: {
              digest:
                "035f28991aca9e3938becee7c6fc9b23bf55cd5844f6f20a1de518769832e6e5",
              tokens: 2304,
            },
            tryDigest:
              "8213da1d0bc36c21da89e86f3bec01818aa406db1b0808b6916dc3c83e0fb04b",
            tryStatements: 53,
          },
          {
            acquisition:
              'constoutsideRenderTarget=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-render-target-"),);',
            catchBodies: ["outsideRenderTargetFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "TryStatement",
            containerStatements: 296,
            failureHolder:
              "letoutsideRenderTargetFailure:|ISingleProductionProjectFixtureFailure|undefined;",
            finallyBodies: [
              "preserveSingleProductionProjectFixtureCleanup(outsideRenderTargetFailure,()=>fs.rmSync(outsideRenderTarget,{force:true,recursive:true}),);",
            ],
            index: 262,
            substantive: {
              digest:
                "09de7969f70d53d55b4b044b4f467c66bd9ca4990cf3e0e4f72febfb306d8128",
              tokens: 70,
            },
            tryDigest:
              "172d9758249b0c3aa871de7a1b27414c5a8eac28e0369f98d5fe584619c49b26",
            tryStatements: 3,
          },
          {
            acquisition:
              'constoutsideContent=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-content-junction-"),);',
            catchBodies: ["outsideContentFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "TryStatement",
            containerStatements: 20,
            failureHolder:
              "letoutsideContentFailure:|ISingleProductionProjectFixtureFailure|undefined;",
            finallyBodies: [
              "preserveSingleProductionProjectFixtureCleanup(outsideContentFailure,()=>fs.rmSync(outsideContent,{force:true,recursive:true}),);",
            ],
            index: 16,
            substantive: {
              digest:
                "97d99abae5db1bbb64b832dc5e3d0bc69d0777dc1d83cd978a662e318d2d9b40",
              tokens: 71,
            },
            tryDigest:
              "3e9b5b084d521a3eb7664ba9857ba05dbba2a2dd0f6bd4efc69c223cf4256b2b",
            tryStatements: 5,
          },
          {
            acquisition:
              'constracedOutside=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-content-race-"),);',
            catchBodies: ["racedOutsideFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerKind: "TryStatement",
            containerStatements: 20,
            failureHolder:
              "letracedOutsideFailure:ISingleProductionProjectFixtureFailure|undefined;",
            finallyBodies: [
              "preserveSingleProductionProjectFixtureCleanup(racedOutsideFailure,()=>fs.rmSync(racedOutside,{force:true,recursive:true}),);",
            ],
            index: 19,
            substantive: {
              digest:
                "b98e84b35443e5af4556f30179c5a8d53055c46a7ee03678bb386796ca3eb1b5",
              tokens: 375,
            },
            tryDigest:
              "f5c639a97cd399902d6af819b8047025ea65b29775b33631cd9b1c726c10bce1",
            tryStatements: 12,
          },
        ],
        statementCounts: [23],
      },
      parseDiagnostics: [],
    },
  );
};
