import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveProjectStorePlumbingFixtureCleanup } from "./test_mcp_project_store_plumbing";

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

const stringLiterals = (node: ts.Node, source: ts.SourceFile): string[] => {
  const values: string[] = [];
  const visit = (cursor: ts.Node): void => {
    if (ts.isStringLiteral(cursor)) values.push(cursor.text);
    ts.forEachChild(cursor, visit);
  };
  visit(node);
  return values;
};

const plumbingFixtureContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_project_store_plumbing.ts",
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
    (entry) => entry.name === "test_mcp_project_store_plumbing",
  );
  const lifecycles: Array<{
    bodyStatements: number;
    catchBodies: string[];
    catchVariables: string[];
    finallyBodies: string[];
    index: number;
    rootDigest: string;
    rootStringLiterals: string[];
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
          .includes("preserveProjectStorePlumbingFixtureCleanup") !== true
      )
        continue;
      const prefixes = [...body.statements].slice(index - 2, index);
      const root = prefixes[0]!;
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
        rootDigest: digestText(root.getText(source)),
        rootStringLiterals: stringLiterals(root, source),
        prefixes: prefixes.map((statement) => compact(statement, source)),
        tryDigest: digestText(lifecycle.tryBlock.getText(source)),
        tryStatements: lifecycle.tryBlock.statements.length,
      });
    }
  }
  const policies = arrows.filter(
    (entry) => entry.name === "preserveProjectStorePlumbingFixtureCleanup",
  );
  return {
    owner: { count: owners.length, lifecycles },
    policy: {
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "ProjectStorePlumbingFixtureCleanupError"
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
      preserveProjectStorePlumbingFixtureCleanup(
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

export const test_mcp_project_store_plumbing_fixture_cleanup = (): void => {
  const primaryFailure = { phase: "project-store plumbing regression" };
  const cleanupFailure = { phase: "plumbing root removal" };
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
    "project-store plumbing cleanup preserves exact failure identity and order",
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
    "all project-store plumbing roots own their complete lifecycles",
    plumbingFixtureContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_project_store_plumbing.ts"),
        "utf8",
      ),
    ),
    {
      owner: {
        count: 1,
        lifecycles: [
          {
            bodyStatements: 24,
            catchBodies: ["parentFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            finallyBodies: [
              'preserveProjectStorePlumbingFixtureCleanup(parentFailure,()=>fs.rmSync(parent,{recursive:true,force:true}),"nested-root",);',
            ],
            index: 2,
            rootDigest:
              "39eb3f07d45f37bf828f94cefaa2af49e8ae6467d12ec15a75d264768c9f02dd",
            rootStringLiterals: ["automovie-root-"],
            prefixes: [
              'constparent=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-root-"));',
              "letparentFailure:IProjectStorePlumbingFixtureFailure|undefined;",
            ],
            tryDigest:
              "e6b0d492c076858557981eda3ccb24868ff0e8cce0f0ddb159cc58c2f86d6f39",
            tryStatements: 7,
          },
          {
            bodyStatements: 24,
            catchBodies: ["orderFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            finallyBodies: [
              'preserveProjectStorePlumbingFixtureCleanup(orderFailure,()=>fs.rmSync(orderRoot,{recursive:true,force:true}),"ordering",);',
            ],
            index: 5,
            rootDigest:
              "fd72fa1c51f6d13a8c03ea655f7376e30e8f5c4fb92da9251be11197f725e54f",
            rootStringLiterals: ["automovie-order-"],
            prefixes: [
              'constorderRoot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-order-"));',
              "letorderFailure:IProjectStorePlumbingFixtureFailure|undefined;",
            ],
            tryDigest:
              "0be6b7ba5bbb7e4f5a147d0162fbe934b75af8dff50f372bb1e351d9f0ad19a8",
            tryStatements: 4,
          },
          {
            bodyStatements: 24,
            catchBodies: ["rawFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            finallyBodies: [
              'preserveProjectStorePlumbingFixtureCleanup(rawFailure,()=>fs.rmSync(rawRoot,{recursive:true,force:true}),"raw-shot",);',
            ],
            index: 8,
            rootDigest:
              "eb4c6d7a677585985b15513f2ee98b290fb303afe318476c83a5c514a48ae10a",
            rootStringLiterals: ["automovie-raw-"],
            prefixes: [
              'constrawRoot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-raw-"));',
              "letrawFailure:IProjectStorePlumbingFixtureFailure|undefined;",
            ],
            tryDigest:
              "927e0f23489eba465ffc9f36d6ecf5241ca68febaf5ad00d5d1e197514802977",
            tryStatements: 2,
          },
          {
            bodyStatements: 24,
            catchBodies: ["nullFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            finallyBodies: [
              'preserveProjectStorePlumbingFixtureCleanup(nullFailure,()=>fs.rmSync(nullRoot,{recursive:true,force:true}),"null-slice",);',
            ],
            index: 11,
            rootDigest:
              "c111ca608b819c594f66f48841440ba32b6b858c941e176166f855f7e91a6ae7",
            rootStringLiterals: ["automovie-null-"],
            prefixes: [
              'constnullRoot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-null-"));',
              "letnullFailure:IProjectStorePlumbingFixtureFailure|undefined;",
            ],
            tryDigest:
              "77f83418484ed45e73210748a4d57ae65169d1fb5e409b6d99a3e1fce785266b",
            tryStatements: 3,
          },
          {
            bodyStatements: 24,
            catchBodies: ["staleFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            finallyBodies: [
              'preserveProjectStorePlumbingFixtureCleanup(staleFailure,()=>fs.rmSync(staleRoot,{recursive:true,force:true}),"stale-lock",);',
            ],
            index: 14,
            rootDigest:
              "befffbbe67af6c7adf67ac989a45c11026b3a8e9a4fd9d6b0e97a9c4f9c0cd3f",
            rootStringLiterals: ["automovie-stale-"],
            prefixes: [
              'conststaleRoot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-stale-"));',
              "letstaleFailure:IProjectStorePlumbingFixtureFailure|undefined;",
            ],
            tryDigest:
              "32248c12418e1363ae22600e66738a5c7a21b8e01fbbca8c1a873482c9a0751b",
            tryStatements: 11,
          },
          {
            bodyStatements: 24,
            catchBodies: ["heldFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            finallyBodies: [
              'preserveProjectStorePlumbingFixtureCleanup(heldFailure,()=>fs.rmSync(heldRoot,{recursive:true,force:true}),"held-lock",);',
            ],
            index: 17,
            rootDigest:
              "1a8d9b3db41f44c8ed7ad326971340396ba591605a830165aa52c4197cb2b970",
            rootStringLiterals: ["automovie-held-"],
            prefixes: [
              'constheldRoot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-held-"));',
              "letheldFailure:IProjectStorePlumbingFixtureFailure|undefined;",
            ],
            tryDigest:
              "1309a777d84a21b825ded46efcd56cc96a461f904936ee803df0c7189afa4179",
            tryStatements: 4,
          },
          {
            bodyStatements: 24,
            catchBodies: ["goneFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            finallyBodies: [
              'preserveProjectStorePlumbingFixtureCleanup(goneFailure,()=>fs.rmSync(goneRoot,{recursive:true,force:true}),"removed-root",);',
            ],
            index: 20,
            rootDigest:
              "f6385e774dd62679877c9b1a3ed5c2814b9ec2de458153022e4b0e5c0bbf5a59",
            rootStringLiterals: ["automovie-gone-"],
            prefixes: [
              'constgoneRoot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-gone-"));',
              "letgoneFailure:IProjectStorePlumbingFixtureFailure|undefined;",
            ],
            tryDigest:
              "0e3b24441d3fa2adb00b76a165291853e40001c494dbbd697aa505662786281d",
            tryStatements: 3,
          },
          {
            bodyStatements: 24,
            catchBodies: ["sortFailure={error};", "throwerror;"],
            catchVariables: ["error"],
            finallyBodies: [
              'preserveProjectStorePlumbingFixtureCleanup(sortFailure,()=>fs.rmSync(sortRoot,{recursive:true,force:true}),"filename-sort",);',
            ],
            index: 23,
            rootDigest:
              "2ee29dc3ae1d019ae8bf6254b7b848c6eb313bed4a3ed9570cda68dc51fd0afa",
            rootStringLiterals: ["automovie-sort-"],
            prefixes: [
              'constsortRoot=fs.mkdtempSync(path.join(os.tmpdir(),"automovie-sort-"));',
              "letsortFailure:IProjectStorePlumbingFixtureFailure|undefined;",
            ],
            tryDigest:
              "11191afb572c3bd8fbd56e84712074dd491156e73d44616a1558afd38af0700b",
            tryStatements: 6,
          },
        ],
      },
      policy: {
        bodies: [
          "{try{cleanup();}catch(cleanupFailure){if(failure===undefined)throwcleanupFailure;thrownewProjectStorePlumbingFixtureCleanupError([failure.error,cleanupFailure],`Project-store${resource}fixturecleanupfailedafterthetestfailed.`,);}}",
        ],
        classes: ["AggregateError"],
        parameters: [
          [
            "failure:IProjectStorePlumbingFixtureFailure|undefined",
            "cleanup:()=>unknown",
            "resource:string",
          ],
        ],
      },
    },
  );
};
