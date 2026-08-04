import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveProjectManifestRaceCleanup } from "./test_mcp_project_manifest";

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

const projectManifestRaceCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_mcp_project_manifest.ts",
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
        "preserveProjectManifestRaceCleanup(",
      ) &&
      (compact(node.finallyBlock, source).match(/resource:/g)?.length ?? 0) >
        1 &&
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
        substantive: leafTokenContract(node.tryBlock.statements, source),
        tryBody: compact(node.tryBlock, source),
        tryDigest: digestText(node.tryBlock.getText(source)),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  const policies = arrows.filter(
    (entry) => entry.name === "preserveProjectManifestRaceCleanup",
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
        statement.name?.text === "ProjectManifestRaceCleanupError"
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
      preserveProjectManifestRaceCleanup(
        primaryState,
        Array.from({ length: props.resources ?? 4 }, (_, index) => ({
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

export const test_mcp_project_manifest_race_cleanup = (): void => {
  const primaryFailure = { phase: "project-manifest race" };
  const hookFailure = { phase: "hook restoration" };
  const residentFailure = { phase: "parked resident restoration" };
  const cleanupFailures = [
    { error: hookFailure, present: true as const },
    undefined,
    undefined,
    { error: residentFailure, present: true as const },
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
  const fullOrder = "cleanup-0,cleanup-1,cleanup-2,cleanup-3";
  TestValidator.predicate(
    "project-manifest race cleanup preserves failure and resource order",
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
        residentFailure,
      ]) &&
      multiple.message.includes("resource-0") &&
      multiple.message.includes("resource-3") &&
      multiple.message.includes("resource-1") === false &&
      multiple.message.includes("resource-2") === false &&
      multiple.order.join(",") === fullOrder &&
      combined.caught &&
      aggregateContainsExactly(combined.failure, [
        primaryFailure,
        hookFailure,
        residentFailure,
      ]) &&
      combined.order.join(",") === fullOrder &&
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
    "project-manifest test owns two nested race cleanup lifecycles",
    projectManifestRaceCleanupContract(
      fs.readFileSync(
        path.join(__dirname, "test_mcp_project_manifest.ts"),
        "utf8",
      ),
    ),
    {
      lifecycles: [
        {
          catchBodies: ["manifestRaceFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 49,
          failureHolder:
            "letmanifestRaceFailure:IProjectManifestFixtureFailure|undefined;",
          finallyDigest:
            "eab88df64a8034876dcae5273c8630aa7b87c5c7bc2b8e2e8befffa8eaa6e897",
          finallySubstantive: {
            digest:
              "53de6d7a6e941838212eec2a46438a586dde90ba2bdde83f90fe4fca03b4edba",
            tokens: 116,
          },
          index: 15,
          substantive: {
            digest:
              "e04a72241efdfebfe56c30d9328452166dd0db0ec01339c7383b389b556c45c9",
            tokens: 22,
          },
          tryBody:
            '{manifestSwapRejected=throwsError(()=>AutoMovieProject.open(root),["changedphysicalidentity","automovie.json"],);}',
          tryDigest:
            "866cdb7241710664c0494fb656c7c18e943e2639b13e1f37de21d3e8c6d40538",
        },
        {
          catchBodies: ["optionalRaceFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 49,
          failureHolder:
            "letoptionalRaceFailure:IProjectManifestFixtureFailure|undefined;",
          finallyDigest:
            "32dd9b4a8502ea503c5383db80a7a461357795c4f980192c7e49bc52a4cc12e6",
          finallySubstantive: {
            digest:
              "9dd932e6d666f84baff7b362d8239df441e92b322398b6d147ce98b4035ba671",
            tokens: 126,
          },
          index: 42,
          substantive: {
            digest:
              "e59cfacd6f929b9eb55769ede167c4dc73b4ff8c1cd6adc4f6e77ba853ee0fa6",
            tokens: 22,
          },
          tryBody:
            '{optionalSwapRejected=throwsError(()=>AutoMovieProject.open(optionalRoot),["changedphysicalidentity","optional-root-race"],);}',
          tryDigest:
            "f707498d92f6fb53b4753087c1aa957a16d5dbc30fe3ec74900a058026b0769f",
        },
      ],
      parseDiagnostics: [],
      policy: {
        bodies: [
          "{constcleanupFailures:Array<{error:unknown;resource:string}>=[];for(constresourceofresources)try{resource.cleanup();}catch(error){cleanupFailures.push({error,resource:resource.resource});}if(cleanupFailures.length===1&&failure===undefined)throwcleanupFailures[0]!.error;if(cleanupFailures.length!==0)thrownewProjectManifestRaceCleanupError([...(failure===undefined?[]:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`Project-manifestracecleanupfailed$" +
            '{failure===undefined?"":"aftertheracefailed"}:$' +
            '{cleanupFailures.map((entry)=>entry.resource).join(",")}.`,);}',
        ],
        classes: ["AggregateError"],
        count: 1,
        parameters: [
          [
            "failure:IProjectManifestFixtureFailure|undefined",
            "resources:readonlyIProjectManifestRaceCleanup[]",
          ],
        ],
      },
    },
  );
};
