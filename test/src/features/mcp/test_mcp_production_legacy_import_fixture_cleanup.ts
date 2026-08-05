import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveLegacyImportFixtureCleanup } from "./test_mcp_production_legacy_import";

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

const legacyImportFixtureContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_legacy_import.ts",
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
    (entry) => entry.name === "test_mcp_production_legacy_import",
  );
  const lifecycles: Array<{
    catchBodies: string[];
    catchVariables: string[];
    containerStatements: number;
    finallyBodies: string[];
    index: number;
    loopHeaders: string[];
    prefixes: string[];
    tryDigest: string;
    tryPrefixes: string[];
  }> = [];
  const ownedFixturePair = (node: ts.Block): boolean =>
    [
      "linked-root legacy fixture",
      "linked-revision legacy fixture",
      "changing-lock legacy fixture",
      "linked-applied-state legacy fixture",
      "unsafe-inventory legacy fixture",
    ].some((resource) => node.getText(source).includes(resource));
  for (const owner of owners) {
    const visit = (node: ts.Node): void => {
      if (
        ts.isTryStatement(node) &&
        node.catchClause !== undefined &&
        node.finallyBlock
          ?.getText(source)
          .includes("preserveLegacyImportFixtureCleanup") === true &&
        ownedFixturePair(node.finallyBlock) &&
        ts.isBlock(node.parent)
      ) {
        const statements = [...node.parent.statements];
        const index = statements.indexOf(node);
        const loop = ts.isForOfStatement(node.parent.parent)
          ? node.parent.parent
          : undefined;
        lifecycles.push({
          catchBodies: node.catchClause.block.statements.map((statement) =>
            compact(statement, source),
          ),
          catchVariables:
            node.catchClause.variableDeclaration === undefined
              ? []
              : [compact(node.catchClause.variableDeclaration, source)],
          containerStatements: statements.length,
          finallyBodies: node.finallyBlock.statements.map((statement) =>
            compact(statement, source),
          ),
          index,
          loopHeaders:
            loop === undefined
              ? []
              : [
                  compact(loop.initializer, source),
                  compact(loop.expression, source),
                ],
          prefixes: statements
            .slice(Math.max(0, index - 3), index)
            .map((statement) => compact(statement, source)),
          tryDigest: digest(node.tryBlock, source),
          tryPrefixes: [...node.tryBlock.statements]
            .slice(0, 1)
            .map((statement) => compact(statement, source)),
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(owner.arrow.body);
  }
  const policies = arrows.filter(
    (entry) => entry.name === "preserveLegacyImportFixtureCleanup",
  );
  return {
    owner: {
      count: owners.length,
      lifecycles,
      statementCounts: owners.flatMap((owner) =>
        ts.isBlock(owner.arrow.body)
          ? [owner.arrow.body.statements.length]
          : [],
      ),
    },
    policy: {
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "LegacyImportFixtureCleanupError"
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
  cleanupFailures?: readonly ({ error: unknown; present: true } | undefined)[];
  primaryFailure?: { error: unknown; present: true };
  resources?: number;
}): { caught: boolean; failure: unknown; order: string[] } => {
  let caught = false;
  const order: string[] = [];
  let failure: unknown;
  try {
    preserveLegacyImportFixtureCleanup(
      props.primaryFailure === undefined
        ? undefined
        : { error: props.primaryFailure.error },
      Array.from({ length: props.resources ?? 2 }, (_, index) => ({
        resource: `resource-${index}`,
        cleanup: (): void => {
          order.push(`cleanup-${index}`);
          const cleanupFailure = props.cleanupFailures?.[index];
          if (cleanupFailure !== undefined) throw cleanupFailure.error;
        },
      })),
    );
    if (props.primaryFailure !== undefined) throw props.primaryFailure.error;
  } catch (error) {
    caught = true;
    failure = error;
  }
  return { caught, failure, order };
};

export const test_mcp_production_legacy_import_fixture_cleanup = (): void => {
  const primaryFailure = { phase: "legacy-import regression" };
  const firstCleanupFailure = { phase: "legacy fixture disposal" };
  const secondCleanupFailure = { phase: "outside root removal" };
  const success = captureCleanup({});
  const partialSetup = captureCleanup({
    primaryFailure: { error: primaryFailure, present: true },
    resources: 1,
  });
  const primaryOnly = captureCleanup({
    primaryFailure: { error: primaryFailure, present: true },
  });
  const standalone = captureCleanup({
    cleanupFailures: [{ error: firstCleanupFailure, present: true }],
  });
  const multiple = captureCleanup({
    cleanupFailures: [
      { error: firstCleanupFailure, present: true },
      { error: secondCleanupFailure, present: true },
    ],
  });
  const combined = captureCleanup({
    cleanupFailures: [
      { error: firstCleanupFailure, present: true },
      { error: secondCleanupFailure, present: true },
    ],
    primaryFailure: { error: primaryFailure, present: true },
  });
  const undefinedPrimary = captureCleanup({
    primaryFailure: { error: undefined, present: true },
  });
  const undefinedStandalone = captureCleanup({
    cleanupFailures: [{ error: undefined, present: true }],
  });
  const undefinedCombined = captureCleanup({
    cleanupFailures: [{ error: undefined, present: true }],
    primaryFailure: { error: undefined, present: true },
  });
  TestValidator.predicate(
    "paired legacy-import cleanup preserves acquisition and failure order",
    success.caught === false &&
      success.failure === undefined &&
      success.order.join(",") === "cleanup-0,cleanup-1" &&
      partialSetup.caught &&
      partialSetup.failure === primaryFailure &&
      partialSetup.order.join(",") === "cleanup-0" &&
      primaryOnly.caught &&
      primaryOnly.failure === primaryFailure &&
      primaryOnly.order.join(",") === "cleanup-0,cleanup-1" &&
      standalone.caught &&
      standalone.failure === firstCleanupFailure &&
      standalone.order.join(",") === "cleanup-0,cleanup-1" &&
      multiple.caught &&
      aggregateContainsExactly(multiple.failure, [
        firstCleanupFailure,
        secondCleanupFailure,
      ]) &&
      multiple.order.join(",") === "cleanup-0,cleanup-1" &&
      combined.caught &&
      aggregateContainsExactly(combined.failure, [
        primaryFailure,
        firstCleanupFailure,
        secondCleanupFailure,
      ]) &&
      combined.order.join(",") === "cleanup-0,cleanup-1" &&
      undefinedPrimary.caught &&
      undefinedPrimary.failure === undefined &&
      undefinedPrimary.order.join(",") === "cleanup-0,cleanup-1" &&
      undefinedStandalone.caught &&
      undefinedStandalone.failure === undefined &&
      undefinedStandalone.order.join(",") === "cleanup-0,cleanup-1" &&
      undefinedCombined.caught &&
      aggregateContainsExactly(undefinedCombined.failure, [
        undefined,
        undefined,
      ]) &&
      undefinedCombined.order.join(",") === "cleanup-0,cleanup-1",
  );
  TestValidator.equals(
    "legacy-import regression owns all five simple fixture pairs",
    legacyImportFixtureContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_production_legacy_import.ts"),
        "utf8",
      ),
    ),
    {
      owner: {
        count: 1,
        lifecycles: [
          {
            catchBodies: ["linkedRootFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerStatements: 145,
            finallyBodies: [
              "constcompletedLinkedParent=linkedParent;",
              'preserveLegacyImportFixtureCleanup(linkedRootFailure,[{resource:"linked-rootlegacyfixture",cleanup:()=>linkedRoot.dispose(),},...(completedLinkedParent===undefined?[]:[{resource:"linked-rootoutsideroot",cleanup:()=>fs.rmSync(completedLinkedParent,{force:true,recursive:true,}),},]),]);',
            ],
            index: 87,
            loopHeaders: [],
            prefixes: [
              "constlinkedRoot=createLegacy();",
              "letlinkedParent:string|undefined;",
              "letlinkedRootFailure:ILegacyImportFixtureFailure|undefined;",
            ],
            tryDigest:
              "4a86ef64f8df902644daa090c8c5be14a01defa12fcc14b5ef41ba3d480c732d",
            tryPrefixes: [
              'linkedParent=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-linked-import-root-"),);',
            ],
          },
          {
            catchBodies: ["linkedRevisionFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerStatements: 145,
            finallyBodies: [
              "constcompletedLinkedRevisionTarget=linkedRevisionTarget;",
              'preserveLegacyImportFixtureCleanup(linkedRevisionFailure,[{resource:"linked-revisionlegacyfixture",cleanup:()=>linkedRevision.dispose(),},...(completedLinkedRevisionTarget===undefined?[]:[{resource:"linked-revisionoutsideroot",cleanup:()=>fs.rmSync(completedLinkedRevisionTarget,{force:true,recursive:true,}),},]),]);',
            ],
            index: 124,
            loopHeaders: [],
            prefixes: [
              "constlinkedRevision=createLegacy();",
              "letlinkedRevisionTarget:string|undefined;",
              "letlinkedRevisionFailure:ILegacyImportFixtureFailure|undefined;",
            ],
            tryDigest:
              "29dfe0fc813485474ea37d656f5cb1ec8003d564b8b528ce580fd1e186884b69",
            tryPrefixes: [
              'linkedRevisionTarget=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-linked-revision-"),);',
            ],
          },
          {
            catchBodies: ["changingLockFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerStatements: 4,
            finallyBodies: [
              "constcompletedOutsideLock=outsideLock;",
              'preserveLegacyImportFixtureCleanup(changingLockFailure,[{resource:"changing-locklegacyfixture",cleanup:()=>changingLock.dispose(),},...(completedOutsideLock===undefined?[]:[{resource:"changing-lockoutsideroot",cleanup:()=>fs.rmSync(completedOutsideLock,{force:true,recursive:true,}),},]),]);',
            ],
            index: 3,
            loopHeaders: [
              "constlockMutation",
              '["missing","symlink","directory","foreign-token",]asconst',
            ],
            prefixes: [
              "constchangingLock=createLegacy();",
              "letoutsideLock:string|undefined;",
              "letchangingLockFailure:ILegacyImportFixtureFailure|undefined;",
            ],
            tryDigest:
              "b4aea634e377e417e5594e2d1c291eed69ef43c66e28c78d27017b6079f22c7a",
            tryPrefixes: [
              'outsideLock=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-changing-lock-"),);',
            ],
          },
          {
            catchBodies: ["linkedAppliedStateFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerStatements: 145,
            finallyBodies: [
              "constcompletedLinkedAppliedStateTarget=linkedAppliedStateTarget;",
              'preserveLegacyImportFixtureCleanup(linkedAppliedStateFailure,[{resource:"linked-applied-statelegacyfixture",cleanup:()=>linkedAppliedState.dispose(),},...(completedLinkedAppliedStateTarget===undefined?[]:[{resource:"linked-applied-stateoutsideroot",cleanup:()=>fs.rmSync(completedLinkedAppliedStateTarget,{force:true,recursive:true,}),},]),]);',
            ],
            index: 132,
            loopHeaders: [],
            prefixes: [
              "constlinkedAppliedState=createLegacy();",
              "letlinkedAppliedStateTarget:string|undefined;",
              "letlinkedAppliedStateFailure:ILegacyImportFixtureFailure|undefined;",
            ],
            tryDigest:
              "704ecbce319274aadd5c4d3aac326ffa4358d03b3c066f8d902167400fc3ebbf",
            tryPrefixes: [
              'linkedAppliedStateTarget=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-linked-applied-state-"),);',
            ],
          },
          {
            catchBodies: ["unsafeFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerStatements: 145,
            finallyBodies: [
              "constcompletedOutside=outside;",
              'preserveLegacyImportFixtureCleanup(unsafeFailure,[{resource:"unsafe-inventorylegacyfixture",cleanup:()=>unsafe.dispose(),},...(completedOutside===undefined?[]:[{resource:"unsafe-inventoryoutsideroot",cleanup:()=>fs.rmSync(completedOutside,{force:true,recursive:true,}),},]),]);',
            ],
            index: 144,
            loopHeaders: [],
            prefixes: [
              "constunsafe=createLegacy();",
              "letoutside:string|undefined;",
              "letunsafeFailure:ILegacyImportFixtureFailure|undefined;",
            ],
            tryDigest:
              "1368f3cb3dac9226063e4fba0922b5f444095b9e30b3fd01ac8fcce9cf4493db",
            tryPrefixes: [
              'outside=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-outside-"));',
            ],
          },
        ],
        statementCounts: [145],
      },
      policy: {
        bodies: [
          "{constcleanupFailures:Array<{error:unknown;resource:string}>=[];for(constresourceofresources)try{resource.cleanup();}catch(error){cleanupFailures.push({error,resource:resource.resource});}if(cleanupFailures.length===1&&failure===undefined)throwcleanupFailures[0]!.error;if(cleanupFailures.length!==0)thrownewLegacyImportFixtureCleanupError([...(failure===undefined?[]:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`Legacy-importfixturecleanupfailed$" +
            '{failure===undefined?"":"afterthetestfailed"}:$' +
            '{cleanupFailures.map((entry)=>entry.resource).join(",")}.`,);}',
        ],
        classes: ["AggregateError"],
        parameters: [
          [
            "failure:ILegacyImportFixtureFailure|undefined",
            "resources:readonlyILegacyImportFixtureCleanup[]",
          ],
        ],
      },
    },
  );
};
