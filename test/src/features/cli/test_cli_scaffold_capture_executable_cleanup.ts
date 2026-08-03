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

const captureExecutableCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "captureexecutablelstathook",
    "capturecreateopenhook",
    "captureopenopenhook",
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

export const test_cli_scaffold_capture_executable_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns three capture executable cleanup lifecycles",
    captureExecutableCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: [
            "captureExecutableRaceCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1982,
          finallyDigest:
            "5100831c7000fbbf0c6603b92aeaeffe1aede7de5457aa6d0518512f2256346d",
          finallySubstantive: {
            digest:
              "456e4b22c56a35e3053064578a41b4d87d53b30cc85b594e6d956819a0b0fbc4",
            tokens: 77,
          },
          index: 406,
          preceding: [
            "letcaptureExecutableRaceRejected=false;",
            "letcaptureExecutableRaceCleanupFailure:{error:unknown}|undefined;",
          ],
          substantive: {
            digest:
              "6a7668d286e6988d3678f5906f9340ca5dacb20e9f7b425f0fdd66fa41aeed09",
            tokens: 16,
          },
          tryBody:
            "{captureExecutableRaceRejected=throws(()=>captureExecutableModule.openCaptureExecutable(captureExecutable),);}",
          tryDigest:
            "fe5c113f4151f76dba679d2fcb21020192c20483f34e7193968e005f91c768b6",
        },
        {
          catchBodies: [
            "combinedCreateSnapshotFailure=error;",
            "createSnapshotHookCleanupFailure={error};",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1982,
          finallyDigest:
            "54cdb4ca3530328b7a7d4e95d164d3a245b220f00e3ca496072966ad30f72281",
          finallySubstantive: {
            digest:
              "740dc3dd13a751fabefd4b899160f45c032519062963edb4dce587c44fb005ee",
            tokens: 71,
          },
          index: 418,
          preceding: [
            "letcombinedCreateSnapshotFailure:unknown;",
            "letcreateSnapshotHookCleanupFailure:{error:unknown}|undefined;",
          ],
          substantive: {
            digest:
              "0866d55589c8805e1424e143d3ea088f25993fa3a5bd3d08dcd98b7a97f8bce5",
            tokens: 15,
          },
          tryBody:
            '{captureExecutableModule.createCaptureExecutableSnapshot(failedCaptureExecutableCreation,Buffer.from("creationbytes"),);}',
          tryDigest:
            "0258333cc547b548e9000d8a1c549766ec3afb5224c57cad515ed62f6e52cfe3",
        },
        {
          catchBodies: [
            "combinedOpenSnapshotFailure=error;",
            "openSnapshotHookCleanupFailure={error};",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1982,
          finallyDigest:
            "5810c3e1cbfda3e81e79c603736baf1c7f9405e98b31a71b73e27015bdccfe20",
          finallySubstantive: {
            digest:
              "bafea6c45938fd60c310c16a00f35299ab4ce299b840bf61560bc674af8b8cb4",
            tokens: 71,
          },
          index: 430,
          preceding: [
            "letcombinedOpenSnapshotFailure:unknown;",
            "letopenSnapshotHookCleanupFailure:{error:unknown}|undefined;",
          ],
          substantive: {
            digest:
              "0bf2484b01a795dee73b77cfae51d12e388402c447289aae4eab8ee1c9f4389c",
            tokens: 8,
          },
          tryBody:
            "{captureExecutableModule.openCaptureExecutable(failedCaptureExecutableOpen,);}",
          tryDigest:
            "088db12daa29366e0ba119664263516a8b69abba04bf86e59b257ff0b113350a",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
