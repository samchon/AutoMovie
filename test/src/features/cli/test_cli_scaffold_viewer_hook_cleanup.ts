import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

import { preserveCliHarnessCleanup } from "./CliHarnessCleanup";

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

const viewerHookCleanupContract = (
  scaffoldText: string,
  policyText: string,
): unknown => {
  const scaffold = ts.createSourceFile(
    "test_cli_scaffold.ts",
    scaffoldText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const policy = ts.createSourceFile(
    "CliHarnessCleanup.ts",
    policyText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "viewerstandaloneopenhook",
    "viewerprimary-onlyopenhook",
    "viewercombinedopenhook",
  ];
  const lifecycles: Array<{
    catchBodies: string[];
    catchVariables: string[];
    containerKind: string;
    containerStatements: number;
    finallyDigest: string;
    finallySubstantive: { digest: string; tokens: number };
    index: number;
    preceding: string[];
    substantive: { digest: string; tokens: number };
    tryBody: string;
    tryDigest: string;
  }> = [];
  const visitScaffold = (node: ts.Node): void => {
    if (
      ts.isTryStatement(node) &&
      node.catchClause !== undefined &&
      node.finallyBlock !== undefined &&
      anchors.some((anchor) =>
        compact(node.finallyBlock!, scaffold).includes(anchor),
      ) &&
      ts.isBlock(node.parent)
    ) {
      const statements = [...node.parent.statements];
      const index = statements.indexOf(node);
      lifecycles.push({
        catchBodies: node.catchClause.block.statements.map((statement) =>
          compact(statement, scaffold),
        ),
        catchVariables:
          node.catchClause.variableDeclaration === undefined
            ? []
            : [compact(node.catchClause.variableDeclaration, scaffold)],
        containerKind: ts.SyntaxKind[node.parent.parent.kind]!,
        containerStatements: statements.length,
        finallyDigest: digestText(node.finallyBlock.getText(scaffold)),
        finallySubstantive: leafTokenContract(
          node.finallyBlock.statements,
          scaffold,
        ),
        index,
        preceding: statements
          .slice(Math.max(0, index - 2), index)
          .map((statement) => compact(statement, scaffold)),
        substantive: leafTokenContract(node.tryBlock.statements, scaffold),
        tryBody: compact(node.tryBlock, scaffold),
        tryDigest: digestText(node.tryBlock.getText(scaffold)),
      });
    }
    ts.forEachChild(node, visitScaffold);
  };
  visitScaffold(scaffold);

  const policies: ts.ArrowFunction[] = [];
  const visitPolicy = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "preserveCliHarnessCleanup" &&
      node.initializer !== undefined &&
      ts.isArrowFunction(node.initializer)
    )
      policies.push(node.initializer);
    ts.forEachChild(node, visitPolicy);
  };
  visitPolicy(policy);

  return {
    lifecycles,
    parseDiagnostics: [
      ...scaffold.parseDiagnostics,
      ...policy.parseDiagnostics,
    ].map((diagnostic) => String(diagnostic.messageText)),
    policy: {
      bodies: policies.map((arrow) => compact(arrow.body, policy)),
      classes: policy.statements.flatMap((statement) =>
        ts.isClassDeclaration(statement) &&
        statement.name?.text === "CliHarnessCleanupError"
          ? (statement.heritageClauses ?? []).flatMap((clause) =>
              clause.types.map((type) => compact(type, policy)),
            )
          : [],
      ),
      count: policies.length,
      parameters: policies.map((arrow) =>
        arrow.parameters.map((parameter) => compact(parameter, policy)),
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
      preserveCliHarnessCleanup(
        primaryState,
        Array.from({ length: props.resources ?? 3 }, (_, index) => ({
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

export const test_cli_scaffold_viewer_hook_cleanup = (): void => {
  const primaryFailure = { phase: "viewer descriptor read" };
  const openFailure = { phase: "open hook restoration" };
  const closeFailure = { phase: "close hook restoration" };
  const cleanupFailures = [
    { error: openFailure, present: true as const },
    undefined,
    { error: closeFailure, present: true as const },
  ];
  const success = captureCleanup({});
  const primaryOnly = captureCleanup({
    primaryFailure: { error: primaryFailure, present: true },
  });
  const standalone = captureCleanup({
    cleanupFailures: [undefined, cleanupFailures[2]],
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
    cleanupFailures: [undefined, { error: undefined, present: true }],
  });
  const undefinedCombined = captureCleanup({
    cleanupFailures: [undefined, { error: undefined, present: true }],
    primaryFailure: { error: undefined, present: true },
  });
  const fullOrder = "cleanup-0,cleanup-1,cleanup-2";
  TestValidator.predicate(
    "viewer hook cleanup preserves failure, resource, and restoration order",
    success.caught === false &&
      success.failure === undefined &&
      success.order.join(",") === fullOrder &&
      primaryOnly.caught &&
      primaryOnly.failure === primaryFailure &&
      primaryOnly.order.join(",") === fullOrder &&
      standalone.caught &&
      standalone.failure === closeFailure &&
      standalone.order.join(",") === fullOrder &&
      multiple.caught &&
      aggregateContainsExactly(multiple.failure, [openFailure, closeFailure]) &&
      multiple.message.includes("resource-0") &&
      multiple.message.includes("resource-2") &&
      multiple.message.includes("resource-1") === false &&
      multiple.order.join(",") === fullOrder &&
      combined.caught &&
      aggregateContainsExactly(combined.failure, [
        primaryFailure,
        openFailure,
        closeFailure,
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
    "CLI scaffold owns three viewer descriptor hook cleanup lifecycles",
    viewerHookCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
      fs.readFileSync(path.join(__dirname, "CliHarnessCleanup.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: [
            "standaloneViewerCloseError=error;",
            "standaloneViewerHookFailure={error};",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1895,
          finallyDigest:
            "40f6224d5b4058fe8a8510ac327836f74585d357c65595d456d61e1ac301e77f",
          finallySubstantive: {
            digest:
              "da28e44721da177d69418d0ca8d298885c52b42c759551e633a461234477effc",
            tokens: 50,
          },
          index: 42,
          preceding: [
            "letstandaloneViewerCloseError:unknown;",
            "letstandaloneViewerHookFailure:{error:unknown}|undefined;",
          ],
          substantive: {
            digest:
              "00499b68760399690753a70f5a6b710e9194b39bca6acd98ebd764996433e410",
            tokens: 22,
          },
          tryBody:
            "{generatedModule.readPhysicalFileSnapshot(viewerRoot,path.dirname(artifact),path.basename(artifact),);}",
          tryDigest:
            "9645969e42272c45803757d7dbc7926d6c2ae50ada0655c1daa6bf54c7d3c315",
        },
        {
          catchBodies: [
            "preservedPrimaryOnlyViewerFailure=error;",
            "primaryOnlyViewerHookFailure={error};",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1895,
          finallyDigest:
            "58efab235de1dc652eca4e91a5a4d17d335caae43408293457d99ea50204a4b5",
          finallySubstantive: {
            digest:
              "4c8f4a749bfa5695b4a4cfb9bb973d0df459ef207d258c4e306cc171a77a8331",
            tokens: 50,
          },
          index: 49,
          preceding: [
            "letpreservedPrimaryOnlyViewerFailure:unknown;",
            "letprimaryOnlyViewerHookFailure:{error:unknown}|undefined;",
          ],
          substantive: {
            digest:
              "00499b68760399690753a70f5a6b710e9194b39bca6acd98ebd764996433e410",
            tokens: 22,
          },
          tryBody:
            "{generatedModule.readPhysicalFileSnapshot(viewerRoot,path.dirname(artifact),path.basename(artifact),);}",
          tryDigest:
            "9645969e42272c45803757d7dbc7926d6c2ae50ada0655c1daa6bf54c7d3c315",
        },
        {
          catchBodies: [
            "combinedViewerFailure=error;",
            "combinedViewerHookFailure={error};",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1895,
          finallyDigest:
            "c313cc0ec8c8adc2523e466c851a0072506afeb7c82912b1794ec278c96e0985",
          finallySubstantive: {
            digest:
              "5efb64d4ccf08110e222bae87ab0ace3c1ed09e19c7240689531de4d79c12407",
            tokens: 71,
          },
          index: 58,
          preceding: [
            "letcombinedViewerFailure:unknown;",
            "letcombinedViewerHookFailure:{error:unknown}|undefined;",
          ],
          substantive: {
            digest:
              "00499b68760399690753a70f5a6b710e9194b39bca6acd98ebd764996433e410",
            tokens: 22,
          },
          tryBody:
            "{generatedModule.readPhysicalFileSnapshot(viewerRoot,path.dirname(artifact),path.basename(artifact),);}",
          tryDigest:
            "9645969e42272c45803757d7dbc7926d6c2ae50ada0655c1daa6bf54c7d3c315",
        },
      ],
      parseDiagnostics: [],
      policy: {
        bodies: [
          '{constcleanupFailures:Array<{error:unknown;resource:string}>=[];for(constresourceofresources)try{resource.cleanup();}catch(error){cleanupFailures.push({error,resource:resource.resource});}if(cleanupFailures.length===1&&failure===undefined)throwcleanupFailures[0]!.error;if(cleanupFailures.length!==0)thrownewCliHarnessCleanupError([...(failure===undefined?[]:[failure.error]),...cleanupFailures.map((entry)=>entry.error),],`CLIharnesscleanupfailed${failure===undefined?"":"aftertheoperationfailed"}:${cleanupFailures.map((entry)=>entry.resource).join(",")}.`,);}',
        ],
        classes: ["AggregateError"],
        count: 1,
        parameters: [
          [
            "failure:ICliHarnessFailure|undefined",
            "resources:readonlyICliHarnessCleanup[]",
          ],
        ],
      },
    },
  );
};
