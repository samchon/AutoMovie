import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { namedFacts } from "../internal/predicates";
import { preserveFilmTimelineFixtureCleanup } from "./test_mcp_production_film_timeline";

const compact = (node: ts.Node, source: ts.SourceFile): string =>
  node.getText(source).replace(/\s+/g, "");

const digest = (node: ts.Node, source: ts.SourceFile): string =>
  createHash("sha256").update(node.getText(source)).digest("hex");

/**
 * Every film-timeline lifecycle that restores an injected project method
 * through the file's own protected policy.
 *
 * This file's policy takes one cleanup callback rather than a resource list, so
 * the selection is that call shape; a restoration that returns to a bare
 * statement in `finally` is caught by the raw-finalizer count instead.
 */
export const filmTimelineProtectedRestorationContract = (
  text: string,
): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_production_film_timeline.ts",
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
  const protectedRestoration = (block: ts.Block): boolean => {
    if (block.statements.length !== 1) return false;
    const statement = block.statements[0];
    return (
      statement !== undefined &&
      ts.isExpressionStatement(statement) &&
      ts.isCallExpression(statement.expression) &&
      ts.isIdentifier(statement.expression.expression) &&
      statement.expression.expression.text ===
        "preserveFilmTimelineFixtureCleanup" &&
      statement.expression.arguments.length === 2 &&
      /^\(\)=>\{project\.[A-Za-z]+=[A-Za-z_$][\w$]*;\}$/u.test(
        compact(statement.expression.arguments[1]!, source),
      )
    );
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isTryStatement(node) &&
      node.catchClause !== undefined &&
      node.finallyBlock !== undefined &&
      protectedRestoration(node.finallyBlock)
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
    // The injected generated-file reader may never be restored as a bare
    // statement again.
    rawFinalizers: [
      ...text.matchAll(/finally\s*\{\s*project\.readGeneratedFile\s*=/gu),
    ].length,
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
    preserveFilmTimelineFixtureCleanup(
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

export const test_mcp_production_film_timeline_single_resource_cleanup =
  (): void => {
    const primaryFailure = { phase: "timeline prepare regression" };
    const restorationFailure = { phase: "generated reader restoration" };
    const success = capture({});
    const primaryOnly = capture({
      primaryFailure: { error: primaryFailure, present: true },
    });
    const standalone = capture({
      cleanupFailure: { error: restorationFailure, present: true },
    });
    const combined = capture({
      cleanupFailure: { error: restorationFailure, present: true },
      primaryFailure: { error: primaryFailure, present: true },
    });
    const undefinedPrimary = capture({
      primaryFailure: { error: undefined, present: true },
    });
    TestValidator.equals(
      "a timeline restoration preserves the guarded failure first",
      namedFacts([
        ["successAttempted", () => success.attempted],
        ["successCaught", () => success.attempted && success.caught === false],
        [
          "primaryOnlyCaught",
          () =>
            success.attempted && success.caught === false && primaryOnly.caught,
        ],
        [
          "primaryOnlyFailurePrimaryFailure",
          () =>
            success.attempted &&
            success.caught === false &&
            primaryOnly.caught &&
            primaryOnly.failure === primaryFailure,
        ],
        [
          "standaloneCaught",
          () =>
            success.attempted &&
            success.caught === false &&
            primaryOnly.caught &&
            primaryOnly.failure === primaryFailure &&
            standalone.caught,
        ],
        [
          "standaloneFailureRestorationFailure",
          () =>
            success.attempted &&
            success.caught === false &&
            primaryOnly.caught &&
            primaryOnly.failure === primaryFailure &&
            standalone.caught &&
            standalone.failure === restorationFailure,
        ],
        [
          "combinedCaught",
          () =>
            success.attempted &&
            success.caught === false &&
            primaryOnly.caught &&
            primaryOnly.failure === primaryFailure &&
            standalone.caught &&
            standalone.failure === restorationFailure &&
            combined.caught,
        ],
        [
          "combinedFailureInstanceof",
          () =>
            success.attempted &&
            success.caught === false &&
            primaryOnly.caught &&
            primaryOnly.failure === primaryFailure &&
            standalone.caught &&
            standalone.failure === restorationFailure &&
            combined.caught &&
            combined.failure instanceof AggregateError,
        ],
        [
          "combinedFailureErrors",
          () =>
            success.attempted &&
            success.caught === false &&
            primaryOnly.caught &&
            primaryOnly.failure === primaryFailure &&
            standalone.caught &&
            standalone.failure === restorationFailure &&
            combined.caught &&
            combined.failure instanceof AggregateError &&
            combined.failure.errors.length === 2,
        ],
        [
          "combinedFailureErrors2",
          () =>
            success.attempted &&
            success.caught === false &&
            primaryOnly.caught &&
            primaryOnly.failure === primaryFailure &&
            standalone.caught &&
            standalone.failure === restorationFailure &&
            combined.caught &&
            combined.failure instanceof AggregateError &&
            combined.failure.errors.length === 2 &&
            combined.failure.errors[0] === primaryFailure,
        ],
        [
          "combinedFailureErrors3",
          () =>
            success.attempted &&
            success.caught === false &&
            primaryOnly.caught &&
            primaryOnly.failure === primaryFailure &&
            standalone.caught &&
            standalone.failure === restorationFailure &&
            combined.caught &&
            combined.failure instanceof AggregateError &&
            combined.failure.errors.length === 2 &&
            combined.failure.errors[0] === primaryFailure &&
            combined.failure.errors[1] === restorationFailure,
        ],
        [
          "undefinedPrimaryCaught",
          () =>
            success.attempted &&
            success.caught === false &&
            primaryOnly.caught &&
            primaryOnly.failure === primaryFailure &&
            standalone.caught &&
            standalone.failure === restorationFailure &&
            combined.caught &&
            combined.failure instanceof AggregateError &&
            combined.failure.errors.length === 2 &&
            combined.failure.errors[0] === primaryFailure &&
            combined.failure.errors[1] === restorationFailure &&
            undefinedPrimary.caught,
        ],
        [
          "undefinedPrimaryFailure",
          () =>
            success.attempted &&
            success.caught === false &&
            primaryOnly.caught &&
            primaryOnly.failure === primaryFailure &&
            standalone.caught &&
            standalone.failure === restorationFailure &&
            combined.caught &&
            combined.failure instanceof AggregateError &&
            combined.failure.errors.length === 2 &&
            combined.failure.errors[0] === primaryFailure &&
            combined.failure.errors[1] === restorationFailure &&
            undefinedPrimary.caught &&
            undefinedPrimary.failure === undefined,
        ],
      ]),
      {
        successAttempted: true,
        successCaught: true,
        primaryOnlyCaught: true,
        primaryOnlyFailurePrimaryFailure: true,
        standaloneCaught: true,
        standaloneFailureRestorationFailure: true,
        combinedCaught: true,
        combinedFailureInstanceof: true,
        combinedFailureErrors: true,
        combinedFailureErrors2: true,
        combinedFailureErrors3: true,
        undefinedPrimaryCaught: true,
        undefinedPrimaryFailure: true,
      },
    );
    TestValidator.equals(
      "film timeline protects its injected reader restoration",
      filmTimelineProtectedRestorationContract(
        fs.readFileSync(
          path.join(__dirname, "test_mcp_production_film_timeline.ts"),
          "utf8",
        ),
      ),
      CONTRACT,
    );
  };

const CONTRACT = {
  count: 1,
  lifecycles: [
    {
      catchBodies: ["invalidTimelineFailure={error};", "throwerror;"],
      finallyBodies: [
        "preserveFilmTimelineFixtureCleanup(invalidTimelineFailure,()=>{project.readGeneratedFile=residentReadGenerated;});",
      ],
      tryDigest:
        "74b54f39ec1fd0d7ca98f85d5da2055d5f3dae4dc0a4b4afa7e7a97c72ca5fc2",
    },
  ],
  rawFinalizers: 0,
};
