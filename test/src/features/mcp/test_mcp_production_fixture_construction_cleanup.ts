import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { throwProductionFixtureConstructionFailure } from "./productionFixtures";

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

const productionFixtureConstructionContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "productionFixtures.ts",
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
  const owners = arrows.filter((entry) => entry.name === "productionFixture");
  const rootDeclarations: string[] = [];
  const lifecycles: Array<{
    catchBodies: string[];
    catchVariables: string[];
    constructionCalls: string[];
    rmCalls: Array<{
      call: string;
      protected: boolean;
      region: "catch" | "try";
    }>;
    returnedDisposers: string[];
    tryDigest: string;
  }> = [];
  for (const owner of owners) {
    const ownerBody = owner.arrow.body;
    if (ts.isBlock(ownerBody) === false) continue;
    const statements = [...ownerBody.statements];
    if (statements.length !== 2) continue;
    const rootStatement = statements[0];
    const lifecycle = statements[1];
    const catchClause =
      lifecycle !== undefined && ts.isTryStatement(lifecycle)
        ? lifecycle.catchClause
        : undefined;
    if (
      rootStatement === undefined ||
      lifecycle === undefined ||
      ts.isVariableStatement(rootStatement) === false ||
      ts.isTryStatement(lifecycle) === false ||
      catchClause === undefined ||
      lifecycle.finallyBlock !== undefined
    )
      continue;
    rootDeclarations.push(compact(rootStatement, source));
    const constructionCalls: string[] = [];
    const returnedDisposers: string[] = [];
    const rmCalls: Array<{
      call: string;
      protected: boolean;
      region: "catch" | "try";
    }> = [];
    const protectedByPolicy = (node: ts.Node): boolean => {
      let cursor: ts.Node | undefined = node.parent;
      while (cursor !== undefined && cursor !== ownerBody) {
        if (
          ts.isCallExpression(cursor) &&
          ts.isIdentifier(cursor.expression) &&
          cursor.expression.text === "throwProductionFixtureConstructionFailure"
        )
          return true;
        cursor = cursor.parent;
      }
      return false;
    };
    const visit = (region: "catch" | "try", node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        ["renderScaffold", "writeFiles"].includes(node.expression.text)
      )
        constructionCalls.push(compact(node, source));
      if (
        ts.isPropertyAssignment(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === "dispose"
      )
        returnedDisposers.push(compact(node, source));
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        compact(node.expression, source) === "fs.rmSync"
      )
        rmCalls.push({
          call: compact(node, source),
          protected: protectedByPolicy(node),
          region,
        });
      ts.forEachChild(node, (child) => visit(region, child));
    };
    visit("try", lifecycle.tryBlock);
    visit("catch", catchClause.block);
    lifecycles.push({
      catchBodies: catchClause.block.statements.map((statement) =>
        compact(statement, source),
      ),
      catchVariables:
        catchClause.variableDeclaration === undefined
          ? []
          : [compact(catchClause.variableDeclaration, source)],
      constructionCalls,
      rmCalls,
      returnedDisposers,
      tryDigest: digest(lifecycle.tryBlock, source),
    });
  }
  const policies = arrows.filter(
    (entry) => entry.name === "throwProductionFixtureConstructionFailure",
  );
  return {
    owner: {
      count: owners.length,
      lifecycles,
      rootDeclarations,
    },
    policy: {
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "ProductionFixtureConstructionCleanupError"
          ? (statement.heritageClauses ?? []).flatMap((clause) =>
              clause.types.map((type) => compact(type, source)),
            )
          : [],
      ),
      parameters: policies.map((entry) =>
        entry.arrow.parameters.map((parameter) => compact(parameter, source)),
      ),
      returnTypes: policies.flatMap((entry) =>
        entry.arrow.type === undefined
          ? []
          : [compact(entry.arrow.type, source)],
      ),
    },
  };
};

const captureConstructionFailure = (
  primaryFailure: unknown,
  cleanupFailure?: unknown,
): { attempts: number; failure: unknown } => {
  let attempts = 0;
  let failure: unknown;
  try {
    throwProductionFixtureConstructionFailure(primaryFailure, () => {
      ++attempts;
      if (cleanupFailure !== undefined) throw cleanupFailure as Error;
    });
  } catch (error) {
    failure = error;
  }
  return { attempts, failure };
};

export const test_mcp_production_fixture_construction_cleanup = (): void => {
  const primaryFailure = { phase: "fixture construction" };
  const cleanupFailure = { phase: "partial-root removal" };
  const primaryOnly = captureConstructionFailure(primaryFailure);
  const combined = captureConstructionFailure(primaryFailure, cleanupFailure);
  TestValidator.predicate(
    "production fixture construction cleanup preserves failure identity and order",
    primaryOnly.failure === primaryFailure &&
      primaryOnly.attempts === 1 &&
      aggregateContainsExactly(combined.failure, [
        primaryFailure,
        cleanupFailure,
      ]) &&
      combined.attempts === 1,
  );
  TestValidator.equals(
    "production fixture owns its temporary root from creation through handoff",
    productionFixtureConstructionContract(
      fs.readFileSync(path.join(__dirname, "productionFixtures.ts"), "utf8"),
    ),
    {
      owner: {
        count: 1,
        lifecycles: [
          {
            catchBodies: [
              "throwProductionFixtureConstructionFailure(error,()=>fs.rmSync(root,{force:true,recursive:true}),);",
            ],
            catchVariables: ["error"],
            constructionCalls: [
              'renderScaffold({name:"fixture-film"})',
              "writeFiles(root,files)",
            ],
            rmCalls: [
              {
                call: "fs.rmSync(root,{force:true,recursive:true})",
                protected: false,
                region: "try",
              },
              {
                call: "fs.rmSync(root,{force:true,recursive:true})",
                protected: true,
                region: "catch",
              },
            ],
            returnedDisposers: [
              "dispose:()=>fs.rmSync(root,{force:true,recursive:true})",
            ],
            tryDigest:
              "9aeda34e94626084d3f1d7b695239fa99c0977f493f18e40bfe36bffe17683cd",
          },
        ],
        rootDeclarations: [
          'constroot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-production-"));',
        ],
      },
      policy: {
        bodies: [
          '{try{cleanup();}catch(cleanupFailure){thrownewProductionFixtureConstructionCleanupError([failure,cleanupFailure],"Productionfixtureconstructionandpartial-rootcleanupfailed.",);}throwfailure;}',
        ],
        classes: ["AggregateError"],
        parameters: [["failure:unknown", "cleanup:()=>unknown"]],
        returnTypes: ["never"],
      },
    },
  );
};
