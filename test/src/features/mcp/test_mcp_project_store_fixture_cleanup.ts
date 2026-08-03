import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveProjectStoreFixtureCleanup } from "./test_mcp_project_store";

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

const stringLiterals = (node: ts.Node): string[] => {
  const values: string[] = [];
  const visit = (cursor: ts.Node): void => {
    if (ts.isStringLiteral(cursor)) values.push(cursor.text);
    ts.forEachChild(cursor, visit);
  };
  visit(node);
  return values;
};

const projectStoreFixtureContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_project_store.ts",
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
    (entry) => entry.name === "test_mcp_project_store",
  );
  const lifecycles: Array<{
    catchBodies: string[];
    catchVariables: string[];
    containerStatements: number;
    finallyBodies: string[];
    index: number;
    loopHeaders: string[];
    prefixes: string[];
    rootDigest: string;
    rootStringLiterals: string[];
    tryDigest: string;
    tryStatements: number;
  }> = [];
  for (const owner of owners) {
    if (ts.isBlock(owner.arrow.body) === false) continue;
    const visit = (
      node: ts.Node,
      container: ts.Block,
      loopHeaders: string[],
    ): void => {
      if (ts.isBlock(node)) {
        for (const statement of node.statements)
          visit(statement, node, loopHeaders);
        return;
      }
      if (ts.isForOfStatement(node)) {
        const header = `${compact(node.initializer, source)}of${compact(
          node.expression,
          source,
        )}`;
        visit(node.statement, container, [...loopHeaders, header]);
        return;
      }
      if (
        ts.isTryStatement(node) &&
        node.catchClause !== undefined &&
        node.finallyBlock
          ?.getText(source)
          .includes("preserveProjectStoreFixtureCleanup") === true
      ) {
        const index = container.statements.indexOf(node);
        const prefixes = [...container.statements].slice(index - 2, index);
        const root = prefixes[0]!;
        lifecycles.push({
          catchBodies: node.catchClause.block.statements.map((statement) =>
            compact(statement, source),
          ),
          catchVariables:
            node.catchClause.variableDeclaration === undefined
              ? []
              : [compact(node.catchClause.variableDeclaration, source)],
          containerStatements: container.statements.length,
          finallyBodies: node.finallyBlock!.statements.map((statement) =>
            compact(statement, source),
          ),
          index,
          loopHeaders,
          prefixes: prefixes.map((statement) => compact(statement, source)),
          rootDigest: digestText(root.getText(source)),
          rootStringLiterals: stringLiterals(root),
          tryDigest: digestText(node.tryBlock.getText(source)),
          tryStatements: node.tryBlock.statements.length,
        });
      }
      ts.forEachChild(node, (child) => visit(child, container, loopHeaders));
    };
    visit(owner.arrow.body, owner.arrow.body, []);
  }
  const ownerStatements = owners.flatMap((owner) =>
    ts.isBlock(owner.arrow.body) ? [...owner.arrow.body.statements] : [],
  );
  const caseTables = ["invalidShapeCases", "invalidKeyedShapeCases"].map(
    (name) => {
      const entry = ownerStatements
        .flatMap((statement) =>
          ts.isVariableStatement(statement)
            ? [...statement.declarationList.declarations].map(
                (declaration) => ({ declaration, statement }),
              )
            : [],
        )
        .find(
          ({ declaration }) =>
            ts.isIdentifier(declaration.name) && declaration.name.text === name,
        );
      const declaration = entry!.declaration;
      return {
        digest: digestText(entry!.statement.getText(source)),
        entries:
          declaration.initializer !== undefined &&
          ts.isArrayLiteralExpression(declaration.initializer)
            ? declaration.initializer.elements.length
            : -1,
        name,
      };
    },
  );
  const policies = arrows.filter(
    (entry) => entry.name === "preserveProjectStoreFixtureCleanup",
  );
  return {
    caseTables,
    owner: {
      bodyStatements: owners.map((owner) =>
        ts.isBlock(owner.arrow.body) ? owner.arrow.body.statements.length : -1,
      ),
      count: owners.length,
      lifecycles,
    },
    policy: {
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "ProjectStoreFixtureCleanupError"
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
      preserveProjectStoreFixtureCleanup(
        primaryState,
        (): void => {
          ++attempts;
          if (props.cleanupFailure !== undefined)
            throw props.cleanupFailure.error;
        },
        "probe",
      );
    }
  } catch (error) {
    caught = true;
    failure = error;
  }
  return { attempts, caught, failure };
};

export const test_mcp_project_store_fixture_cleanup = (): void => {
  const primaryFailure = { phase: "project-store regression" };
  const cleanupFailure = { phase: "project-store root removal" };
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
    "project-store cleanup preserves exact failure identity and order",
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
    "all project-store roots own their complete fixture lifecycles",
    projectStoreFixtureContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_project_store.ts"),
        "utf8",
      ),
    ),
    {
      caseTables: [
        {
          digest:
            "8e39527621931540553ef7929f6d68498dac903478ac4a8622542ca2bb614437",
          entries: 5,
          name: "invalidShapeCases",
        },
        {
          digest:
            "637daeb1ef931f0e5070dde55b79fb42d1709de782537b544efa3602acd03a08",
          entries: 5,
          name: "invalidKeyedShapeCases",
        },
      ],
      owner: {
        bodyStatements: [19],
        count: 1,
        lifecycles: [
          {
            catchBodies: ["storeFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerStatements: 19,
            finallyBodies: [
              'preserveProjectStoreFixtureCleanup(storeFailure,()=>fs.rmSync(root,{recursive:true,force:true}),"main-store",);',
            ],
            index: 2,
            loopHeaders: [],
            prefixes: [
              'constroot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-store-"));',
              "letstoreFailure:IProjectStoreFixtureFailure|undefined;",
            ],
            rootDigest:
              "31ee550032f9e164621ab281787cc0d353ba43dd863abc5dbd821f3cd38ea6c8",
            rootStringLiterals: ["automovie-store-"],
            tryDigest:
              "f625433f7ba77f54fc8b1f820428b2adc9b9f0e40656325c42710ab30cd77ecd",
            tryStatements: 21,
          },
          {
            catchBodies: ["manifestFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerStatements: 19,
            finallyBodies: [
              'preserveProjectStoreFixtureCleanup(manifestFailure,()=>fs.rmSync(manifestRoot,{recursive:true,force:true}),"malformed-manifest",);',
            ],
            index: 5,
            loopHeaders: [],
            prefixes: [
              'constmanifestRoot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-bad-manifest-"),);',
              "letmanifestFailure:IProjectStoreFixtureFailure|undefined;",
            ],
            rootDigest:
              "2b723fc30a57bca6753ba3198412d46e9c5e7830d8d41786bb3282bccb044fce",
            rootStringLiterals: ["automovie-bad-manifest-"],
            tryDigest:
              "446a76559c6f9d024a5f8959ec93f97b84f4ea42a86e98b48cc8f677b4718d0b",
            tryStatements: 2,
          },
          {
            catchBodies: ["sliceFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerStatements: 19,
            finallyBodies: [
              'preserveProjectStoreFixtureCleanup(sliceFailure,()=>fs.rmSync(sliceRoot,{recursive:true,force:true}),"malformed-slice",);',
            ],
            index: 8,
            loopHeaders: [],
            prefixes: [
              'constsliceRoot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-bad-slice-"),);',
              "letsliceFailure:IProjectStoreFixtureFailure|undefined;",
            ],
            rootDigest:
              "2591e67814a4fbf027be3f3d45ee89b962fa2885126e0993895d1ecabac58ba1",
            rootStringLiterals: ["automovie-bad-slice-"],
            tryDigest:
              "e851242214bef1158cfbe03af1a9491f56802cceae2cdd015c2c27ad9a901056",
            tryStatements: 3,
          },
          {
            catchBodies: ["invalidShapeFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerStatements: 3,
            finallyBodies: [
              'preserveProjectStoreFixtureCleanup(invalidShapeFailure,()=>fs.rmSync(invalidRoot,{recursive:true,force:true}),"invalid-slice-shape",);',
            ],
            index: 2,
            loopHeaders: ["constentryofinvalidShapeCases"],
            prefixes: [
              'constinvalidRoot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-invalid-slice-shape-"),);',
              "letinvalidShapeFailure:IProjectStoreFixtureFailure|undefined;",
            ],
            rootDigest:
              "a00e08ee6d903aeec1ddbe13a099fe1a0b42fd313597ee14698a61897348b6ae",
            rootStringLiterals: ["automovie-invalid-slice-shape-"],
            tryDigest:
              "c33ce6db42469bbd907a7db51339dd8deec8024bb6b36b41b0e7838bdf7fcd9a",
            tryStatements: 3,
          },
          {
            catchBodies: ["keyedFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerStatements: 19,
            finallyBodies: [
              'preserveProjectStoreFixtureCleanup(keyedFailure,()=>fs.rmSync(keyedRoot,{recursive:true,force:true}),"malformed-keyed-slice",);',
            ],
            index: 13,
            loopHeaders: [],
            prefixes: [
              'constkeyedRoot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-bad-keyed-"),);',
              "letkeyedFailure:IProjectStoreFixtureFailure|undefined;",
            ],
            rootDigest:
              "0b06896d3838d3799ea7cccea2b8c6e4a74f004aa02d640cb21b0d6e21a30c21",
            rootStringLiterals: ["automovie-bad-keyed-"],
            tryDigest:
              "dedc59497739646b81d0f2eb29370af274893d9ce48ad74de52a9ae13f720216",
            tryStatements: 3,
          },
          {
            catchBodies: ["invalidKeyedShapeFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerStatements: 3,
            finallyBodies: [
              'preserveProjectStoreFixtureCleanup(invalidKeyedShapeFailure,()=>fs.rmSync(invalidRoot,{recursive:true,force:true}),"invalid-keyed-shape",);',
            ],
            index: 2,
            loopHeaders: ["constentryofinvalidKeyedShapeCases"],
            prefixes: [
              'constinvalidRoot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-invalid-keyed-shape-"),);',
              "letinvalidKeyedShapeFailure:IProjectStoreFixtureFailure|undefined;",
            ],
            rootDigest:
              "dbdd53f28804cd04f75adfdace0fd2f4ce3f0a13947aec12128185a294a83c2d",
            rootStringLiterals: ["automovie-invalid-keyed-shape-"],
            tryDigest:
              "d18db91e271d0da41ef8850924596cd7845d772abba943aec4a339f20c0f8c64",
            tryStatements: 3,
          },
          {
            catchBodies: ["blockedFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerStatements: 19,
            finallyBodies: [
              'preserveProjectStoreFixtureCleanup(blockedFailure,()=>fs.rmSync(blockedParent,{recursive:true,force:true}),"file-blocked-root",);',
            ],
            index: 18,
            loopHeaders: [],
            prefixes: [
              'constblockedParent=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-file-root-"),);',
              "letblockedFailure:IProjectStoreFixtureFailure|undefined;",
            ],
            rootDigest:
              "3254376f8628bde08595b1d63731a134e3f5a5f3b482e02e1f21dda28c1dfb40",
            rootStringLiterals: ["automovie-file-root-"],
            tryDigest:
              "fd62a62799afe2e9ad13a64749cf4c6c8a0465fd1539dc668e0039cc9be4d842",
            tryStatements: 3,
          },
        ],
      },
      policy: {
        bodies: [
          "{try{cleanup();}catch(cleanupFailure){if(failure===undefined)throwcleanupFailure;thrownewProjectStoreFixtureCleanupError([failure.error,cleanupFailure],`Project-store\${resource}fixturecleanupfailedafterthetestfailed.`,);}}",
        ],
        classes: ["AggregateError"],
        parameters: [
          [
            "failure:IProjectStoreFixtureFailure|undefined",
            "cleanup:()=>unknown",
            "resource:string",
          ],
        ],
      },
    },
  );
};
