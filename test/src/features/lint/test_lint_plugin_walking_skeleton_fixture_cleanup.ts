import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveLintFixtureCleanup } from "./test_lint_plugin_walking_skeleton";

const compact = (node: ts.Node, source: ts.SourceFile): string =>
  node.getText(source).replace(/\s+/g, "");

const digest = (node: ts.Node, source: ts.SourceFile): string =>
  createHash("sha256").update(node.getText(source)).digest("hex");

/**
 * Every walking-skeleton run that disposes its fixture through the file's own
 * protected policy.
 *
 * Both guarded bodies do real work that can fail -- a fixture mutation and a
 * packaged toolchain process -- so the lint diagnostic they exist to report
 * must survive a disposal failure rather than be replaced by it.
 */
export const lintFixtureDisposalContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_lint_plugin_walking_skeleton.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const lifecycles: Array<{
    catchBodies: string[];
    finallyBodies: string[];
    tryDigest: string;
  }> = [];
  const protectedDisposal = (block: ts.Block): boolean => {
    if (block.statements.length !== 1) return false;
    const statement = block.statements[0];
    return (
      statement !== undefined &&
      ts.isExpressionStatement(statement) &&
      ts.isCallExpression(statement.expression) &&
      ts.isIdentifier(statement.expression.expression) &&
      statement.expression.expression.text === "preserveLintFixtureCleanup" &&
      statement.expression.arguments.length === 2 &&
      compact(statement.expression.arguments[1]!, source) ===
        "()=>{fixture.cleanup();}"
    );
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isTryStatement(node) &&
      node.catchClause !== undefined &&
      node.finallyBlock !== undefined &&
      protectedDisposal(node.finallyBlock)
    )
      lifecycles.push({
        catchBodies: node.catchClause.block.statements.map((statement) =>
          compact(statement, source),
        ),
        finallyBodies: node.finallyBlock.statements.map((statement) =>
          compact(statement, source),
        ),
        tryDigest: digest(node.tryBlock, source),
      });
    ts.forEachChild(node, visit);
  };
  visit(source);
  return {
    count: lifecycles.length,
    lifecycles,
    // No run may dispose its fixture as a bare statement again.
    rawFinalizers: [...text.matchAll(/finally\s*\{\s*fixture\.cleanup\(/gu)]
      .length,
  };
};

const capture = (props: {
  cleanupFailure?: { error: unknown; present: true };
  primaryFailure?: { error: unknown; present: true };
}): { attempted: boolean; caught: boolean; failure: unknown } => {
  let attempted = false;
  let caught = false;
  let failure: unknown;
  try {
    preserveLintFixtureCleanup(
      props.primaryFailure === undefined
        ? undefined
        : { error: props.primaryFailure.error },
      () => {
        attempted = true;
        if (props.cleanupFailure !== undefined)
          throw props.cleanupFailure.error;
      },
    );
    if (props.primaryFailure !== undefined) throw props.primaryFailure.error;
  } catch (error) {
    caught = true;
    failure = error;
  }
  return { attempted, caught, failure };
};

export const test_lint_plugin_walking_skeleton_fixture_cleanup = (): void => {
  const primaryFailure = { phase: "lint run failure" };
  const disposalFailure = { phase: "fixture disposal failure" };
  const success = capture({});
  const primaryOnly = capture({
    primaryFailure: { error: primaryFailure, present: true },
  });
  const standalone = capture({
    cleanupFailure: { error: disposalFailure, present: true },
  });
  const combined = capture({
    cleanupFailure: { error: disposalFailure, present: true },
    primaryFailure: { error: primaryFailure, present: true },
  });
  const undefinedPrimary = capture({
    primaryFailure: { error: undefined, present: true },
  });
  TestValidator.predicate(
    "a fixture disposal never replaces the lint failure it guarded",
    success.attempted &&
      success.caught === false &&
      primaryOnly.caught &&
      primaryOnly.failure === primaryFailure &&
      standalone.caught &&
      standalone.failure === disposalFailure &&
      combined.caught &&
      combined.failure instanceof AggregateError &&
      combined.failure.errors.length === 2 &&
      combined.failure.errors[0] === primaryFailure &&
      combined.failure.errors[1] === disposalFailure &&
      undefinedPrimary.caught &&
      undefinedPrimary.failure === undefined,
  );
  TestValidator.equals(
    "the walking skeleton disposes every fixture through the policy",
    lintFixtureDisposalContract(
      fs.readFileSync(
        path.join(__dirname, "test_lint_plugin_walking_skeleton.ts"),
        "utf8",
      ),
    ),
    CONTRACT,
  );
};

const CONTRACT = {
  count: 2,
  lifecycles: [
    {
      catchBodies: ["scaffoldRunFailure={error};", "throwerror;"],
      finallyBodies: [
        "preserveLintFixtureCleanup(scaffoldRunFailure,()=>{fixture.cleanup();});",
      ],
      tryDigest:
        "729612cb750ff0f834b488f6e12ded9dc42b21c0786846e7c5b29b4a53da7921",
    },
    {
      catchBodies: ["fixtureRunFailure={error};", "throwerror;"],
      finallyBodies: [
        "preserveLintFixtureCleanup(fixtureRunFailure,()=>{fixture.cleanup();});",
      ],
      tryDigest:
        "78e71ba785848b00b027207307138b2f3fa9311848a201656c3e56e1f3db4353",
    },
  ],
  rawFinalizers: 0,
};
