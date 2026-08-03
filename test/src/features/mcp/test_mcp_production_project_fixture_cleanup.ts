import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveProductionProjectFixtureCleanup } from "./test_mcp_production_project";

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

const productionProjectFixtureContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_project.ts",
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
    (entry) => entry.name === "test_mcp_production_project",
  );
  const lifecycles: Array<{
    catchBodies: string[];
    catchVariables: string[];
    containerStatements: number;
    finallyBodies: string[];
    index: number;
    prefixes: string[];
    tryDigest: string;
    tryPrefixes: string[];
  }> = [];
  for (const owner of owners) {
    const visit = (node: ts.Node): void => {
      if (
        ts.isTryStatement(node) &&
        node.catchClause !== undefined &&
        node.finallyBlock
          ?.getText(source)
          .includes("preserveProductionProjectFixtureCleanup") === true &&
        ts.isBlock(node.parent)
      ) {
        const statements = [...node.parent.statements];
        const index = statements.indexOf(node);
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
    (entry) => entry.name === "preserveProductionProjectFixtureCleanup",
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
        statement.name?.text === "ProductionProjectFixtureCleanupError"
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
    preserveProductionProjectFixtureCleanup(
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

export const test_mcp_production_project_fixture_cleanup = (): void => {
  const primaryFailure = { phase: "production-project regression" };
  const firstCleanupFailure = { phase: "production fixture disposal" };
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
    "paired production-project cleanup preserves acquisition and failure order",
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
    "production-project regression owns all five paired fixtures",
    productionProjectFixtureContract(
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
            catchBodies: ["linkedGeneratedFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerStatements: 288,
            finallyBodies: [
              "constcompletedOutsideGenerated=outsideGenerated;",
              'preserveProductionProjectFixtureCleanup(linkedGeneratedFailure,[{resource:"linked-generatedproductionfixture",cleanup:()=>linkedGenerated.dispose(),},...(completedOutsideGenerated===undefined?[]:[{resource:"linked-generatedoutsideroot",cleanup:()=>fs.rmSync(completedOutsideGenerated,{force:true,recursive:true,}),},]),]);',
            ],
            index: 149,
            prefixes: [
              "constlinkedGenerated=productionFixture();",
              "letoutsideGenerated:string|undefined;",
              "letlinkedGeneratedFailure:IProductionProjectFixtureFailure|undefined;",
            ],
            tryDigest:
              "b19d40e910cc079db4da9e8a2630038df198165ddb3ab56437dd9d9fcb3a8ec0",
            tryPrefixes: [
              'outsideGenerated=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-generated-outside-"),);',
            ],
          },
          {
            catchBodies: ["linkedStateFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerStatements: 288,
            finallyBodies: [
              "constcompletedOutsideState=outsideState;",
              'preserveProductionProjectFixtureCleanup(linkedStateFailure,[{resource:"linked-stateproductionfixture",cleanup:()=>linkedState.dispose(),},...(completedOutsideState===undefined?[]:[{resource:"linked-stateoutsideroot",cleanup:()=>fs.rmSync(completedOutsideState,{force:true,recursive:true,}),},]),]);',
            ],
            index: 153,
            prefixes: [
              "constlinkedState=productionFixture();",
              "letoutsideState:string|undefined;",
              "letlinkedStateFailure:IProductionProjectFixtureFailure|undefined;",
            ],
            tryDigest:
              "a270fecb4d6fc847e0b93709d29c2177a17ea36e188d9a8461806ff8598b4d89",
            tryPrefixes: [
              'outsideState=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-state-outside-"),);',
            ],
          },
          {
            catchBodies: ["linkedStateFileFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerStatements: 288,
            finallyBodies: [
              "constcompletedOutsideStateFile=outsideStateFile;",
              'preserveProductionProjectFixtureCleanup(linkedStateFileFailure,[{resource:"linked-state-fileproductionfixture",cleanup:()=>linkedStateFile.dispose(),},...(completedOutsideStateFile===undefined?[]:[{resource:"linked-state-fileoutsideroot",cleanup:()=>fs.rmSync(completedOutsideStateFile,{force:true,recursive:true,}),},]),]);',
            ],
            index: 157,
            prefixes: [
              "constlinkedStateFile=productionFixture();",
              "letoutsideStateFile:string|undefined;",
              "letlinkedStateFileFailure:IProductionProjectFixtureFailure|undefined;",
            ],
            tryDigest:
              "12c766b9d28a4d900f70a9f7c73f9681a41479d1921d8096b8c6e95acb4fec05",
            tryPrefixes: [
              'outsideStateFile=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-state-file-outside-"),);',
            ],
          },
          {
            catchBodies: ["nestedContentFileFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerStatements: 23,
            finallyBodies: [
              "constcompletedOutsideContentFile=outsideContentFile;",
              'preserveProductionProjectFixtureCleanup(nestedContentFileFailure,[{resource:"nested-content-fileproductionfixture",cleanup:()=>nestedContentFileFixture.dispose(),},...(completedOutsideContentFile===undefined?[]:[{resource:"nested-content-fileoutsideroot",cleanup:()=>fs.rmSync(completedOutsideContentFile,{force:true,recursive:true,}),},]),]);',
            ],
            index: 11,
            prefixes: [
              "constnestedContentFileFixture=productionFixture();",
              "letoutsideContentFile:string|undefined;",
              "letnestedContentFileFailure:IProductionProjectFixtureFailure|undefined;",
            ],
            tryDigest:
              "59c2dc7330d1c92e9da176aeb15d473b061757f2bdcf101fe8236aeb48ac29fd",
            tryPrefixes: [
              'outsideContentFile=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-content-file-junction-"),);',
            ],
          },
          {
            catchBodies: ["parentJunctionFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            containerStatements: 23,
            finallyBodies: [
              "constcompletedOutsideContentRoot=outsideContentRoot;",
              'preserveProductionProjectFixtureCleanup(parentJunctionFailure,[{resource:"parent-junctionproductionfixture",cleanup:()=>parentJunctionFixture.dispose(),},...(completedOutsideContentRoot===undefined?[]:[{resource:"parent-junctionoutsideroot",cleanup:()=>fs.rmSync(completedOutsideContentRoot,{force:true,recursive:true,}),},]),]);',
            ],
            index: 15,
            prefixes: [
              "constparentJunctionFixture=productionFixture();",
              "letoutsideContentRoot:string|undefined;",
              "letparentJunctionFailure:IProductionProjectFixtureFailure|undefined;",
            ],
            tryDigest:
              "8d095222ac862a0a0f3fd65577527deccc55146a8de3767d73a521f30d31f6a4",
            tryPrefixes: [
              'outsideContentRoot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-content-root-junction-"),);',
            ],
          },
        ],
        statementCounts: [23],
      },
      policy: {
        bodies: [
          '{constcleanupFailures:Array<{error:unknown;resource:string}>=[];for(constresourceofresources)try{resource.cleanup();}catch(error){cleanupFailures.push({error,resource:resource.resource});}if(cleanupFailures.length===1&&failure===undefined)throwcleanupFailures[0]!.error;if(cleanupFailures.length!==0)thrownewProductionProjectFixtureCleanupError([...(failure===undefined?[]:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`Production-projectfixturecleanupfailed${failure===undefined?"":"afterthetestfailed"}:${cleanupFailures.map((entry)=>entry.resource).join(",")}.`,);}',
        ],
        classes: ["AggregateError"],
        parameters: [
          [
            "failure:IProductionProjectFixtureFailure|undefined",
            "resources:readonlyIProductionProjectFixtureCleanup[]",
          ],
        ],
      },
    },
  );
};
