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

const renderLivenessCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "renderlivenesspartialopenhook",
    "renderlivenessinterleavedopenhook",
  ];
  const lifecycles: Array<{
    catchBodies: string[];
    catchVariables: string[];
    containerKind: string;
    containerStatements: number;
    finallyDigest: string;
    finallySubstantive: { digest: string; tokens: number };
    index: number;
    preceding: string;
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
        compact(node.finallyBlock!, source).toLowerCase().includes(anchor),
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
        preceding: compact(statements[index - 1]!, source),
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
    parseDiagnostics: (
      source as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics.map((diagnostic) => String(diagnostic.messageText)),
  };
};

export const test_cli_scaffold_render_liveness_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns two render liveness cleanup lifecycles",
    renderLivenessCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: ["partialLeaseCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1999,
          finallyDigest:
            "b7bc7cab73fc086fbda73971b38e2c57bcc0c460bfda572c175b97f4a11565fe",
          finallySubstantive: {
            digest:
              "b7476a2529d3f59dcddc7041fdd223898d57ddb9b12f9b71f0c5ba31d356ec32",
            tokens: 50,
          },
          index: 1076,
          preceding: "letpartialLeaseCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "1d9a93cf3d4471315e81946fc0a54ee6e3e6981a7e59787e2308b44f904877ad",
            tokens: 39,
          },
          tryBody:
            "{partialLeaseRejected=throws(()=>renderLivenessModule.acquireRenderGcLease({coordinationRoot:livenessRoot,pid:31000,processAlive:(pid)=>pid===31000,scope:livenessScope,}),);}",
          tryDigest:
            "fa0dc7f49fc44fa395bf22e1874161b8c91f71253bd94ba336c819a616185446",
        },
        {
          catchBodies: [
            "interleavedWorkerCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1999,
          finallyDigest:
            "cc05c8f86dfafe28e5dc1f3c58ccfc234ffdc8841a47b2d53fdfb5155e97c5dd",
          finallySubstantive: {
            digest:
              "a0f07e55820efa7a6704d2dc546cb4deb4864e78672b039d4bcb5d54c186e4dc",
            tokens: 57,
          },
          index: 1086,
          preceding:
            "letinterleavedWorkerCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "17f6ddbf43bcc7f2fb0b62915eb6f84579f8c960b019260a6a64a4af81a9e423",
            tokens: 47,
          },
          tryBody:
            '{interleavedWorkerRejected=throws(()=>renderLivenessModule.acquireRenderSessionLease({coordinationRoot:livenessRoot,pid:31010,processAlive:(pid)=>pid===31009||pid===31010,scope:livenessScope,tier:"proxy",}),);}',
          tryDigest:
            "e94041c7862e6fb3d54ff068941115db6eb035628b4c2a1025066eb9c713a466",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
