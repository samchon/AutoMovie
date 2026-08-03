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

const renderTemporaryCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "rendertemporarystatemkdirhook",
    "rendertemporaryparentmkdirhook",
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
    parseDiagnostics: source.parseDiagnostics.map((diagnostic) =>
      String(diagnostic.messageText),
    ),
  };
};

export const test_cli_scaffold_render_temporary_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns two render temporary cleanup lifecycles",
    renderTemporaryCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: ["temporaryStateCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1968,
          finallyDigest:
            "90a1a79a2eb0c1af7f02ecc4031a8f9e27639a80baf52a6e869aa23038a23d9d",
          finallySubstantive: {
            digest:
              "64800bffc271e38840e35828d39cd99ebbf0da33b779b1dba70a47bb366e341a",
            tokens: 29,
          },
          index: 1209,
          preceding:
            "lettemporaryStateCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "e53e03161cf5a1c021a5e7c57bd0a4aeb33eb7d3dc08861b1cf8269ebec314c6",
            tokens: 25,
          },
          tryBody:
            '{temporaryStateRejected=throws(()=>renderTemporarySnapshotModule.createRenderChunkTemporaryTree({name:"state-race",state:temporaryStateOwnership,}),);}',
          tryDigest:
            "11f42e31881305380afc9512c7b43ddc59c8fcf764162df1965fd9b680673996",
        },
        {
          catchBodies: [
            "temporaryParentCleanupFailure={error};",
            "throwerror;",
          ],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1968,
          finallyDigest:
            "34b489ed659556c93ead50ffd1390f61ce13282c4895b5ec426b2f00af0c582c",
          finallySubstantive: {
            digest:
              "89359f1160add6ffecc8c4a2db61b3c312eab1ada1ea065b39abcebb7e1c7233",
            tokens: 29,
          },
          index: 1223,
          preceding:
            "lettemporaryParentCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "2d6193ffe8d8fccdd7964519df5f614b4ac3e77ee13b219aeeec1d261abaa7b6",
            tokens: 25,
          },
          tryBody:
            '{temporaryParentRejected=throws(()=>renderTemporarySnapshotModule.createRenderChunkTemporaryTree({name:"parent-race",state:temporaryParentOwnership,}),);}',
          tryDigest:
            "7e159f51008124386750548a2c07d2ad7a49572bd5ec09df4b8ca3ae5c5e6c6e",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
