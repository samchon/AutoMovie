import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript-compiler";

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

const captureLaunchCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "capturelaunchboundarysnapshot",
    "capturerejectedlaunchsnapshot",
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
  const visit = (node: ts.Node): void => {
    if (
      ts.isTryStatement(node) &&
      node.catchClause !== undefined &&
      node.finallyBlock !== undefined &&
      anchors.some((anchor) =>
        compact(node.finallyBlock!, source).includes(anchor),
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
        finallyDigest: digestText(node.finallyBlock.getText(source)),
        finallySubstantive: leafTokenContract(
          node.finallyBlock.statements,
          source,
        ),
        index,
        preceding: statements
          .slice(Math.max(0, index - 2), index)
          .map((statement) => compact(statement, source)),
        substantive: leafTokenContract(node.tryBlock.statements, source),
        tryBody: compact(node.tryBlock, source),
        tryDigest: digestText(node.tryBlock.getText(source)),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return {
    lifecycles,
    parseDiagnostics: source.parseDiagnostics.map((diagnostic) =>
      String(diagnostic.messageText),
    ),
  };
};

export const test_cli_scaffold_capture_launch_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns two capture launch cleanup lifecycles",
    captureLaunchCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: [
            "launchBoundaryRejected=true;",
            "launchBoundaryCleanupFailure={error};",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1934,
          finallyDigest:
            "5e9526da18da593cbb6793a558dc5b7ab5e3064d51dc99ab0170422d8e237561",
          finallySubstantive: {
            digest:
              "1b0bd2ab48ea5e92dc27facfc7611dab7baad21b5ebc5c575ba1d815ec2693cd",
            tokens: 83,
          },
          index: 541,
          preceding: [
            "letlaunchBoundaryRejected=false;",
            "letlaunchBoundaryCleanupFailure:{error:unknown}|undefined;",
          ],
          substantive: {
            digest:
              "667389d46dd1cfe0d30539d4a453453a0183311c2cef94c5b0bfcc366eedbcfb",
            tokens: 56,
          },
          tryBody:
            '{awaitcaptureBrowserModule.launchWithCaptureExecutableSnapshot({snapshot:launchBoundarySnapshot,launch:async()=>{fs.renameSync(launchExecutable,parkedLaunchExecutable);fs.writeFileSync(launchExecutable,captureExecutableBytes);return"opened";},close:async()=>{rejectedLaunchClosed=true;},});}',
          tryDigest:
            "fd08e08af435461868cade993070054eed8ff08f5ba1f065c78815c64c1960e3",
        },
        {
          catchBodies: [
            "failedLaunchCleanupError=error;",
            "failedLaunchHarnessCleanupFailure={error};",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1934,
          finallyDigest:
            "d9584d9210c82b23ee5ff644144239fe5c33de67eecb7a15dfc732479b382514",
          finallySubstantive: {
            digest:
              "b075f9c2595f59cccd895f155d7ab0017db5ef973f0d148b7b22466447db462a",
            tokens: 83,
          },
          index: 548,
          preceding: [
            "letfailedLaunchCleanupError:unknown;",
            "letfailedLaunchHarnessCleanupFailure:{error:unknown}|undefined;",
          ],
          substantive: {
            digest:
              "9664558d8493f380ca393194a0d516e14583aa769b8b82fa2c3ba050aa1bd251",
            tokens: 55,
          },
          tryBody:
            '{awaitcaptureBrowserModule.launchWithCaptureExecutableSnapshot({snapshot:failedLaunchCleanupSnapshot,launch:async()=>{fs.renameSync(launchExecutable,failedLaunchCleanupParked);fs.writeFileSync(launchExecutable,captureExecutableBytes);return"opened";},close:async()=>{throwlaunchCleanupFailure;},});}',
          tryDigest:
            "e69378525ad6b070a5d3d5941bfb54e74c467ab171abe5d54483a2e0f18a93f1",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
