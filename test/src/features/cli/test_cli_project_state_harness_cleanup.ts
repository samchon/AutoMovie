import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveProjectStateHarnessCleanup } from "./test_cli_project_state";

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

const enclosingArrowName = (node: ts.Node): string | undefined => {
  for (let cursor: ts.Node | undefined = node.parent; cursor !== undefined; ) {
    if (ts.isArrowFunction(cursor)) {
      const declaration = cursor.parent;
      return ts.isVariableDeclaration(declaration) &&
        ts.isIdentifier(declaration.name)
        ? declaration.name.text
        : undefined;
    }
    cursor = cursor.parent;
  }
  return undefined;
};

const projectStateHarnessCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_project_state.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const arrows: Array<{ arrow: ts.ArrowFunction; name: string }> = [];
  const lifecycles: Array<{
    catchBodies: string[];
    catchVariables: string[];
    containerKind: string;
    containerStatements: number;
    failureHolder: string;
    finallyDigest: string;
    finallySubstantive: { digest: string; tokens: number };
    index: number;
    owner: string | undefined;
    substantive: { digest: string; tokens: number };
    tryBody: string;
    tryDigest: string;
  }> = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer !== undefined &&
      ts.isArrowFunction(node.initializer)
    )
      arrows.push({ arrow: node.initializer, name: node.name.text });
    if (
      ts.isTryStatement(node) &&
      node.catchClause !== undefined &&
      node.finallyBlock !== undefined &&
      compact(node.finallyBlock, source).includes(
        "preserveProjectStateHarnessCleanup(",
      ) &&
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
        containerKind: ts.SyntaxKind[node.parent.parent.kind]!,
        containerStatements: statements.length,
        failureHolder: compact(statements[index - 1]!, source),
        finallyDigest: digestText(node.finallyBlock.getText(source)),
        finallySubstantive: leafTokenContract(
          node.finallyBlock.statements,
          source,
        ),
        index,
        owner: enclosingArrowName(node),
        substantive: leafTokenContract(node.tryBlock.statements, source),
        tryBody: compact(node.tryBlock, source),
        tryDigest: digestText(node.tryBlock.getText(source)),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const policies = arrows.filter(
    (entry) => entry.name === "preserveProjectStateHarnessCleanup",
  );
  return {
    lifecycles,
    parseDiagnostics: (
      source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics.map((diagnostic) => String(diagnostic.messageText)),
    policy: {
      bodies: policies.map((entry) => compact(entry.arrow.body, source)),
      classes: source.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "ProjectStateHarnessCleanupError"
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
}): { caught: boolean; failure: unknown; message: string; order: string[] } => {
  let caught = false;
  let failure: unknown;
  let message = "";
  const order: string[] = [];
  let primaryState: { error: unknown } | undefined;
  try {
    try {
      if (props.primaryFailure !== undefined) throw props.primaryFailure.error;
    } catch (error) {
      primaryState = { error };
      throw error;
    } finally {
      preserveProjectStateHarnessCleanup(
        primaryState,
        Array.from({ length: props.resources ?? 2 }, (_, index) => ({
          resource: `resource-${index}`,
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
    if (error instanceof Error) message = error.message;
  }
  return { caught, failure, message, order };
};

export const test_cli_project_state_harness_cleanup = (): void => {
  const primaryFailure = { phase: "project-state read" };
  const hookFailure = { phase: "prototype restoration" };
  const sourceFailure = { phase: "source restoration" };
  const cleanupFailures = [
    { error: hookFailure, present: true as const },
    { error: sourceFailure, present: true as const },
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
  const selective = captureCleanup({
    cleanupFailures: [cleanupFailures[0], undefined, cleanupFailures[1]],
    resources: 3,
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
  const fullOrder = "cleanup-0,cleanup-1";
  TestValidator.predicate(
    "project-state harness cleanup preserves failure and restoration order",
    success.caught === false &&
      success.failure === undefined &&
      success.order.join(",") === fullOrder &&
      primaryOnly.caught &&
      primaryOnly.failure === primaryFailure &&
      primaryOnly.order.join(",") === fullOrder &&
      standalone.caught &&
      standalone.failure === hookFailure &&
      standalone.order.join(",") === fullOrder &&
      multiple.caught &&
      aggregateContainsExactly(multiple.failure, [
        hookFailure,
        sourceFailure,
      ]) &&
      multiple.order.join(",") === fullOrder &&
      combined.caught &&
      aggregateContainsExactly(combined.failure, [
        primaryFailure,
        hookFailure,
        sourceFailure,
      ]) &&
      combined.order.join(",") === fullOrder &&
      selective.caught &&
      aggregateContainsExactly(selective.failure, [
        hookFailure,
        sourceFailure,
      ]) &&
      selective.message.includes("resource-0") &&
      selective.message.includes("resource-2") &&
      selective.message.includes("resource-1") === false &&
      selective.order.join(",") === "cleanup-0,cleanup-1,cleanup-2" &&
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
    "project-state test owns two multi-resource harness lifecycles",
    projectStateHarnessCleanupContract(
      fs.readFileSync(
        path.join(__dirname, "test_cli_project_state.ts"),
        "utf8",
      ),
    ),
    {
      lifecycles: [
        {
          catchBodies: ["manifestReadFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "ArrowFunction",
          containerStatements: 4,
          failureHolder:
            "letmanifestReadFailure:IProjectStateFixtureFailure|undefined;",
          finallyDigest:
            "644521c0cccbffa7e6fb0b5f6760a89a2ccaf9eb72179ed6ba3e6a1d4648d410",
          finallySubstantive: {
            digest:
              "b9555e54aeb5c13fc329a3cf244cdecd39aeccdb5dd373b002480a95dce3f041",
            tokens: 54,
          },
          index: 3,
          owner: "withManifest",
          substantive: {
            digest:
              "96d50c9c36707ec7083b5e92f052acce7b59aaadf1c8bb109ab6351db4606b9e",
            tokens: 12,
          },
          tryBody: "{returnloadAutoMovieProjectState({root:fixture.root});}",
          tryDigest:
            "f133edf862c958ec85ba202489835295546201013005165d1f5a9395eb473297",
        },
        {
          catchBodies: ["sourceRaceFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 84,
          failureHolder:
            "letsourceRaceFailure:IProjectStateFixtureFailure|undefined;",
          finallyDigest:
            "86941266065f9c83ae23b50552b109a1b1b2a0fc9220f6b8ce54cac829fc1dca",
          finallySubstantive: {
            digest:
              "2ca5132d1d8338d32a350f839e514544ba0d4deabb7cf50a31a28ca2b9862e48",
            tokens: 55,
          },
          index: 74,
          owner: "test_cli_project_state",
          substantive: {
            digest:
              "840e851c478a359c5910eef4d42376caa8123a3bdaaee6dea1d5e9cc595f88cd",
            tokens: 13,
          },
          tryBody: "{raced=loadAutoMovieProjectState({root:fixture.root});}",
          tryDigest:
            "7efd80e21ca22e83bd0fd49818d23ddaeb5f7d6fdbb0bcc31eb8ac46ac27deb0",
        },
      ],
      parseDiagnostics: [],
      policy: {
        bodies: [
          "{constcleanupFailures:Array<{error:unknown;resource:string}>=[];for(constresourceofresources)try{resource.cleanup();}catch(error){cleanupFailures.push({error,resource:resource.resource});}if(cleanupFailures.length===1&&failure===undefined)throwcleanupFailures[0]!.error;if(cleanupFailures.length!==0)thrownewProjectStateHarnessCleanupError([...(failure===undefined?[]:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`Project-stateharnesscleanupfailed$" +
            '{failure===undefined?"":"afterthestatereadfailed"}:$' +
            '{cleanupFailures.map((entry)=>entry.resource).join(",")}.`,);}',
        ],
        classes: ["AggregateError"],
        count: 1,
        parameters: [
          [
            "failure:IProjectStateFixtureFailure|undefined",
            "resources:readonlyIProjectStateHarnessCleanup[]",
          ],
        ],
      },
    },
  );
};
