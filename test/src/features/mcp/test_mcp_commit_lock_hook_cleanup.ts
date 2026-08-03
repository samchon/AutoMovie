import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveCommitLockHookCleanup } from "./test_mcp_commit_lock";

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

const commitLockHookCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_commit_lock.ts",
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
            ? [{ arrow: declaration.initializer, name: declaration.name.text }]
            : [],
        )
      : [],
  );
  const holderNames = [
    "releaseRaceFailure",
    "rejectedSnapshotFailure",
    "quarantineRecoveryFailure",
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
  for (const owner of arrows) {
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
    visit(owner.arrow.body);
  }
  const policies = arrows.filter(
    (entry) => entry.name === "preserveCommitLockHookCleanup",
  );
  return {
    lifecycles,
    parseDiagnostics: source.parseDiagnostics.map((diagnostic) =>
      String(diagnostic.messageText),
    ),
    policy: {
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "CommitLockHookCleanupError"
          ? (statement.heritageClauses ?? []).flatMap((clause) =>
              clause.types.map((type) => compact(type, source)),
            )
          : [],
      ),
      count: policies.length,
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
  let failure: unknown;
  const order: string[] = [];
  let primaryState: { error: unknown } | undefined;
  try {
    try {
      if (props.primaryFailure !== undefined) throw props.primaryFailure.error;
    } catch (error) {
      primaryState = { error };
      throw error;
    } finally {
      preserveCommitLockHookCleanup(
        primaryState,
        Array.from({ length: props.resources ?? 5 }, (_, index) => ({
          resource: `hook-${index}`,
          cleanup: (): void => {
            order.push(`cleanup-${index}`);
            const cleanupFailure = props.cleanupFailures?.[index];
            if (cleanupFailure !== undefined) throw cleanupFailure.error;
          },
        })),
      );
    }
  } catch (error) {
    caught = true;
    failure = error;
  }
  return { caught, failure, order };
};

export const test_mcp_commit_lock_hook_cleanup = (): void => {
  const primaryFailure = { phase: "commit-lock release" };
  const renameFailure = { phase: "rename hook restoration" };
  const linkFailure = { phase: "link hook restoration" };
  const copyFailure = { phase: "copy hook restoration" };
  const removeFailure = { phase: "remove hook restoration" };
  const lstatFailure = { phase: "lstat hook restoration" };
  const cleanupFailures = [
    { error: renameFailure, present: true as const },
    { error: linkFailure, present: true as const },
    { error: copyFailure, present: true as const },
    { error: removeFailure, present: true as const },
    { error: lstatFailure, present: true as const },
  ];
  const success = captureCleanup({});
  const primaryOnly = captureCleanup({
    primaryFailure: { error: primaryFailure, present: true },
  });
  const standalone = captureCleanup({
    cleanupFailures: [cleanupFailures[0]],
  });
  const multiple = captureCleanup({ cleanupFailures });
  const combined = captureCleanup({
    cleanupFailures,
    primaryFailure: { error: primaryFailure, present: true },
  });
  const twoHooks = captureCleanup({
    cleanupFailures: [cleanupFailures[0]],
    primaryFailure: { error: primaryFailure, present: true },
    resources: 2,
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
  const fullOrder = "cleanup-0,cleanup-1,cleanup-2,cleanup-3,cleanup-4";
  TestValidator.predicate(
    "commit-lock hook cleanup preserves failure and restoration order",
    success.caught === false &&
      success.failure === undefined &&
      success.order.join(",") === fullOrder &&
      primaryOnly.caught &&
      primaryOnly.failure === primaryFailure &&
      primaryOnly.order.join(",") === fullOrder &&
      standalone.caught &&
      standalone.failure === renameFailure &&
      standalone.order.join(",") === fullOrder &&
      multiple.caught &&
      aggregateContainsExactly(multiple.failure, [
        renameFailure,
        linkFailure,
        copyFailure,
        removeFailure,
        lstatFailure,
      ]) &&
      multiple.order.join(",") === fullOrder &&
      combined.caught &&
      aggregateContainsExactly(combined.failure, [
        primaryFailure,
        renameFailure,
        linkFailure,
        copyFailure,
        removeFailure,
        lstatFailure,
      ]) &&
      combined.order.join(",") === fullOrder &&
      twoHooks.caught &&
      aggregateContainsExactly(twoHooks.failure, [
        primaryFailure,
        renameFailure,
      ]) &&
      twoHooks.order.join(",") === "cleanup-0,cleanup-1" &&
      undefinedPrimary.caught &&
      undefinedPrimary.failure === undefined &&
      undefinedPrimary.order.join(",") === fullOrder &&
      undefinedStandalone.caught &&
      undefinedStandalone.failure === undefined &&
      undefinedStandalone.order.join(",") === fullOrder &&
      undefinedCombined.caught &&
      aggregateContainsExactly(undefinedCombined.failure, [
        undefined,
        undefined,
      ]) &&
      undefinedCombined.order.join(",") === fullOrder,
  );
  TestValidator.equals(
    "commit-lock test owns three multi-hook cleanup lifecycles",
    commitLockHookCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_mcp_commit_lock.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: ["releaseRaceFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 50,
          failureHolder:
            "letreleaseRaceFailure:ICommitLockFixtureFailure|undefined;",
          finallyDigest:
            "002969320d2298727c1c6d88403fd1ab2f638b2dcb109c2b40f0a90a03d877b5",
          finallyStatements: 1,
          finallySubstantive: {
            digest:
              "dba1d21582b0d6ae63318ec83a2a2223cda6913691376d3f0aab480bbe25987d",
            tokens: 50,
          },
          index: 26,
          substantive: {
            digest:
              "c4d77fe099bfce74fef6170eb8be4685a8c35098c2c6f9862a43f998be5ddb8a",
            tokens: 7,
          },
          tryBody: "{releaseCommitLock(releaseRacePath,releaseRaceToken);}",
          tryDigest:
            "46e8c64135c667d83c148a5b1b284f327e79d357e7bcb757cafa0794f4015b6a",
          tryStatements: 1,
        },
        {
          catchBodies: ["rejectedSnapshotFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "ForOfStatement",
          containerStatements: 13,
          failureHolder:
            "letrejectedSnapshotFailure:ICommitLockFixtureFailure|undefined;",
          finallyDigest:
            "b7fef65508a07970fcf188946a5c2494e276ef7b2a52fdc9ff9f70f5ca8e71e1",
          finallyStatements: 1,
          finallySubstantive: {
            digest:
              "0c9edf2618b0d5c81298eaaee04d6655bcdc6e5b6830bf33d0e2943a443364e4",
            tokens: 50,
          },
          index: 10,
          substantive: {
            digest:
              "e40ed689023450420ad65c5771e181f5eb103cae212a60d9f2274e8a8a1f605c",
            tokens: 7,
          },
          tryBody: "{releaseCommitLock(lockPath,token);}",
          tryDigest:
            "2c3763daec6074aa494de2c5627c75a1e98c8b25fd3059e9c93c005051e534fa",
          tryStatements: 1,
        },
        {
          catchBodies: ["quarantineRecoveryFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "ForOfStatement",
          containerStatements: 27,
          failureHolder:
            "letquarantineRecoveryFailure:ICommitLockFixtureFailure|undefined;",
          finallyDigest:
            "ecb2d67fe7cb73e7f8fdbe9472b0b81b12c81212627802c9281465fdd70ccffc",
          finallyStatements: 1,
          finallySubstantive: {
            digest:
              "d4bf02fcaf126eed1fd6f2331804e448b5e81e714dc2e856e5f489441e92120d",
            tokens: 113,
          },
          index: 19,
          substantive: {
            digest:
              "e40ed689023450420ad65c5771e181f5eb103cae212a60d9f2274e8a8a1f605c",
            tokens: 7,
          },
          tryBody: "{releaseCommitLock(lockPath,token);}",
          tryDigest:
            "2c3763daec6074aa494de2c5627c75a1e98c8b25fd3059e9c93c005051e534fa",
          tryStatements: 1,
        },
      ],
      parseDiagnostics: [],
      policy: {
        bodies: [
          '{constcleanupFailures:Array<{error:unknown;resource:string}>=[];for(constresourceofresources)try{resource.cleanup();}catch(error){cleanupFailures.push({error,resource:resource.resource});}if(cleanupFailures.length===1&&failure===undefined)throwcleanupFailures[0]!.error;if(cleanupFailures.length!==0)thrownewCommitLockHookCleanupError([...(failure===undefined?[]:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`Commit-lockhookcleanupfailed${failure===undefined?"":"afterthetestfailed"}:${cleanupFailures.map((entry)=>entry.resource).join(",")}.`,);}',
        ],
        classes: ["AggregateError"],
        count: 1,
        parameters: [
          [
            "failure:ICommitLockFixtureFailure|undefined",
            "resources:readonlyICommitLockHookCleanup[]",
          ],
        ],
      },
    },
  );
};
