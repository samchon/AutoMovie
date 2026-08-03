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

const renderLivenessSingleCleanupContract = (text: string): unknown => {
  const source = ts.createSourceFile(
    "test_cli_scaffold.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const anchors = [
    "renderlivenessinventoryreaddirhook",
    "renderlivenessstalesuccessorrenamehook",
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

export const test_cli_scaffold_render_liveness_single_cleanup = (): void => {
  TestValidator.equals(
    "CLI scaffold owns two render liveness single-hook cleanup lifecycles",
    renderLivenessSingleCleanupContract(
      fs.readFileSync(path.join(__dirname, "test_cli_scaffold.ts"), "utf8"),
    ),
    {
      lifecycles: [
        {
          catchBodies: ["inventoryGcCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1986,
          finallyDigest:
            "7e99a8246127f0be124c61e4cf988be0a8b53c5bce324c636090f08304d9f864",
          finallySubstantive: {
            digest:
              "ba4f25b6c77a1a9b452102cfc0516203d5291838f3994163f89a5d1b6429aa85",
            tokens: 29,
          },
          index: 1094,
          preceding: "letinventoryGcCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "1430fb068c589a7b3c7b183977d4a13dd26ae79b2a2e0104d2a85f84d9f33e19",
            tokens: 36,
          },
          tryBody:
            "{inventoryGc=renderLivenessModule.acquireRenderGcLease({coordinationRoot:livenessRoot,pid:31013,processAlive:(pid)=>pid===31013||pid===31014,scope:livenessScope,});}",
          tryDigest:
            "d8ba57d31b6717e8d61fe5a66e1b58718c9e8507e0c55350af848a5d30af1bda",
        },
        {
          catchBodies: ["staleSuccessorCleanupFailure={error};", "throwerror;"],
          catchVariables: ["error"],
          containerKind: "TryStatement",
          containerStatements: 1986,
          finallyDigest:
            "336e319210c323cd757e73f05aadba6f9dee89b84030485d3affad7535f2c7ee",
          finallySubstantive: {
            digest:
              "618761dd8a19c4ae2bfa29b77e57a84f1fbc05bd55cf5cf7715ea381f9179d1c",
            tokens: 29,
          },
          index: 1128,
          preceding:
            "letstaleSuccessorCleanupFailure:{error:unknown}|undefined;",
          substantive: {
            digest:
              "4b5f927bde6252aabce49a1a390dbfcd0d5b6fd7d1c741a91a9292eb614480e9",
            tokens: 43,
          },
          tryBody:
            '{staleSuccessorRejected=throws(()=>renderLivenessModule.acquireRenderSessionLease({coordinationRoot:livenessRoot,pid:31016,processAlive:(pid)=>pid===31016,scope:livenessScope,tier:"proxy",}),);}',
          tryDigest:
            "c1428513eda6080951560796707d662638300f2d65edebc068920a9d1b7e9138",
        },
      ],
      parseDiagnostics: [],
    },
  );
};
